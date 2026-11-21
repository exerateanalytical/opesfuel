import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Fuel, Plus, Trash2 } from 'lucide-react';
import { canPerformAction } from '../../auth/auth0';
import { ALL_FUEL_GRADES, formatFcfa, formatLitres, formatShortDate, gradeLabel } from '../../domain/formatters';
import { Employee, FuelGrade, FuelTank, Pump, ShiftRecord, UserRole } from '../../domain/types';

interface ForecourtSectionProps {
  role: UserRole;
  stationId: string;
  defaultStationId: string;
  pumps: Pump[];
  tanks: FuelTank[];
  shifts: ShiftRecord[];
  employees: Employee[];
  onOpenShift: (stationId: string, pumpId: string, attendantId: string) => void;
  onCloseShift: (
    shiftId: string,
    payload: {
      closingMeterLitres: number;
      cashFcfa: number;
      mobileMoneyFcfa: number;
      cardFcfa: number;
      fleetCreditFcfa: number;
    }
  ) => void;
  onCreatePump: (input: {
    stationId: string;
    tankId: string;
    code: string;
    grade: FuelGrade;
    initialTotalizerLitres: number;
  }) => void;
  onDeletePump: (pumpId: string) => void;
  onDeleteShift: (shiftId: string) => void;
}

