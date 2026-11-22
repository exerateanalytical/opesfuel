import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Ban,
  Building2,
  CheckCircle2,
  Cpu,
  CreditCard,
  Crown,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Headphones,
  KeyRound,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { OpesFuelApiEngine, SUBSCRIPTION_PLANS } from '../../api/opesfuelClient';
import { formatShortDate } from '../../domain/formatters';
import { useCurrency } from '../../i18n/CurrencyContext';
import {
  exportSaasAuditCsv,
  exportSaasGlobalReconciliationExcel,
  printEnterpriseLicensePdf,
  printSaasAuditTrailPdf,
  printSaasExecutiveBoardReportPdf,
  printSaasInvoicePdf,
} from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';
import { PlatformGovernanceControlsPanel } from './PlatformGovernanceControlsPanel';
import { ApiIntegrationsHubPanel } from './ApiIntegrationsHubPanel';
import { PlatformSupportDeskPanel } from './PlatformSupportDeskPanel';
import { TenantDetail360View } from './TenantDetail360View';

export type PlatformAdminTab =
  | 'overview'
  | 'tenants'
  | 'support'
  | 'leads'
  | 'plans'
  | 'invoices'
  | 'licenses'
  | 'broadcasts'
  | 'governance'
  | 'integrations'
  | 'audit';

