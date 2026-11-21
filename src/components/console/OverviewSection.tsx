import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Compass, Droplets, Gauge, Smartphone, Sparkles } from 'lucide-react';
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

interface OverviewSectionProps {
  role: UserRole;
  activeStationId: string;
  stations: Station[];
  tanks: FuelTank[];
  pumps: Pump[];
  shifts: ShiftRecord[];
  events: DomainEventLog[];
  report: FinancialReportBundle;
  onboardingCompletedCount: number;
  onOpenOnboardingGuide: (tab?: 'guide' | 'institutional') => void;
  onUpdatePrice: (stationId: string, grade: FuelGrade, price: number) => void;
  onCreateStation: (input: {
    code: string;
    name: string;
    city: string;
    planName: string;
    monthlyFeeFcfa: number;
  }) => void;
  onJumpTo: (section: 'forecourt' | 'inventory' | 'accounting' | 'api-platform' | 'ai-assistant' | 'mobile-app') => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  role,
  activeStationId,
  stations,
  tanks,
  pumps,
  shifts,
  events,
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
  const [showNewStation, setShowNewStation] = useState(false);
  const [stationForm, setStationForm] = useState({ code: '', name: '', city: '' });

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
    onUpdatePrice(currentStation.id, priceGrade, Number(priceValue) || 0);
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

  return (
    <div className="space-y-6">
      {/* Onboarding & Institutional Fuel Tick-Wizard Banner */}
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
                    className={`flex items-start justify-between gap-2 rounded-md border px-2.5 py-2 text-xs ${
                      al.severity === 'CRITICAL'
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-amber-50 border-amber-200 text-amber-950'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{al.title}</div>
                      <div className="text-[11px] opacity-85 truncate">{al.detail}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        al.target === 'onboarding'
                          ? onOpenOnboardingGuide('institutional')
                          : onJumpTo(al.target)
                      }
                      className="text-[11px] font-bold underline shrink-0 whitespace-nowrap"
                    >
                      {al.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-xs text-emerald-900">
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
                onClick={() => setShowNewStation((v) => !v)}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800"
              >
                {showNewStation ? 'Cancel' : '+ New Station'}
              </button>
            )}
          </div>

          {showNewStation && canEditPrices && (
            <form onSubmit={handleStationSubmit} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
              <div className="text-xs font-semibold text-slate-900">Onboard Station (25 000 FCFA/mo Starter)</div>
              <input
                type="text"
                placeholder="Code (e.g. OPF-GAR-03)"
                value={stationForm.code}
                onChange={(e) => setStationForm({ ...stationForm, code: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded border border-slate-300 bg-white"
              />
              <input
                type="text"
                placeholder="Station Name"
                value={stationForm.name}
                onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded border border-slate-300 bg-white"
              />
              <input
                type="text"
                placeholder="City"
                value={stationForm.city}
                onChange={(e) => setStationForm({ ...stationForm, city: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded border border-slate-300 bg-white"
              />
              <button
                type="submit"
                className="w-full py-2 rounded bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Save Station
              </button>
            </form>
          )}

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
            <form onSubmit={handlePriceSubmit} className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={priceGrade}
                  onChange={(e) => {
                    const g = e.target.value as FuelGrade;
                    setPriceGrade(g);
                    if (currentStation) setPriceValue(String(currentStation.prices[g]));
                  }}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white min-h-[40px]"
                >
                  {ALL_FUEL_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {gradeLabel(g)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={100}
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono tabular-nums min-h-[40px]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                Publish Fuel Price Update
              </button>
            </form>
          ) : (
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
              Only the Owner role can publish regulatory fuel price updates.
            </div>
          )}
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
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
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
    </div>
  );
};
