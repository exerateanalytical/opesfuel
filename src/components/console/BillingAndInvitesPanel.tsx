import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, CreditCard, FileText, MailPlus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { formatFcfa, formatShortDate } from '../../domain/formatters';
import { Employee, Station, UserRole } from '../../domain/types';

interface BillingAndInvitesPanelProps {
  engine: OpesFuelApiEngine;
  role: UserRole;
  stations: Station[];
  employees: Employee[];
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const BillingAndInvitesPanel: React.FC<BillingAndInvitesPanelProps> = ({
  engine,
  role,
  stations,
  employees,
  onNotify,
}) => {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([]);
  const [invites, setInvites] = useState<Array<Record<string, unknown>>>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  // Generate invoice
  const [periodLabel, setPeriodLabel] = useState(() => new Date().toISOString().slice(0, 7));

  // Pay invoice inline modal
  const [payingInvoice, setPayingInvoice] = useState<Record<string, unknown> | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payChannel, setPayChannel] = useState<'ORANGE_MONEY' | 'MTN_MOMO' | 'BANK_TRANSFER' | 'CARD'>('ORANGE_MONEY');
  const [payRef, setPayRef] = useState('');

  // Create staff invite
  const [inviteStationId, setInviteStationId] = useState(stations[0]?.id ?? '');
  const [inviteEmployeeId, setInviteEmployeeId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('MANAGER');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, invRes, staffInvRes, meRes] = await Promise.all([
        engine.fetchBillingSummary().catch(() => null),
        engine.listBillingInvoices().catch(() => []),
        engine.listStaffInvites().catch(() => []),
        engine.fetchAuthenticatedProfile().catch(() => null),
      ]);
      setSummary(sumRes);
      setInvoices(Array.isArray(invRes) ? invRes : []);
      setInvites(Array.isArray(staffInvRes) ? staffInvRes : []);
      setProfile(meRes);
    } finally {
      setLoading(false);
    }
  }, [engine]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleGenerateInvoice = async () => {
    try {
      await engine.generateBillingInvoice(periodLabel.trim() || undefined);
      onNotify('success', `Generated SaaS subscription invoice for period ${periodLabel}.`);
      await loadAll();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to generate invoice.');
    }
  };

  const handlePayInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    const invoiceId = String(payingInvoice.id || '');
    const amountFcfa = Number(payAmount) || 0;
    if (amountFcfa <= 0 || !payRef.trim()) {
      onNotify('error', 'Enter a positive FCFA payment amount and provider reference.');
      return;
    }
    try {
      await engine.payBillingInvoice(invoiceId, {
        amountFcfa,
        paymentChannel: payChannel,
        providerReference: payRef.trim(),
      });
      onNotify('success', `Recorded ${formatFcfa(amountFcfa)} payment via ${payChannel}.`);
      setPayingInvoice(null);
      setPayAmount('');
      setPayRef('');
      await loadAll();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to record invoice payment.');
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetStation = inviteStationId || stations[0]?.id;
    if (!targetStation || !inviteEmail.trim()) return;
    try {
      await engine.createStaffInvite({
        stationId: targetStation,
        ...(inviteEmployeeId ? { employeeId: inviteEmployeeId } : {}),
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      onNotify('success', `Issued Auth0 invitation for ${inviteEmail.trim()} (${inviteRole}).`);
      setInviteEmail('');
      setInviteEmployeeId('');
      await loadAll();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to create staff invite.');
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await engine.revokeStaffInvite(inviteId);
      onNotify('success', 'Revoked staff invitation.');
      await loadAll();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to revoke invite.');
    }
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/#/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
      onNotify('success', 'Copied staff invitation link to clipboard.');
    } catch {
      onNotify('success', `Invite link: ${link}`);
    }
  };

  const stationEmployees = employees.filter((e) => !inviteStationId || e.stationId === inviteStationId);

  return (
    <div className="space-y-6">
      {/* SaaS Billing Invoices & Settlement */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              SaaS Invoices &amp; Payment Settlement
            </h3>
            <p className="text-xs text-slate-500">
              Live billing ledger from <span className="font-mono">/api/v1/billing/summary</span> &amp;{' '}
              <span className="font-mono">/api/v1/billing/invoices</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
            />
            {role === 'OWNER' && (
              <button
                type="button"
                onClick={() => void handleGenerateInvoice()}
                className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                Generate Monthly Invoice
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
              aria-label="Refresh billing and invites"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-500 font-medium">Monthly Recurring Total</div>
              <div className="font-mono text-lg font-bold text-slate-900 mt-1">
                {formatFcfa(Number(summary.monthlyRecurringTotalFcfa ?? 0))}
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-500 font-medium">Outstanding Invoice Balance</div>
              <div className="font-mono text-lg font-bold text-amber-700 mt-1">
                {formatFcfa(Number(summary.outstandingBalanceFcfa ?? 0))}
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-500 font-medium">AI Copilot Add-on</div>
              <div className="font-mono text-lg font-bold text-slate-900 mt-1">
                {formatFcfa(Number(summary.aiAddonMonthlyFcfa ?? 0))} / mo
              </div>
            </div>
          </div>
        )}

        {payingInvoice && (
          <form onSubmit={(e) => void handlePayInvoice(e)} className="p-4 rounded-xl border border-amber-300 bg-amber-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-amber-700" />
                Record Payment for Invoice {String(payingInvoice.invoiceNumber || payingInvoice.id)}
              </div>
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="number"
                min={1}
                placeholder="Amount FCFA"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
              />
              <select
                value={payChannel}
                onChange={(e) => setPayChannel(e.target.value as 'ORANGE_MONEY' | 'MTN_MOMO' | 'BANK_TRANSFER' | 'CARD')}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
              >
                <option value="ORANGE_MONEY">Orange Money CM</option>
                <option value="MTN_MOMO">MTN MoMo</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CARD">Corporate Card</option>
              </select>
              <input
                type="text"
                placeholder="Transaction / MoMo Ref"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
              >
                Confirm Payment
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-semibold">Invoice #</th>
                <th className="py-2 pr-3 font-semibold">Period</th>
                <th className="py-2 pr-3 font-semibold text-right">Total (incl. VAT)</th>
                <th className="py-2 pr-3 font-semibold text-right">Paid</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-5 text-center text-slate-500">
                    No billing invoices generated yet. Click &ldquo;Generate Monthly Invoice&rdquo; above.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const total = Number(inv.totalFcfa ?? 0);
                  const paid = Number(inv.paidFcfa ?? 0);
                  const remaining = Math.max(0, total - paid);
                  const status = String(inv.status ?? 'ISSUED');
                  return (
                    <tr key={String(inv.id)}>
                      <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900">
                        {String(inv.invoiceNumber ?? inv.id)}
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{String(inv.periodLabel ?? '-')}</td>
                      <td className="py-2.5 pr-3 text-right font-mono font-semibold">{formatFcfa(total)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-emerald-700">{formatFcfa(paid)}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'PARTIAL'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        {remaining > 0 && role === 'OWNER' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayingInvoice(inv);
                              setPayAmount(String(remaining));
                              setPayRef(`MOMO-${Date.now().toString().slice(-6)}`);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold"
                          >
                            Record Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Invitations & Authenticated Identity Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <MailPlus className="w-4 h-4 text-amber-600" />
              Staff Invitations &amp; Auth0 Account Linking
            </h3>
            <p className="text-xs text-slate-500">
              Issue 7-day invitation tokens (<span className="font-mono">/api/v1/identity/invites</span>) to link station staff to their Auth0 login.
            </p>
          </div>

          <form onSubmit={(e) => void handleSendInvite(e)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <select
              value={inviteStationId}
              onChange={(e) => setInviteStationId(e.target.value)}
              className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="email"
              required
              placeholder="staff@company.cm"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
            >
              <option value="MANAGER">Manager</option>
              <option value="ATTENDANT">Attendant</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="OWNER">Owner</option>
            </select>
            <select
              value={inviteEmployeeId}
              onChange={(e) => setInviteEmployeeId(e.target.value)}
              className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
            >
              <option value="">Optional: Link Employee</option>
              {stationEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="sm:col-span-2 lg:col-span-4 py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Generate Staff Invite Token
            </button>
          </form>

          <div className="divide-y divide-slate-100 text-xs">
            {invites.length === 0 ? (
              <div className="py-4 text-center text-slate-500">No pending or historical staff invitations.</div>
            ) : (
              invites.map((inv) => {
                const token = String(inv.inviteToken ?? '');
                const status = String(inv.status ?? 'PENDING');
                return (
                  <div key={String(inv.id)} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {String(inv.email)} · <span className="font-mono text-amber-700">{String(inv.role)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {status} · expires {inv.expiresAt ? formatShortDate(String(inv.expiresAt)) : '-'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {status === 'PENDING' && token && (
                        <button
                          type="button"
                          onClick={() => void copyInviteLink(token)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 text-[11px] font-semibold text-slate-700"
                        >
                          {copiedToken === token ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                          Copy Link
                        </button>
                      )}
                      {status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => void handleRevokeInvite(String(inv.id))}
                          className="p-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50"
                          aria-label="Revoke invite"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Authenticated Identity
          </h3>
          <p className="text-xs text-slate-500">
            Live claim snapshot from <span className="font-mono">GET /api/v1/identity/me</span>
          </p>
          {profile ? (
            <dl className="space-y-2 text-xs pt-1">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Tenant ID</dt>
                <dd className="font-mono font-semibold text-slate-900 truncate">{String(profile.tenantId ?? '-')}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Auth0 Sub</dt>
                <dd className="font-mono text-slate-800 truncate">{String(profile.auth0Sub ?? '-')}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Roles</dt>
                <dd className="font-mono font-semibold text-amber-700">
                  {Array.isArray(profile.roles) ? profile.roles.join(', ') : role}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Accessible Stations</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {String(profile.accessibleStationsCount ?? stations.length)}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="text-xs text-slate-500">Profile unavailable in current session.</div>
          )}
        </div>
      </div>
    </div>
  );
};