interface PlatformAdminSectionProps {
  engine: OpesFuelApiEngine;
  activeTab?: PlatformAdminTab;
  onChangeTab?: (tab: PlatformAdminTab) => void;
  onPostBackend?: (path: string, method: 'POST' | 'PATCH' | 'PUT', body?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onStartImpersonation: (payload: { tenantId: string; tenantName: string; ticketId?: string; reason: string }) => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const LEAD_STATUSES = ['RECEIVED', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'ARCHIVED'] as const;

interface PlanRow {
  id: string;
  name: string;
  monthlyFeeFcfa: number;
  maxStations: number;
  maxPumps: number;
  trialDays: number;
  active: boolean;
}

export const PlatformAdminSection: React.FC<PlatformAdminSectionProps> = ({
  engine,
  activeTab: controlledTab,
  onChangeTab,
  onPostBackend,
  onStartImpersonation,
  onNotify,
}) => {
  const { formatFromXaf, formatUsdFromXaf, xafPerUsd } = useCurrency();
  const [internalTab, setInternalTab] = useState<PlatformAdminTab>('overview');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (tab: PlatformAdminTab) => {
    setInternalTab(tab);
    onChangeTab?.(tab);
    if (tab !== 'tenants') setSelectedTenantId(null);
  };

  // Live Platform Datasets
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [tenants, setTenants] = useState<Array<Record<string, unknown>>>([]);
  const [leads, setLeads] = useState<Array<Record<string, unknown>>>([]);
  const [tickets, setTickets] = useState<Array<Record<string, unknown>>>([]);
  const [impersonations, setImpersonations] = useState<Array<Record<string, unknown>>>([]);
  const [globalInvoices, setGlobalInvoices] = useState<Array<Record<string, unknown>>>([]);
  const [momoSettlements, setMomoSettlements] = useState<Array<Record<string, unknown>>>([]);
  const [licenses, setLicenses] = useState<Array<Record<string, unknown>>>([]);
  const [broadcasts, setBroadcasts] = useState<Array<Record<string, unknown>>>([]);
  const [healthTelemetry, setHealthTelemetry] = useState<Record<string, unknown> | null>(null);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [plans, setPlans] = useState<PlanRow[]>(() =>
    SUBSCRIPTION_PLANS.map((p) => ({
      id: p.id,
      name: p.name,
      monthlyFeeFcfa: p.monthlyPriceFcfa,
      maxStations: p.id === 'starter' ? 1 : p.id === 'growth' ? 5 : 999,
      maxPumps: p.id === 'starter' ? 6 : p.id === 'growth' ? 18 : 999,
      trialDays: p.id === 'enterprise' ? 30 : 14,
      active: true,
    }))
  );

  const [loading, setLoading] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [tenantQuery, setTenantQuery] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditTenantFilter, setAuditTenantFilter] = useState('ALL');
  const [provisioningLeadId, setProvisioningLeadId] = useState<string | null>(null);

  // Plan Edit Modal
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [planFeeDraft, setPlanFeeDraft] = useState('');
  const [planStationsDraft, setPlanStationsDraft] = useState('');
  const [planPumpCapDraft, setPlanPumpCapDraft] = useState('');
  const [planTrialDraft, setPlanTrialDraft] = useState('14');

  // Create Tenant Modal
  const [newTenantOpen, setNewTenantOpen] = useState(false);
  const [ntName, setNtName] = useState('');
  const [ntEmail, setNtEmail] = useState('');
  const [ntCity, setNtCity] = useState('Douala');
  const [ntCountry, setNtCountry] = useState('CM');
  const [ntPlan, setNtPlan] = useState('growth');
  const [ntStations, setNtStations] = useState('1');
  const [ntTrialDays, setNtTrialDays] = useState('14');

  // Issue Global Invoice Modal
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [invTenantId, setInvTenantId] = useState('');
  const [invPeriod, setInvPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [invAmount, setInvAmount] = useState('110000');
  const [invChannel, setInvChannel] = useState('MTN_MOMO');

  // Issue Enterprise License Modal
  const [newLicenseOpen, setNewLicenseOpen] = useState(false);
  const [licTenantId, setLicTenantId] = useState('');
  const [licOrg, setLicOrg] = useState('');
  const [licTier, setLicTier] = useState('Enterprise On-Premises Perpetual');
  const [licMaxStations, setLicMaxStations] = useState('25');
  const [licFee, setLicFee] = useState('5000000');
  const [licExpires, setLicExpires] = useState('2027-12-31');

  // Revoke License Modal
  const [revokingLicense, setRevokingLicense] = useState<Record<string, unknown> | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  // Broadcast Modal
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [bcChannel, setBcChannel] = useState<'IN_APP' | 'EMAIL' | 'WHATSAPP'>('IN_APP');
  const [bcAudience, setBcAudience] = useState('ALL_ACTIVE');
  const [bcTitle, setBcTitle] = useState('');
  const [bcMessage, setBcMessage] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        ov,
        tn,
        ld,
        tkt,
        imp,
        invs,
        momo,
        lics,
        bcs,
        health,
        auds,
        govPlans,
      ] = await Promise.all([
        engine.fetchPlatformAdminOverview(),
        engine.listPlatformTenants(),
        engine.listPlatformLeads(),
        engine.listPlatformSupportTickets(),
        engine.listPlatformImpersonations(),
        engine.listPlatformGlobalInvoices(),
        engine.listPlatformMomoSettlements(),
        engine.listPlatformLicenses(),
        engine.listPlatformBroadcasts(),
        engine.getPlatformHealthTelemetry(),
        engine.listPlatformAuditLogs(),
        engine.listPlatformGovernancePlans().catch(() => []),
      ]);
      setOverview(ov);
      setTenants(tn);
      setLeads(ld);
      setTickets(tkt);
      setImpersonations(imp);
      setGlobalInvoices(invs);
      setMomoSettlements(momo);
      setLicenses(lics);
      setBroadcasts(bcs);
      setHealthTelemetry(health);
      setAuditLogs(auds);
      if (govPlans.length > 0) {
        setPlans(
          govPlans.map((p) => ({
            id: String(p.plan_code ?? p.planCode ?? 'growth'),
            name: String(p.plan_name ?? p.planName ?? 'Plan'),
            monthlyFeeFcfa: Number(p.monthly_price_fcfa ?? p.monthlyPriceFcfa ?? 55000),
            maxStations: Number(p.max_stations ?? p.maxStations ?? 5),
            maxPumps: Number(p.max_pumps ?? p.maxPumps ?? 18),
            trialDays: Number(p.trial_days ?? p.trialDays ?? 14),
            active: p.active !== false,
          }))
        );
      }
      if (!invTenantId && tn.length > 0) {
        setInvTenantId(String(tn[0].id ?? ''));
      }
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to load SaaS Control Plane telemetry.');
    } finally {
      setLoading(false);
    }
  }, [engine, onNotify, invTenantId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredTenants = useMemo(() => {
    const q = tenantQuery.trim().toLowerCase();
    return tenants.filter((t) => {
      const status = String(t.status ?? 'ACTIVE');
      if (tenantStatusFilter !== 'ALL' && status !== tenantStatusFilter) return false;
      if (!q) return true;
      return (
        String(t.name ?? '').toLowerCase().includes(q) ||
        String(t.ownerEmail ?? '').toLowerCase().includes(q) ||
        String(t.id ?? '').toLowerCase().includes(q)
      );
    });
  }, [tenants, tenantQuery, tenantStatusFilter]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((l) => {
      if (auditTenantFilter !== 'ALL' && String(l.tenantId ?? '') !== auditTenantFilter) return false;
      if (!q) return true;
      return (
        String(l.action ?? '').toLowerCase().includes(q) ||
        String(l.actorEmail ?? '').toLowerCase().includes(q) ||
        String(l.summary ?? '').toLowerCase().includes(q) ||
        String(l.entityType ?? '').toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditSearch, auditTenantFilter]);

  const mrr = Number(overview?.totalPlatformMrrFcfa ?? 0);
  const arr = mrr * 12;
  const arpu = Number(overview?.arpuFcfa ?? 0);
  const collectionRatePct = Number(overview?.collectionRatePct ?? 100);
  const churnRatePct = Number(overview?.churnRatePct ?? 0);
  const activeTenantsCount = Number(overview?.activeTenants ?? 0);
  const totalTenantsCount = Number(overview?.totalTenants ?? tenants.length);
  const trialTenantsCount = Number(overview?.trialTenants ?? 0);
  const totalStationsCount = Number(overview?.totalStations ?? 0);
  const openTicketsCount = Number(overview?.openSupportTickets ?? tickets.filter((t) => ['OPEN', 'IN_PROGRESS', 'WAITING_TENANT', 'ESCALATED'].includes(String(t.status))).length);
  const urgentTicketsCount = Number(overview?.urgentSupportTickets ?? 0);
  const edgeOnline = Number(overview?.edgeDevicesOnline ?? healthTelemetry?.edgeDevicesOnline ?? 0);
  const edgeTotal = Number(overview?.edgeDevicesTotal ?? healthTelemetry?.edgeDevicesTotal ?? 0);
  const momoSettledVolume = Number(overview?.momoSettledVolumeFcfa ?? 0);
  const momoSettledCount = Number(overview?.momoSettledCount ?? 0);
  const outstandingAr = Number(overview?.outstandingReceivablesFcfa ?? 0);
  const tierBreakdown = (overview?.planTierBreakdown as Array<{
    planCode: string;
    planName: string;
    tenantCount: number;
    stationCount: number;
    mrrFcfa: number;
    sharePct: number;
  }> | undefined) ?? [];

  // Handlers — 100% wired to backend APIs
  const handleToggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await engine.updatePlatformTenantStatus(tenantId, nextStatus);
      await loadAll();
      onNotify('success', `Tenant ${tenantId} status updated to ${nextStatus}.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update tenant status.');
    }
  };

  const handleCreateManualTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ntName.trim() || !ntEmail.trim()) return;
    try {
      const created = await engine.createPlatformTenant({
        name: ntName.trim(),
        ownerEmail: ntEmail.trim().toLowerCase(),
        countryCode: ntCountry,
        city: ntCity.trim() || 'Douala',
        planCode: ntPlan,
        initialStations: Math.max(1, Number(ntStations) || 1),
        trialDays: Math.max(0, Number(ntTrialDays) || 0),
      });
      setNewTenantOpen(false);
      setNtName('');
      setNtEmail('');
      await loadAll();
      setSelectedTenantId(String(created.id ?? ''));
      setActiveTab('tenants');
      onNotify('success', `Provisioned live tenant "${String(created.name ?? ntName)}" with ${Number(created.stationCount ?? ntStations)} station(s).`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to provision tenant.');
    }
  };

  const handleProvisionLead = async (lead: Record<string, unknown>) => {
    const leadId = String(lead.id ?? '');
    setProvisioningLeadId(leadId);
    try {
      const planStr = String(lead.selectedPlan ?? '').toLowerCase();
      const planCode = planStr.includes('enterprise') ? 'enterprise' : planStr.includes('starter') ? 'starter' : 'growth';
      await engine.createPlatformTenant({
        name: String(lead.stationName ?? 'New Fuel Network'),
        ownerEmail: String(lead.email ?? 'owner@station.cm'),
        countryCode: 'CM',
        city: 'Douala',
        planCode,
        initialStations: Math.max(1, Math.ceil(Number(lead.pumpCount ?? 4) / 6)),
        trialDays: 14,
      });
      await engine.updatePlatformLeadStatus(leadId, 'CONVERTED');
      await loadAll();
      onNotify('success', `Converted lead "${String(lead.stationName)}" into an active customer tenant!`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to convert lead.');
    } finally {
      setProvisioningLeadId(null);
    }
  };

  const handleLeadStatus = async (leadId: string, nextStatus: (typeof LEAD_STATUSES)[number]) => {
    try {
      await engine.updatePlatformLeadStatus(leadId, nextStatus);
      await loadAll();
      onNotify('success', `Lead status updated to ${nextStatus}.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update lead status.');
    }
  };

  const handleSavePlanEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    const fee = Math.max(0, Number(planFeeDraft) || editingPlan.monthlyFeeFcfa);
    const maxStations = Math.max(1, Number(planStationsDraft) || editingPlan.maxStations);
    const maxPumps = Math.max(1, Number(planPumpCapDraft) || editingPlan.maxPumps);
    const trialDays = Math.max(0, Number(planTrialDraft) || 0);
    try {
      await engine.upsertPlatformGovernancePlan({
        planCode: editingPlan.id,
        planName: editingPlan.name,
        monthlyPriceFcfa: fee,
        monthlyPriceUsd: Number((fee / Math.max(1, xafPerUsd)).toFixed(2)),
        maxStations,
        maxPumps,
        trialDays,
        active: editingPlan.active,
      });
      setEditingPlan(null);
      await loadAll();
      onNotify('success', `Saved & persisted "${editingPlan.name}" pricing (${formatFromXaf(fee)}/mo) to backend.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save plan pricing.');
    }
  };

  const handleIssueGlobalInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invTenantId) return;
    try {
      const created = await engine.issuePlatformGlobalInvoice({
        tenantId: invTenantId,
        periodLabel: invPeriod,
        totalFcfa: Math.max(1000, Number(invAmount) || 55000),
        channel: invChannel,
      });
      setNewInvoiceOpen(false);
      await loadAll();
      onNotify('success', `Issued SaaS invoice ${String(created.invoiceNumber ?? '')} and persisted to ledger.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to issue SaaS invoice.');
    }
  };

  const handleMarkInvoicePaid = async (invoiceId: string) => {
    try {
      await engine.markPlatformGlobalInvoicePaid(invoiceId, 'MTN_MOMO');
      await loadAll();
      onNotify('success', 'Recorded payment settlement and marked SaaS invoice PAID.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to mark invoice paid.');
    }
  };

  const handleIssueLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licOrg.trim()) return;
    try {
      const created = await engine.issuePlatformLicense({
        tenantId: licTenantId || undefined,
        organizationName: licOrg.trim(),
        tierName: licTier,
        maxStations: Math.max(1, Number(licMaxStations) || 10),
        annualFeeFcfa: Math.max(0, Number(licFee) || 5000000),
        expiresAt: licExpires,
      });
      setNewLicenseOpen(false);
      setLicOrg('');
      await loadAll();
      onNotify('success', `Issued & persisted sovereign Enterprise License ${String(created.licenseKey ?? '')}.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to issue enterprise license.');
    }
  };

  const handleConfirmRevokeLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingLicense?.id) return;
    try {
      await engine.revokePlatformLicense(String(revokingLicense.id), revokeReason.trim() || 'Revoked by SaaS Super-Admin');
      setRevokingLicense(null);
      setRevokeReason('');
      await loadAll();
      onNotify('success', `Revoked Enterprise License ${String(revokingLicense.licenseKey ?? '')} and logged audit entry.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to revoke license.');
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcTitle.trim() || !bcMessage.trim()) return;
    try {
      const res = await engine.sendPlatformBroadcast({
        channel: bcChannel,
        audience: bcAudience,
        title: bcTitle.trim(),
        message: bcMessage.trim(),
      });
      setBroadcastOpen(false);
      setBcTitle('');
      setBcMessage('');
      await loadAll();
      onNotify(
        'success',
        `Dispatched ${bcChannel} broadcast to ${Number(res.dispatchedCount ?? 0)}/${Number(res.recipientCount ?? 0)} customer tenants.`
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to send broadcast.');
    }
  };

  const tabItems: Array<{ id: PlatformAdminTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { id: 'overview', label: 'Platform KPIs', icon: TrendingUp },
    { id: 'tenants', label: 'Tenants', icon: Building2, badge: totalTenantsCount },
    { id: 'support', label: 'Support Desk', icon: Headphones, badge: openTicketsCount },
    { id: 'leads', label: 'Leads', icon: Users, badge: Number(overview?.openLeadsCount ?? 0) },
    { id: 'plans', label: 'Plans & Quotas', icon: Sliders },
    { id: 'invoices', label: 'Global Billing & MoMo', icon: CreditCard },
    { id: 'licenses', label: 'Enterprise Licenses', icon: Award },
    { id: 'integrations', label: 'API & MoMo Gateways', icon: KeyRound },
    { id: 'broadcasts', label: 'Broadcasts & Health', icon: Server },
    { id: 'governance', label: 'Governance', icon: ShieldCheck },
    { id: 'audit', label: 'Security & Audit', icon: ShieldAlert },
  ];

  // If inspecting a specific Tenant 360° Detail Page
  if (activeTab === 'tenants' && selectedTenantId) {
    return (
      <TenantDetail360View
        tenantId={selectedTenantId}
        engine={engine}
        onBack={() => setSelectedTenantId(null)}
        onRefreshParent={loadAll}
        onStartImpersonation={onStartImpersonation}
        onNotify={onNotify}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* SaaS Executive Header Bar */}
      <div className="bg-[#0F172A] text-white rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-amber-400">
            <Crown className="w-3.5 h-3.5" /> OpesWare SaaS Super-Admin Control Plane
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
            Global Platform Performance &amp; Multi-Tenant Operations
          </h1>
          <p className="text-xs text-slate-300">
            Live multi-tenant revenue, customer support desk, Cameroon MoMo collections, Edge Agent fleet telemetry, and audited governance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              printSaasExecutiveBoardReportPdf({
                mrrFcfa: mrr,
                arrFcfa: arr,
                arpuFcfa: arpu,
                collectionRatePct,
                churnRatePct,
                activeTenants: activeTenantsCount,
                totalTenants: totalTenantsCount,
                trialTenants: trialTenantsCount,
                totalStations: totalStationsCount,
                outstandingReceivablesFcfa: outstandingAr,
                momoSettledVolumeFcfa: momoSettledVolume,
                openSupportTickets: openTicketsCount,
                edgeDevicesOnline: edgeOnline,
                edgeDevicesTotal: edgeTotal,
                tierBreakdown,
                topTenants: tenants.map((t) => ({
                  name: String(t.name ?? ''),
                  status: String(t.status ?? 'ACTIVE'),
                  stationCount: Number(t.stationCount ?? 0),
                  monthlyMrrFcfa: Number(t.monthlyMrrFcfa ?? 0),
                  planCode: String(t.planCode ?? 'growth'),
                })),
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
          >
            <FileText className="w-3.5 h-3.5" /> Board Report PDF
          </button>
          <button
            type="button"
            onClick={() =>
              exportSaasGlobalReconciliationExcel({
                tenants,
                leads,
                invoices: globalInvoices,
                momoSettlements,
                licenses,
                tickets,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Global Excel
          </button>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Horizontal Quick Tab Ribbon (synced with SaaS Sidebar) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-[#D97706] text-slate-950 bg-amber-50/60'
                  : 'border-transparent text-slate-600 hover:text-slate-950 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                    tab.id === 'support' && urgentTicketsCount > 0
                      ? 'bg-red-600 text-white'
                      : active
                      ? 'bg-[#0F172A] text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PLATFORM EXECUTIVE PERFORMANCE (FIRST VIEW!) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Primary SaaS Financial & Growth KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Global Platform MRR</div>
              <div className="font-mono text-2xl font-bold text-slate-950 mt-1">{formatFromXaf(mrr)}</div>
              <div className="text-xs text-slate-500 mt-1">
                ARR: <span className="font-mono font-semibold text-slate-900">{formatFromXaf(arr)}</span> ({formatUsdFromXaf(arr)})
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Tenants &amp; Sites</div>
              <div className="font-mono text-2xl font-bold text-slate-950 mt-1">
                {activeTenantsCount} <span className="text-sm font-normal text-slate-500">/ {totalTenantsCount} tenants</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {totalStationsCount} petrol stations · {trialTenantsCount} active trial(s) · Churn {churnRatePct.toFixed(1)}%
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">ARPU &amp; Collection Rate</div>
              <div className="font-mono text-2xl font-bold text-emerald-700 mt-1">{collectionRatePct.toFixed(1)}%</div>
              <div className="text-xs text-slate-500 mt-1">
                ARPU: <span className="font-mono font-semibold text-slate-900">{formatFromXaf(arpu)}</span> · AR: {formatFromXaf(outstandingAr)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cameroon MoMo Settled</div>
              <div className="font-mono text-2xl font-bold text-slate-950 mt-1">{formatFromXaf(momoSettledVolume)}</div>
              <div className="text-xs text-slate-500 mt-1">
                {momoSettledCount} settled MTN MoMo / Orange Money tx
              </div>
            </div>
          </div>

          {/* Operational Health & Support Readiness Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('support')}
              className="text-left bg-white border border-slate-200 hover:border-amber-400 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-slate-500">
                <span>Support Desk Queue</span>
                <Headphones className="w-4 h-4 text-amber-600" />
              </div>
              <div className="font-mono text-xl font-bold text-slate-950 mt-1">{openTicketsCount} Open</div>
              <div className={`text-[11px] mt-0.5 font-medium ${urgentTicketsCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {urgentTicketsCount > 0 ? `${urgentTicketsCount} High/Urgent SLA attention` : 'All SLA timers green'}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('broadcasts')}
              className="text-left bg-white border border-slate-200 hover:border-amber-400 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-slate-500">
                <span>Edge Agent Fleet</span>
                <Cpu className="w-4 h-4 text-slate-900" />
              </div>
              <div className="font-mono text-xl font-bold text-slate-950 mt-1">{edgeOnline} / {edgeTotal} Online</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Live forecourt hardware bridges</div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('broadcasts')}
              className="text-left bg-white border border-slate-200 hover:border-amber-400 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-slate-500">
                <span>Platform Health &amp; DB</span>
                <Activity className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="font-mono text-xl font-bold text-emerald-700 mt-1">
                {String(healthTelemetry?.status ?? 'HEALTHY')} · {String(healthTelemetry?.flywaySchemaVersion ?? 'V24')}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                DB {Number(healthTelemetry?.databaseLatencyMs ?? 5)}ms · Webhooks {Number(healthTelemetry?.webhookSuccessRatePct ?? 100).toFixed(1)}%
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leads')}
              className="text-left bg-white border border-slate-200 hover:border-amber-400 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-slate-500">
                <span>Sales Pipeline &amp; Licenses</span>
                <Award className="w-4 h-4 text-amber-600" />
              </div>
              <div className="font-mono text-xl font-bold text-slate-950 mt-1">
                {Number(overview?.openLeadsCount ?? 0)} Open Leads
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {Number(overview?.activeLicensesCount ?? licenses.filter((l) => l.status === 'ACTIVE').length)} active perpetual license(s)
              </div>
            </button>
          </div>

          {/* REAL Computed Revenue Breakdown by Plan Tier (NO hardcoded multipliers!) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-950">Actual MRR Breakdown by Plan Tier</h3>
                  <p className="text-xs text-slate-500">Computed directly from active tenant plans and provisioned station subscriptions.</p>
                </div>
                <span className="font-mono text-xs font-bold text-slate-900">{formatFromXaf(mrr)}/mo</span>
              </div>
              <div className="space-y-4">
                {tierBreakdown.map((tier) => (
                  <div key={tier.planCode} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">
                        {tier.planName}{' '}
                        <span className="font-normal text-slate-500">
                          ({tier.tenantCount} tenant{tier.tenantCount === 1 ? '' : 's'} · {tier.stationCount} station{tier.stationCount === 1 ? '' : 's'})
                        </span>
                      </span>
                      <span className="font-mono font-bold text-slate-950">
                        {formatFromXaf(tier.mrrFcfa)} <span className="text-slate-500 font-normal">({tier.sharePct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#0F172A]"
                        style={{ width: `${Math.min(100, Math.max(2, tier.sharePct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Customer Tenants Snapshot */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-950">Top Tenants by MRR</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('tenants')}
                  className="text-xs font-semibold text-amber-700 hover:underline"
                >
                  View All →
                </button>
              </div>
              <div className="divide-y divide-slate-200">
                {[...tenants]
                  .sort((a, b) => Number(b.monthlyMrrFcfa ?? 0) - Number(a.monthlyMrrFcfa ?? 0))
                  .slice(0, 5)
                  .map((t) => (
                    <button
                      key={String(t.id)}
                      type="button"
                      onClick={() => {
                        setSelectedTenantId(String(t.id));
                        setActiveTab('tenants');
                      }}
                      className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 text-left"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-950 truncate">{String(t.name ?? '')}</div>
                        <div className="text-[11px] text-slate-500">
                          {Number(t.stationCount ?? 0)} sites · {String(t.planCode ?? 'growth').toUpperCase()}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-xs font-bold text-slate-950">{formatFromXaf(Number(t.monthlyMrrFcfa ?? 0))}</div>
                        <div className={`text-[10px] font-semibold ${String(t.status) === 'ACTIVE' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {String(t.status ?? 'ACTIVE')}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TENANTS DIRECTORY */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tenantQuery}
                  onChange={(e) => setTenantQuery(e.target.value)}
                  placeholder="Search organization, owner email, tenant ID..."
                  className="opes-input pl-9 text-xs"
                />
              </div>
              <select
                value={tenantStatusFilter}
                onChange={(e) => setTenantStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED')}
                className="opes-input text-xs w-40"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="SUSPENDED">Suspended Only</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setNewTenantOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Provision New Tenant
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0F172A] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Tenant Organization</th>
                    <th className="px-4 py-3 text-left font-semibold">Plan &amp; Billing</th>
                    <th className="px-4 py-3 text-right font-semibold">Stations</th>
                    <th className="px-4 py-3 text-right font-semibold">Monthly MRR</th>
                    <th className="px-4 py-3 text-center font-semibold">Support / Edge</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTenants.map((t) => {
                    const id = String(t.id ?? '');
                    const status = String(t.status ?? 'ACTIVE');
                    return (
                      <tr key={id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-950">{String(t.name ?? '')}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{String(t.ownerEmail ?? '')} · {id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold uppercase text-[10px]">
                            {String(t.planCode ?? 'growth')}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-0.5">{String(t.billingStatus ?? 'CURRENT')}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{Number(t.stationCount ?? 0)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{formatFromXaf(Number(t.monthlyMrrFcfa ?? 0))}</td>
                        <td className="px-4 py-3 text-center font-mono text-[11px] text-slate-600">
                          {Number(t.openTicketsCount ?? 0)} tkt · {Number(t.edgeDevicesOnline ?? 0)} edge
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedTenantId(id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-semibold"
                            >
                              <Eye className="w-3.5 h-3.5" /> 360° Detail
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleTenantStatus(id, status)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-800"
                            >
                              {status === 'ACTIVE' ? <PauseCircle className="w-3.5 h-3.5 text-red-600" /> : <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />}
                              {status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUPPORT DESK */}
      {activeTab === 'support' && (
        <PlatformSupportDeskPanel
          engine={engine}
          tenants={tenants}
          tickets={tickets}
          impersonations={impersonations}
          onRefresh={loadAll}
          onStartImpersonation={onStartImpersonation}
          onNotify={onNotify}
        />
      )}

      {/* TAB 4: ONBOARDING LEADS */}
      {activeTab === 'leads' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-slate-950">Inbound Sales &amp; Demo Leads ({leads.length})</h3>
              <p className="text-xs text-slate-500">Convert qualified station operators into live Postgres tenants with one click.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0F172A] text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Ref / Station</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Plan &amp; Pumps</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {leads.map((l) => {
                  const id = String(l.id ?? '');
                  const status = String(l.status ?? 'RECEIVED');
                  return (
                    <tr key={id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-950">{String(l.stationName ?? '')}</div>
                        <div className="font-mono text-[11px] text-slate-500">{String(l.referenceId ?? id)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{String(l.fullName ?? '')}</div>
                        <div className="text-[11px] text-slate-500">{String(l.email ?? '')} · {String(l.phone ?? '')}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{String(l.selectedPlan ?? '')}</div>
                        <div className="font-mono text-[11px] text-slate-500">{Number(l.pumpCount ?? 0)} pumps</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={status}
                          onChange={(e) => void handleLeadStatus(id, e.target.value as (typeof LEAD_STATUSES)[number])}
                          className="opes-input py-1 text-xs font-semibold w-36"
                        >
                          {LEAD_STATUSES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {status !== 'CONVERTED' ? (
                          <button
                            type="button"
                            disabled={provisioningLeadId === id}
                            onClick={() => void handleProvisionLead(l)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-[11px] font-semibold disabled:opacity-50"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> {provisioningLeadId === id ? 'Provisioning...' : 'Convert to Tenant'}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Converted
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PLANS & QUOTAS (PERSISTED TO /governance/plans) */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                    {plan.id}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700">Live Backend Catalog</span>
                </div>
                <h3 className="font-display text-lg font-bold text-slate-950">{plan.name}</h3>
                <div className="font-mono text-2xl font-bold text-slate-950">
                  {formatFromXaf(plan.monthlyFeeFcfa)}
                  <span className="text-xs font-normal text-slate-500"> / station / mo</span>
                </div>
                <div className="text-xs font-mono text-slate-500">Intl equiv: {formatUsdFromXaf(plan.monthlyFeeFcfa)}</div>
                <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <div>Max Stations: <strong className="text-slate-950">{plan.maxStations >= 999 ? 'Unlimited' : plan.maxStations}</strong></div>
                  <div>Max Pumps / Site: <strong className="text-slate-950">{plan.maxPumps >= 999 ? 'Unlimited' : plan.maxPumps}</strong></div>
                  <div>Default Free Trial: <strong className="text-slate-950">{plan.trialDays} days</strong></div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPlan(plan);
                  setPlanFeeDraft(String(plan.monthlyFeeFcfa));
                  setPlanStationsDraft(String(plan.maxStations));
                  setPlanPumpCapDraft(String(plan.maxPumps));
                  setPlanTrialDraft(String(plan.trialDays));
                }}
                className="w-full py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
              >
                Edit Pricing &amp; Quotas
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TAB 6: GLOBAL BILLING & CAMEROON MOMO SETTLEMENT LEDGER */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-950">Cross-Tenant SaaS Invoices ({globalInvoices.length})</h3>
                <p className="text-xs text-slate-500">Real Postgres billing_invoices across all tenants with instant settlement recording.</p>
              </div>
              <button
                type="button"
                onClick={() => setNewInvoiceOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Issue SaaS Invoice
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0F172A] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Invoice #</th>
                    <th className="px-4 py-3 text-left">Tenant</th>
                    <th className="px-4 py-3 text-left">Period</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Settled</th>
                    <th className="px-4 py-3 text-left">Status / Channel</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {globalInvoices.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No cross-tenant invoices issued yet.</td></tr>
                  ) : (
                    globalInvoices.map((inv) => {
                      const id = String(inv.id ?? '');
                      const status = String(inv.status ?? 'ISSUED');
                      const total = Number(inv.totalFcfa ?? 0);
                      const paid = Number(inv.paidFcfa ?? 0);
                      return (
                        <tr key={id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">{String(inv.invoiceNumber ?? id)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-950">{String(inv.tenantName ?? inv.tenantId ?? '')}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{String(inv.periodLabel ?? '')}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{formatFromXaf(total)}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-700">{formatFromXaf(paid)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : status === 'OVERDUE'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {status}
                            </span>
                            <span className="ml-1.5 font-mono text-[10px] text-slate-500">{String(inv.channel ?? '')}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {status !== 'PAID' && (
                                <button
                                  type="button"
                                  onClick={() => void handleMarkInvoicePaid(id)}
                                  className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold"
                                >
                                  Mark Paid
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  printSaasInvoicePdf({
                                    invoiceNumber: String(inv.invoiceNumber ?? id),
                                    organizationName: String(inv.tenantName ?? ''),
                                    periodLabel: String(inv.periodLabel ?? ''),
                                    totalFcfa: total,
                                    paidFcfa: paid,
                                    status,
                                    usdEquivalent: formatUsdFromXaf(total),
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold"
                              >
                                <Printer className="w-3 h-3" /> PDF
                              </button>
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

          {/* Global Cameroon MTN MoMo & Orange Money Settlement Feed */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-slate-950">Global Cameroon MTN MoMo &amp; Orange Money Settlement Ledger</h3>
                <p className="text-xs text-slate-500">Live cross-tenant Mobile Money collections, webhook status, and provider financial references.</p>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-700">Settled: {formatFromXaf(momoSettledVolume)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Provider</th>
                    <th className="px-4 py-2.5 text-left">Tenant</th>
                    <th className="px-4 py-2.5 text-left">MSISDN</th>
                    <th className="px-4 py-2.5 text-left">Reference / Provider TX</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-left">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {momoSettlements.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No Cameroon Mobile Money transactions recorded yet.</td></tr>
                  ) : (
                    momoSettlements.map((m) => (
                      <tr key={String(m.id)} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-900">{String(m.provider ?? '')}</td>
                        <td className="px-4 py-2.5 text-slate-800">{String(m.tenantName ?? m.tenantId ?? '')}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-700">{String(m.msisdn ?? '')}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                          {String(m.referenceId ?? '')}
                          {Boolean(m.providerTxId) && <span className="block text-slate-400">{String(m.providerTxId)}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-950">{formatFromXaf(Number(m.amountFcfa ?? 0))}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              String(m.status) === 'SUCCESSFUL'
                                ? 'bg-emerald-50 text-emerald-700'
                                : String(m.status) === 'FAILED'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {String(m.status ?? 'PENDING')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-500">{formatShortDate(String(m.createdAt ?? ''))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: ENTERPRISE LICENSES (PERSISTED + REVOKE) */}
      {activeTab === 'licenses' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-950">Enterprise Sovereign Software Licenses ({licenses.length})</h3>
              <p className="text-xs text-slate-500">Issue verifiable Guilloché PDF licenses and revoke compromised or expired keys with full audit trail.</p>
            </div>
            <button
              type="button"
              onClick={() => setNewLicenseOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Issue Enterprise License
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0F172A] text-white">
                <tr>
                  <th className="px-4 py-3 text-left">License Key</th>
                  <th className="px-4 py-3 text-left">Organization &amp; Tier</th>
                  <th className="px-4 py-3 text-right">Stations Cap</th>
                  <th className="px-4 py-3 text-right">Annual Fee</th>
                  <th className="px-4 py-3 text-left">Expiry</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {licenses.map((lic) => {
                  const status = String(lic.status ?? 'ACTIVE');
                  return (
                    <tr key={String(lic.id)} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{String(lic.licenseKey ?? '')}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-950">{String(lic.organizationName ?? '')}</div>
                        <div className="text-[11px] text-slate-500">{String(lic.tierName ?? '')}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{Number(lic.maxStations ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{formatFromXaf(Number(lic.annualFeeFcfa ?? 0))}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{String(lic.expiresAt ?? '')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {status}
                        </span>
                        {Boolean(lic.revokedReason) && (
                          <div className="text-[10px] text-red-700 mt-0.5 max-w-[180px] truncate">{String(lic.revokedReason)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              printEnterpriseLicensePdf({
                                licenseKey: String(lic.licenseKey ?? ''),
                                organizationName: String(lic.organizationName ?? ''),
                                tierName: String(lic.tierName ?? ''),
                                maxStations: Number(lic.maxStations ?? 10),
                                expiresAt: String(lic.expiresAt ?? ''),
                                feeLabel: formatFromXaf(Number(lic.annualFeeFcfa ?? 0)),
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold"
                          >
                            <Printer className="w-3 h-3" /> Certificate PDF
                          </button>
                          {status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => setRevokingLicense(lic)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold"
                            >
                              <Ban className="w-3 h-3" /> Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: API & PAYMENT GATEWAYS HUB */}
      {activeTab === 'integrations' && (
        <ApiIntegrationsHubPanel scope="GLOBAL" role="PLATFORM_ADMIN" onNotify={onNotify} />
      )}

      {/* TAB 9: BROADCASTS & LIVE INFRASTRUCTURE HEALTH TELEMETRY */}
      {activeTab === 'broadcasts' && (
        <div className="space-y-6">
          {/* LIVE Infrastructure Telemetry Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-emerald-700" /> Database &amp; Flyway Schema
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold">
                  {String(healthTelemetry?.databaseStatus ?? 'UP')}
                </span>
              </div>
              <div className="font-mono text-xl font-bold text-slate-950">
                {String(healthTelemetry?.flywaySchemaVersion ?? 'V24')}{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({Number(healthTelemetry?.flywayMigrationsApplied ?? 24)} migrations)
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Ping latency: {Number(healthTelemetry?.databaseLatencyMs ?? 5)} ms · Java {String(healthTelemetry?.javaVersion ?? '25')}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-amber-600" /> Edge Agents &amp; Webhooks
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px] font-bold">
                  {Number(healthTelemetry?.webhookSuccessRatePct ?? 100).toFixed(1)}% OK
                </span>
              </div>
              <div className="font-mono text-xl font-bold text-slate-950">
                {Number(healthTelemetry?.edgeDevicesOnline ?? 0)} / {Number(healthTelemetry?.edgeDevicesTotal ?? 0)} Online
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Webhooks: {Number(healthTelemetry?.webhooksTotal ?? 0)} total · {Number(healthTelemetry?.webhooksFailed ?? 0)} failed
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-slate-900" /> Gateways &amp; JVM Runtime
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold">
                  {Number(healthTelemetry?.connectorsVerified ?? 0)}/{Number(healthTelemetry?.connectorsConfigured ?? 0)} Verified
                </span>
              </div>
              <div className="font-mono text-xl font-bold text-slate-950">
                {Number(healthTelemetry?.heapUsedMb ?? 0)} / {Number(healthTelemetry?.heapMaxMb ?? 1024)} MB
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                MoMo pending: {Number(healthTelemetry?.momoPendingCount ?? 0)} · failed: {Number(healthTelemetry?.momoFailedCount ?? 0)}
              </div>
            </div>
          </div>

          {/* Persisted Broadcasts Log */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-950">Multi-Tenant Broadcast Dispatch Log ({broadcasts.length})</h3>
                <p className="text-xs text-slate-500">Dispatches real in-app alerts, SMTP/Resend emails, or Meta WhatsApp notifications to tenant owners.</p>
              </div>
              <button
                type="button"
                onClick={() => setBroadcastOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
              >
                <Megaphone className="w-3.5 h-3.5" /> New Broadcast
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {broadcasts.map((b) => (
                <div key={String(b.id)} className="p-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#0F172A] text-white font-mono text-[10px] font-bold">{String(b.channel ?? 'IN_APP')}</span>
                      <span className="text-xs font-bold text-slate-950">{String(b.title ?? '')}</span>
                    </div>
                    <p className="text-xs text-slate-600">{String(b.message ?? '')}</p>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-500 shrink-0">
                    <div>Delivered: {Number(b.dispatchedCount ?? 0)}/{Number(b.recipientCount ?? 0)} tenants</div>
                    <div>{formatShortDate(String(b.sentAt ?? ''))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: GOVERNANCE */}
      {activeTab === 'governance' && (
        <PlatformGovernanceControlsPanel
          engine={engine}
          tenants={tenants}
          onPostBackend={onPostBackend}
          onEnterSupportView={() => setActiveTab('support')}
          onNotify={onNotify}
        />
      )}

      {/* TAB 11: PLATFORM SECURITY & SUPER-ADMIN AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Filter by action, actor email, entity, summary..."
                  className="opes-input pl-9 text-xs"
                />
              </div>
              <select
                value={auditTenantFilter}
                onChange={(e) => setAuditTenantFilter(e.target.value)}
                className="opes-input text-xs w-48"
              >
                <option value="ALL">All Scopes (Platform + Tenants)</option>
                <option value="PLATFORM">Platform Control Plane Only</option>
                {tenants.map((t) => (
                  <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportSaasAuditCsv(filteredAuditLogs as Array<Record<string, string>>)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-900"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button
                type="button"
                onClick={() => printSaasAuditTrailPdf(filteredAuditLogs as Array<Record<string, string>>)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" /> Audit Trail PDF
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0F172A] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Timestamp</th>
                    <th className="px-4 py-3 text-left">Scope</th>
                    <th className="px-4 py-3 text-left">Actor</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAuditLogs.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No audit records match your filter.</td></tr>
                  ) : (
                    filteredAuditLogs.map((l) => (
                      <tr key={String(l.id)} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">{formatShortDate(String(l.createdAt ?? ''))}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700">{String(l.tenantId ?? 'PLATFORM')}</td>
                        <td className="px-4 py-2.5 text-slate-900 font-medium">{String(l.actorEmail ?? '')}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-800">
                            {String(l.action ?? '')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{String(l.summary ?? '')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <FormModal open={newTenantOpen} onClose={() => setNewTenantOpen(false)} title="Provision New SaaS Tenant" subtitle="Creates organization, initial stations, feature flags, and audit trail in PostgreSQL.">
        <form onSubmit={(e) => void handleCreateManualTenant(e)} className="space-y-4">
          <div>
            <label className="opes-label">Organization / Petrol Network Name</label>
            <input type="text" required value={ntName} onChange={(e) => setNtName(e.target.value)} placeholder="e.g. Wouri Energies SA" className="opes-input text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Owner Email</label>
              <input type="email" required value={ntEmail} onChange={(e) => setNtEmail(e.target.value)} placeholder="ceo@company.cm" className="opes-input text-xs" />
            </div>
            <div>
              <label className="opes-label">Primary City</label>
              <input type="text" required value={ntCity} onChange={(e) => setNtCity(e.target.value)} className="opes-input text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="opes-label">Plan Tier</label>
              <select value={ntPlan} onChange={(e) => setNtPlan(e.target.value)} className="opes-input text-xs">
                <option value="starter">Starter</option>
                <option value="growth">Multi-Pump Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Stations</label>
              <input type="number" min={1} max={50} required value={ntStations} onChange={(e) => setNtStations(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Trial Days</label>
              <input type="number" min={0} max={90} required value={ntTrialDays} onChange={(e) => setNtTrialDays(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div>
            <label className="opes-label">Country Code (ISO)</label>
            <input type="text" maxLength={3} value={ntCountry} onChange={(e) => setNtCountry(e.target.value.toUpperCase())} className="opes-input font-mono text-xs w-28" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNewTenantOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold">Provision Live Tenant</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={Boolean(editingPlan)} onClose={() => setEditingPlan(null)} title={`Edit Plan: ${editingPlan?.name ?? ''}`} subtitle="Persisted directly to platform_subscription_plans.">
        <form onSubmit={(e) => void handleSavePlanEdit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Monthly Fee (FCFA / station)</label>
              <input type="number" min={0} required value={planFeeDraft} onChange={(e) => setPlanFeeDraft(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Trial Days</label>
              <input type="number" min={0} required value={planTrialDraft} onChange={(e) => setPlanTrialDraft(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Max Stations</label>
              <input type="number" min={1} required value={planStationsDraft} onChange={(e) => setPlanStationsDraft(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Max Pumps / Station</label>
              <input type="number" min={1} required value={planPumpCapDraft} onChange={(e) => setPlanPumpCapDraft(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingPlan(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold">Save to Backend</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={newInvoiceOpen} onClose={() => setNewInvoiceOpen(false)} title="Issue Global SaaS Invoice" subtitle="Creates an official invoice in billing_invoices.">
        <form onSubmit={(e) => void handleIssueGlobalInvoice(e)} className="space-y-4">
          <div>
            <label className="opes-label">Target Tenant</label>
            <select value={invTenantId} onChange={(e) => setInvTenantId(e.target.value)} required className="opes-input text-xs">
              {tenants.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Billing Period (YYYY-MM)</label>
              <input type="text" required value={invPeriod} onChange={(e) => setInvPeriod(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Total Amount (FCFA)</label>
              <input type="number" min={1000} required value={invAmount} onChange={(e) => setInvAmount(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div>
            <label className="opes-label">Preferred Settlement Channel</label>
            <select value={invChannel} onChange={(e) => setInvChannel(e.target.value)} className="opes-input text-xs">
              <option value="MTN_MOMO">MTN MoMo Cameroon</option>
              <option value="ORANGE_MONEY">Orange Money Cameroon</option>
              <option value="BANK_TRANSFER">CEMAC Bank Wire</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNewInvoiceOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold">Issue Invoice</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={newLicenseOpen} onClose={() => setNewLicenseOpen(false)} title="Issue Enterprise Software License" subtitle="Persists license key and enables verifiable Guilloché PDF export.">
        <form onSubmit={(e) => void handleIssueLicense(e)} className="space-y-4">
          <div>
            <label className="opes-label">Link Existing Tenant (Optional)</label>
            <select
              value={licTenantId}
              onChange={(e) => {
                setLicTenantId(e.target.value);
                const found = tenants.find((t) => String(t.id) === e.target.value);
                if (found) setLicOrg(String(found.name ?? ''));
              }}
              className="opes-input text-xs"
            >
              <option value="">Standalone / On-Premises Enterprise</option>
              {tenants.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="opes-label">Licensed Organization Name</label>
            <input type="text" required value={licOrg} onChange={(e) => setLicOrg(e.target.value)} className="opes-input text-xs" />
          </div>
          <div>
            <label className="opes-label">License Tier</label>
            <input type="text" required value={licTier} onChange={(e) => setLicTier(e.target.value)} className="opes-input text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="opes-label">Max Stations</label>
              <input type="number" min={1} required value={licMaxStations} onChange={(e) => setLicMaxStations(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Annual Fee (FCFA)</label>
              <input type="number" min={0} required value={licFee} onChange={(e) => setLicFee(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Expiry Date</label>
              <input type="date" required value={licExpires} onChange={(e) => setLicExpires(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNewLicenseOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold">Issue License Key</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={Boolean(revokingLicense)} onClose={() => setRevokingLicense(null)} title="Revoke Enterprise License" subtitle={`Key: ${String(revokingLicense?.licenseKey ?? '')} (${String(revokingLicense?.organizationName ?? '')})`}>
        <form onSubmit={(e) => void handleConfirmRevokeLicense(e)} className="space-y-4">
          <div>
            <label className="opes-label">Mandatory Revocation Reason</label>
            <textarea rows={3} required value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder="e.g. Contract superseded / non-payment / key compromised" className="opes-input text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRevokingLicense(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold">Confirm Revocation</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={broadcastOpen} onClose={() => setBroadcastOpen(false)} title="Send Platform Broadcast" subtitle="Persists message and dispatches via In-App Alerts, SMTP/Resend Email, or WhatsApp Cloud API.">
        <form onSubmit={(e) => void handleSendBroadcast(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Channel</label>
              <select value={bcChannel} onChange={(e) => setBcChannel(e.target.value as 'IN_APP' | 'EMAIL' | 'WHATSAPP')} className="opes-input text-xs">
                <option value="IN_APP">In-App Workspace Alert</option>
                <option value="EMAIL">Email (SMTP / Resend)</option>
                <option value="WHATSAPP">WhatsApp Cloud API</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Audience</label>
              <select value={bcAudience} onChange={(e) => setBcAudience(e.target.value)} className="opes-input text-xs">
                <option value="ALL_ACTIVE">All Active Tenants</option>
                <option value="ALL">All Tenants (Including Suspended)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="opes-label">Subject / Headline</label>
            <input type="text" required value={bcTitle} onChange={(e) => setBcTitle(e.target.value)} className="opes-input text-xs" />
          </div>
          <div>
            <label className="opes-label">Message Body</label>
            <textarea rows={4} required value={bcMessage} onChange={(e) => setBcMessage(e.target.value)} className="opes-input text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBroadcastOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold">Dispatch Broadcast</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
