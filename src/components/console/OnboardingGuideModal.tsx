import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, Circle, Sparkles, Truck, Wrench, X } from 'lucide-react';
import { INSTITUTIONAL_FUEL_CATALOG } from '../../api/opesfuelClient';
import { formatFcfa, formatLitres } from '../../domain/formatters';
import {
  ConsoleSection,
  Employee,
  FinancialReportBundle,
  FuelGrade,
  FuelTank,
  InstitutionalSetupSelection,
  JournalEntry,
  Pump,
  ShiftRecord,
  Station,
  TenantWorkspace,
} from '../../domain/types';
import { OpesFuelLogo } from '../brand/OpesFuelLogo';

interface OnboardingGuideModalProps {
  open: boolean;
  initialTab?: 'guide' | 'institutional';
  onClose: () => void;
  tenant: TenantWorkspace;
  stations: Station[];
  activeStationId: string;
  tanks: FuelTank[];
  pumps: Pump[];
  employees: Employee[];
  shifts: ShiftRecord[];
  journals: JournalEntry[];
  report: FinancialReportBundle;
  onJumpTo: (section: ConsoleSection) => void;
  onApplyInstitutionalSetup: (
    stationId: string,
    selections: InstitutionalSetupSelection[],
    lubricantsPack?: { includeLubricants: boolean; oilBottlesQty: number; lpgCylindersQty: number }
  ) => void;
}

interface FuelDraftRow extends InstitutionalSetupSelection {
  selected: boolean;
}

