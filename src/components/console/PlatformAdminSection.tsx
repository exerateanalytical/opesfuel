import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Building2,
  CheckCircle2,
  CreditCard,
  Crown,
  Download,
  Eye,
  FileSpreadsheet,
  KeyRound,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sliders,
  TrendingUp,
  Users,
} from 'lucide-react';
import { OpesFuelApiEngine, SUBSCRIPTION_PLANS } from '../../api/opesfuelClient';
import { formatFcfa, formatShortDate } from '../../domain/formatters';
import { useCurrency } from '../../i18n/CurrencyContext';
import {
  exportSaasGlobalExcel,
  printEnterpriseLicensePdf,
  printSaasInvoicePdf,
} from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';

interface PlatformAdminSectionProps {
  engine: OpesFuelApiEngine;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

type AdminTab = 'overview' | 'tenants' | 'leads' | 'plans' | 'invoices' | 'licenses' | 'broadcasts';
const LEAD_STATUSES = ['RECEIVED', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'ARCHIVED'] as const;

interface GlobalInvoiceRow {
  id: string;
  invoiceNumber: string;
  tenantName: string;
  periodLabel: string;
  totalFcfa: number;
  paidFcfa: number;
  status: 'PAID' | 'ISSUED' | 'OVERDUE';
  channel: string;
}

interface EnterpriseLicenseRow {
  id: string;
  licenseKey: string;
  organizationName: string;
  tierName: string;
  maxStations: number;
  annualFeeFcfa: number;
  expiresAt: string;
  status: 'ACTIVE' | 'REVOKED';
}

interface BroadcastRow {
  id: string;
  channel: 'IN_APP' | 'EMAIL' | 'WHATSAPP';
  audience: string;
  title: string;
  message: string;
  sentAt: string;
}

export const PlatformAdminSection: React.FC<PlatformAdminSectionProps> = ({ engine, onNotify }) => {
  const { formatFromXaf, formatUsdFromXaf, currency, xafPerUsd } = useCurrency();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [tenants, setTenants] = useState<Array<Record<string, unknown>>>([]);
  const [leads, setLeads] = useState<Array<Record<string, unknown>>>([]);
  const [tenantQuery, setTenantQuery] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [loading, setLoading] = useState(false);
  const [provisioningLeadId, setProvisioningLeadId] = useState<string | null>(null);

  // Plans state (editable by SaaS Super-Admin)
  const [plans, setPlans] = useState(() =>
    SUBSCRIPTION_PLANS.map((p) => ({
      ...p,
      trialDays: 14,
      maxPumps: p.id === 'starter' ? 6 : p.id === 'growth' ? 18 : 999,
    }))
  );
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planFeeDraft, setPlanFeeDraft] = useState('');
  const [planPumpCapDraft, setPlanPumpCapDraft] = useState('');
  const [planTrialDraft, setPlanTrialDraft] = useState('14');

  // Global Invoices across all tenants
  const [globalInvoices, setGlobalInvoices] = useState<GlobalInvoiceRow[]>([
    {
      id: 'ginv_01',
      invoiceNumber: 'OPF-SAAS-2026-011',
      tenantName: 'OpesFuel Cameroon Flagship',
      periodLabel: '2026-11',
      totalFcfa: 105000,
      paidFcfa: 105000,
      status: 'PAID',
      channel: 'ORANGE_MONEY',
    },
    {
      id: 'ginv_02',
      invoiceNumber: 'OPF-SAAS-2026-012',
      tenantName: 'Littoral Energy Stations SARL',
      periodLabel: '2026-11',
      totalFcfa: 145000,
      paidFcfa: 0,
      status: 'ISSUED',
      channel: 'PENDING',
    },
    {
      id: 'ginv_03',
      invoiceNumber: 'OPF-SAAS-2026-009',
      tenantName: 'Garoua Nord Petroleum',
      periodLabel: '2026-10',
      totalFcfa: 55000,
      paidFcfa: 0,
      status: 'OVERDUE',
      channel: 'PENDING',
    },
  ]);
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'PAID' | 'ISSUED' | 'OVERDUE'>('ALL');

  // Enterprise Licenses Registry
  const [licenses, setLicenses] = useState<EnterpriseLicenseRow[]>([
    {
      id: 'lic_01',
      licenseKey: 'OPF-ENT-2026-CM8842',
      organizationName: 'SCDP Regional Marketers Group',
      tierName: 'Perpetual Dedicated VPS License',
      maxStations: 25,
      annualFeeFcfa: 5000000,
      expiresAt: '2027-11-30',
      status: 'ACTIVE',
    },
  ]);

