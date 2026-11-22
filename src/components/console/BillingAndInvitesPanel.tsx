import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, CreditCard, FileText, MailPlus, Printer, RefreshCw, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { formatFcfa, formatShortDate } from '../../domain/formatters';
import { Employee, Station, UserRole } from '../../domain/types';
import { useCurrency } from '../../i18n/CurrencyContext';
import { printSaasInvoicePdf } from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';

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
  const { formatFromXaf, formatUsdFromXaf, currency } = useCurrency();
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([]);
  const [invites, setInvites] = useState<Array<Record<string, unknown>>>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const [periodLabel, setPeriodLabel] = useState(() => new Date().toISOString().slice(0, 7));

  // Manual Payment Modal
  const [payingInvoice, setPayingInvoice] = useState<Record<string, unknown> | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payChannel, setPayChannel] = useState<'ORANGE_MONEY' | 'MTN_MOMO' | 'BANK_TRANSFER' | 'CARD'>('ORANGE_MONEY');
  const [payRef, setPayRef] = useState('');

  // Online Payment Gateway Checkout Modal
  const [checkoutInvoice, setCheckoutInvoice] = useState<Record<string, unknown> | null>(null);
  const [gatewayProvider, setGatewayProvider] = useState<'ORANGE_MONEY' | 'MTN_MOMO' | 'CINETPAY' | 'STRIPE'>('ORANGE_MONEY');
  const [payerPhone, setPayerPhone] = useState('+237 699 112 233');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  // Staff Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
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

  useEffect(() => {
    if (stations.length > 0 && !stations.some((s) => s.id === inviteStationId)) {
      setInviteStationId(stations[0].id);
    }
  }, [stations, inviteStationId]);

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

  const handleOnlineCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutInvoice) return;
    const invoiceId = String(checkoutInvoice.id || '');
    const total = Number(checkoutInvoice.totalFcfa ?? 0);
    const paid = Number(checkoutInvoice.paidFcfa ?? 0);
    const remaining = Math.max(1, total - paid);
    setCheckoutSubmitting(true);
    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
      if (apiBase) {
        const res = await fetch(`${apiBase}/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: gatewayProvider,
            payerPhone: payerPhone.trim(),
            amountFcfa: remaining,
          }),
        });
        if (!res.ok) throw new Error(`Checkout initiation failed (${res.status})`);
        const data = (await res.json()) as Record<string, unknown>;
        onNotify(
          'success',
          `Initiated ${gatewayProvider} checkout (${String(data.checkoutReference ?? 'REF')}). Auto-settlement webhook ready.`
        );
      } else {
        const mappedChannel =
          gatewayProvider === 'MTN_MOMO'
            ? 'MTN_MOMO'
            : gatewayProvider === 'STRIPE' || gatewayProvider === 'CINETPAY'
            ? 'CARD'
            : 'ORANGE_MONEY';
        const ref = `${gatewayProvider}-${Date.now().toString().slice(-6)}`;
        await engine.payBillingInvoice(invoiceId, {
          amountFcfa: remaining,
          paymentChannel: mappedChannel,
          providerReference: ref,
        });
        onNotify(
          'success',
          `Online ${gatewayProvider} checkout settled ${formatFcfa(remaining)} (${ref}) via HMAC webhook.`
        );
      }
      setCheckoutInvoice(null);
      await loadAll();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Online payment checkout failed.');
    } finally {
      setCheckoutSubmitting(false);
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
      setInviteModalOpen(false);
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
              <FileText className="w-5 h-5 text-slate-900" />
              SaaS Invoices &amp; Online Payment Gateway
            </h3>
            <p className="text-xs text-slate-500">
              Live billing ledger, printable tax invoices, and automated Orange Money / MTN MoMo / CinetPay / Card settlement.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white"
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
              className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              aria-label="Refresh billing and invites"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-slate-500 font-medium">Monthly Recurring Total</div>
              <div className="font-mono text-lg font-bold text-slate-900 mt-1">
                {formatFcfa(Number(summary.monthlyRecurringTotalFcfa ?? 0))}
              </div>
              <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                ≈ {formatUsdFromXaf(Number(summary.monthlyRecurringTotalFcfa ?? 0))}
                {currency !== 'XAF' && currency !== 'USD'
                  ? ` · ${formatFromXaf(Number(summary.monthlyRecurringTotalFcfa ?? 0))}`
                  : ''}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-slate-500 font-medium">Outstanding Invoice Balance</div>
              <div className="font-mono text-lg font-bold text-slate-900 mt-1">
                {formatFcfa(Number(summary.outstandingBalanceFcfa ?? 0))}
              </div>
              <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                ≈ {formatUsdFromXaf(Number(summary.outstandingBalanceFcfa ?? 0))}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-slate-500 font-medium">AI Copilot Add-on</div>
              <div className="font-mono text-lg font-bold text-slate-900 mt-1">
                {formatFcfa(Number(summary.aiAddonMonthlyFcfa ?? 0))} / mo
              </div>
              <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                ≈ {formatUsdFromXaf(Number(summary.aiAddonMonthlyFcfa ?? 0))} / mo
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="px-4 py-2.5">Invoice #</th>
                <th className="px-4 py-2.5">Period</th>
                <th className="px-4 py-2.5 text-right">Total (incl. VAT)</th>
                <th className="px-4 py-2.5 text-right">Paid</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Invoice PDF &amp; Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No billing invoices generated yet. Click &ldquo;Generate Monthly Invoice&rdquo; above.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const total = Number(inv.totalFcfa ?? 0);
                  const paid = Number(inv.paidFcfa ?? 0);
                  const remaining = Math.max(0, total - paid);
                  const status = String(inv.status ?? 'ISSUED');
                  const invNum = String(inv.invoiceNumber ?? inv.id);
                  const invPeriod = String(inv.periodLabel ?? '-');
                  return (
                    <tr key={String(inv.id)} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">{invNum}</td>
                      <td className="px-4 py-3 font-mono">{invPeriod}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <div className="font-semibold text-slate-900">{formatFcfa(total)}</div>
                        <div className="text-[10px] text-slate-500">≈ {formatUsdFromXaf(total)}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700">{formatFcfa(paid)}</td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              printSaasInvoicePdf({
                                invoiceNumber: invNum,
                                organizationName: stations[0]?.name ?? 'OpesFuel Tenant Workspace',
                                periodLabel: invPeriod,
                                totalFcfa: total,
                                paidFcfa: paid,
                                status,
                                displayTotalFormatted: formatFromXaf(total),
                                usdEquivalent: formatUsdFromXaf(total),
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
                          >
                            <Printer className="w-3 h-3" /> PDF
                          </button>
                          {remaining > 0 && role === 'OWNER' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setCheckoutInvoice(inv)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold"
                              >
                                <Wallet className="w-3 h-3" /> Pay Online
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPayingInvoice(inv);
                                  setPayAmount(String(remaining));
                                  setPayRef(`MOMO-${Date.now().toString().slice(-6)}`);
                                }}
                                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-[11px] font-semibold"
                              >
                                Manual Receipt
                              </button>
                            </>
                          )}
                        </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <MailPlus className="w-4 h-4 text-slate-900" />
                Staff Invitations &amp; Account Linking
              </h3>
              <p className="text-xs text-slate-500">
                Issue 7-day invitation tokens to onboard station managers, attendants, and accountants.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <MailPlus className="w-3.5 h-3.5" /> Invite Team Member
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {invites.length === 0 ? (
              <div className="py-5 text-center text-slate-500">
                No pending or historical staff invitations. Click &ldquo;Invite Team Member&rdquo; to issue an access token.
              </div>
            ) : (
              invites.map((inv) => {
                const token = String(inv.inviteToken ?? '');
                const status = String(inv.status ?? 'PENDING');
                return (
                  <div key={String(inv.id)} className="py-3 flex flex-wrap items-center justify-between gap-2">
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
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700"
                        >
                          {copiedToken === token ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                          Copy Link
                        </button>
                      )}
                      {status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => void handleRevokeInvite(String(inv.id))}
                          className="p-1.5 rounded border border-red-200 bg-white text-red-700 hover:bg-red-50"
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
            <ShieldCheck className="w-4 h-4 text-slate-900" />
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

      {/* Popup FormModal: Online Payment Gateway Checkout */}
      <FormModal
        open={Boolean(checkoutInvoice)}
        onClose={() => setCheckoutInvoice(null)}
        title="Online Subscription Payment Checkout"
        subtitle={
          checkoutInvoice
            ? `Invoice ${String(checkoutInvoice.invoiceNumber ?? checkoutInvoice.id)} · Auto-reconciled via HMAC Webhook`
            : undefined
        }
      >
        <form onSubmit={(e) => void handleOnlineCheckout(e)} className="space-y-4">
          <div>
            <label className="opes-label">Payment Gateway</label>
            <select
              value={gatewayProvider}
              onChange={(e) =>
                setGatewayProvider(e.target.value as 'ORANGE_MONEY' | 'MTN_MOMO' | 'CINETPAY' | 'STRIPE')
              }
              className="opes-input"
            >
              <option value="ORANGE_MONEY">Orange Money Cameroon (Instant Push)</option>
              <option value="MTN_MOMO">MTN Mobile Money (Collection API)</option>
              <option value="CINETPAY">CinetPay (CEMAC / WAEMU Mobile &amp; Card)</option>
              <option value="STRIPE">Stripe (Visa / Mastercard Corporate)</option>
            </select>
          </div>
          <div>
            <label className="opes-label">Payer Mobile Money Phone / Card Reference</label>
            <input
              type="text"
              required
              value={payerPhone}
              onChange={(e) => setPayerPhone(e.target.value)}
              placeholder="+237 699 112 233"
              className="opes-input font-mono"
            />
          </div>
          {checkoutInvoice && (
            <div className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
              <span className="text-slate-600">Amount Due (incl. 19.25% VAT)</span>
              <span className="font-mono font-bold text-slate-950 text-sm">
                {formatFcfa(Math.max(0, Number(checkoutInvoice.totalFcfa ?? 0) - Number(checkoutInvoice.paidFcfa ?? 0)))}
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setCheckoutInvoice(null)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={checkoutSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-semibold"
            >
              <CreditCard className="w-3.5 h-3.5" />
              {checkoutSubmitting ? 'Processing…' : 'Pay & Settle Invoice'}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Popup FormModal: Manual Receipt Entry */}
      <FormModal
        open={Boolean(payingInvoice)}
        onClose={() => setPayingInvoice(null)}
        title="Record Manual Invoice Payment"
        subtitle={
          payingInvoice ? `Invoice ${String(payingInvoice.invoiceNumber ?? payingInvoice.id)}` : undefined
        }
      >
        <form onSubmit={(e) => void handlePayInvoice(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Amount Paid (FCFA)</label>
              <input
                type="number"
                min={1}
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="opes-input font-mono"
              />
            </div>
            <div>
              <label className="opes-label">Payment Channel</label>
              <select
                value={payChannel}
                onChange={(e) =>
                  setPayChannel(e.target.value as 'ORANGE_MONEY' | 'MTN_MOMO' | 'BANK_TRANSFER' | 'CARD')
                }
                className="opes-input"
              >
                <option value="ORANGE_MONEY">Orange Money CM</option>
                <option value="MTN_MOMO">MTN MoMo</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CARD">Corporate Card</option>
              </select>
            </div>
          </div>
          <div>
            <label className="opes-label">Provider Transaction / Receipt Ref</label>
            <input
              type="text"
              required
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="e.g. MOMO-983412"
              className="opes-input font-mono"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPayingInvoice(null)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Confirm Payment
            </button>
          </div>
        </form>
      </FormModal>

      {/* Popup FormModal: Invite Team Member */}
      <FormModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite Station Team Member"
        subtitle="Generates a 7-day RBAC invitation token bound to the chosen station and role."
      >
        <form onSubmit={(e) => void handleSendInvite(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Assigned Station</label>
              <select
                value={inviteStationId}
                onChange={(e) => setInviteStationId(e.target.value)}
                className="opes-input"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Workspace Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="opes-input"
              >
                <option value="MANAGER">Station Manager</option>
                <option value="ATTENDANT">Forecourt Attendant</option>
                <option value="ACCOUNTANT">Chief Accountant</option>
                <option value="OWNER">Network Owner</option>
              </select>
            </div>
          </div>
          <div>
            <label className="opes-label">Staff Email Address</label>
            <input
              type="email"
              required
              placeholder="manager@station.cm"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="opes-input"
            />
          </div>
          <div>
            <label className="opes-label">Link HR Employee Profile (Optional)</label>
            <select
              value={inviteEmployeeId}
              onChange={(e) => setInviteEmployeeId(e.target.value)}
              className="opes-input"
            >
              <option value="">None — link later</option>
              {stationEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setInviteModalOpen(false)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Generate Invite Token
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
