import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CalendarPlus,
  Cpu,
  CreditCard,
  FileText,
  Headphones,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Printer,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { formatShortDate } from '../../domain/formatters';
import { useCurrency } from '../../i18n/CurrencyContext';
import { printTenantWelcomeDossierPdf } from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';

interface TenantDetail360ViewProps {
  tenantId: string;
  engine: OpesFuelApiEngine;
  onBack: () => void;
  onRefreshParent: () => Promise<void>;
  onStartImpersonation: (payload: { tenantId: string; tenantName: string; reason: string }) => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const TenantDetail360View: React.FC<TenantDetail360ViewProps> = ({
  tenantId,
  engine,
  onBack,
  onRefreshParent,
  onStartImpersonation,
  onNotify,
}) => {
  const { formatFromXaf } = useCurrency();
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Modals
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [trialDays, setTrialDays] = useState('14');
  const [trialReason, setTrialReason] = useState('Onboarding pilot extension');

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planDraft, setPlanDraft] = useState('enterprise');
  const [customFeeDraft, setCustomFeeDraft] = useState('');

  const [impModalOpen, setImpModalOpen] = useState(false);
  const [impReason, setImpReason] = useState('');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await engine.getPlatformTenantDetail(tenantId);
      setDetail(data);
      setPlanDraft(String(data.planCode ?? 'growth'));
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to load tenant 360° profile.');
    } finally {
      setLoading(false);
    }
  }, [engine, tenantId, onNotify]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleToggleStatus = async () => {
    if (!detail) return;
    const currentStatus = String(detail.status ?? 'ACTIVE');
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setBusyAction('status');
    try {
      const updated = await engine.updatePlatformTenantStatus(tenantId, nextStatus);
      setDetail((prev) => ({ ...(prev ?? {}), ...updated, status: nextStatus }));
      await onRefreshParent();
      onNotify('success', `Tenant ${String(detail.name ?? tenantId)} status updated to ${nextStatus}.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update tenant status.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleExtendTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = Math.max(1, Number(trialDays) || 14);
    setBusyAction('trial');
    try {
      const updated = await engine.extendPlatformTenantTrial(tenantId, days, trialReason.trim());
      setDetail(updated);
      setTrialModalOpen(false);
      await onRefreshParent();
      onNotify('success', `Extended free trial for ${String(updated.name ?? tenantId)} by +${days} days.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to extend tenant trial.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleChangePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const customFee = customFeeDraft.trim() ? Number(customFeeDraft) : null;
    setBusyAction('plan');
    try {
      const updated = await engine.updatePlatformTenantPlan(tenantId, planDraft, customFee);
      setDetail(updated);
      setPlanModalOpen(false);
      setCustomFeeDraft('');
      await onRefreshParent();
      onNotify('success', `Updated subscription plan to ${String(updated.planName ?? planDraft)} (${formatFromXaf(Number(updated.monthlyMrrFcfa ?? 0))}/mo).`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update tenant plan.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleResendAccess = async () => {
    setBusyAction('access');
    try {
      const res = await engine.resendPlatformTenantAccess(tenantId);
      onNotify('success', `Owner access recovery email dispatched to ${String(res.ownerEmail ?? detail?.ownerEmail ?? '')}.`);
      await loadDetail();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to dispatch owner access recovery.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartImpersonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !impReason.trim()) return;
    setBusyAction('imp');
    try {
      await onStartImpersonation({
        tenantId,
        tenantName: String(detail.name ?? tenantId),
        reason: impReason.trim(),
      });
      setImpModalOpen(false);
      setImpReason('');
    } finally {
      setBusyAction(null);
    }
  };

  if (loading && !detail) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs font-mono text-slate-500">
        Loading Tenant 360° Profile ({tenantId})...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <p className="text-sm text-slate-600">Tenant profile not found.</p>
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold">
          Back to Tenants Directory
        </button>
      </div>
    );
  }

  const stations = (detail.stations as Array<Record<string, unknown>> | undefined) ?? [];
  const users = (detail.users as Array<Record<string, unknown>> | undefined) ?? [];
  const invoices = (detail.invoices as Array<Record<string, unknown>> | undefined) ?? [];
  const momoTx = (detail.momoTransactions as Array<Record<string, unknown>> | undefined) ?? [];
  const edgeDevices = (detail.edgeDevices as Array<Record<string, unknown>> | undefined) ?? [];
  const tickets = (detail.supportTickets as Array<Record<string, unknown>> | undefined) ?? [];
  const auditLogs = (detail.recentAuditLogs as Array<Record<string, unknown>> | undefined) ?? [];
  const branding = (detail.branding as Record<string, unknown> | null | undefined) ?? null;
  const status = String(detail.status ?? 'ACTIVE');

  return (
    <div className="space-y-6">
      {/* Top Navigation & Header */}
      <div className="bg-[#0F172A] text-white rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Tenants Directory
          </button>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
              }`}
            >
              {status}
            </span>
            <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
              {String(detail.planName ?? detail.planCode ?? 'Growth')}
            </span>
            <button
              type="button"
              onClick={() => void loadDetail()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs text-amber-400">{String(detail.id)}</div>
            <h2 className="font-display text-2xl font-bold text-white mt-0.5">{String(detail.name ?? '')}</h2>
            <p className="text-xs text-slate-300 mt-1">
              Owner: {String(detail.ownerEmail ?? '')} · Region: {String(detail.countryCode ?? 'CM')} ({String(detail.timezone ?? 'Africa/Douala')})
              {Boolean(detail.trialEndsAt) && ` · Trial ends ${formatShortDate(String(detail.trialEndsAt))}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTrialModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-amber-400" /> Extend Trial
            </button>
            <button
              type="button"
              onClick={() => setPlanModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Change Plan
            </button>
            <button
              type="button"
              disabled={busyAction === 'access'}
              onClick={() => void handleResendAccess()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" /> Resend Owner Access
            </button>
            <button
              type="button"
              onClick={() =>
                printTenantWelcomeDossierPdf({
                  tenantId,
                  organizationName: String(detail.name ?? ''),
                  ownerEmail: String(detail.ownerEmail ?? ''),
                  planName: String(detail.planName ?? detail.planCode ?? 'Growth'),
                  stationCount: Number(detail.stationCount ?? stations.length),
                  monthlyMrrFcfa: Number(detail.monthlyMrrFcfa ?? 0),
                  trialEndsAt: detail.trialEndsAt ? String(detail.trialEndsAt) : null,
                  countryCode: String(detail.countryCode ?? 'CM'),
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5" /> Welcome Dossier PDF
            </button>
            <button
              type="button"
              onClick={() => setImpModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <UserCheck className="w-3.5 h-3.5" /> Enter Support View
            </button>
            <button
              type="button"
              disabled={busyAction === 'status'}
              onClick={() => void handleToggleStatus()}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                status === 'ACTIVE'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {status === 'ACTIVE' ? (
                <><PauseCircle className="w-3.5 h-3.5" /> Suspend Tenant</>
              ) : (
                <><PlayCircle className="w-3.5 h-3.5" /> Reactivate Tenant</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500">Monthly MRR</div>
          <div className="font-mono text-xl font-bold text-slate-950 mt-1">{formatFromXaf(Number(detail.monthlyMrrFcfa ?? 0))}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Billing: {String(detail.billingStatus ?? 'CURRENT')}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500">Stations</div>
          <div className="font-mono text-xl font-bold text-slate-950 mt-1">{stations.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {stations.reduce((s, st) => s + Number(st.pump_count ?? 0), 0)} pumps · {stations.reduce((s, st) => s + Number(st.tank_count ?? 0), 0)} tanks
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500">Workforce &amp; Users</div>
          <div className="font-mono text-xl font-bold text-slate-950 mt-1">{Number(detail.employeeCount ?? 0)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{users.length} registered account(s)</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500">Edge Agents</div>
          <div className="font-mono text-xl font-bold text-slate-950 mt-1">
            {edgeDevices.filter((e) => String(e.status) === 'ONLINE').length}/{edgeDevices.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Online hardware gateways</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500">Support Tickets</div>
          <div className="font-mono text-xl font-bold text-slate-950 mt-1">{tickets.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{momoTx.length} MoMo tx recorded</div>
        </div>
      </div>

      {/* Legal Identity & Provisioned Stations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
            <ShieldCheck className="w-4 h-4 text-slate-900" />
            <h3 className="font-display text-sm font-bold text-slate-950">Legal Identity &amp; Tax Profile</h3>
          </div>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Legal Name</dt>
              <dd className="font-semibold text-slate-950 text-right">{String(branding?.legal_name ?? detail.name ?? '-')}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">NIU / Tax ID</dt>
              <dd className="font-mono text-slate-900">{String(branding?.tax_id_niu ?? 'Not configured')}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">RCCM</dt>
              <dd className="font-mono text-slate-900">{String(branding?.rccm_number ?? 'Not configured')}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">City / Address</dt>
              <dd className="text-slate-800 text-right">{String(branding?.city ?? 'Douala')}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Primary Contact</dt>
              <dd className="font-mono text-slate-800">{String(branding?.phone ?? detail.ownerEmail ?? '-')}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Provisioned On</dt>
              <dd className="font-mono text-slate-800">{formatShortDate(String(detail.createdAt ?? ''))}</dd>
            </div>
          </dl>
        </div>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-900" />
            <h3 className="font-display text-sm font-bold text-slate-950">Provisioned Petrol Stations ({stations.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0F172A] text-white">
                <tr>
                  <th className="px-4 py-2.5 text-left">Code</th>
                  <th className="px-4 py-2.5 text-left">Station Name</th>
                  <th className="px-4 py-2.5 text-left">City</th>
                  <th className="px-4 py-2.5 text-right">Pumps / Tanks</th>
                  <th className="px-4 py-2.5 text-right">Monthly Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stations.map((s) => (
                  <tr key={String(s.id)} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{String(s.code ?? '-')}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-950">{String(s.name ?? '')}</td>
                    <td className="px-4 py-2.5 text-slate-600">{String(s.city ?? '')}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{Number(s.pump_count ?? 0)}P / {Number(s.tank_count ?? 0)}T</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-950">{formatFromXaf(Number(s.monthly_fee_fcfa ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoices & Cameroon MoMo Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-900" />
            <h3 className="font-display text-sm font-bold text-slate-950">SaaS Invoices ({invoices.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-2 text-left">Invoice #</th>
                  <th className="px-4 py-2 text-left">Period</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-5 text-center text-slate-500">No invoices billed yet.</td></tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={String(inv.id)}>
                      <td className="px-4 py-2 font-mono font-semibold text-slate-900">{String(inv.invoice_number ?? inv.invoiceNumber ?? '')}</td>
                      <td className="px-4 py-2 font-mono text-slate-600">{String(inv.period_label ?? inv.periodLabel ?? '')}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold">{formatFromXaf(Number(inv.total_fcfa ?? inv.totalFcfa ?? 0))}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-[10px]">{String(inv.status ?? 'ISSUED')}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-900" />
            <h3 className="font-display text-sm font-bold text-slate-950">Cameroon MTN MoMo &amp; Orange Money ({momoTx.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-2 text-left">Provider</th>
                  <th className="px-4 py-2 text-left">MSISDN</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {momoTx.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-5 text-center text-slate-500">No MoMo transactions recorded.</td></tr>
                ) : (
                  momoTx.map((m) => (
                    <tr key={String(m.id)}>
                      <td className="px-4 py-2 font-semibold text-slate-900">{String(m.provider ?? '')}</td>
                      <td className="px-4 py-2 font-mono text-slate-600">{String(m.msisdn ?? '')}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold">{formatFromXaf(Number(m.amount_fcfa ?? m.amountFcfa ?? 0))}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px]">{String(m.status ?? '')}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edge Devices, Support Tickets & Recent Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-slate-950 border-b border-slate-200 pb-2">
            <Cpu className="w-4 h-4 text-slate-900" /> Edge Agent Gateways ({edgeDevices.length})
          </div>
          {edgeDevices.length === 0 ? (
            <p className="text-xs text-slate-500">No on-site Edge Agents paired.</p>
          ) : (
            edgeDevices.map((d) => (
              <div key={String(d.id)} className="border border-slate-200 rounded-lg p-2.5 text-xs flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-950">{String(d.device_name ?? d.id)}</div>
                  <div className="text-[11px] font-mono text-slate-500">v{String(d.agent_version ?? '1.0')} · outbox: {Number(d.outbox_depth ?? 0)}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${String(d.status) === 'ONLINE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {String(d.status ?? 'PENDING')}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-slate-950 border-b border-slate-200 pb-2">
            <Headphones className="w-4 h-4 text-amber-600" /> Support Tickets ({tickets.length})
          </div>
          {tickets.length === 0 ? (
            <p className="text-xs text-slate-500">No support tickets for this tenant.</p>
          ) : (
            tickets.map((tk) => (
              <div key={String(tk.id)} className="border border-slate-200 rounded-lg p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-700">{String(tk.ticket_number ?? tk.ticketNumber ?? tk.id)}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold">{String(tk.status ?? '')}</span>
                </div>
                <div className="font-medium text-slate-900">{String(tk.subject ?? '')}</div>
              </div>
            ))
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-slate-950 border-b border-slate-200 pb-2">
            <Users className="w-4 h-4 text-slate-900" /> Recent Audit Events ({auditLogs.length})
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No recent audit events.</p>
            ) : (
              auditLogs.slice(0, 10).map((a) => (
                <div key={String(a.id)} className="border-b border-slate-100 pb-1.5 text-[11px]">
                  <div className="font-mono font-bold text-slate-800">{String(a.action ?? '')}</div>
                  <div className="text-slate-600">{String(a.summary ?? '')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Extend Trial Modal */}
      <FormModal open={trialModalOpen} onClose={() => setTrialModalOpen(false)} title="Extend Tenant Free Trial" subtitle={`Grant additional trial days to ${String(detail.name ?? '')}.`}>
        <form onSubmit={(e) => void handleExtendTrial(e)} className="space-y-4">
          <div>
            <label className="opes-label">Additional Trial Days</label>
            <input type="number" min={1} max={365} required value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className="opes-input font-mono text-xs" />
          </div>
          <div>
            <label className="opes-label">Audit Reason</label>
            <input type="text" required value={trialReason} onChange={(e) => setTrialReason(e.target.value)} className="opes-input text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setTrialModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" disabled={busyAction === 'trial'} className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold">
              {busyAction === 'trial' ? 'Saving...' : 'Grant Trial Extension'}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Change Plan Modal */}
      <FormModal open={planModalOpen} onClose={() => setPlanModalOpen(false)} title="Change Tenant Subscription Plan" subtitle={`Updates plan tier and monthly fee across all ${stations.length} station(s).`}>
        <form onSubmit={(e) => void handleChangePlan(e)} className="space-y-4">
          <div>
            <label className="opes-label">Subscription Plan Tier</label>
            <select value={planDraft} onChange={(e) => setPlanDraft(e.target.value)} className="opes-input text-xs">
              <option value="starter">Starter Station (25,000 FCFA / station / mo)</option>
              <option value="growth">Multi-Pump Pro (55,000 FCFA / station / mo)</option>
              <option value="enterprise">Network Enterprise (120,000 FCFA / station / mo)</option>
            </select>
          </div>
          <div>
            <label className="opes-label">Optional Custom Fee Override (FCFA / station / mo)</label>
            <input
              type="number"
              min={0}
              value={customFeeDraft}
              onChange={(e) => setCustomFeeDraft(e.target.value)}
              placeholder="Leave blank to use default tier pricing"
              className="opes-input font-mono text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPlanModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" disabled={busyAction === 'plan'} className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold">
              {busyAction === 'plan' ? 'Updating...' : 'Apply Plan Change'}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Impersonation Modal */}
      <FormModal open={impModalOpen} onClose={() => setImpModalOpen(false)} title="Enter Audited Tenant Support View" subtitle={`All actions inside ${String(detail.name ?? '')}'s workspace are audit-logged.`}>
        <form onSubmit={(e) => void handleStartImpersonation(e)} className="space-y-4">
          <div>
            <label className="opes-label">Mandatory Support Reason</label>
            <textarea rows={3} required value={impReason} onChange={(e) => setImpReason(e.target.value)} placeholder="e.g. Assisting owner with dipstick calibration / shift close review" className="opes-input text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setImpModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" disabled={busyAction === 'imp' || !impReason.trim()} className="px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">
              {busyAction === 'imp' ? 'Launching...' : 'Start Support Session'}
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