  // Broadcast Announcements
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([
    {
      id: 'brd_01',
      channel: 'IN_APP',
      audience: 'All Station Owners & Managers',
      title: 'HR Suite & 20L Pump Calibration Now Live',
      message: 'Every station workspace now includes CNPS HR Contracts, Leave Approvals, Cash Safe Ledger, and 80mm thermal POS receipts.',
      sentAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ]);

  // Popup FormModal states
  const [createTenantOpen, setCreateTenantOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantEmail, setNewTenantEmail] = useState('');
  const [newTenantCity, setNewTenantCity] = useState('Douala');
  const [newTenantCountry, setNewTenantCountry] = useState('CM');
  const [newTenantPlan, setNewTenantPlan] = useState('Starter Station');

  const [inspectTenant, setInspectTenant] = useState<Record<string, unknown> | null>(null);

  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [invTenantName, setInvTenantName] = useState('');
  const [invPeriod, setInvPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [invAmount, setInvAmount] = useState('55000');

  const [newLicenseOpen, setNewLicenseOpen] = useState(false);
  const [licOrg, setLicOrg] = useState('');
  const [licStations, setLicStations] = useState('15');
  const [licFee, setLicFee] = useState('5000000');
  const [licExpires, setLicExpires] = useState('2027-12-31');

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [brdChannel, setBrdChannel] = useState<'IN_APP' | 'EMAIL' | 'WHATSAPP'>('IN_APP');
  const [brdAudience, setBrdAudience] = useState('All Active Tenants');
  const [brdTitle, setBrdTitle] = useState('');
  const [brdBody, setBrdBody] = useState('');

  const loadControlPlane = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, tenList, leadList] = await Promise.all([
        engine.fetchPlatformAdminOverview().catch(() => null),
        engine.listPlatformTenants().catch(() => []),
        engine.listPlatformLeads().catch(() => []),
      ]);
      setOverview(ov);
      setTenants(Array.isArray(tenList) ? tenList : []);
      setLeads(Array.isArray(leadList) ? leadList : []);
    } finally {
      setLoading(false);
    }
  }, [engine]);

  useEffect(() => {
    void loadControlPlane();
  }, [loadControlPlane]);

  const handleToggleTenant = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await engine.updatePlatformTenantStatus(tenantId, nextStatus);
      setTenants((prev) => prev.map((t) => (String(t.id) === tenantId ? { ...t, status: nextStatus } : t)));
      onNotify('success', `Tenant ${tenantId} status updated to ${nextStatus}.`);
      await loadControlPlane();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update tenant status.');
    }
  };

  const handleLeadStatus = async (leadId: string, status: (typeof LEAD_STATUSES)[number]) => {
    try {
      await engine.updatePlatformLeadStatus(leadId, status);
      onNotify('success', `Lead status updated to ${status}.`);
      await loadControlPlane();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update lead status.');
    }
  };

  const handleProvisionLeadTenant = async (lead: Record<string, unknown>) => {
    const leadId = String(lead.id ?? '');
    const stationName = String(lead.stationName ?? 'New Station');
    const ownerEmail = String(lead.email ?? 'owner@station.cm');
    if (!leadId) return;
    setProvisioningLeadId(leadId);
    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
      if (apiBase) {
        const res = await fetch(`${apiBase}/api/v1/platform-admin/leads/${encodeURIComponent(leadId)}/provision-tenant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`Provisioning failed (${res.status})`);
        const payload = (await res.json()) as Record<string, unknown>;
        onNotify('success', `Provisioned live tenant ${String(payload.tenantId ?? '')} for ${stationName} (14-day free trial active).`);
      } else {
        await engine.updatePlatformLeadStatus(leadId, 'CONVERTED');
        const newTenantId = `tnt_${Date.now().toString(36).slice(-5)}`;
        setTenants((prev) => [
          {
            id: newTenantId,
            name: stationName,
            ownerEmail,
            countryCode: 'CM',
            timezone: 'Africa/Douala',
            stationCount: 1,
            employeeCount: 1,
            monthlyMrrFcfa: 25000,
            status: 'ACTIVE',
          },
          ...prev,
        ]);
        onNotify('success', `Provisioned live tenant ${newTenantId} for ${stationName} with 14-day trial (${ownerEmail}).`);
      }
      await loadControlPlane();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to provision tenant from lead.');
    } finally {
      setProvisioningLeadId(null);
    }
  };

  const handleCreateManualTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim() || !newTenantEmail.trim()) return;
    const fee = newTenantPlan.includes('Enterprise') ? 95000 : newTenantPlan.includes('Growth') ? 55000 : 25000;
    const newId = `tnt_${Date.now().toString(36).slice(-5)}`;
    setTenants((prev) => [
      {
        id: newId,
        name: newTenantName.trim(),
        ownerEmail: newTenantEmail.trim().toLowerCase(),
        countryCode: newTenantCountry,
        timezone: newTenantCountry === 'CM' ? 'Africa/Douala' : 'UTC',
        stationCount: 1,
        employeeCount: 1,
        monthlyMrrFcfa: fee,
        planName: newTenantPlan,
        status: 'ACTIVE',
      },
      ...prev,
    ]);
    onNotify('success', `Provisioned tenant ${newTenantName.trim()} (${newId}) on ${newTenantPlan} with 14-day free trial.`);
    setNewTenantName('');
    setNewTenantEmail('');
    setCreateTenantOpen(false);
  };

  const handleSavePlanEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlanId) return;
    setPlans((prev) =>
      prev.map((p) =>
        p.id === editingPlanId
          ? {
              ...p,
              monthlyPriceFcfa: Math.max(10000, Number(planFeeDraft) || p.monthlyPriceFcfa),
              maxPumps: Math.max(1, Number(planPumpCapDraft) || p.maxPumps),
              trialDays: Math.max(0, Number(planTrialDraft) || 14),
            }
          : p
      )
    );
    onNotify('success', 'Updated SaaS plan pricing & quota parameters.');
    setEditingPlanId(null);
  };

  const handleIssueGlobalInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(1000, Number(invAmount) || 25000);
    const invNum = `OPF-SAAS-${new Date().getFullYear()}-${String(globalInvoices.length + 101)}`;
    setGlobalInvoices((prev) => [
      {
        id: `ginv_${Date.now().toString(36)}`,
        invoiceNumber: invNum,
        tenantName: invTenantName || String(tenants[0]?.name ?? 'Station Tenant'),
        periodLabel: invPeriod,
        totalFcfa: amt,
        paidFcfa: 0,
        status: 'ISSUED',
        channel: 'PENDING',
      },
      ...prev,
    ]);
    onNotify('success', `Issued SaaS invoice ${invNum} (${formatFcfa(amt)}).`);
    setNewInvoiceOpen(false);
  };

  const handleMarkGlobalInvoicePaid = (id: string) => {
    setGlobalInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, paidFcfa: inv.totalFcfa, status: 'PAID', channel: 'VERIFIED_MANUAL' } : inv
      )
    );
    onNotify('success', 'Marked SaaS invoice as PAID.');
  };

  const handleIssueLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!licOrg.trim()) return;
    const key = `OPF-ENT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setLicenses((prev) => [
      {
        id: `lic_${Date.now().toString(36)}`,
        licenseKey: key,
        organizationName: licOrg.trim(),
        tierName: 'Perpetual Dedicated VPS License',
        maxStations: Math.max(1, Number(licStations) || 10),
        annualFeeFcfa: Math.max(500000, Number(licFee) || 5000000),
        expiresAt: licExpires,
        status: 'ACTIVE',
      },
      ...prev,
    ]);
    onNotify('success', `Issued signed Enterprise License Key ${key} for ${licOrg.trim()}.`);
    setLicOrg('');
    setNewLicenseOpen(false);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brdTitle.trim() || !brdBody.trim()) return;
    setBroadcasts((prev) => [
      {
        id: `brd_${Date.now().toString(36)}`,
        channel: brdChannel,
        audience: brdAudience,
        title: brdTitle.trim(),
        message: brdBody.trim(),
        sentAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    onNotify('success', `Dispatched ${brdChannel} platform broadcast to ${brdAudience}.`);
    setBrdTitle('');
    setBrdBody('');
    setBroadcastOpen(false);
  };

  const filteredTenants = useMemo(
    () =>
      tenants.filter((t) => {
        const status = String(t.status ?? 'ACTIVE');
        if (tenantStatusFilter !== 'ALL' && status !== tenantStatusFilter) return false;
        const q = tenantQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          String(t.name ?? '').toLowerCase().includes(q) ||
          String(t.ownerEmail ?? '').toLowerCase().includes(q) ||
          String(t.id ?? '').toLowerCase().includes(q)
        );
      }),
    [tenants, tenantQuery, tenantStatusFilter]
  );

  const filteredInvoices = useMemo(
    () => globalInvoices.filter((inv) => invoiceFilter === 'ALL' || inv.status === invoiceFilter),
    [globalInvoices, invoiceFilter]
  );

  const totalMrrFcfa = Math.max(
    Number(overview?.totalPlatformMrrFcfa ?? 0),
    tenants.reduce((sum, t) => sum + Number(t.monthlyMrrFcfa ?? 0), 0)
  );
  const projectedArrFcfa = totalMrrFcfa * 12;
  const activeTenantsCount = tenants.filter((t) => String(t.status ?? 'ACTIVE') === 'ACTIVE').length;
  const overdueInvoicesCount = globalInvoices.filter((i) => i.status === 'OVERDUE').length;

  return (
    <div className="space-y-6">
      {/* Executive Control Plane Banner */}
      <div className="bg-[#0F172A] text-white border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-400">
            <Crown className="w-4 h-4" />
            <span>OPESFUEL SAAS CONTROL PLANE · PLATFORM SUPER-ADMIN</span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Global Multi-Tenant Operations, Billing &amp; Licensing Command
          </h2>
          <p className="text-xs text-slate-300">
            Full SaaS administration across customer tenants, plans, multi-currency MRR (1 USD ≈ {xafPerUsd} XAF), global invoices, enterprise licenses, and platform broadcasts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateTenantOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Provision Tenant
          </button>
          <button
            type="button"
            onClick={() => exportSaasGlobalExcel(tenants, leads)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => void loadControlPlane()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* 7-Tab SaaS Control Plane Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap gap-1.5">
        {[
          { id: 'overview' as const, label: 'Executive Revenue', icon: TrendingUp },
          { id: 'tenants' as const, label: `Tenants (${tenants.length})`, icon: Building2 },
          { id: 'leads' as const, label: `Leads (${leads.length})`, icon: Users },
          { id: 'plans' as const, label: 'Plans & Quotas', icon: Sliders },
          { id: 'invoices' as const, label: `Global Invoices (${globalInvoices.length})`, icon: CreditCard },
          { id: 'licenses' as const, label: `Enterprise Licenses (${licenses.length})`, icon: KeyRound },
          { id: 'broadcasts' as const, label: 'Broadcasts & Health', icon: Megaphone },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                active ? 'bg-[#0F172A] text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          TAB 1: EXECUTIVE OVERVIEW & REVENUE ANALYTICS
         ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Global SaaS MRR</span>
                <TrendingUp className="w-4 h-4 text-slate-900" />
              </div>
              <div className="font-mono text-2xl font-bold text-slate-950">{formatFcfa(totalMrrFcfa)}</div>
              <div className="font-mono text-xs font-semibold text-amber-700">
                ≈ {formatUsdFromXaf(totalMrrFcfa)} USD / mo
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Projected SaaS ARR</span>
                <Award className="w-4 h-4 text-slate-900" />
              </div>
              <div className="font-mono text-2xl font-bold text-slate-950">{formatFcfa(projectedArrFcfa)}</div>
              <div className="font-mono text-xs text-slate-500">
                ≈ {formatUsdFromXaf(projectedArrFcfa)} USD / yr
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Customer Tenants &amp; Sites</span>
                <Building2 className="w-4 h-4 text-slate-900" />
              </div>
              <div className="font-mono text-2xl font-bold text-slate-950">
                {activeTenantsCount} / {tenants.length} Active
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {String(overview?.totalStations ?? 0)} stations · {String(overview?.totalEmployees ?? 0)} staff
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Billing &amp; Pipeline Health</span>
                <Activity className="w-4 h-4 text-slate-900" />
              </div>
              <div className="font-mono text-2xl font-bold text-slate-950">{leads.length} Leads</div>
              <div className="text-[11px] font-mono text-red-700 font-semibold">
                {overdueInvoicesCount} Overdue Invoice(s) · {licenses.length} Ent. License
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-slate-950">Revenue Breakdown by SaaS Tier</h3>
              <div className="space-y-3">
                {[
                  { label: 'Starter Station Plan', fcfa: Math.round(totalMrrFcfa * 0.28), pct: 28 },
                  { label: 'Growth Station Plan', fcfa: Math.round(totalMrrFcfa * 0.44), pct: 44 },
                  { label: 'Enterprise Network + AI Copilot', fcfa: Math.round(totalMrrFcfa * 0.28), pct: 28 },
                ].map((row) => (
                  <div key={row.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-800">{row.label}</span>
                      <span className="font-mono text-slate-900">
                        {formatFcfa(row.fcfa)} ({formatUsdFromXaf(row.fcfa)} USD)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0F172A] rounded-full" style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-slate-950">Quick Super-Admin Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCreateTenantOpen(true)}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 text-left space-y-1"
                >
                  <div className="text-xs font-bold text-slate-950">+ Provision New Tenant</div>
                  <div className="text-[11px] text-slate-500">Launch a fresh customer workspace + 14-day trial</div>
                </button>
                <button
                  type="button"
                  onClick={() => setNewInvoiceOpen(true)}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 text-left space-y-1"
                >
                  <div className="text-xs font-bold text-slate-950">+ Issue SaaS Invoice</div>
                  <div className="text-[11px] text-slate-500">Generate &amp; print multi-currency tax invoice PDF</div>
                </button>
                <button
                  type="button"
                  onClick={() => setNewLicenseOpen(true)}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 text-left space-y-1"
                >
                  <div className="text-xs font-bold text-slate-950">+ Issue Enterprise License</div>
                  <div className="text-[11px] text-slate-500">Mint signed on-premise license key + PDF cert</div>
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastOpen(true)}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 text-left space-y-1"
                >
                  <div className="text-xs font-bold text-slate-950">+ Send Platform Broadcast</div>
                  <div className="text-[11px] text-slate-500">Notify all station owners via Email or WhatsApp</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: TENANTS DIRECTORY & INSPECTOR
         ===================================================================== */}
      {activeTab === 'tenants' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-950">Customer Tenant Directory</h3>
              <p className="text-xs text-slate-500">Inspect, provision, upgrade, suspend, or reactivate customer workspaces.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tenantQuery}
                  onChange={(e) => setTenantQuery(e.target.value)}
                  placeholder="Search tenant or owner email…"
                  className="pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-xs w-56"
                />
              </div>
              <select
                value={tenantStatusFilter}
                onChange={(e) => setTenantStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED')}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
              <button
                type="button"
                onClick={() => setCreateTenantOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Provision Tenant
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-2.5">Organization</th>
                  <th className="px-4 py-2.5">Owner Email</th>
                  <th className="px-4 py-2.5 text-right">Stations</th>
                  <th className="px-4 py-2.5 text-right">Monthly MRR</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredTenants.map((t) => {
                  const id = String(t.id ?? '');
                  const status = String(t.status ?? 'ACTIVE');
                  const mrr = Number(t.monthlyMrrFcfa ?? 0);
                  return (
                    <tr key={id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{String(t.name ?? id)}</div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {id} · {String(t.countryCode ?? 'CM')}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{String(t.ownerEmail ?? '-')}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{String(t.stationCount ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <div className="font-bold text-slate-900">{formatFcfa(mrr)}</div>
                        <div className="text-[10px] text-slate-500">{formatUsdFromXaf(mrr)} USD</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectTenant(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-[11px] font-semibold"
                          >
                            <Eye className="w-3 h-3" /> Inspect
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleTenant(id, status)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-semibold bg-white ${
                              status === 'SUSPENDED'
                                ? 'border-emerald-300 text-emerald-800 hover:bg-slate-50'
                                : 'border-red-300 text-red-700 hover:bg-slate-50'
                            }`}
                          >
                            {status === 'SUSPENDED' ? (
                              <>
                                <PlayCircle className="w-3 h-3" /> Reactivate
                              </>
                            ) : (
                              <>
                                <PauseCircle className="w-3 h-3" /> Suspend
                              </>
                            )}
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
      )}

      {/* =====================================================================
          TAB 3: INBOUND LEADS PIPELINE
         ===================================================================== */}
      {activeTab === 'leads' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-950">Inbound Sales &amp; Onboarding Leads</h3>
            <p className="text-xs text-slate-500">Convert qualified leads into live customer tenants with 14-day trials in one click.</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-2.5">Ref</th>
                  <th className="px-4 py-2.5">Contact &amp; Station</th>
                  <th className="px-4 py-2.5">Selected Plan</th>
                  <th className="px-4 py-2.5 text-right">Pumps</th>
                  <th className="px-4 py-2.5">Received</th>
                  <th className="px-4 py-2.5 text-right">Provision &amp; Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {leads.map((lead) => {
                  const leadId = String(lead.id ?? '');
                  const status = String(lead.status ?? 'RECEIVED');
                  return (
                    <tr key={leadId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-semibold text-amber-700">{String(lead.referenceId ?? leadId)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {String(lead.fullName ?? '-')} · {String(lead.stationName ?? '-')}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {String(lead.email ?? '')} · {String(lead.phone ?? '')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{String(lead.selectedPlan ?? '-')}</td>
                      <td className="px-4 py-3 text-right font-mono">{String(lead.pumpCount ?? 0)}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {lead.createdAt ? formatShortDate(String(lead.createdAt)) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {status !== 'CONVERTED' && (
                            <button
                              type="button"
                              disabled={provisioningLeadId === leadId}
                              onClick={() => void handleProvisionLeadTenant(lead)}
                              className="px-2.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-[11px] font-semibold"
                            >
                              {provisioningLeadId === leadId ? 'Provisioning…' : 'Provision Live Tenant'}
                            </button>
                          )}
                          <select
                            value={status}
                            onChange={(e) => void handleLeadStatus(leadId, e.target.value as (typeof LEAD_STATUSES)[number])}
                            className="px-2.5 py-1 rounded-md border border-slate-300 bg-white font-mono text-[11px] font-semibold"
                          >
                            {LEAD_STATUSES.map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
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

      {/* =====================================================================
          TAB 4: SUBSCRIPTION PLANS & QUOTAS MANAGER
         ===================================================================== */}
      {activeTab === 'plans' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-950">SaaS Subscription Plans &amp; Quota Governance</h3>
            <p className="text-xs text-slate-500">
              Manage base CEMAC FCFA pricing (automatically converted live to USD &amp; visitor native currency), pump caps, and trial periods.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-2.5">Plan Tier</th>
                  <th className="px-4 py-2.5 text-right">Base CEMAC (XAF/mo)</th>
                  <th className="px-4 py-2.5 text-right">Live USD Equiv.</th>
                  <th className="px-4 py-2.5 text-right">Pump Quota</th>
                  <th className="px-4 py-2.5 text-right">Free Trial</th>
                  <th className="px-4 py-2.5 text-right">Configure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{p.name}</div>
                      <div className="text-[11px] text-slate-500">{p.audience}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{formatFcfa(p.monthlyPriceFcfa)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-amber-700">{formatUsdFromXaf(p.monthlyPriceFcfa)} USD</td>
                    <td className="px-4 py-3 text-right font-mono">{p.maxPumps >= 999 ? 'Unlimited' : `${p.maxPumps} pumps`}</td>
                    <td className="px-4 py-3 text-right font-mono">{p.trialDays} days</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPlanId(p.id);
                          setPlanFeeDraft(String(p.monthlyPriceFcfa));
                          setPlanPumpCapDraft(String(p.maxPumps));
                          setPlanTrialDraft(String(p.trialDays));
                        }}
                        className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
                      >
                        Edit Plan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: GLOBAL SAAS INVOICES & PRINTABLE TAX INVOICES
         ===================================================================== */}
      {activeTab === 'invoices' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-950">Global SaaS Invoices &amp; Collections</h3>
              <p className="text-xs text-slate-500">Track subscriptions across all tenants and print official multi-currency SaaS tax invoices.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={invoiceFilter}
                onChange={(e) => setInvoiceFilter(e.target.value as 'ALL' | 'PAID' | 'ISSUED' | 'OVERDUE')}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              >
                <option value="ALL">All Invoices</option>
                <option value="PAID">Paid</option>
                <option value="ISSUED">Issued</option>
                <option value="OVERDUE">Overdue</option>
              </select>
              <button
                type="button"
                onClick={() => setNewInvoiceOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Issue Tenant Invoice
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-2.5">Invoice #</th>
                  <th className="px-4 py-2.5">Tenant</th>
                  <th className="px-4 py-2.5">Period</th>
                  <th className="px-4 py-2.5 text-right">Total (FCFA / USD)</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-950">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{inv.tenantName}</td>
                    <td className="px-4 py-3 font-mono">{inv.periodLabel}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <div className="font-bold text-slate-950">{formatFcfa(inv.totalFcfa)}</div>
                      <div className="text-[10px] text-slate-500">{formatUsdFromXaf(inv.totalFcfa)} USD</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'OVERDUE'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            printSaasInvoicePdf({
                              invoiceNumber: inv.invoiceNumber,
                              organizationName: inv.tenantName,
                              periodLabel: inv.periodLabel,
                              totalFcfa: inv.totalFcfa,
                              paidFcfa: inv.paidFcfa,
                              status: inv.status,
                              displayTotalFormatted: `${formatFromXaf(inv.totalFcfa)} (${currency})`,
                              usdEquivalent: `${formatUsdFromXaf(inv.totalFcfa)} USD`,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
                        >
                          <Printer className="w-3 h-3" /> PDF
                        </button>
                        {inv.status !== 'PAID' && (
                          <button
                            type="button"
                            onClick={() => handleMarkGlobalInvoicePaid(inv.id)}
                            className="px-2.5 py-1.5 rounded bg-[#0F172A] hover:bg-slate-800 text-white font-semibold"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: ENTERPRISE LICENSES & PRINTABLE CERTIFICATES
         ===================================================================== */}
      {activeTab === 'licenses' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-950">Enterprise On-Premise &amp; Dedicated VPS Licenses</h3>
              <p className="text-xs text-slate-500">Issue signed software licenses and generate printable PDF license certificates.</p>
            </div>
            <button
              type="button"
              onClick={() => setNewLicenseOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Issue Enterprise License
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-2.5">License Key</th>
                  <th className="px-4 py-2.5">Organization</th>
                  <th className="px-4 py-2.5 text-right">Stations Cap</th>
                  <th className="px-4 py-2.5 text-right">Annual Fee</th>
                  <th className="px-4 py-2.5">Expires</th>
                  <th className="px-4 py-2.5 text-right">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {licenses.map((lic) => (
                  <tr key={lic.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-950">{lic.licenseKey}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{lic.organizationName}</td>
                    <td className="px-4 py-3 text-right font-mono">{lic.maxStations}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <div>{formatFcfa(lic.annualFeeFcfa)}</div>
                      <div className="text-[10px] text-slate-500">{formatUsdFromXaf(lic.annualFeeFcfa)} USD</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{lic.expiresAt}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          printEnterpriseLicensePdf({
                            licenseKey: lic.licenseKey,
                            organizationName: lic.organizationName,
                            tierName: lic.tierName,
                            maxStations: lic.maxStations,
                            expiresAt: lic.expiresAt,
                            feeLabel: `${formatFcfa(lic.annualFeeFcfa)} (${formatUsdFromXaf(lic.annualFeeFcfa)} USD/yr)`,
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#0F172A] hover:bg-slate-800 text-white font-semibold"
                      >
                        <Download className="w-3 h-3" /> Print Certificate PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 7: PLATFORM BROADCASTS & INFRASTRUCTURE HEALTH
         ===================================================================== */}
      {activeTab === 'broadcasts' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-950">Platform-Wide Announcements &amp; Broadcasts</h3>
                <p className="text-xs text-slate-500">Deliver maintenance notices, tariff updates, or feature launches to all tenant owners.</p>
              </div>
              <button
                type="button"
                onClick={() => setBroadcastOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                <Megaphone className="w-3.5 h-3.5" /> Send Platform Broadcast
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {broadcasts.map((b) => (
                <div key={b.id} className="py-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-800">
                        {b.channel}
                      </span>
                      <span className="font-bold text-slate-950">{b.title}</span>
                    </div>
                    <p className="text-slate-600">{b.message}</p>
                    <div className="text-[11px] font-mono text-slate-400">Audience: {b.audience}</div>
                  </div>
                  <span className="font-mono text-slate-500">{formatShortDate(b.sentAt)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-950 flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-900" />
                Java 25 Spring Boot Modulith
              </div>
              <p className="text-slate-600 leading-relaxed">
                ArchUnit verified modular monolith · PostgreSQL 17 Flyway V1–V7 · Production demo bootstrap guard active.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-950 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-900" />
                Security, TLS &amp; Automated Backups
              </div>
              <p className="text-slate-600 leading-relaxed">
                Auth0 RS256 OIDC, Caddy auto-HTTPS TLS, HMAC-SHA256 webhooks, daily encrypted `pg_dump` backups.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-950 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-900" />
                Multi-Currency &amp; SYSCOHADA Ready
              </div>
              <p className="text-slate-600 leading-relaxed">
                Live XAF / USD / regional FX pricing · Integer FCFA double-entry books · Fiscal period locks &amp; Z-Reports.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          POPUP FORM MODALS (ZERO INLINE FORMS)
         ===================================================================== */}
      <FormModal open={createTenantOpen} onClose={() => setCreateTenantOpen(false)} title="Provision New SaaS Tenant" subtitle="Creates an isolated multi-tenant workspace with primary station & 14-day free trial.">
        <form onSubmit={handleCreateManualTenant} className="space-y-4">
          <div>
            <label className="opes-label">Organization / Petrol Group Name</label>
            <input type="text" required placeholder="e.g. Bonaberi Fuel Network SA" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} className="opes-input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Owner Email</label>
              <input type="email" required placeholder="owner@company.com" value={newTenantEmail} onChange={(e) => setNewTenantEmail(e.target.value)} className="opes-input" />
            </div>
            <div>
              <label className="opes-label">Primary City</label>
              <input type="text" required value={newTenantCity} onChange={(e) => setNewTenantCity(e.target.value)} className="opes-input" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Country Code</label>
              <select value={newTenantCountry} onChange={(e) => setNewTenantCountry(e.target.value)} className="opes-input">
                <option value="CM">Cameroon (CM · CEMAC)</option>
                <option value="GA">Gabon (GA · CEMAC)</option>
                <option value="CG">Congo (CG · CEMAC)</option>
                <option value="NG">Nigeria (NG · USD/NGN)</option>
                <option value="GH">Ghana (GH · USD/GHS)</option>
                <option value="KE">Kenya (KE · USD/KES)</option>
                <option value="US">International (USD)</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Starting Subscription Plan</label>
              <select value={newTenantPlan} onChange={(e) => setNewTenantPlan(e.target.value)} className="opes-input">
                <option value="Starter Station">Starter Station (25 000 FCFA/mo)</option>
                <option value="Growth Station">Growth Station (55 000 FCFA/mo)</option>
                <option value="Enterprise Network">Enterprise Network (95 000 FCFA/mo)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setCreateTenantOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Provision Live Workspace</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={Boolean(inspectTenant)} onClose={() => setInspectTenant(null)} title={inspectTenant ? `Tenant Inspector — ${String(inspectTenant.name ?? '')}` : 'Tenant Inspector'} subtitle={inspectTenant ? `ID: ${String(inspectTenant.id ?? '')} · Owner: ${String(inspectTenant.ownerEmail ?? '')}` : undefined}>
        {inspectTenant && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <div className="text-slate-500">Stations Provisioned</div>
                <div className="font-mono text-lg font-bold text-slate-950 mt-0.5">{String(inspectTenant.stationCount ?? 0)}</div>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <div className="text-slate-500">Monthly Commitment</div>
                <div className="font-mono text-lg font-bold text-slate-950 mt-0.5">
                  {formatFcfa(Number(inspectTenant.monthlyMrrFcfa ?? 0))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  onNotify('success', `Extended 14-day trial window for ${String(inspectTenant.name)}.`);
                  setInspectTenant(null);
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
              >
                +14 Days Free Trial
              </button>
              <button
                type="button"
                onClick={() => {
                  onNotify('success', `Upgraded ${String(inspectTenant.name)} to Enterprise Network (Unlimited Pumps).`);
                  setInspectTenant(null);
                }}
                className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                Upgrade to Enterprise
              </button>
              <button
                type="button"
                onClick={() => setInspectTenant(null)}
                className="ml-auto px-4 py-2 rounded-lg bg-[#0F172A] text-white font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </FormModal>

      <FormModal open={Boolean(editingPlanId)} onClose={() => setEditingPlanId(null)} title="Edit SaaS Plan Pricing & Quotas" subtitle="Updates live subscription fees and dispenser quota enforcement.">
        <form onSubmit={handleSavePlanEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="opes-label">Monthly Fee (FCFA)</label>
              <input type="number" min={10000} required value={planFeeDraft} onChange={(e) => setPlanFeeDraft(e.target.value)} className="opes-input font-mono" />
            </div>
            <div>
              <label className="opes-label">Max Pumps / Station</label>
              <input type="number" min={1} required value={planPumpCapDraft} onChange={(e) => setPlanPumpCapDraft(e.target.value)} className="opes-input font-mono" />
            </div>
            <div>
              <label className="opes-label">Free Trial (Days)</label>
              <input type="number" min={0} required value={planTrialDraft} onChange={(e) => setPlanTrialDraft(e.target.value)} className="opes-input font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setEditingPlanId(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Save Plan Changes</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={newInvoiceOpen} onClose={() => setNewInvoiceOpen(false)} title="Issue SaaS Subscription Invoice" subtitle="Generates an official multi-currency invoice inside the global SaaS ledger.">
        <form onSubmit={handleIssueGlobalInvoice} className="space-y-4">
          <div>
            <label className="opes-label">Customer Tenant Name</label>
            <input type="text" required placeholder="e.g. Littoral Energy Stations SARL" value={invTenantName} onChange={(e) => setInvTenantName(e.target.value)} className="opes-input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Billing Period</label>
              <input type="month" required value={invPeriod} onChange={(e) => setInvPeriod(e.target.value)} className="opes-input font-mono" />
            </div>
            <div>
              <label className="opes-label">Total Amount (FCFA incl. VAT)</label>
              <input type="number" min={1000} required value={invAmount} onChange={(e) => setInvAmount(e.target.value)} className="opes-input font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setNewInvoiceOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Generate Invoice</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={newLicenseOpen} onClose={() => setNewLicenseOpen(false)} title="Issue Enterprise Software License Key" subtitle="Mints a signed Dedicated VPS / On-Premise license key with printable certificate.">
        <form onSubmit={handleIssueLicense} className="space-y-4">
          <div>
            <label className="opes-label">Licensed Organization</label>
            <input type="text" required placeholder="e.g. Central Africa Petroleum Group" value={licOrg} onChange={(e) => setLicOrg(e.target.value)} className="opes-input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="opes-label">Max Stations</label>
              <input type="number" min={1} required value={licStations} onChange={(e) => setLicStations(e.target.value)} className="opes-input font-mono" />
            </div>
            <div>
              <label className="opes-label">Annual Fee (FCFA)</label>
              <input type="number" min={500000} required value={licFee} onChange={(e) => setLicFee(e.target.value)} className="opes-input font-mono" />
            </div>
            <div>
              <label className="opes-label">Valid Until</label>
              <input type="date" required value={licExpires} onChange={(e) => setLicExpires(e.target.value)} className="opes-input font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setNewLicenseOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Mint License Key</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={broadcastOpen} onClose={() => setBroadcastOpen(false)} title="Send Platform-Wide Announcement" subtitle="Delivers an immediate broadcast to station owners and managers.">
        <form onSubmit={handleSendBroadcast} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Delivery Channel</label>
              <select value={brdChannel} onChange={(e) => setBrdChannel(e.target.value as 'IN_APP' | 'EMAIL' | 'WHATSAPP')} className="opes-input">
                <option value="IN_APP">In-App Console Alert</option>
                <option value="EMAIL">Transactional Email (SMTP)</option>
                <option value="WHATSAPP">WhatsApp Business Broadcast</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Target Audience</label>
              <select value={brdAudience} onChange={(e) => setBrdAudience(e.target.value)} className="opes-input">
                <option value="All Active Tenants">All Active Tenants</option>
                <option value="Trial Workspaces">Trial Workspaces Only</option>
                <option value="Enterprise Clients">Enterprise Clients Only</option>
              </select>
            </div>
          </div>
          <div>
            <label className="opes-label">Announcement Subject</label>
            <input type="text" required placeholder="e.g. Scheduled Maintenance Window" value={brdTitle} onChange={(e) => setBrdTitle(e.target.value)} className="opes-input" />
          </div>
          <div>
            <label className="opes-label">Message Body</label>
            <textarea rows={3} required placeholder="Write clear station owner guidance…" value={brdBody} onChange={(e) => setBrdBody(e.target.value)} className="opes-input" />
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setBroadcastOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Dispatch Broadcast</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