export const OnboardingGuideModal: React.FC<OnboardingGuideModalProps> = ({
  open,
  initialTab = 'guide',
  onClose,
  tenant,
  stations,
  activeStationId,
  tanks,
  pumps,
  employees,
  shifts,
  journals,
  report,
  onJumpTo,
  onApplyInstitutionalSetup,
}) => {
  const [tab, setTab] = useState<'guide' | 'institutional'>(initialTab);
  const [targetStationId, setTargetStationId] = useState<string>(() =>
    activeStationId !== 'ALL' ? activeStationId : stations[0]?.id ?? ''
  );

  const [rows, setRows] = useState<FuelDraftRow[]>(() =>
    INSTITUTIONAL_FUEL_CATALOG.map((item) => ({
      selected: item.code === 'SUPER' || item.code === 'GASOIL',
      grade: item.code,
      tankName: item.tankName,
      capacityLitres: item.defaultCapacityLitres,
      openingLitres: item.defaultOpeningLitres,
      unitCostFcfa: item.defaultUnitCostFcfa,
      sellingPriceFcfa: item.defaultSellingPriceFcfa,
      nozzleCount: item.defaultNozzleCount,
    }))
  );

  const [includeLubricants, setIncludeLubricants] = useState(true);
  const [oilBottlesQty, setOilBottlesQty] = useState('30');
  const [lpgCylindersQty, setLpgCylindersQty] = useState('24');

  React.useEffect(() => {
    if (open) {
      setTab(initialTab);
      if (activeStationId !== 'ALL') {
        setTargetStationId(activeStationId);
      } else if (stations[0]?.id) {
        setTargetStationId(stations[0].id);
      }
    }
  }, [open, initialTab, activeStationId, stations]);

  const effectiveStationId =
    stations.find((s) => s.id === targetStationId)?.id ?? stations[0]?.id ?? '';

  const steps = useMemo(
    () => [
      {
        id: 'INSTITUTIONAL_FUELS_VOLUMES',
        title: '1. Select Institutional Fuels & Opening Volumes',
        description:
          'Tick the fuel grades carried at your station, enter tank capacities & opening Litres, and synchronize tanks, pumps, and opening inventory capital (1200 / 3010).',
        done: tanks.length > 0,
        ctaLabel: 'Open Fuel & Volume Setup',
        action: () => setTab('institutional'),
      },
      {
        id: 'FORECOURT_PUMPS_STAFF',
        title: '2. Verify Forecourt Pumps & Attendant Roster',
        description:
          'Confirm every dispenser nozzle has an initial meter reading and assign shift-ready pump attendants.',
        done: pumps.length > 0 && employees.length > 0,
        ctaLabel: 'Check Pumps & Staff',
        action: () => {
          onClose();
          onJumpTo(pumps.length === 0 ? 'forecourt' : 'workforce');
        },
      },
      {
        id: 'SHIFT_RECONCILIATION',
        title: '3. Open & Reconcile First Forecourt Shift',
        description:
          'Run an attendant shift from opening meter to closing tender split (Cash, OM/MoMo, Card, Fleet) with automated VAT & COGS journals.',
        done: shifts.some((s) => s.status === 'CLOSED'),
        ctaLabel: 'Go to Forecourt Shifts',
        action: () => {
          onClose();
          onJumpTo('forecourt');
        },
      },
      {
        id: 'DOUBLE_ENTRY_AUDIT',
        title: '4. Audit Double-Entry Trial Balance & Bank Drops',
        description:
          'Verify Cash Safe drops to Bank (1030), log operating expenses, and review your balanced SYSCOHADA Trial Balance.',
        done: journals.length > 0 && report.trialBalanceBalanced,
        ctaLabel: 'Open Accounting Ledger',
        action: () => {
          onClose();
          onJumpTo('accounting');
        },
      },
      {
        id: 'PAID_AI_COPILOT',
        title: '5. Enable Paid AI Forecasting & Margin Copilot',
        description:
          'Activate OpesFuel AI Copilot (25 000 FCFA/mo or included free on Network Enterprise) for tank stockout predictions and 30-day revenue forecasts.',
        done: tenant.aiSubscription.active,
        ctaLabel: 'Open AI Copilot',
        action: () => {
          onClose();
          onJumpTo('ai-assistant');
        },
      },
    ],
    [tanks.length, pumps.length, employees.length, shifts, journals.length, report.trialBalanceBalanced, tenant.aiSubscription.active, onClose, onJumpTo]
  );

  const completedCount = steps.filter((s) => s.done).length;

  const selectedRows = rows.filter((r) => r.selected);
  const estimatedOpeningCapitalFcfa = useMemo(() => {
    const fuelSum = selectedRows.reduce(
      (sum, r) => sum + Math.round((Number(r.openingLitres) || 0) * (Number(r.unitCostFcfa) || 0)),
      0
    );
    const shopSum = includeLubricants
      ? (Number(oilBottlesQty) || 0) * 13200 + (Number(lpgCylindersQty) || 0) * 5400
      : 0;
    return fuelSum + shopSum;
  }, [selectedRows, includeLubricants, oilBottlesQty, lpgCylindersQty]);

  const updateRow = (grade: FuelGrade, patch: Partial<FuelDraftRow>) => {
    setRows((prev) => prev.map((r) => (r.grade === grade ? { ...r, ...patch } : r)));
  };

  const handleApplyInstitutional = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveStationId || selectedRows.length === 0) return;
    const selections: InstitutionalSetupSelection[] = selectedRows.map((r) => ({
      grade: r.grade,
      tankName: r.tankName.trim() || `${r.grade} Reserve Tank`,
      capacityLitres: Math.max(1000, Number(r.capacityLitres) || 20000),
      openingLitres: Math.max(0, Number(r.openingLitres) || 0),
      unitCostFcfa: Math.max(100, Number(r.unitCostFcfa) || 500),
      sellingPriceFcfa: Math.max(100, Number(r.sellingPriceFcfa) || 600),
      nozzleCount: Math.max(1, Number(r.nozzleCount) || 1),
    }));
    onApplyInstitutionalSetup(effectiveStationId, selections, {
      includeLubricants,
      oilBottlesQty: Math.max(0, Number(oilBottlesQty) || 0),
      lpgCylindersQty: Math.max(0, Number(lpgCylindersQty) || 0),
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="OpesFuel Station Onboarding Guide"
    >
      <div className="bg-white w-full max-w-4xl max-h-[92vh] sm:rounded-2xl rounded-t-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-900 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <OpesFuelLogo variant="light" size="sm" />
            <div className="h-5 w-px bg-slate-700 hidden sm:block" />
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">Station Onboarding &amp; Institutional Setup</div>
              <div className="text-[11px] text-slate-300 font-mono">
                {completedCount}/5 operational milestones complete
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close onboarding guide"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('guide')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[40px] ${
              tab === 'guide'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Station Onboarding Checklist ({completedCount}/5)
          </button>
          <button
            type="button"
            onClick={() => setTab('institutional')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[40px] ${
              tab === 'institutional'
                ? 'bg-amber-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" /> Institutional Fuels &amp; Volumes Setup
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === 'guide' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-900">Fast-Track Station Commissioning</div>
                  <p className="text-xs text-slate-700">
                    Every module synchronizes automatically: ticking your fuels and opening Litres creates tanks, forecourt nozzles, regulatory tariffs, and your opening double-entry ledger balance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('institutional')}
                  className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap min-h-[44px]"
                >
                  Configure Fuels Now
                </button>
              </div>

              <div className="space-y-3">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      step.done ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {step.done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-900">{step.title}</div>
                        <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={step.action}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] ${
                        step.done
                          ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {step.done ? 'Review Step' : step.ctaLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <form id="institutional-setup-form" onSubmit={handleApplyInstitutional} className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div>
                  <div className="text-xs font-bold text-slate-900">Target Station Partition</div>
                  <p className="text-[11px] text-slate-500">
                    Tick each fuel product available at this station and confirm opening volumes in Litres.
                  </p>
                </div>
                <select
                  value={effectiveStationId}
                  onChange={(e) => setTargetStationId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 min-h-[40px]"
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {rows.map((row) => {
                  const template = INSTITUTIONAL_FUEL_CATALOG.find((c) => c.code === row.grade)!;
                  const rowCapitalFcfa = Math.round((Number(row.openingLitres) || 0) * (Number(row.unitCostFcfa) || 0));
                  return (
                    <div
                      key={row.grade}
                      className={`rounded-xl border p-4 transition-colors ${
                        row.selected ? 'border-amber-500 bg-amber-50/25' : 'border-slate-200 bg-white opacity-80'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-[220px]">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => updateRow(row.grade, { selected: e.target.checked })}
                            className="mt-1 w-4 h-4 accent-amber-600 rounded"
                          />
                          <div>
                            <div className="text-sm font-bold text-slate-900">{template.label}</div>
                            <div className="text-xs text-slate-500">{template.description}</div>
                          </div>
                        </label>
                        {row.selected && (
                          <div className="text-right font-mono tabular-nums text-xs">
                            <div className="text-slate-500">Opening Asset (1200)</div>
                            <div className="font-bold text-slate-900">{formatFcfa(rowCapitalFcfa)}</div>
                          </div>
                        )}
                      </div>

                      {row.selected && (
                        <div className="mt-4 pt-3 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                          <div className="col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tank Name</label>
                            <input
                              type="text"
                              value={row.tankName}
                              onChange={(e) => updateRow(row.grade, { tankName: e.target.value })}
                              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Capacity (L)</label>
                            <input
                              type="number"
                              min={1000}
                              value={row.capacityLitres}
                              onChange={(e) => updateRow(row.grade, { capacityLitres: Number(e.target.value) || 0 })}
                              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Opening Vol (L)</label>
                            <input
                              type="number"
                              min={0}
                              value={row.openingLitres}
                              onChange={(e) => updateRow(row.grade, { openingLitres: Number(e.target.value) || 0 })}
                              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono tabular-nums font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cost/L (FCFA)</label>
                            <input
                              type="number"
                              min={100}
                              value={row.unitCostFcfa}
                              onChange={(e) => updateRow(row.grade, { unitCostFcfa: Number(e.target.value) || 0 })}
                              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pump Tariff / Nozzles</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <input
                                type="number"
                                min={100}
                                value={row.sellingPriceFcfa}
                                title="Selling Price FCFA/L"
                                onChange={(e) => updateRow(row.grade, { sellingPriceFcfa: Number(e.target.value) || 0 })}
                                className="w-full px-2 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono tabular-nums"
                              />
                              <input
                                type="number"
                                min={1}
                                max={8}
                                value={row.nozzleCount}
                                title="Number of dispenser nozzles"
                                onChange={(e) => updateRow(row.grade, { nozzleCount: Number(e.target.value) || 1 })}
                                className="w-full px-2 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono tabular-nums text-center"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Optional Lubricants & 12.5kg Gas Cylinder Counter Stock */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLubricants}
                    onChange={(e) => setIncludeLubricants(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-amber-600 rounded"
                  />
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Include Lubricants &amp; 12.5kg Domestic Gas Cylinders Pack
                    </div>
                    <div className="text-xs text-slate-500">
                      Synchronizes initial counter SKUs in Fleet Credit &amp; Shop POS alongside underground tank inventory.
                    </div>
                  </div>
                </label>
                {includeLubricants && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-7">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        15W40 5L Engine Oil Qty (Cost 13 200 FCFA / Sell 18 500 FCFA)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={oilBottlesQty}
                        onChange={(e) => setOilBottlesQty(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        12.5kg LPG Cylinders Qty (Cost 5 400 FCFA / Sell 6 500 FCFA)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={lpgCylindersQty}
                        onChange={(e) => setLpgCylindersQty(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono tabular-nums"
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          {tab === 'institutional' ? (
            <>
              <div className="text-xs">
                <span className="text-slate-500">Selected: </span>
                <span className="font-semibold text-slate-900">{selectedRows.length} fuel grades</span>
                <span className="text-slate-400"> · </span>
                <span className="text-slate-500">Total Vol: </span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatLitres(selectedRows.reduce((s, r) => s + (Number(r.openingLitres) || 0), 0))}
                </span>
                <span className="text-slate-400"> · </span>
                <span className="text-slate-500">Opening Capital: </span>
                <span className="font-mono font-bold text-amber-700">{formatFcfa(estimatedOpeningCapitalFcfa)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab('guide')}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[44px]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  form="institutional-setup-form"
                  disabled={selectedRows.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold min-h-[44px]"
                >
                  <Check className="w-4 h-4" /> Apply &amp; Sync Station Modules
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>Spring Modulith cross-module sync updates Inventory, Forecourt, and Ledger atomically.</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold min-h-[44px]"
              >
                Continue to Console
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
