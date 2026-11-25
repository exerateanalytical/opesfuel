import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  Globe2,
  Landmark,
  Layers,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { MakerCheckerApprovalItem } from '../../api/enterpriseModulesData';
import { formatFcfa, formatShortDate } from '../../domain/formatters';
import { UserRole } from '../../domain/types';
import {
  exportConsolidatedGroupExcel,
  printConsolidatedFinancialStatementsPackPdf,
  printIntercompanyEliminationCertificatePdf,
} from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';

interface HoldingConsolidationPanelProps {
  engine: OpesFuelApiEngine;
  role: UserRole;
  approvals?: MakerCheckerApprovalItem[];
  onDecideApproval?: (id: string, status: 'APPROVED' | 'REJECTED') => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

type CfoTab = 'pnl' | 'balance-sheet' | 'subsidiaries' | 'intercompany' | 'approvals';

interface SubsidiaryReportRow {
  memberId?: string;
  tenantId: string;
  entityName: string;
  countryLabel: string;
  functionalCurrency: 'XAF' | 'XOF' | 'USD';
  ownershipPct: number;
  minorityInterestPct: number;
  revenueFunctional: number;
  cogsFunctional: number;
  opexFunctional: number;
  assetsFunctional: number;
  liabilitiesFunctional: number;
  equityFunctional: number;
  intercoReceivablesFunctional: number;
  intercoPayablesFunctional: number;
  revenueReporting: number;
  cogsReporting: number;
  opexReporting: number;
  netIncomeReporting: number;
  assetsReporting: number;
  liabilitiesReporting: number;
  equityReporting: number;
  grossMarginPct: number;
  netMarginPct: number;
  debtToEquityRatio: number;
  roaPct: number;
}

export const HoldingConsolidationPanel: React.FC<HoldingConsolidationPanelProps> = ({
  engine,
  role,
  approvals = [],
  onDecideApproval,
  onNotify,
}) => {
  const canManageGroup = role === 'PLATFORM_ADMIN' || role === 'GROUP_CFO';
  const canRecordInterco = role === 'PLATFORM_ADMIN' || role === 'GROUP_CFO' || role === 'ACCOUNTANT';

  const [activeTab, setActiveTab] = useState<CfoTab>('pnl');
  const [groups, setGroups] = useState<Array<Record<string, unknown>>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('hgrp_default');
  const [period, setPeriod] = useState<string>('2026-11');
  const [reportingCcy, setReportingCcy] = useState<'XAF' | 'XOF' | 'USD'>('XAF');
  const [fxXafPerUsd, setFxXafPerUsd] = useState<number>(605);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCcy, setNewGroupCcy] = useState<'XAF' | 'XOF' | 'USD'>('XAF');