export const ForecourtSection: React.FC<ForecourtSectionProps> = ({
  role,
  stationId,
  defaultStationId,
  pumps,
  tanks,
  shifts,
  employees,
  onOpenShift,
  onCloseShift,
  onCreatePump,
  onDeletePump,
  onDeleteShift,
}) => {
  const canOperate = canPerformAction(role, 'OPEN_CLOSE_SHIFT');
  const canManage = canPerformAction(role, 'MANAGE_EMPLOYEES');

  const visiblePumps = pumps.filter((p) => stationId === 'ALL' || p.stationId === stationId);
  const visibleTanks = tanks.filter((t) => stationId === 'ALL' || t.stationId === stationId);
  const visibleShifts = shifts.filter((s) => stationId === 'ALL' || s.stationId === stationId);
  const idlePumps = visiblePumps.filter((p) => p.status === 'IDLE');
  const attendants = employees.filter(
    (e) => (stationId === 'ALL' || e.stationId === stationId) && e.role === 'ATTENDANT'
  );

  // Detail sub-views
  const [detailPumpId, setDetailPumpId] = useState<string | null>(null);
  const [detailShiftId, setDetailShiftId] = useState<string | null>(null);

  // Open shift selector
  const [selectedPumpId, setSelectedPumpId] = useState('');
  const [selectedAttendantId, setSelectedAttendantId] = useState('');

  // Add pump panel
  const [showAddPump, setShowAddPump] = useState(false);
  const [pumpCode, setPumpCode] = useState('');
  const [pumpGrade, setPumpGrade] = useState<FuelGrade>('SUPER');
  const [pumpTankId, setPumpTankId] = useState('');
  const [pumpTotalizer, setPumpTotalizer] = useState('0');

  // Close shift drawer state
  const [closingShift, setClosingShift] = useState<ShiftRecord | null>(null);
  const [closingMeter, setClosingMeter] = useState('');
  const [cashFcfa, setCashFcfa] = useState('0');
  const [momoFcfa, setMomoFcfa] = useState('0');
  const [cardFcfa, setCardFcfa] = useState('0');
  const [fleetFcfa, setFleetFcfa] = useState('0');

  const openCloseModal = (shift: ShiftRecord) => {
    const suggestedLitres = 650;
    const suggestedClosing = shift.openingMeterLitres + suggestedLitres;
    const expected = suggestedLitres * shift.unitPriceFcfa;
    setClosingShift(shift);
    setClosingMeter(String(suggestedClosing));
    setCashFcfa(String(Math.round(expected * 0.65)));
    setMomoFcfa(String(Math.round(expected * 0.25)));
    setCardFcfa(String(expected - Math.round(expected * 0.65) - Math.round(expected * 0.25)));
    setFleetFcfa('0');
  };

  const handleOpenShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pump = idlePumps.find((p) => p.id === selectedPumpId) ?? idlePumps[0];
    const att = attendants.find((a) => a.id === selectedAttendantId) ?? attendants[0];
    if (!pump || !att) return;
    onOpenShift(pump.stationId, pump.id, att.id);
    setSelectedPumpId('');
  };

  const handleCloseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingShift) return;
    onCloseShift(closingShift.id, {
      closingMeterLitres: Number(closingMeter) || 0,
      cashFcfa: Number(cashFcfa) || 0,
      mobileMoneyFcfa: Number(momoFcfa) || 0,
      cardFcfa: Number(cardFcfa) || 0,
      fleetCreditFcfa: Number(fleetFcfa) || 0,
    });
    setClosingShift(null);
  };

  const handleCreatePumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetTank = visibleTanks.find((t) => t.id === pumpTankId) ?? visibleTanks[0];
    if (!pumpCode.trim() || !targetTank) return;
    onCreatePump({
      stationId: targetTank.stationId || defaultStationId,
      tankId: targetTank.id,
      code: pumpCode.trim(),
      grade: pumpGrade,
      initialTotalizerLitres: Number(pumpTotalizer) || 0,
    });
    setPumpCode('');
    setPumpTotalizer('0');
    setShowAddPump(false);
  };

  const previewLitres = closingShift
    ? Math.max(0, (Number(closingMeter) || 0) - closingShift.openingMeterLitres)
    : 0;
  const previewExpected = closingShift ? Math.round(previewLitres * closingShift.unitPriceFcfa) : 0;
  const previewDeclared =
    (Number(cashFcfa) || 0) +
    (Number(momoFcfa) || 0) +
    (Number(cardFcfa) || 0) +
    (Number(fleetFcfa) || 0);
  const previewVariance = previewDeclared - previewExpected;

  // Dedicated Pump Detail View
  const activeDetailPump = detailPumpId ? pumps.find((p) => p.id === detailPumpId) : null;
  if (activeDetailPump) {
    const linkedTank = tanks.find((t) => t.id === activeDetailPump.tankId);
    const pumpShifts = shifts.filter((s) => s.pumpId === activeDetailPump.id);
    const openShift = pumpShifts.find((s) => s.status === 'OPEN');

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDetailPumpId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Forecourt &amp; Shifts
          </button>
          {canManage && activeDetailPump.status !== 'ACTIVE_SHIFT' && (
            <button
              type="button"
              onClick={() => {
                onDeletePump(activeDetailPump.id);
                setDetailPumpId(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove Pump Dispenser
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Dispenser {activeDetailPump.code} — {gradeLabel(activeDetailPump.grade)}
                </h2>
                <p className="text-xs text-slate-500">
                  Pump ID: <span className="font-mono">{activeDetailPump.id}</span> · Linked Tank:{' '}
                  {linkedTank ? linkedTank.name : 'Unassigned'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Current Totalizer</div>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                {formatLitres(activeDetailPump.totalizerLitres)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Pump Tariff</div>
              <div className="font-mono tabular-nums font-bold text-slate-900 mt-1">
                {formatFcfa(activeDetailPump.unitPriceFcfa)} / L
              </div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Operational State</div>
              <div className="font-semibold text-slate-900 mt-1">
                {activeDetailPump.status === 'ACTIVE_SHIFT' ? 'Active Shift Running' : 'Idle & Ready'}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Tank Reserve</div>
              <div className="font-mono tabular-nums font-bold text-slate-900 mt-1">
                {linkedTank ? formatLitres(linkedTank.bookVolumeLitres) : '—'}
              </div>
            </div>
          </div>

          {openShift && canOperate && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-amber-900">
                Active Shift <span className="font-mono font-bold">{openShift.id}</span> assigned to{' '}
                <span className="font-semibold">{openShift.attendantName}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailPumpId(null);
                  openCloseModal(openShift);
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Close &amp; Reconcile Shift
              </button>
            </div>
          )}

          <div>
            <h3 className="font-display text-base font-bold text-slate-900 mb-3">
              Shift History for {activeDetailPump.code} ({pumpShifts.length})
            </h3>
            {pumpShifts.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Shift</th>
                      <th className="px-4 py-2.5">Attendant</th>
                      <th className="px-4 py-2.5 text-right">Opening (L)</th>
                      <th className="px-4 py-2.5 text-right">Closing (L)</th>
                      <th className="px-4 py-2.5 text-right">Sold (L)</th>
                      <th className="px-4 py-2.5 text-right">Variance</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pumpShifts.map((sh) => (
                      <tr
                        key={sh.id}
                        onClick={() => {
                          setDetailPumpId(null);
                          setDetailShiftId(sh.id);
                        }}
                        className="hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-4 py-2.5 font-mono text-amber-700 font-semibold">{sh.id}</td>
                        <td className="px-4 py-2.5 text-slate-800">{sh.attendantName}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatLitres(sh.openingMeterLitres)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {sh.closingMeterLitres !== null ? formatLitres(sh.closingMeterLitres) : 'Open'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatLitres(sh.litresSold)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatFcfa(sh.varianceFcfa)}</td>
                        <td className="px-4 py-2.5 font-semibold">{sh.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-slate-500 p-4 border border-slate-200 rounded-lg">
                No shifts have been recorded on this dispenser yet.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Dedicated Shift Detail View
  const activeDetailShift = detailShiftId ? shifts.find((s) => s.id === detailShiftId) : null;
  if (activeDetailShift) {
    const declaredTotal =
      activeDetailShift.cashFcfa +
      activeDetailShift.mobileMoneyFcfa +
      activeDetailShift.cardFcfa +
      activeDetailShift.fleetCreditFcfa;
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDetailShiftId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Shift Ledger
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => {
                onDeleteShift(activeDetailShift.id);
                setDetailShiftId(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Shift Record
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="font-mono text-xs text-amber-700 font-semibold">
                {activeDetailShift.id} · {activeDetailShift.status}
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900 mt-1">
                Shift Reconciliation — {activeDetailShift.pumpCode} ({gradeLabel(activeDetailShift.grade)})
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Attendant: {activeDetailShift.attendantName} · Opened {formatShortDate(activeDetailShift.openedAt)}
                {activeDetailShift.closedAt ? ` · Closed ${formatShortDate(activeDetailShift.closedAt)}` : ''}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Expected Revenue</div>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                {formatFcfa(activeDetailShift.expectedRevenueFcfa)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-900">Meter Calibration</div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Opening Totalizer</span>
                <span className="font-mono tabular-nums">{formatLitres(activeDetailShift.openingMeterLitres)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Closing Totalizer</span>
                <span className="font-mono tabular-nums">
                  {activeDetailShift.closingMeterLitres !== null
                    ? formatLitres(activeDetailShift.closingMeterLitres)
                    : 'Shift Still Open'}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Volume Dispensed</span>
                <span className="font-mono tabular-nums font-bold">{formatLitres(activeDetailShift.litresSold)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Pump Tariff</span>
                <span className="font-mono tabular-nums">{formatFcfa(activeDetailShift.unitPriceFcfa)} / L</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-900">Declared Tender Breakdown</div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Cash in Safe (1010)</span>
                <span className="font-mono tabular-nums">{formatFcfa(activeDetailShift.cashFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Mobile Money Clearing (1020)</span>
                <span className="font-mono tabular-nums">{formatFcfa(activeDetailShift.mobileMoneyFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Card / Bank Terminal (1030)</span>
                <span className="font-mono tabular-nums">{formatFcfa(activeDetailShift.cardFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Fleet Credit Vouchers (1100)</span>
                <span className="font-mono tabular-nums">{formatFcfa(activeDetailShift.fleetCreditFcfa)}</span>
              </div>
              <div className="px-4 py-3 bg-slate-900 text-white flex justify-between font-bold">
                <span>Declared Total ({formatFcfa(activeDetailShift.varianceFcfa)} Variance)</span>
                <span className="font-mono tabular-nums text-amber-400">{formatFcfa(declaredTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pump Islands Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Forecourt Pumps &amp; Totalizers</h2>
            <p className="text-xs text-slate-500">Mechanical &amp; digital dispenser meters in Litres</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canOperate && idlePumps.length > 0 && attendants.length > 0 && (
              <form onSubmit={handleOpenShiftSubmit} className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedPumpId || idlePumps[0]?.id}
                  onChange={(e) => setSelectedPumpId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  {idlePumps.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} ({gradeLabel(p.grade)})
                    </option>
                  ))}
                </select>
                <select
                  value={selectedAttendantId || attendants[0]?.id}
                  onChange={(e) => setSelectedAttendantId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  {attendants.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.fullName}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap"
                >
                  Open Shift
                </button>
              </form>
            )}

            {canManage && (
              <button
                type="button"
                onClick={() => setShowAddPump((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" /> {showAddPump ? 'Cancel' : 'Add Pump'}
              </button>
            )}
          </div>
        </div>

        {showAddPump && canManage && (
          <form
            onSubmit={handleCreatePumpSubmit}
            className="p-4 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
          >
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pump Code</label>
              <input
                type="text"
                placeholder="e.g. P-05A"
                value={pumpCode}
                onChange={(e) => setPumpCode(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Fuel Grade</label>
              <select
                value={pumpGrade}
                onChange={(e) => setPumpGrade(e.target.value as FuelGrade)}
                className="w-full px-3 py-2 rounded border border-slate-300 text-xs bg-white min-h-[40px]"
              >
                {ALL_FUEL_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Linked Underground Tank</label>
              {visibleTanks.length > 0 ? (
                <select
                  value={pumpTankId || visibleTanks[0]?.id}
                  onChange={(e) => setPumpTankId(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 text-xs bg-white"
                >
                  {visibleTanks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 rounded border border-amber-200 bg-amber-50 text-[11px] text-amber-800">
                  Add a fuel tank first
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Initial Meter (L)</label>
              <input
                type="number"
                min={0}
                value={pumpTotalizer}
                onChange={(e) => setPumpTotalizer(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={visibleTanks.length === 0}
              className="py-2 px-4 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold"
            >
              Provision Dispenser
            </button>
          </form>
        )}

        {visiblePumps.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center space-y-2">
            <div className="font-display font-semibold text-slate-900">No dispensers provisioned yet</div>
            <p className="text-xs text-slate-500">
              Provision an underground fuel tank in Tanks &amp; Deliveries, then add forecourt pump nozzles above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {visiblePumps.map((pump) => {
              const activeShift = visibleShifts.find((s) => s.pumpId === pump.id && s.status === 'OPEN');
              return (
                <div key={pump.id} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailPumpId(pump.id)}
                      className="inline-flex items-center gap-1 font-display font-bold text-slate-900 hover:text-amber-700"
                    >
                      <span>{pump.code}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          pump.status === 'ACTIVE_SHIFT' ? 'text-amber-700' : 'text-slate-500'
                        }`}
                      >
                        {pump.status === 'ACTIVE_SHIFT' ? 'Active Shift' : 'Idle'}
                      </span>
                      {canManage && pump.status !== 'ACTIVE_SHIFT' && (
                        <button
                          type="button"
                          onClick={() => onDeletePump(pump.id)}
                          aria-label={`Delete pump ${pump.code}`}
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">
                    {gradeLabel(pump.grade)} ·{' '}
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {formatFcfa(pump.unitPriceFcfa)}/L
                    </span>
                  </div>
                  <div className="bg-slate-900 text-amber-400 font-mono tabular-nums text-base font-semibold px-3 py-2 rounded">
                    {pump.totalizerLitres.toLocaleString('en-US')} L
                  </div>
                  {activeShift ? (
                    <div className="space-y-2 pt-1">
                      <div className="text-xs text-slate-600">Attendant: {activeShift.attendantName}</div>
                      {canOperate && (
                        <button
                          type="button"
                          onClick={() => openCloseModal(activeShift)}
                          className="w-full py-2 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                        >
                          Close Shift &amp; Reconcile
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <span>Ready for next shift</span>
                      <button
                        type="button"
                        onClick={() => setDetailPumpId(pump.id)}
                        className="font-semibold text-amber-700 hover:text-amber-800"
                      >
                        Details
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Close Shift Calculator Panel */}
      {closingShift && (
        <div className="bg-white border-2 border-amber-600 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Close &amp; Reconcile Shift {closingShift.id} ({closingShift.pumpCode})
              </h3>
              <p className="text-xs text-slate-500">
                Attendant: {closingShift.attendantName} · Opening Meter:{' '}
                <span className="font-mono tabular-nums">{formatLitres(closingShift.openingMeterLitres)}</span> · Price:{' '}
                <span className="font-mono tabular-nums">{formatFcfa(closingShift.unitPriceFcfa)}/L</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setClosingShift(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCloseSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Closing Meter (L)</label>
              <input
                type="number"
                step="0.01"
                value={closingMeter}
                onChange={(e) => setClosingMeter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Cash (FCFA)</label>
              <input
                type="number"
                value={cashFcfa}
                onChange={(e) => setCashFcfa(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Money (FCFA)</label>
              <input
                type="number"
                value={momoFcfa}
                onChange={(e) => setMomoFcfa(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Card / TPE (FCFA)</label>
              <input
                type="number"
                value={cardFcfa}
                onChange={(e) => setCardFcfa(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Fleet Credit (FCFA)</label>
              <input
                type="number"
                value={fleetFcfa}
                onChange={(e) => setFleetFcfa(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
              />
            </div>

            <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-6 text-xs">
                <div>
                  <span className="text-slate-500">Volume Sold: </span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">{formatLitres(previewLitres)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Expected Revenue: </span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">{formatFcfa(previewExpected)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Declared Tenders: </span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">{formatFcfa(previewDeclared)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Variance: </span>
                  <span
                    className={`font-mono tabular-nums font-bold ${
                      previewVariance === 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {previewVariance > 0 ? `+${formatFcfa(previewVariance)}` : formatFcfa(previewVariance)}
                  </span>
                </div>
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                Commit Shift &amp; Post Accounting Journal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shift Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-bold text-slate-900">Shift Handover Ledger</h3>
          <p className="text-xs text-slate-500">Click any shift row for complete meter &amp; tender reconciliation details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Pump / Grade</th>
                <th className="px-4 py-3">Attendant</th>
                <th className="px-4 py-3 text-right">Volume (L)</th>
                <th className="px-4 py-3 text-right">Expected (FCFA)</th>
                <th className="px-4 py-3 text-right">Declared (FCFA)</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3">Status</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleShifts.map((s) => {
                const declared = s.cashFcfa + s.mobileMoneyFcfa + s.cardFcfa + s.fleetCreditFcfa;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      <button
                        type="button"
                        onClick={() => setDetailShiftId(s.id)}
                        className="font-semibold text-amber-700 hover:underline"
                      >
                        {s.id}
                      </button>
                      <div className="text-slate-400">{formatShortDate(s.openedAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900">{s.pumpCode}</span>{' '}
                      <span className="text-xs text-slate-500">· {s.grade}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{s.attendantName}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatLitres(s.litresSold)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatFcfa(s.expectedRevenueFcfa)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatFcfa(declared)}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                        s.varianceFcfa < 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {s.varianceFcfa > 0 ? `+${formatFcfa(s.varianceFcfa)}` : formatFcfa(s.varianceFcfa)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {s.status === 'OPEN' ? (
                        <span className="text-amber-700">Open</span>
                      ) : (
                        <span className="text-slate-600">Closed</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteShift(s.id)}
                          aria-label={`Delete shift ${s.id}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {visibleShifts.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="px-4 py-6 text-center text-xs text-slate-500">
                    No shifts recorded for this station scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
