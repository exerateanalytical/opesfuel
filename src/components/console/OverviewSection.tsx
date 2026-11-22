import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Compass,
  Droplets,
  FileSpreadsheet,
  FileText,
  Gauge,
  History,
  Plus,
  Printer,
  Smartphone,
  Sparkles,
  Tag,
  Trophy,
} from 'lucide-react';
import { PriceHistoryItem } from '../../api/demoDataset1000';
import { canPerformAction } from '../../auth/auth0';
import { ALL_FUEL_GRADES, formatFcfa, formatLitres, formatShortDate, gradeLabel } from '../../domain/formatters';
import {
  DomainEventLog,
  FinancialReportBundle,
  FuelGrade,
  FuelTank,
  Pump,
  ShiftRecord,
  Station,
  UserRole,
} from '../../domain/types';
import { exportShiftsExcel, printDailyZReportPdf } from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';

interface OverviewSectionProps {
  role: UserRole;
  activeStationId: string;
  stations: Station[];
  tanks: FuelTank[];
  pumps: Pump[];
  shifts: ShiftRecord[];
  events: DomainEventLog[];
  priceHistory?: PriceHistoryItem[];
  report: FinancialReportBundle;
  onboardingCompletedCount: number;
  onOpenOnboardingGuide: (tab?: 'guide' | 'institutional') => void;
  onUpdatePrice: (stationId: string, grade: FuelGrade, price: number, reason?: string) => void;
  onCreateStation: (input: {
    code: string;
    name: string;
    city: string;
    planName: string;
    monthlyFeeFcfa: number;
  }) => void;
  onJumpTo: (
    section:
      | 'forecourt'
      | 'inventory'
      | 'fleet'
      | 'workforce'
      | 'accounting'
      | 'api-platform'
      | 'ai-assistant'
      | 'mobile-app'
      | 'admin'
      | 'platform-admin'
  ) => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  role,
  activeStationId,
  stations,
  tanks,
  pumps,
  shifts,
  events,
  priceHistory = [],
  report,
  onboardingCompletedCount,
  onOpenOnboardingGuide,
  onUpdatePrice,
  onCreateStation,
  onJumpTo,
}) => {
  const currentStation =
    stations.find((s) => s.id === activeStationId) ?? stations[0];
  const canEditPrices = canPerformAction(role, 'MANAGE_STATIONS_PRICES');

  const [priceGrade, setPriceGrade] = useState<FuelGrade>('SUPER');
  const [priceValue, setPriceValue] = useState(String(currentStation?.prices.SUPER ?? 840));
  const [priceReason, setPriceReason] = useState('CSPH regulatory tariff update');
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showNewStation, setShowNewStation] = useState(false);
  const [stationForm, setStationForm] = useState({ code: '', name: '', city: '' });

  useEffect(() => {
    const livePrice = currentStation?.prices[priceGrade];
    if (livePrice !== undefined) {
      setPriceValue(String(livePrice));
    }
  }, [currentStation?.id, currentStation?.prices, priceGrade]);

  const filteredTanks = tanks.filter((t) => activeStationId === 'ALL' || t.stationId === activeStationId);
  const filteredShifts = shifts.filter((s) => activeStationId === 'ALL' || s.stationId === activeStationId);
  const filteredPumps = pumps.filter((p) => activeStationId === 'ALL' || p.stationId === activeStationId);
  const totalLitresSold = filteredShifts.reduce((acc, s) => acc + s.litresSold, 0);
  const openShiftsCount = filteredShifts.filter((s) => s.status === 'OPEN').length;

  const closedShifts = filteredShifts.filter((s) => s.status === 'CLOSED');
  const tenderCash = closedShifts.reduce((acc, s) => acc + s.cashFcfa, 0);
  const tenderMoMo = closedShifts.reduce((acc, s) => acc + s.mobileMoneyFcfa, 0);
  const tenderCard = closedShifts.reduce((acc, s) => acc + s.cardFcfa, 0);
  const tenderFleet = closedShifts.reduce((acc, s) => acc + s.fleetCreditFcfa, 0);
  const totalTenders = Math.max(1, tenderCash + tenderMoMo + tenderCard + tenderFleet);

  const visibleGrades = ALL_FUEL_GRADES.filter(
    (g) =>
      g === 'SUPER' ||
      g === 'GASOIL' ||
      g === 'KEROSENE' ||
      filteredTanks.some((t) => t.grade === g) ||
      filteredPumps.some((p) => p.grade === g) ||
      closedShifts.some((s) => s.grade === g)
  );

  const gradeStats = visibleGrades.map((g) => {
    const gradeLitres = closedShifts
      .filter((s) => s.grade === g)
      .reduce((sum, s) => sum + s.litresSold, 0);
    const gradeRev = closedShifts
      .filter((s) => s.grade === g)
      .reduce((sum, s) => sum + s.expectedRevenueFcfa, 0);
    const activePumpCount = filteredPumps.filter((p) => p.grade === g).length;
    return { grade: g, litres: gradeLitres, revenueFcfa: gradeRev, pumps: activePumpCount };
  });
  const maxGradeLitres = Math.max(1, ...gradeStats.map((gs) => gs.litres));

  // Automated Health Monitor computations
  const totalBookLitres = filteredTanks.reduce((acc, t) => acc + t.bookVolumeLitres, 0);
  const totalCapacityLitres = filteredTanks.reduce((acc, t) => acc + t.capacityLitres, 0);
  const volumeFillPct = totalCapacityLitres > 0 ? Math.min(100, Math.round((totalBookLitres / totalCapacityLitres) * 100)) : 0;
  const lowestTank = [...filteredTanks].sort(
    (a, b) => a.bookVolumeLitres / Math.max(1, a.capacityLitres) - b.bookVolumeLitres / Math.max(1, b.capacityLitres)
  )[0];

  const openShifts = filteredShifts.filter((s) => s.status === 'OPEN');
  const activePumpsCount = filteredPumps.filter((p) => p.status === 'ACTIVE_SHIFT').length;
  const idlePumpsCount = filteredPumps.filter((p) => p.status === 'IDLE').length;
  const maintenancePumpsCount = filteredPumps.filter((p) => p.status === 'MAINTENANCE').length;

  interface HealthAlert {
    id: string;
    severity: 'CRITICAL' | 'URGENT' | 'AUDIT';
    title: string;
    detail: string;
    actionLabel: string;
    target: 'inventory' | 'forecourt' | 'accounting' | 'onboarding';
  }

  const operationalAlerts: HealthAlert[] = [];
  for (const t of filteredTanks) {
    if (t.status === 'VARIANCE_ALERT' || Math.abs(t.varianceLitres) > 100) {
      operationalAlerts.push({
        id: `var-${t.id}`,
        severity: 'CRITICAL',
        title: `Dipstick Variance on ${t.name}`,
        detail: `${t.varianceLitres > 0 ? `+${t.varianceLitres}` : t.varianceLitres} L delta vs. book stock`,
        actionLabel: 'Audit Tank',
        target: 'inventory',
      });
    }
    const pct = t.capacityLitres > 0 ? Math.round((t.bookVolumeLitres / t.capacityLitres) * 100) : 0;
    if (t.status === 'LOW_STOCK' || pct < 20) {
      operationalAlerts.push({
        id: `low-${t.id}`,
        severity: 'URGENT',
        title: `Low Reserve: ${t.name} (${pct}%)`,
        detail: `${formatLitres(t.bookVolumeLitres)} remaining — schedule SCDP delivery`,
        actionLabel: 'Raise PO',
        target: 'inventory',
      });
    }
  }
  if (report.cashVarianceFcfa > 0) {
    operationalAlerts.push({
      id: 'cash-var',
      severity: 'AUDIT',
      title: `Shift Cash Shortfall: ${formatFcfa(report.cashVarianceFcfa)}`,
      detail: 'Verify attendant cash/MoMo tenders against closing meter totals',
      actionLabel: 'Inspect Ledger',
      target: 'accounting',
    });
  }
  if (!report.trialBalanceBalanced) {
    operationalAlerts.push({
      id: 'tb-unbal',
      severity: 'CRITICAL',
      title: 'Trial Balance Imbalance Detected',
      detail: 'Debit and Credit totals differ across active station journals',
      actionLabel: 'Open Ledger',
      target: 'accounting',
    });
  }
  if (filteredTanks.length === 0 || filteredPumps.length === 0) {
    operationalAlerts.push({
      id: 'setup-empty',
      severity: 'URGENT',
      title: 'Station Fuel & Pump Provisioning Pending',
      detail: 'Tick institutional fuel grades & opening volumes to activate forecourt tracking',
      actionLabel: 'Open Setup',
      target: 'onboarding',
    });
  }

  const overallHealthState =
    operationalAlerts.some((a) => a.severity === 'CRITICAL')
      ? 'Action Required'
      : operationalAlerts.length > 0
      ? 'Attention Needed'
      : 'All Systems Nominal';

  const handlePriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStation) return;
    onUpdatePrice(currentStation.id, priceGrade, Number(priceValue) || 0, priceReason.trim() || 'Regulatory tariff update');
    setShowPriceModal(false);
  };

  const handleStationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationForm.code.trim() || !stationForm.name.trim() || !stationForm.city.trim()) return;
    onCreateStation({
      code: stationForm.code,
      name: stationForm.name,
      city: stationForm.city,
      planName: 'Starter Station',
      monthlyFeeFcfa: 25000,
    });
    setStationForm({ code: '', name: '', city: '' });
    setShowNewStation(false);
  };

  const roleDesk = {
    PLATFORM_ADMIN: {
      badge: 'SAAS PLATFORM SUPER-ADMIN WORKSPACE',
      title: 'Global Multi-Tenant Control Plane & Network Telemetry',
      summary: 'Monitor all subscribed petrol station tenants, global FCFA MRR, enterprise licenses, and inbound sales leads.',
      actions: [
        { label: 'Open SaaS Control Plane', target: 'platform-admin' as const, primary: true },
        { label: 'Tenant Billing & Invites', target: 'admin' as const, primary: false },
        { label: 'API Keys & Webhooks', target: 'api-platform' as const, primary: false },
      ],
    },
    OWNER: {
      badge: 'STATION NETWORK OWNER WORKSPACE',
      title: `Executive Overview — ${currentStation ? currentStation.name : 'All Network Stations'}`,
      summary: `Net Profit: ${formatFcfa(report.netIncomeFcfa)} · Trial Balance: ${report.trialBalanceBalanced ? 'Balanced' : 'Attention Required'} · ${stations.length} active station(s).`,
      actions: [
        { label: 'Billing & Staff Invites', target: 'admin' as const, primary: true },
        { label: 'SYSCOHADA Ledger', target: 'accounting' as const, primary: false },
        { label: 'AI Copilot Diagnostics', target: 'ai-assistant' as const, primary: false },
      ],
    },
    MANAGER: {
      badge: 'FORECOURT STATION MANAGER WORKSPACE',
      title: 'Daily Forecourt, Tank Dipsticks & Staff Roster Control',
      summary: `${openShiftsCount} open nozzle shift(s) · ${operationalAlerts.length} operational alert(s) · Avg tank fill ${volumeFillPct}%.`,
      actions: [
        { label: 'Forecourt Shifts', target: 'forecourt' as const, primary: true },
        { label: 'Tanks & Deliveries', target: 'inventory' as const, primary: false },
        { label: 'Staff & Payroll', target: 'workforce' as const, primary: false },
      ],
    },
    ATTENDANT: {
      badge: 'PUMP ISLAND ATTENDANT WORKSPACE',
      title: 'Active Nozzle Shift, Cash/MoMo Handover & Shop POS',
      summary: `${openShiftsCount} active shift(s) currently running across ${filteredPumps.length} forecourt nozzle(s).`,
      actions: [
        { label: 'Open / Close Pump Shift', target: 'forecourt' as const, primary: true },
        { label: 'Fleet Voucher & Shop POS', target: 'fleet' as const, primary: false },
        { label: 'Mobile Field Companion', target: 'mobile-app' as const, primary: false },
      ],
    },
    ACCOUNTANT: {
      badge: 'CHIEF ACCOUNTANT & SYSCOHADA WORKSPACE',
      title: 'Double-Entry Ledger, VAT (19.25%), Fleet AR & Fiscal Locks',
      summary: `VAT Payable: ${formatFcfa(report.vatPayableFcfa)} · Fleet AR: ${formatFcfa(report.fleetReceivablesFcfa)} · Supplier AP: ${formatFcfa(report.accountsPayableFcfa)}.`,
      actions: [
        { label: 'Ledger, VAT & Z-Report', target: 'accounting' as const, primary: true },
        { label: 'Fleet AR Settlements', target: 'fleet' as const, primary: false },
        { label: 'Monthly Payroll Run', target: 'workforce' as const, primary: false },
      ],
    },
  }[role];

  return (
    <div className="space-y-6">
      {/* Role-Tailored Command Header for all 5 Account Types */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="font-mono text-[11px] font-bold text-amber-700 tracking-wide">
            {roleDesk.badge}
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
            {roleDesk.title}
          </h2>
          <p className="text-xs text-slate-600">{roleDesk.summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {roleDesk.actions.map((act) => (
            <button
              key={act.label}
              type="button"
              onClick={() => onJumpTo(act.target)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                act.primary
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
              }`}
            >
              {act.label}
            </button>
          ))}
        </div>
      </div>

      {/* Onboarding & Institutional Fuel Tick-Wizard Banner */}
      {(role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN') && (
      <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 font-mono text-xs text-amber-400 font-semibold">
            <Compass className="w-3.5 h-3.5" />
            <span>Station Setup Checklist · {onboardingCompletedCount}/5 Milestones Complete</span>
          </div>
          <div className="text-sm font-semibold text-white">
            {filteredTanks.length === 0 || filteredPumps.length === 0
              ? 'Tick your fuel types (Super, Diesel, Kerosene, LPG Gaz) & opening Litres to commission tanks, pumps, and ledger in one click.'
              : 'Commission another station or adjust institutional fuels, volumes, and opening capital anytime.'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenOnboardingGuide('institutional')}
            className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold min-h-[44px]"
          >
            Institutional Fuel &amp; Volume Setup
          </button>
          <button
            type="button"
            onClick={() => onJumpTo('ai-assistant')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold min-h-[44px]"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Copilot
          </button>
          <button
            type="button"
            onClick={() => onJumpTo('mobile-app')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold min-h-[44px]"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-400" /> Mobile App
          </button>
        </div>
      </div>
      )}

      {/* Automated Station Health Monitor */}
      <section
        aria-label="Automated Station Health Monitor"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity
              className={`w-4 h-4 ${
                operationalAlerts.some((a) => a.severity === 'CRITICAL')
                  ? 'text-red-600'
                  : operationalAlerts.length > 0
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            />
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
              Automated Station Health Monitor
            </h2>
            <span className="text-slate-300">·</span>
            <span
              className={`text-xs font-semibold ${
                operationalAlerts.some((a) => a.severity === 'CRITICAL')
                  ? 'text-red-700'
                  : operationalAlerts.length > 0
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {overallHealthState}
            </span>
          </div>
          <div className="font-mono text-xs text-slate-500 tabular-nums">
            {currentStation && activeStationId !== 'ALL' ? currentStation.name : `${stations.length} Station Network`} ·{' '}
            {operationalAlerts.length} Alert{operationalAlerts.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* 1. Real-Time Fuel Volume */}
          <div className="lg:col-span-4 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Droplets className="w-4 h-4 text-amber-600" />
                <span>Real-Time Fuel Reserve</span>
              </div>
              <button
                type="button"
                onClick={() => onJumpTo('inventory')}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 whitespace-nowrap"
              >
                Tanks →
              </button>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                  {formatLitres(totalBookLitres)}
                </span>
                <span className="font-mono tabular-nums text-xs font-semibold text-slate-500">
                  {volumeFillPct}% of {formatLitres(totalCapacityLitres)}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full ${
                    volumeFillPct < 20 ? 'bg-red-600' : volumeFillPct < 40 ? 'bg-amber-600' : 'bg-slate-900'
                  }`}
                  style={{ width: `${volumeFillPct}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-slate-600 flex items-center justify-between gap-2 pt-1">
              <span>{filteredTanks.length} Underground Tank(s)</span>
              {lowestTank ? (
                <span className="font-mono tabular-nums text-slate-700 truncate">
                  Lowest: {gradeLabel(lowestTank.grade)} ({Math.round((lowestTank.bookVolumeLitres / Math.max(1, lowestTank.capacityLitres)) * 100)}%)
                </span>
              ) : (
                <span className="text-slate-400">No tanks added</span>
              )}
            </div>
          </div>

          {/* 2. Current Pump Shift Status */}
          <div className="lg:col-span-4 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Gauge className="w-4 h-4 text-amber-600" />
                <span>Current Pump Shift Status</span>
              </div>
              <button
                type="button"
                onClick={() => onJumpTo('forecourt')}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 whitespace-nowrap"
              >
                Shifts →
              </button>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                {activePumpsCount} / {filteredPumps.length} Active
              </span>
              <span className="font-mono tabular-nums text-xs text-slate-500">
                {idlePumpsCount} Idle · {maintenancePumpsCount} Maint
              </span>
            </div>
            {openShifts.length > 0 ? (
              <div className="space-y-1.5 pt-0.5">
                {openShifts.slice(0, 2).map((sh) => (
                  <div
                    key={sh.id}
                    className="flex items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5"
                  >
                    <span className="font-medium text-slate-800 truncate">
                      <span className="font-mono font-bold text-slate-900">{sh.pumpCode}</span> · {sh.attendantName}
                    </span>
                    <span className="font-mono tabular-nums text-emerald-700 font-semibold shrink-0">OPEN</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                No pump shifts currently open. Assign an attendant on Forecourt &amp; Shifts.
              </div>
            )}
          </div>

          {/* 3. Urgent Operational Alerts */}
          <div className="lg:col-span-4 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                {operationalAlerts.length > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
                <span>Urgent Operational Alerts</span>
              </div>
              <span className="font-mono tabular-nums text-xs font-semibold text-slate-500">
                {operationalAlerts.length} Active
              </span>
            </div>

            {operationalAlerts.length > 0 ? (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-0.5">
                {operationalAlerts.slice(0, 3).map((al) => (
                  <div
                    key={al.id}
                    className={`flex items-start justify-between gap-2 rounded-md border border-slate-200 border-l-4 bg-white px-3 py-2 text-xs ${
                      al.severity === 'CRITICAL'
                        ? 'border-l-red-600 text-slate-900'
                        : 'border-l-amber-600 text-slate-900'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{al.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{al.detail}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        al.target === 'onboarding'
                          ? onOpenOnboardingGuide('institutional')
                          : onJumpTo(al.target)
                      }
                      className="text-[11px] font-bold text-amber-700 underline shrink-0 whitespace-nowrap"
                    >
                      {al.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 border-l-4 border-l-emerald-600 bg-white px-3 py-2.5 text-xs text-slate-700">
                Zero urgent tank, pump, or cash variance alerts detected across station modules.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4-column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Net Fuel &amp; Shop Revenue</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
            {formatFcfa(report.totalRevenueFcfa)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            Gross Profit: <span className="font-mono tabular-nums text-slate-800">{formatFcfa(report.grossProfitFcfa)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Metered Fuel Dispensed</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
            {formatLitres(totalLitresSold)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            {openShiftsCount} active shift(s) · {filteredPumps.length} pumps
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Cash &amp; Mobile Money Clearing</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
            {formatFcfa(report.cashOnHandFcfa + report.mobileMoneyClearingFcfa)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            Bank Balance: <span className="font-mono tabular-nums text-slate-800">{formatFcfa(report.bankBalanceFcfa)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Shift Cash Variance</div>
          <div
            className={`font-mono tabular-nums text-2xl font-bold mt-1 ${
              report.cashVarianceFcfa > 0 ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {report.cashVarianceFcfa === 0 ? '0 FCFA' : formatFcfa(-report.cashVarianceFcfa)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            Trial Balance: {report.trialBalanceBalanced ? 'Balanced (Debit = Credit)' : 'Unbalanced'}
          </div>
        </div>
      </div>

      {/* Classic Analytics Strip: Fuel Grade Volume Breakdown + Payment Tender Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">Sales Performance by Fuel Grade</h2>
              <p className="text-xs text-slate-500">Closed-shift volume dispensed &amp; revenue contribution in FCFA</p>
            </div>
            <span className="font-mono text-xs text-slate-500">{filteredPumps.length} Nozzles</span>
          </div>
          <div className="space-y-3">
            {gradeStats.map((gs) => {
              const widthPct = gs.litres > 0 ? Math.max(8, Math.round((gs.litres / maxGradeLitres) * 100)) : 4;
              return (
                <div key={gs.grade} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">
                      {gradeLabel(gs.grade)} <span className="text-slate-400">·</span>{' '}
                      <span className="text-slate-500">{gs.pumps} pump(s)</span>
                    </span>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">
                      {formatLitres(gs.litres)} ({formatFcfa(gs.revenueFcfa)})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        gs.grade === 'SUPER'
                          ? 'bg-amber-600'
                          : gs.grade === 'GASOIL'
                          ? 'bg-slate-800'
                          : 'bg-slate-500'
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">Forecourt Payment Tender Mix</h2>
              <p className="text-xs text-slate-500">Settlement distribution across Cash, Mobile Money, Card &amp; Fleet</p>
            </div>
            <span className="font-mono text-xs text-slate-500">{closedShifts.length} Closed Shifts</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {[
              { label: 'Cash Safe', value: tenderCash },
              { label: 'OM / MTN MoMo', value: tenderMoMo },
              { label: 'Bank Card', value: tenderCard },
              { label: 'Fleet Credit', value: tenderFleet },
            ].map((item) => {
              const sharePct = Math.round((item.value / totalTenders) * 100);
              return (
                <div key={item.label} className="border border-slate-200 rounded-lg p-3 space-y-1">
                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className="font-mono tabular-nums text-sm font-bold text-slate-900">
                    {formatFcfa(item.value)}
                  </div>
                  <div className="font-mono tabular-nums text-[11px] text-amber-700 font-semibold">
                    {sharePct}% share
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Grid: Active Dispensers + Tank Gauges + Fuel Pricing & Multi-Station */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active Dispensers Snapshot */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">Forecourt Dispenser Summary</h2>
                <p className="text-xs text-slate-500">Live totalizers, assigned attendants, and active pump states</p>
              </div>
              <button
                type="button"
                onClick={() => onJumpTo('forecourt')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open Shift Controls
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Pump</th>
                    <th className="px-4 py-2.5">Grade</th>
                    <th className="px-4 py-2.5 text-right">Totalizer (L)</th>
                    <th className="px-4 py-2.5 text-right">Price (FCFA/L)</th>
                    <th className="px-4 py-2.5">Attendant</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPumps.map((pump) => {
                    const activeShift = filteredShifts.find((s) => s.pumpId === pump.id && s.status === 'OPEN');
                    return (
                      <tr key={pump.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{pump.code}</td>
                        <td className="px-4 py-2.5 text-slate-700">{gradeLabel(pump.grade)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {formatLitres(pump.totalizerLitres)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold">
                          {formatFcfa(pump.unitPriceFcfa)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">
                          {activeShift ? activeShift.attendantName : 'Unassigned'}
                        </td>
                        <td className="px-4 py-2.5 font-semibold">
                          {pump.status === 'ACTIVE_SHIFT' ? (
                            <span className="text-emerald-700">Active Shift</span>
                          ) : (
                            <span className="text-slate-500">Idle</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPumps.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-500">
                        No forecourt dispensers provisioned yet. Open Forecourt &amp; Shifts to add pumps.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Underground Tank Reserves</h2>
                <p className="text-xs text-slate-500">Book volume vs. physical dipstick calibration</p>
              </div>
            <button
              type="button"
              onClick={() => onJumpTo('inventory')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Manage Tanks &amp; Dipsticks
            </button>
          </div>

          <div className="space-y-4">
            {filteredTanks.map((tank) => {
              const pct = Math.min(100, Math.round((tank.bookVolumeLitres / tank.capacityLitres) * 100));
              const statusText =
                tank.status === 'VARIANCE_ALERT'
                  ? 'Variance Alert'
                  : tank.status === 'LOW_STOCK'
                  ? 'Low Stock'
                  : 'Nominal';
              const barColor =
                tank.status === 'VARIANCE_ALERT'
                  ? 'bg-red-600'
                  : tank.status === 'LOW_STOCK'
                  ? 'bg-amber-600'
                  : 'bg-slate-800';
              const textColor =
                tank.status === 'VARIANCE_ALERT'
                  ? 'text-red-700'
                  : tank.status === 'LOW_STOCK'
                  ? 'text-amber-700'
                  : 'text-emerald-700';

              return (
                <div key={tank.id} className="space-y-1.5 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="font-medium text-slate-900">
                      {tank.name} <span className="text-slate-400">·</span>{' '}
                      <span className="text-xs text-slate-500">{gradeLabel(tank.grade)}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums text-xs">
                      <span className="text-slate-700 font-semibold">
                        {formatLitres(tank.bookVolumeLitres)} / {formatLitres(tank.capacityLitres)} ({pct}%)
                      </span>
                      <span className={`font-sans font-semibold ${textColor}`}>{statusText}</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-mono tabular-nums">
                    <span>Last Dipstick: {formatLitres(tank.lastDipLitres)}</span>
                    <span>Variance: {tank.varianceLitres > 0 ? `+${tank.varianceLitres}` : tank.varianceLitres} L</span>
                  </div>
                </div>
              );
            })}
            {filteredTanks.length === 0 && (
              <div className="p-5 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500">
                No underground fuel tanks configured yet. Open Tanks &amp; Deliveries to add your first tank.
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Station & Regulatory Pricing Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">Regulatory Pump Prices</h2>
              <p className="text-xs text-slate-500">{currentStation?.name}</p>
            </div>
            {canEditPrices && (
              <button
                type="button"
                onClick={() => setShowNewStation(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-900"
              >
                <Plus className="w-3.5 h-3.5" /> New Station
              </button>
            )}
          </div>

          {currentStation && (
            <div className="space-y-2 text-sm">
              {ALL_FUEL_GRADES.map((g) => (
                <div key={g} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-700 font-medium">{gradeLabel(g)}</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    {formatFcfa(currentStation.prices[g])} / L
                  </span>
                </div>
              ))}
            </div>
          )}

          {canEditPrices ? (
            <button
              type="button"
              onClick={() => setShowPriceModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <Tag className="w-3.5 h-3.5" /> Publish Fuel Price Update
            </button>
          ) : (
            <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg p-3">
              Only the Owner role can publish regulatory fuel price updates.
            </div>
          )}
        </div>
      </div>

      {/* Fuel Price Change History Register */}
      {priceHistory.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-900" />
                Fuel Price Change Audit History
              </h2>
              <p className="text-xs text-slate-500">
                Complete tariff audit trail showing previous rate, new rate, operator, and CSPH / regulatory reason.
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500">{priceHistory.length} Recorded Changes</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Grade</th>
                  <th className="px-4 py-2.5 text-right">Previous (FCFA/L)</th>
                  <th className="px-4 py-2.5 text-right">New (FCFA/L)</th>
                  <th className="px-4 py-2.5">Changed By</th>
                  <th className="px-4 py-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {priceHistory.slice(0, 8).map((ph) => (
                  <tr key={ph.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-slate-600">{formatShortDate(ph.changedAt)}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{ph.grade}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500">{formatFcfa(ph.oldPriceFcfa)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-950">{formatFcfa(ph.newPriceFcfa)}</td>
                    <td className="px-4 py-2.5 text-slate-700">{ph.changedBy}</td>
                    <td className="px-4 py-2.5 text-slate-600">{ph.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Printable Document & Report Center + Attendant Performance Leaderboard */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-slate-900" />
                Station Printable Document Center
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Instant A4 PDF reports, Excel ledgers, and 80mm thermal receipts across every module.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() =>
                printDailyZReportPdf({
                  stationName: currentStation?.name ?? 'OpesFuel Station Network',
                  dateLabel: new Date().toISOString().slice(0, 10),
                  shifts: filteredShifts,
                  report,
                })
              }
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <span className="inline-flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" /> Daily Z-Report PDF
              </span>
              <span className="font-mono text-[10px] text-amber-300">A4</span>
            </button>
            <button
              type="button"
              onClick={() =>
                exportShiftsExcel(filteredShifts, currentStation?.name ?? 'Network')
              }
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold"
            >
              <span className="inline-flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Shifts Ledger Excel
              </span>
              <span className="font-mono text-[10px] text-slate-500">.xlsx</span>
            </button>
            <button
              type="button"
              onClick={() => onJumpTo('accounting')}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
            >
              <span>SYSCOHADA P&amp;L &amp; Vault Slips</span>
              <span className="font-mono text-[10px] text-amber-700">Open →</span>
            </button>
            <button
              type="button"
              onClick={() => onJumpTo('workforce')}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
            >
              <span>Payslips, Payroll &amp; Contracts</span>
              <span className="font-mono text-[10px] text-amber-700">Open →</span>
            </button>
            <button
              type="button"
              onClick={() => onJumpTo('inventory')}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
            >
              <span>Fuel POs &amp; Tanker GRN PDFs</span>
              <span className="font-mono text-[10px] text-amber-700">Open →</span>
            </button>
            <button
              type="button"
              onClick={() => onJumpTo('fleet')}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
            >
              <span>Fleet Tax Statements &amp; 80mm</span>
              <span className="font-mono text-[10px] text-amber-700">Open →</span>
            </button>
          </div>
        </div>

        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-slate-900" />
                Attendant Shift Performance Leaderboard
              </h2>
              <p className="text-xs text-slate-500">
                Closed forecourt volume, sales accuracy, and cash reconciliation variance by attendant.
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500">{closedShifts.length} Closed Shifts</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-2.5">Attendant</th>
                  <th className="px-4 py-2.5 text-right">Shifts</th>
                  <th className="px-4 py-2.5 text-right">Volume Sold</th>
                  <th className="px-4 py-2.5 text-right">Expected Sales</th>
                  <th className="px-4 py-2.5 text-right">Net Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(() => {
                  const byAttendant = new Map<
                    string,
                    { name: string; shifts: number; litres: number; expected: number; variance: number }
                  >();
                  for (const s of closedShifts) {
                    const prev = byAttendant.get(s.attendantName) ?? {
                      name: s.attendantName,
                      shifts: 0,
                      litres: 0,
                      expected: 0,
                      variance: 0,
                    };
                    prev.shifts += 1;
                    prev.litres += s.litresSold;
                    prev.expected += s.expectedRevenueFcfa;
                    prev.variance += s.varianceFcfa;
                    byAttendant.set(s.attendantName, prev);
                  }
                  const ranked = Array.from(byAttendant.values()).sort((a, b) => b.litres - a.litres);
                  if (ranked.length === 0) {
                    return (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                          Close your first forecourt shift to populate attendant performance rankings.
                        </td>
                      </tr>
                    );
                  }
                  return ranked.slice(0, 6).map((row) => (
                    <tr key={row.name} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{row.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{row.shifts}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                        {formatLitres(row.litres)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                        {formatFcfa(row.expected)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-semibold ${
                          row.variance < 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {row.variance > 0 ? `+${formatFcfa(row.variance)}` : formatFcfa(row.variance)}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Domain Events */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Recent Domain Events</h2>
            <p className="text-xs text-slate-500">Event-driven audit trail updating tanks, payroll, and double-entry journals</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onJumpTo('forecourt')}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Open / Close Shift
            </button>
            <button
              type="button"
              onClick={() => onJumpTo('accounting')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
            >
              Financial Reports
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {events.slice(0, 6).map((evt) => (
            <div key={evt.eventId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
              <div className="space-y-0.5">
                <div className="font-mono text-xs font-semibold text-amber-700">
                  {evt.eventType} <span className="text-slate-400">·</span>{' '}
                  <span className="text-slate-500 font-normal">{evt.aggregateType}</span>
                </div>
                <div className="text-slate-800">{evt.summary}</div>
              </div>
              <div className="font-mono text-xs text-slate-500 shrink-0">{formatShortDate(evt.occurredAt)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Popup FormModal: Publish Fuel Price Update */}
      <FormModal
        open={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        title="Publish Fuel Price Update"
        subtitle={`Updates live pump tariff for ${currentStation?.name ?? 'Active Station'} and records audit history.`}
      >
        <form onSubmit={handlePriceSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Fuel Grade</label>
              <select
                value={priceGrade}
                onChange={(e) => {
                  const g = e.target.value as FuelGrade;
                  setPriceGrade(g);
                  if (currentStation) setPriceValue(String(currentStation.prices[g]));
                }}
                className="opes-input"
              >
                {ALL_FUEL_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">New Retail Price (FCFA / Litre)</label>
              <input
                type="number"
                min={100}
                required
                value={priceValue}
                onChange={(e) => setPriceValue(e.target.value)}
                className="opes-input font-mono"
              />
            </div>
          </div>
          <div>
            <label className="opes-label">Regulatory / Pricing Reason</label>
            <input
              type="text"
              required
              value={priceReason}
              onChange={(e) => setPriceReason(e.target.value)}
              placeholder="e.g. CSPH monthly tariff adjustment"
              className="opes-input"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowPriceModal(false)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Publish Price Update
            </button>
          </div>
        </form>
      </FormModal>

      {/* Popup FormModal: Onboard New Petrol Station */}
      <FormModal
        open={showNewStation}
        onClose={() => setShowNewStation(false)}
        title="Onboard New Petrol Station"
        subtitle="Adds a new branch to your station network on the Starter plan (25,000 FCFA/mo)."
      >
        <form onSubmit={handleStationSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Station Code</label>
              <input
                type="text"
                required
                placeholder="e.g. OPF-GAR-03"
                value={stationForm.code}
                onChange={(e) => setStationForm({ ...stationForm, code: e.target.value })}
                className="opes-input font-mono"
              />
            </div>
            <div>
              <label className="opes-label">City / Town</label>
              <input
                type="text"
                required
                placeholder="e.g. Garoua"
                value={stationForm.city}
                onChange={(e) => setStationForm({ ...stationForm, city: e.target.value })}
                className="opes-input"
              />
            </div>
          </div>
          <div>
            <label className="opes-label">Station Name</label>
            <input
              type="text"
              required
              placeholder="e.g. OpesFuel Garoua Nord"
              value={stationForm.name}
              onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
              className="opes-input"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowNewStation(false)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Create Petrol Station
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