  const [addSubOpen, setAddSubOpen] = useState(false);
  const [newSubId, setNewSubId] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCountry, setNewSubCountry] = useState('CI (UEMOA)');
  const [newSubCcy, setNewSubCcy] = useState<'XAF' | 'XOF' | 'USD'>('XOF');
  const [newSubOwn, setNewSubOwn] = useState('75');

  const [editFinSub, setEditFinSub] = useState<SubsidiaryReportRow | null>(null);
  const [finRev, setFinRev] = useState('');
  const [finCogs, setFinCogs] = useState('');
  const [finOpex, setFinOpex] = useState('');
  const [finAssets, setFinAssets] = useState('');
  const [finLiab, setFinLiab] = useState('');
  const [finEquity, setFinEquity] = useState('');
  const [finIcRec, setFinIcRec] = useState('');
  const [finIcPay, setFinIcPay] = useState('');

  const [detailSub, setDetailSub] = useState<SubsidiaryReportRow | null>(null);

  const [newIntercoOpen, setNewIntercoOpen] = useState(false);
  const [icSeller, setIcSeller] = useState('');
  const [icBuyer, setIcBuyer] = useState('');
  const [icCurrency, setIcCurrency] = useState<'XAF' | 'XOF' | 'USD'>('XAF');
  const [icAmount, setIcAmount] = useState('');
  const [icDesc, setIcDesc] = useState('');

  const loadGroupsAndReport = useCallback(
    async (targetGroupId?: string, targetCcy?: 'XAF' | 'XOF' | 'USD', targetFx?: number) => {
      setLoading(true);
      try {
        const list = await engine.listHoldingGroups();
        setGroups(list);
        const resolvedId =
          targetGroupId ||
          (list.some((g) => String(g.id) === selectedGroupId) ? selectedGroupId : String(list[0]?.id ?? 'hgrp_default'));
        if (resolvedId !== selectedGroupId) setSelectedGroupId(resolvedId);

        const rep = await engine.getHoldingConsolidatedReport(
          resolvedId,
          period,
          targetCcy ?? reportingCcy,
          targetFx ?? fxXafPerUsd
        );
        setReport(rep);
        const subs = (rep.subsidiaries as SubsidiaryReportRow[] | undefined) ?? [];
        if (subs.length >= 2 && !icSeller) {
          setIcSeller(subs[0].tenantId);
          setIcBuyer(subs[1].tenantId);
        }
      } catch (err) {
        onNotify('error', err instanceof Error ? err.message : 'Unable to load consolidated group report.');
      } finally {
        setLoading(false);
      }
    },
    [engine, selectedGroupId, period, reportingCcy, fxXafPerUsd, icSeller, onNotify]
  );

  useEffect(() => {
    void loadGroupsAndReport();
  }, [loadGroupsAndReport]);

  const activeCcy = String(report?.reportingCurrency ?? reportingCcy) as 'XAF' | 'XOF' | 'USD';
  const groupName = String(report?.groupName ?? groups.find((g) => String(g.id) === selectedGroupId)?.name ?? 'Holding Group');
  const pnl = (report?.consolidatedPnl as Record<string, number> | undefined) ?? {
    grossRevenue: 0,
    intercompanyRevenueElimination: 0,
    consolidatedRevenue: 0,
    consolidatedCogs: 0,
    grossProfit: 0,
    operatingExpenses: 0,
    consolidatedNetIncome: 0,
    controllingShareNetIncome: 0,
    minorityInterestNetIncome: 0,
  };
  const bs = (report?.consolidatedBalanceSheet as Record<string, number> | undefined) ?? {
    grossAssets: 0,
    intercompanyBalanceElimination: 0,
    consolidatedAssets: 0,
    consolidatedLiabilities: 0,
    totalEquity: 0,
    controllingEquity: 0,
    minorityInterestEquity: 0,
  };
  const subsidiaries = (report?.subsidiaries as SubsidiaryReportRow[] | undefined) ?? [];
  const intercompanyTx = (report?.intercompanyTransactions as Array<Record<string, unknown>> | undefined) ?? [];
  const eliminations = (report?.eliminations as Array<Record<string, unknown>> | undefined) ?? [];
  const pendingIntercoCount = Number(report?.pendingIntercompanyCount ?? 0);
  const pendingIntercoReporting = Number(report?.pendingIntercompanyReporting ?? 0);
  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');

  const fmt = (val: number, ccy: string = activeCcy) =>
    ccy === 'USD'
      ? `$${Math.round(val).toLocaleString('en-US')}`
      : `${Math.round(val).toLocaleString('en-US').replace(/,/g, ' ')} ${ccy}`;

  const bsGap = Math.abs(bs.consolidatedAssets - (bs.consolidatedLiabilities + bs.totalEquity));
  const bsBalanced = bsGap <= 1;

  // Actions — 100% wired to backend APIs
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const created = await engine.createHoldingGroup({ name: newGroupName.trim(), reportingCurrency: newGroupCcy });
      const newId = String(created.id ?? '');
      setCreateGroupOpen(false);
      setNewGroupName('');
      setSelectedGroupId(newId);
      setReportingCcy(newGroupCcy);
      await loadGroupsAndReport(newId, newGroupCcy);
      onNotify('success', `Created holding group "${newGroupName.trim()}" (${newGroupCcy}).`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to create holding group.');
    }
  };

  const handleAddSubsidiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubId.trim() || !newSubName.trim()) return;
    try {
      await engine.addHoldingSubsidiary(selectedGroupId, {
        tenantId: newSubId.trim(),
        entityName: newSubName.trim(),
        countryLabel: newSubCountry.trim() || newSubCcy,
        functionalCurrency: newSubCcy,
        ownershipPct: Math.min(100, Math.max(1, Number(newSubOwn) || 100)),
      });
      setAddSubOpen(false);
      setNewSubId('');
      setNewSubName('');
      await loadGroupsAndReport();
      onNotify('success', `Linked subsidiary "${newSubName.trim()}" (${newSubOwn}% ownership, ${newSubCcy}) to group.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to link subsidiary.');
    }
  };

  const handleRemoveSubsidiary = async (sub: SubsidiaryReportRow) => {
    try {
      await engine.removeHoldingSubsidiary(selectedGroupId, sub.memberId || sub.tenantId);
      await loadGroupsAndReport();
      onNotify('success', `Unlinked subsidiary ${sub.entityName} from holding group.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to remove subsidiary.');
    }
  };

  const openEditFinancials = (sub: SubsidiaryReportRow) => {
    setEditFinSub(sub);
    setFinRev(String(sub.revenueFunctional));
    setFinCogs(String(sub.cogsFunctional));
    setFinOpex(String(sub.opexFunctional));
    setFinAssets(String(sub.assetsFunctional));
    setFinLiab(String(sub.liabilitiesFunctional));
    setFinEquity(String(sub.equityFunctional));
    setFinIcRec(String(sub.intercoReceivablesFunctional));
    setFinIcPay(String(sub.intercoPayablesFunctional));
  };

  const handleSaveFinancials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFinSub) return;
    try {
      await engine.submitSubsidiaryFinancials(selectedGroupId, {
        tenantId: editFinSub.tenantId,
        periodLabel: period,
        revenue: Number(finRev) || 0,
        costOfSales: Number(finCogs) || 0,
        operatingExpenses: Number(finOpex) || 0,
        totalAssets: Number(finAssets) || 0,
        totalLiabilities: Number(finLiab) || 0,
        equity: Number(finEquity) || 0,
        receivablesIntercompany: Number(finIcRec) || 0,
        payablesIntercompany: Number(finIcPay) || 0,
      });
      setEditFinSub(null);
      await loadGroupsAndReport();
      onNotify('success', `Saved period ${period} financials for ${editFinSub.entityName} (${editFinSub.functionalCurrency}).`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save subsidiary financials.');
    }
  };

  const handleRecordIntercompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!icSeller || !icBuyer || icSeller === icBuyer) {
      onNotify('error', 'Select two distinct subsidiaries for an inter-company transaction.');
      return;
    }
    try {
      await engine.recordHoldingIntercompany(selectedGroupId, {
        periodLabel: period,
        sellerTenantId: icSeller,
        buyerTenantId: icBuyer,
        currency: icCurrency,
        amount: Math.max(1, Number(icAmount) || 0),
        description: icDesc.trim() || 'Inter-subsidiary fuel transfer',
      });
      setNewIntercoOpen(false);
      setIcAmount('');
      setIcDesc('');
      await loadGroupsAndReport();
      onNotify('success', `Logged inter-company transaction (${icSeller} → ${icBuyer}) awaiting elimination.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to record inter-company transaction.');
    }
  };

  const handleRunEliminations = async () => {
    try {
      const res = await engine.runHoldingEliminations(selectedGroupId, period);
      await loadGroupsAndReport();
      const count = Number(res.eliminatedTransactions ?? 0);
      const total = Number(res.totalEliminatedReporting ?? 0);
      if (count === 0) {
        onNotify('success', `No pending inter-company transactions to eliminate for ${period}. Group books are clean.`);
      } else {
        onNotify('success', `Eliminated ${count} inter-company transaction(s) totaling ${fmt(total)} for ${period}.`);
      }
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to execute inter-company eliminations.');
    }
  };

  const tabs: Array<{ id: CfoTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { id: 'pnl', label: 'Executive & Consolidated P&L', icon: TrendingUp },
    { id: 'balance-sheet', label: 'Consolidated Balance Sheet', icon: Landmark },
    { id: 'subsidiaries', label: 'Subsidiaries & Financials', icon: Building2, badge: subsidiaries.length },
    { id: 'intercompany', label: 'Inter-Company & Eliminations', icon: ArrowRightLeft, badge: pendingIntercoCount },
    { id: 'approvals', label: 'Group Governance & Approvals', icon: ShieldCheck, badge: pendingApprovals.length },
  ];

  return (
    <div className="space-y-6">
      {/* Holding Executive Header */}
      <div className="bg-[#0F172A] text-white rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-amber-400">
              <Globe2 className="w-3.5 h-3.5" /> Holding Group CFO Consolidation Cockpit (CEMAC / UEMOA / USD)
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white">{groupName}</h1>
            <p className="text-xs text-slate-300">
              Multi-subsidiary OHADA / IFRS 10 consolidation · XAF/XOF 1:1 CFA parity + platform USD translation · Controlling vs. Minority Interest (NCI).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                printConsolidatedFinancialStatementsPackPdf({
                  groupName,
                  period,
                  reportingCurrency: activeCcy,
                  fxXafPerUsd,
                  pnl: pnl as Parameters<typeof printConsolidatedFinancialStatementsPackPdf>[0]['pnl'],
                  balanceSheet: bs as Parameters<typeof printConsolidatedFinancialStatementsPackPdf>[0]['balanceSheet'],
                  subsidiaries,
                  eliminations: eliminations as Array<{ id: string; intercompany_tx_id?: string; debit_account?: string; credit_account?: string; amount_reporting?: number }>,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" /> Board Pack PDF
            </button>
            <button
              type="button"
              onClick={() =>
                exportConsolidatedGroupExcel({
                  groupName,
                  period,
                  reportingCurrency: activeCcy,
                  pnl,
                  balanceSheet: bs,
                  subsidiaries: subsidiaries as unknown as Array<Record<string, unknown>>,
                  intercompanyTransactions: intercompanyTx,
                  eliminations,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> 5-Sheet Excel
            </button>
            <button
              type="button"
              onClick={() =>
                printIntercompanyEliminationCertificatePdf({
                  groupName,
                  period,
                  reportingCurrency: activeCcy,
                  fxXafPerUsd,
                  totalEliminatedReporting: pnl.intercompanyRevenueElimination,
                  pendingCount: pendingIntercoCount,
                  eliminations: eliminations as Array<{ id: string; intercompany_tx_id?: string; debit_account?: string; credit_account?: string; amount_reporting?: number; created_at?: string }>,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-amber-400" /> Elimination Cert PDF
            </button>
          </div>
        </div>

        {/* Group Selector, Period, Reporting Currency & FX Controls */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-800">
          <select
            aria-label="Select holding group"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-semibold"
          >
            {groups.map((g) => (
              <option key={String(g.id)} value={String(g.id)}>
                {String(g.name)} ({String(g.reporting_currency ?? 'XAF')})
              </option>
            ))}
          </select>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-mono"
          />
          <select
            aria-label="Reporting currency"
            value={reportingCcy}
            onChange={(e) => setReportingCcy(e.target.value as 'XAF' | 'XOF' | 'USD')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-mono"
          >
            <option value="XAF">Report in XAF (CEMAC)</option>
            <option value="XOF">Report in XOF (UEMOA)</option>
            <option value="USD">Report in USD</option>
          </select>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
            <span>1 USD =</span>
            <input
              type="number"
              min={100}
              value={fxXafPerUsd}
              onChange={(e) => setFxXafPerUsd(Math.max(100, Number(e.target.value) || 605))}
              className="w-16 bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs font-mono"
            />
            <span>XAF</span>
          </div>
          {canManageGroup && (
            <button
              type="button"
              onClick={() => setCreateGroupOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300"
            >
              <Plus className="w-3.5 h-3.5" /> New Holding Group
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadGroupsAndReport()}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Pending Eliminations Alert Banner */}
      {pendingIntercoCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>{pendingIntercoCount} uneliminated inter-company transaction(s)</strong> totaling{' '}
              <strong className="font-mono">{fmt(pendingIntercoReporting)}</strong> are pending elimination for{' '}
              <span className="font-mono">{period}</span>. Run eliminations to prevent revenue/COGS double-counting.
            </span>
          </div>
          {canManageGroup && (
            <button
              type="button"
              onClick={() => void handleRunEliminations()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <Scale className="w-3.5 h-3.5 text-amber-400" /> Execute Eliminations Now
            </button>
          )}
        </div>
      )}

      {/* Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Consolidated Revenue</div>
          <div className="font-mono text-2xl font-bold text-slate-950 mt-1">{fmt(pnl.consolidatedRevenue)}</div>
          <div className="text-xs text-slate-500 mt-1">
            Gross: {fmt(pnl.grossRevenue)} · Eliminated: {fmt(pnl.intercompanyRevenueElimination)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Consolidated Net Income</div>
          <div className="font-mono text-2xl font-bold text-emerald-700 mt-1">{fmt(pnl.consolidatedNetIncome)}</div>
          <div className="text-xs text-slate-500 mt-1">
            Parent Share: <strong className="text-slate-900">{fmt(pnl.controllingShareNetIncome)}</strong>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Minority Interest (NCI)</div>
          <div className="font-mono text-2xl font-bold text-amber-700 mt-1">{fmt(pnl.minorityInterestNetIncome)}</div>
          <div className="text-xs text-slate-500 mt-1">
            NCI Balance Sheet Equity: <strong className="text-slate-900">{fmt(bs.minorityInterestEquity)}</strong>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Consolidated Assets</div>
          <div className="font-mono text-2xl font-bold text-slate-950 mt-1">{fmt(bs.consolidatedAssets)}</div>
          <div className="text-xs text-slate-500 mt-1">
            Liabilities: {fmt(bs.consolidatedLiabilities)} · Equity: {fmt(bs.totalEquity)}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
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
                    tab.id === 'intercompany' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: CONSOLIDATED INCOME STATEMENT (P&L) */}
      {activeTab === 'pnl' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-950">
                Consolidated Income Statement (P&amp;L) — {period} ({activeCcy})
              </h3>
              <span className="font-mono text-[11px] text-slate-500">OHADA / IFRS 10</span>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead className="bg-[#0F172A] text-white">
                <tr>
                  <th className="px-5 py-2.5 text-left">Line Item</th>
                  <th className="px-5 py-2.5 text-right">Amount ({activeCcy})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="px-5 py-2.5 text-slate-700">Gross Subsidiary Revenue (Translated)</td>
                  <td className="px-5 py-2.5 text-right font-mono">{fmt(pnl.grossRevenue)}</td>
                </tr>
                <tr className="bg-amber-50/40">
                  <td className="px-5 py-2.5 text-amber-900 font-medium">Less: Inter-Company Revenue Eliminations (DR 701)</td>
                  <td className="px-5 py-2.5 text-right font-mono text-amber-900 font-semibold">({fmt(pnl.intercompanyRevenueElimination)})</td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="px-5 py-2.5 text-slate-950">Consolidated Group Revenue</td>
                  <td className="px-5 py-2.5 text-right font-mono text-slate-950">{fmt(pnl.consolidatedRevenue)}</td>
                </tr>
                <tr>
                  <td className="px-5 py-2.5 text-slate-700">Less: Consolidated Cost of Goods Sold (Net of CR 601)</td>
                  <td className="px-5 py-2.5 text-right font-mono">({fmt(pnl.consolidatedCogs)})</td>
                </tr>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-5 py-2.5 text-slate-950">Consolidated Gross Profit</td>
                  <td className="px-5 py-2.5 text-right font-mono text-slate-950">{fmt(pnl.grossProfit)}</td>
                </tr>
                <tr>
                  <td className="px-5 py-2.5 text-slate-700">Less: Group Operating Expenses (OpEx)</td>
                  <td className="px-5 py-2.5 text-right font-mono">({fmt(pnl.operatingExpenses)})</td>
                </tr>
                <tr className="bg-emerald-50/70 font-bold text-sm">
                  <td className="px-5 py-3 text-emerald-950">Consolidated Net Income</td>
                  <td className="px-5 py-3 text-right font-mono text-emerald-800">{fmt(pnl.consolidatedNetIncome)}</td>
                </tr>
                <tr>
                  <td className="px-5 py-2.5 text-slate-700 pl-8">↳ Attributable to Parent Shareholders (Controlling Interest)</td>
                  <td className="px-5 py-2.5 text-right font-mono font-semibold text-slate-950">{fmt(pnl.controllingShareNetIncome)}</td>
                </tr>
                <tr>
                  <td className="px-5 py-2.5 text-slate-700 pl-8">↳ Attributable to Non-Controlling Interests (Minority NCI)</td>
                  <td className="px-5 py-2.5 text-right font-mono font-semibold text-amber-700">{fmt(pnl.minorityInterestNetIncome)}</td>
                </tr>
              </tbody>
            </table></div>
          </div>

          {/* Subsidiary Revenue Contribution Ranking */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-950">Subsidiary Contribution ({activeCcy})</h3>
              <button type="button" onClick={() => setActiveTab('subsidiaries')} className="text-xs font-semibold text-amber-700 hover:underline">
                Manage →
              </button>
            </div>
            <div className="space-y-4">
              {subsidiaries.map((s) => {
                const share = pnl.grossRevenue > 0 ? Math.round((s.revenueReporting / pnl.grossRevenue) * 1000) / 10 : 0;
                return (
                  <button
                    key={s.tenantId}
                    type="button"
                    onClick={() => setDetailSub(s)}
                    className="w-full text-left space-y-1.5 hover:bg-slate-50 p-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-950">{s.entityName}</span>
                      <span className="font-mono font-bold text-slate-900">
                        {fmt(s.revenueReporting)} <span className="text-slate-500 font-normal">({share}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-[#0F172A]" style={{ width: `${Math.min(100, Math.max(3, share))}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>{s.functionalCurrency} · Own {s.ownershipPct}%</span>
                      <span className="text-emerald-700 font-semibold">Net Margin {s.netMarginPct.toFixed(1)}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONSOLIDATED BALANCE SHEET */}
      {activeTab === 'balance-sheet' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-slate-950">
                Consolidated Balance Sheet — {period} ({activeCcy})
              </h3>
              <p className="text-xs text-slate-500">Inter-company receivables &amp; payables automatically offset; equity split into Parent vs. NCI.</p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                bsBalanced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {bsBalanced ? 'Assets = Liabilities + Equity (Balanced)' : `Variance: ${fmt(bsGap)}`}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div>
              <div className="px-5 py-2.5 bg-[#0F172A] text-white text-xs font-bold uppercase">Assets</div>
              <div className="overflow-x-auto"><table className="w-full text-xs">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-5 py-3 text-slate-700">Gross Combined Subsidiary Assets</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(bs.grossAssets)}</td>
                  </tr>
                  <tr className="bg-amber-50/40">
                    <td className="px-5 py-3 text-amber-900">Less: Inter-Company Receivables Elimination</td>
                    <td className="px-5 py-3 text-right font-mono text-amber-900">({fmt(bs.intercompanyBalanceElimination)})</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold text-sm">
                    <td className="px-5 py-3.5 text-slate-950">TOTAL CONSOLIDATED ASSETS</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-950">{fmt(bs.consolidatedAssets)}</td>
                  </tr>
                </tbody>
              </table></div>
            </div>
            <div>
              <div className="px-5 py-2.5 bg-[#0F172A] text-white text-xs font-bold uppercase">Liabilities &amp; Consolidated Equity</div>
              <div className="overflow-x-auto"><table className="w-full text-xs">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-5 py-3 text-slate-700">Consolidated Liabilities (Net of Inter-Co Payables)</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(bs.consolidatedLiabilities)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-slate-700">Controlling Parent Shareholders&apos; Equity</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-950">{fmt(bs.controllingEquity)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-amber-800">Minority Interest (NCI) Equity</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-amber-800">{fmt(bs.minorityInterestEquity)}</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold text-sm">
                    <td className="px-5 py-3.5 text-slate-950">TOTAL LIABILITIES &amp; EQUITY</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-950">{fmt(bs.consolidatedLiabilities + bs.totalEquity)}</td>
                  </tr>
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUBSIDIARIES & PERIOD FINANCIALS */}
      {activeTab === 'subsidiaries' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-950">Legal Subsidiaries &amp; Period Financials ({period})</h3>
              <p className="text-xs text-slate-500">Submit functional-currency financials per subsidiary or drill down into FX translation &amp; margin ratios.</p>
            </div>
            {canManageGroup && (
              <button
                type="button"
                onClick={() => setAddSubOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Link Subsidiary
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0F172A] text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Legal Subsidiary</th>
                  <th className="px-4 py-3 text-left">Func. CCY</th>
                  <th className="px-4 py-3 text-right">Own / NCI</th>
                  <th className="px-4 py-3 text-right">Revenue ({activeCcy})</th>
                  <th className="px-4 py-3 text-right">Net Income</th>
                  <th className="px-4 py-3 text-right">Margins (GM / NM)</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {subsidiaries.map((s) => (
                  <tr key={s.tenantId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-950">{s.entityName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{s.tenantId} · {s.countryLabel}</div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{s.functionalCurrency}</td>
                    <td className="px-4 py-3 text-right font-mono">{s.ownershipPct}% / {s.minorityInterestPct}%</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(s.revenueReporting)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{fmt(s.netIncomeReporting)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {s.grossMarginPct.toFixed(1)}% / {s.netMarginPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailSub(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-semibold"
                        >
                          <Eye className="w-3 h-3" /> Detail
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditFinancials(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-900"
                        >
                          <Edit3 className="w-3 h-3" /> Financials
                        </button>
                        {canManageGroup && (
                          <button
                            type="button"
                            onClick={() => void handleRemoveSubsidiary(s)}
                            aria-label={`Remove ${s.entityName}`}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* TAB 4: INTER-COMPANY TRANSACTIONS & ELIMINATION JOURNALS */}
      {activeTab === 'intercompany' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-950">Inter-Company Transactions Register ({period})</h3>
                <p className="text-xs text-slate-500">Log inter-subsidiary fuel transfers, coastal depot deliveries, or holding management fees for elimination.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canRecordInterco && (
                  <button
                    type="button"
                    onClick={() => setNewIntercoOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-900"
                  >
                    <Plus className="w-3.5 h-3.5" /> Record Inter-Company Tx
                  </button>
                )}
                {canManageGroup && (
                  <button
                    type="button"
                    onClick={() => void handleRunEliminations()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
                  >
                    <Scale className="w-3.5 h-3.5" /> Run Eliminations ({pendingIntercoCount} Pending)
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0F172A] text-white">
                  <tr>
                    <th className="px-4 py-2.5 text-left">TX ID</th>
                    <th className="px-4 py-2.5 text-left">Seller → Buyer Subsidiary</th>
                    <th className="px-4 py-2.5 text-left">Description</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {intercompanyTx.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No inter-company transactions logged for {period}.</td></tr>
                  ) : (
                    intercompanyTx.map((tx) => {
                      const isElim = Boolean(tx.eliminated);
                      return (
                        <tr key={String(tx.id)} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono text-slate-700">{String(tx.id)}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold text-slate-950">
                            {String(tx.seller_tenant_id ?? '')} → {String(tx.buyer_tenant_id ?? '')}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">{String(tx.description ?? '')}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-950">
                            {fmt(Number(tx.amount ?? 0), String(tx.currency ?? 'XAF'))}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isElim ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-900'}`}>
                              {isElim ? 'ELIMINATED' : 'PENDING ELIMINATION'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Posted Elimination Journal Entries */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h3 className="font-display text-sm font-bold text-slate-950">Posted Consolidation Elimination Journal Entries ({eliminations.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Entry ID</th>
                    <th className="px-4 py-2.5 text-left">Inter-Co TX</th>
                    <th className="px-4 py-2.5 text-left">Debit Account</th>
                    <th className="px-4 py-2.5 text-left">Credit Account</th>
                    <th className="px-4 py-2.5 text-right">Eliminated Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {eliminations.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-5 text-center text-slate-500">No elimination entries posted yet for {period}.</td></tr>
                  ) : (
                    eliminations.map((e) => (
                      <tr key={String(e.id)}>
                        <td className="px-4 py-2.5 font-mono text-slate-700">{String(e.id)}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">{String(e.intercompany_tx_id ?? '')}</td>
                        <td className="px-4 py-2.5 font-mono text-red-700">DR {String(e.debit_account ?? '701_INTERCO_REVENUE')}</td>
                        <td className="px-4 py-2.5 font-mono text-emerald-700">CR {String(e.credit_account ?? '601_INTERCO_COGS')}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold">{fmt(Number(e.amount_reporting ?? 0))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: GROUP MAKER-CHECKER APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-950">Group CFO Maker-Checker Approval Inbox ({approvals.length})</h3>
            <p className="text-xs text-slate-500">Approve or reject high-value subsidiary CAPEX, treasury transfers, and credit limit overrides.</p>
          </div>
          <div className="divide-y divide-slate-200">
            {approvals.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No maker-checker approvals queued across the holding group.</div>
            ) : (
              approvals.map((a) => (
                <div key={a.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-800">{a.requestType}</span>
                      <span className="text-xs font-bold text-slate-950">{a.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Requested by {a.requestedBy} · Amount: <strong className="font-mono text-slate-900">{formatFcfa(a.amountFcfa)}</strong> · {formatShortDate(a.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === 'PENDING' && onDecideApproval ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onDecideApproval(a.id, 'APPROVED')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => onDecideApproval(a.id, 'REJECTED')}
                          className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${a.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {a.status}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      <FormModal open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} title="Create Holding Consolidation Group" subtitle="Creates a parent holding entity for multi-subsidiary reporting.">
        <form onSubmit={(e) => void handleCreateGroup(e)} className="space-y-4">
          <div>
            <label className="opes-label">Holding Group Legal Name</label>
            <input type="text" required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g. Central Africa Petroleum Holdings SA" className="opes-input text-xs" />
          </div>
          <div>
            <label className="opes-label">Primary Reporting Currency</label>
            <select value={newGroupCcy} onChange={(e) => setNewGroupCcy(e.target.value as 'XAF' | 'XOF' | 'USD')} className="opes-input text-xs">
              <option value="XAF">XAF (CEMAC Franc CFA)</option>
              <option value="XOF">XOF (UEMOA Franc CFA)</option>
              <option value="USD">USD (US Dollar)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateGroupOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold">Create Group</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={addSubOpen} onClose={() => setAddSubOpen(false)} title="Link Subsidiary Tenant to Holding Group">
        <form onSubmit={(e) => void handleAddSubsidiary(e)} className="space-y-3">
          <div>
            <label className="opes-label">Subsidiary Tenant ID</label>
            <input type="text" required value={newSubId} onChange={(e) => setNewSubId(e.target.value)} placeholder="ten_opes_ci" className="opes-input font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Legal Entity Name</label>
              <input type="text" required value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="OpesFuel Côte d'Ivoire SA" className="opes-input text-xs" />
            </div>
            <div>
              <label className="opes-label">Country / Zone</label>
              <input type="text" required value={newSubCountry} onChange={(e) => setNewSubCountry(e.target.value)} className="opes-input text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Functional Currency</label>
              <select value={newSubCcy} onChange={(e) => setNewSubCcy(e.target.value as 'XAF' | 'XOF' | 'USD')} className="opes-input text-xs">
                <option value="XAF">XAF (CEMAC)</option>
                <option value="XOF">XOF (UEMOA)</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Parent Ownership %</label>
              <input type="number" min={1} max={100} required value={newSubOwn} onChange={(e) => setNewSubOwn(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddSubOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Link Subsidiary
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={Boolean(editFinSub)}
        onClose={() => setEditFinSub(null)}
        title={`Submit Period Financials: ${editFinSub?.entityName ?? ''}`}
        subtitle={`Period ${period} · Enter figures in subsidiary functional currency (${editFinSub?.functionalCurrency ?? 'XAF'})`}
      >
        <form onSubmit={(e) => void handleSaveFinancials(e)} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="opes-label">Revenue</label>
              <input type="number" step="any" required value={finRev} onChange={(e) => setFinRev(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Cost of Sales (COGS)</label>
              <input type="number" step="any" required value={finCogs} onChange={(e) => setFinCogs(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Operating Expenses</label>
              <input type="number" step="any" required value={finOpex} onChange={(e) => setFinOpex(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="opes-label">Total Assets</label>
              <input type="number" step="any" required value={finAssets} onChange={(e) => setFinAssets(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Total Liabilities</label>
              <input type="number" step="any" required value={finLiab} onChange={(e) => setFinLiab(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Total Equity</label>
              <input type="number" step="any" required value={finEquity} onChange={(e) => setFinEquity(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Inter-Company Receivables (AR)</label>
              <input type="number" step="any" value={finIcRec} onChange={(e) => setFinIcRec(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Inter-Company Payables (AP)</label>
              <input type="number" step="any" value={finIcPay} onChange={(e) => setFinIcPay(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditFinSub(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold">Save Period Financials</button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={Boolean(detailSub)}
        onClose={() => setDetailSub(null)}
        title={detailSub ? `${detailSub.entityName} — Financial Drill-Down` : 'Subsidiary Detail'}
        subtitle={detailSub ? `${detailSub.tenantId} · ${detailSub.countryLabel} · Ownership ${detailSub.ownershipPct}% (NCI ${detailSub.minorityInterestPct}%)` : ''}
      >
        {detailSub && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border border-slate-200 rounded-lg p-3">
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Gross Margin</div>
                <div className="font-mono text-lg font-bold text-slate-950">{detailSub.grossMarginPct.toFixed(1)}%</div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Net Margin</div>
                <div className="font-mono text-lg font-bold text-emerald-700">{detailSub.netMarginPct.toFixed(1)}%</div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Debt / Equity</div>
                <div className="font-mono text-lg font-bold text-slate-950">{detailSub.debtToEquityRatio.toFixed(2)}x</div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Return on Assets</div>
                <div className="font-mono text-lg font-bold text-slate-950">{detailSub.roaPct.toFixed(1)}%</div>
              </div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-[#0F172A] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-right">Functional ({detailSub.functionalCurrency})</th>
                  <th className="px-3 py-2 text-right">Translated ({activeCcy})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                <tr><td className="px-3 py-2 font-sans">Revenue</td><td className="px-3 py-2 text-right">{fmt(detailSub.revenueFunctional, detailSub.functionalCurrency)}</td><td className="px-3 py-2 text-right font-bold">{fmt(detailSub.revenueReporting)}</td></tr>
                <tr><td className="px-3 py-2 font-sans">COGS</td><td className="px-3 py-2 text-right">{fmt(detailSub.cogsFunctional, detailSub.functionalCurrency)}</td><td className="px-3 py-2 text-right">{fmt(detailSub.cogsReporting)}</td></tr>
                <tr><td className="px-3 py-2 font-sans">Operating Expenses</td><td className="px-3 py-2 text-right">{fmt(detailSub.opexFunctional, detailSub.functionalCurrency)}</td><td className="px-3 py-2 text-right">{fmt(detailSub.opexReporting)}</td></tr>
                <tr className="bg-emerald-50/60"><td className="px-3 py-2 font-sans font-bold">Net Income</td><td className="px-3 py-2 text-right font-bold">{fmt(detailSub.revenueFunctional - detailSub.cogsFunctional - detailSub.opexFunctional, detailSub.functionalCurrency)}</td><td className="px-3 py-2 text-right font-bold text-emerald-700">{fmt(detailSub.netIncomeReporting)}</td></tr>
                <tr><td className="px-3 py-2 font-sans">Total Assets</td><td className="px-3 py-2 text-right">{fmt(detailSub.assetsFunctional, detailSub.functionalCurrency)}</td><td className="px-3 py-2 text-right">{fmt(detailSub.assetsReporting)}</td></tr>
                <tr><td className="px-3 py-2 font-sans">Total Liabilities</td><td className="px-3 py-2 text-right">{fmt(detailSub.liabilitiesFunctional, detailSub.functionalCurrency)}</td><td className="px-3 py-2 text-right">{fmt(detailSub.liabilitiesReporting)}</td></tr>
                <tr><td className="px-3 py-2 font-sans">Total Equity</td><td className="px-3 py-2 text-right">{fmt(detailSub.equityFunctional, detailSub.functionalCurrency)}</td><td className="px-3 py-2 text-right">{fmt(detailSub.equityReporting)}</td></tr>
              </tbody>
            </table></div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const s = detailSub;
                  setDetailSub(null);
                  openEditFinancials(s);
                }}
                className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
              >
                Edit Period Financials
              </button>
            </div>
          </div>
        )}
      </FormModal>

      <FormModal open={newIntercoOpen} onClose={() => setNewIntercoOpen(false)} title="Record Inter-Company Transaction" subtitle={`Period ${period} · Will queue for automatic revenue/COGS elimination.`}>
        <form onSubmit={(e) => void handleRecordIntercompany(e)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Seller Subsidiary</label>
              <select value={icSeller} onChange={(e) => setIcSeller(e.target.value)} required className="opes-input text-xs">
                {subsidiaries.map((s) => (
                  <option key={s.tenantId} value={s.tenantId}>{s.entityName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Buyer Subsidiary</label>
              <select value={icBuyer} onChange={(e) => setIcBuyer(e.target.value)} required className="opes-input text-xs">
                {subsidiaries.map((s) => (
                  <option key={s.tenantId} value={s.tenantId}>{s.entityName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Transaction Currency</label>
              <select value={icCurrency} onChange={(e) => setIcCurrency(e.target.value as 'XAF' | 'XOF' | 'USD')} className="opes-input text-xs">
                <option value="XAF">XAF</option>
                <option value="XOF">XOF</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Amount</label>
              <input type="number" min={1} step="any" required value={icAmount} onChange={(e) => setIcAmount(e.target.value)} placeholder="12500000" className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div>
            <label className="opes-label">Description</label>
            <input type="text" required value={icDesc} onChange={(e) => setIcDesc(e.target.value)} placeholder="e.g. Bulk Gasoil Coastal Transfer / Management Fee" className="opes-input text-xs" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setNewIntercoOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold">Record Inter-Company Tx</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
