import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Database, FileSpreadsheet, FileText, Plus, Trash2 } from 'lucide-react';
import { canPerformAction } from '../../auth/auth0';
import { ALL_FUEL_GRADES, formatFcfa, formatLitres, formatShortDate, gradeLabel } from '../../domain/formatters';
import { DipstickReadingRecord, FuelGrade, FuelTank, PurchaseOrder, TankDeliveryRecord, UserRole } from '../../domain/types';
import { exportInventoryExcel, exportInventoryPdf } from '../../utils/exportReports';

interface InventorySectionProps {
  role: UserRole;
  stationId: string;
  defaultStationId: string;
  tanks: FuelTank[];
  purchaseOrders: PurchaseOrder[];
  deliveries: TankDeliveryRecord[];
  dipsticks: DipstickReadingRecord[];
  onRecordDipstick: (tankId: string, measuredLitres: number) => void;
  onCreatePO: (input: {
    stationId: string;
    supplierName: string;
    grade: FuelGrade;
    orderedLitres: number;
    unitCostFcfa: number;
  }) => void;
  onReceiveDelivery: (input: {
    tankId: string;
    purchaseOrderId?: string;
    supplierName: string;
    bolLitres: number;
    actualReceivedLitres: number;
    unitCostFcfa: number;
  }) => void;
  onCreateTank: (input: {
    stationId: string;
    name: string;
    grade: FuelGrade;
    capacityLitres: number;
    bookVolumeLitres: number;
    unitCostFcfa: number;
  }) => void;
  onDeleteTank: (tankId: string) => void;
  onDeletePO: (poId: string) => void;
  onDeleteDelivery: (deliveryId: string) => void;
  onDeleteDipstick: (dipstickId: string) => void;
}

export const InventorySection: React.FC<InventorySectionProps> = ({
  role,
  stationId,
  defaultStationId,
  tanks,
  purchaseOrders,
  deliveries,
  dipsticks,
  onRecordDipstick,
  onCreatePO,
  onReceiveDelivery,
  onCreateTank,
  onDeleteTank,
  onDeletePO,
  onDeleteDelivery,
  onDeleteDipstick,
}) => {
  const canDeliver = canPerformAction(role, 'RECORD_DELIVERY');
  const canDip = canPerformAction(role, 'RECORD_DIPSTICK');
  const effectiveStation = stationId === 'ALL' ? defaultStationId : stationId;

  const visibleTanks = tanks.filter((t) => stationId === 'ALL' || t.stationId === stationId);
  const visibleTankIds = new Set(visibleTanks.map((t) => t.id));
  const visiblePOs = purchaseOrders.filter((p) => stationId === 'ALL' || p.stationId === stationId);
  const visibleDeliveries = deliveries.filter((d) => stationId === 'ALL' || visibleTankIds.has(d.tankId));
  const visibleDipsticks = dipsticks.filter((d) => stationId === 'ALL' || visibleTankIds.has(d.tankId));

  // Tank Detail page state
  const [detailTankId, setDetailTankId] = useState<string | null>(null);

  // Create Tank form state
  const [showAddTank, setShowAddTank] = useState(false);
  const [tankName, setTankName] = useState('');
  const [tankGrade, setTankGrade] = useState<FuelGrade>('SUPER');
  const [tankCap, setTankCap] = useState('35000');
  const [tankVol, setTankVol] = useState('15000');
  const [tankCost, setTankCost] = useState('745');

  const [dipTankId, setDipTankId] = useState('');
  const [dipLitres, setDipLitres] = useState('24500');

  const [poSupplier, setPoSupplier] = useState('SCDP Depot Douala');
  const [poGrade, setPoGrade] = useState<FuelGrade>('KEROSENE');
  const [poLitres, setPoLitres] = useState('10000');
  const [poCost, setPoCost] = useState('470');

  const [delTankId, setDelTankId] = useState('');
  const [delSupplier, setDelSupplier] = useState('SCDP Depot Douala');
  const [delBol, setDelBol] = useState('10000');
  const [delActual, setDelActual] = useState('9965');
  const [delCost, setDelCost] = useState('745');

  const handleDipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = dipTankId || visibleTanks[0]?.id;
    if (!targetId) return;
    onRecordDipstick(targetId, Number(dipLitres) || 0);
  };

  const handlePoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplier.trim()) return;
    onCreatePO({
      stationId: effectiveStation,
      supplierName: poSupplier.trim(),
      grade: poGrade,
      orderedLitres: Number(poLitres) || 0,
      unitCostFcfa: Number(poCost) || 0,
    });
  };

  const handleDeliverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = delTankId || visibleTanks[0]?.id;
    if (!targetId) return;
    onReceiveDelivery({
      tankId: targetId,
      supplierName: delSupplier,
      bolLitres: Number(delBol) || 0,
      actualReceivedLitres: Number(delActual) || 0,
      unitCostFcfa: Number(delCost) || 0,
    });
  };

  const handleCreateTankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tankName.trim()) return;
    onCreateTank({
      stationId: effectiveStation,
      name: tankName.trim(),
      grade: tankGrade,
      capacityLitres: Number(tankCap) || 30000,
      bookVolumeLitres: Number(tankVol) || 0,
      unitCostFcfa: Number(tankCost) || 745,
    });
    setTankName('');
    setShowAddTank(false);
  };

  // Dedicated Underground Tank Detail View
  const activeDetailTank = detailTankId ? tanks.find((t) => t.id === detailTankId) : null;
  if (activeDetailTank) {
    const pct = Math.min(100, Math.round((activeDetailTank.bookVolumeLitres / activeDetailTank.capacityLitres) * 100));
    const stockValuationFcfa = Math.round(activeDetailTank.bookVolumeLitres * activeDetailTank.unitCostFcfa);
    const tankDeliveries = deliveries.filter((d) => d.tankId === activeDetailTank.id);
    const tankDipsticks = dipsticks.filter((d) => d.tankId === activeDetailTank.id);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDetailTankId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Underground Tanks
          </button>
          {canDeliver && (
            <button
              type="button"
              onClick={() => {
                onDeleteTank(activeDetailTank.id);
                setDetailTankId(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Underground Tank
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">{activeDetailTank.name}</h2>
                <p className="text-xs text-slate-500">
                  {gradeLabel(activeDetailTank.grade)} · ID <span className="font-mono">{activeDetailTank.id}</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">WAC Inventory Valuation</div>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                {formatFcfa(stockValuationFcfa)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700">Capacity Utilization ({pct}%)</span>
              <span className="font-mono tabular-nums text-slate-900">
                {formatLitres(activeDetailTank.bookVolumeLitres)} / {formatLitres(activeDetailTank.capacityLitres)}
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  activeDetailTank.status === 'VARIANCE_ALERT'
                    ? 'bg-red-600'
                    : activeDetailTank.status === 'LOW_STOCK'
                    ? 'bg-amber-600'
                    : 'bg-slate-900'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Book Volume</div>
              <div className="font-mono tabular-nums font-bold text-slate-900 mt-1">
                {formatLitres(activeDetailTank.bookVolumeLitres)}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Last Physical Dipstick</div>
              <div className="font-mono tabular-nums font-bold text-slate-900 mt-1">
                {formatLitres(activeDetailTank.lastDipLitres)}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Shrinkage Variance</div>
              <div
                className={`font-mono tabular-nums font-bold mt-1 ${
                  Math.abs(activeDetailTank.varianceLitres) > 100 ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {activeDetailTank.varianceLitres > 0 ? `+${activeDetailTank.varianceLitres}` : activeDetailTank.varianceLitres} L
              </div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Weighted Avg Cost</div>
              <div className="font-mono tabular-nums font-bold text-slate-900 mt-1">
                {formatFcfa(activeDetailTank.unitCostFcfa)} / L
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 mb-2">
                Tanker Deliveries ({tankDeliveries.length})
              </h3>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                {tankDeliveries.map((del) => (
                  <div key={del.id} className="p-3 flex justify-between items-center gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{del.supplierName}</div>
                      <div className="text-slate-500 font-mono">
                        BoL {formatLitres(del.bolLitres)} → Actual {formatLitres(del.actualReceivedLitres)}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-semibold text-slate-900">{formatFcfa(del.totalInvoiceFcfa)}</div>
                      <div className="text-slate-400">{formatShortDate(del.receivedAt)}</div>
                    </div>
                  </div>
                ))}
                {tankDeliveries.length === 0 && (
                  <div className="p-4 text-center text-slate-500">No deliveries logged for this tank.</div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 mb-2">
                Dipstick Calibration Log ({tankDipsticks.length})
              </h3>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                {tankDipsticks.map((dip) => (
                  <div key={dip.id} className="p-3 flex justify-between items-center gap-3">
                    <div>
                      <div className="font-mono font-semibold text-slate-900">
                        Measured: {formatLitres(dip.measuredLitres)}
                      </div>
                      <div className="text-slate-500 font-mono">Book: {formatLitres(dip.bookLitres)}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className={Math.abs(dip.varianceLitres) > 100 ? 'text-red-600 font-bold' : 'text-emerald-700 font-semibold'}>
                        {dip.varianceLitres > 0 ? `+${dip.varianceLitres}` : dip.varianceLitres} L
                      </div>
                      <div className="text-slate-400">{formatShortDate(dip.recordedAt)}</div>
                    </div>
                  </div>
                ))}
                {tankDipsticks.length === 0 && (
                  <div className="p-4 text-center text-slate-500">No dipstick readings logged for this tank.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tank Stock Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Underground Fuel Tanks</h2>
            <p className="text-xs text-slate-500">
              Click any tank row for WAC valuation &amp; calibration history, or add/remove underground tanks
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <button
              type="button"
              onClick={() =>
                exportInventoryPdf(
                  visibleTanks,
                  visibleDeliveries,
                  visibleDipsticks,
                  visiblePOs,
                  stationId === 'ALL' ? 'Network Consolidated' : stationId
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" /> Export PDF
            </button>
            <button
              type="button"
              onClick={() =>
                exportInventoryExcel(
                  visibleTanks,
                  visibleDeliveries,
                  visibleDipsticks,
                  visiblePOs,
                  stationId === 'ALL' ? 'Network Consolidated' : stationId
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Export Excel (.xlsx)
            </button>
            {canDeliver && (
              <button
                type="button"
                onClick={() => setShowAddTank((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> {showAddTank ? 'Cancel' : 'Add Underground Tank'}
              </button>
            )}
          </div>
        </div>

        {showAddTank && canDeliver && (
          <form
            onSubmit={handleCreateTankSubmit}
            className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end"
          >
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tank Name</label>
              <input
                type="text"
                placeholder="Underground Tank T-04 (Super)"
                value={tankName}
                onChange={(e) => setTankName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Grade</label>
              <select
                value={tankGrade}
                onChange={(e) => setTankGrade(e.target.value as FuelGrade)}
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
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Capacity (L)</label>
              <input
                type="number"
                min={1000}
                value={tankCap}
                onChange={(e) => setTankCap(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Initial Stock (L)</label>
              <input
                type="number"
                min={0}
                value={tankVol}
                onChange={(e) => setTankVol(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">WAC FCFA/L</label>
                <input
                  type="number"
                  min={100}
                  value={tankCost}
                  onChange={(e) => setTankCost(e.target.value)}
                  className="w-full px-2.5 py-2 rounded border border-slate-300 text-xs font-mono bg-white"
                />
              </div>
              <button
                type="submit"
                className="self-end py-2 px-3.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap"
              >
                Save Tank
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Tank</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3 text-right">Capacity</th>
                <th className="px-4 py-3 text-right">Book Stock</th>
                <th className="px-4 py-3 text-right">Last Dipstick</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3">Health</th>
                {canDeliver && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTanks.map((tk) => (
                <tr key={tk.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDetailTankId(tk.id)}
                      className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-amber-700"
                    >
                      <span>{tk.name}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{gradeLabel(tk.grade)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{formatLitres(tk.capacityLitres)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">{formatLitres(tk.bookVolumeLitres)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{formatLitres(tk.lastDipLitres)}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                      Math.abs(tk.varianceLitres) > 100 ? 'text-red-600' : 'text-slate-700'
                    }`}
                  >
                    {tk.varianceLitres > 0 ? `+${tk.varianceLitres}` : tk.varianceLitres} L
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{formatFcfa(tk.unitCostFcfa)}</td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {tk.status === 'VARIANCE_ALERT' ? (
                      <span className="text-red-600">Variance Alert</span>
                    ) : tk.status === 'LOW_STOCK' ? (
                      <span className="text-amber-700">Low Stock</span>
                    ) : (
                      <span className="text-emerald-700">Nominal</span>
                    )}
                  </td>
                  {canDeliver && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteTank(tk.id)}
                        aria-label={`Delete tank ${tk.name}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {visibleTanks.length === 0 && (
                <tr>
                  <td colSpan={canDeliver ? 9 : 8} className="px-4 py-8 text-center text-xs text-slate-500">
                    No underground tanks provisioned for this station scope. Click Add Underground Tank above to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Forms: Dipstick + Receive Delivery + Purchase Order */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canDip && (
          <form onSubmit={handleDipSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">Record Physical Dipstick</h3>
              <p className="text-xs text-slate-500">Flags variance alerts when delta exceeds 100 L</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Select Tank</label>
              <select
                value={dipTankId || visibleTanks[0]?.id || ''}
                onChange={(e) => setDipTankId(e.target.value)}
                disabled={visibleTanks.length === 0}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white disabled:opacity-50"
              >
                {visibleTanks.length === 0 && <option value="">No tanks available</option>}
                {visibleTanks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Measured Volume (Litres)</label>
              <input
                type="number"
                value={dipLitres}
                onChange={(e) => setDipLitres(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
              />
            </div>
            <button
              type="submit"
              disabled={visibleTanks.length === 0}
              className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold"
            >
              Submit Dipstick Calibration
            </button>
          </form>
        )}

        {canDeliver && (
          <form onSubmit={handleDeliverySubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">Receive Tanker Delivery</h3>
              <p className="text-xs text-slate-500">Increments tank stock &amp; posts Inventory / AP journal</p>
            </div>
            <select
              value={delTankId || visibleTanks[0]?.id || ''}
              onChange={(e) => setDelTankId(e.target.value)}
              disabled={visibleTanks.length === 0}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white disabled:opacity-50"
            >
              {visibleTanks.length === 0 && <option value="">No tanks available</option>}
              {visibleTanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Supplier Name"
              value={delSupplier}
              onChange={(e) => setDelSupplier(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">BoL (L)</label>
                <input
                  type="number"
                  value={delBol}
                  onChange={(e) => setDelBol(e.target.value)}
                  className="w-full px-2.5 py-2 rounded border border-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Actual (L)</label>
                <input
                  type="number"
                  value={delActual}
                  onChange={(e) => setDelActual(e.target.value)}
                  className="w-full px-2.5 py-2 rounded border border-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Cost/L</label>
                <input
                  type="number"
                  value={delCost}
                  onChange={(e) => setDelCost(e.target.value)}
                  className="w-full px-2.5 py-2 rounded border border-slate-300 text-xs font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={visibleTanks.length === 0}
              className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold"
            >
              Confirm Delivery Receipt
            </button>
          </form>
        )}

        {canDeliver && (
          <form onSubmit={handlePoSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">Raise Purchase Order</h3>
              <p className="text-xs text-slate-500">Schedule replenishment from fuel depot</p>
            </div>
            <input
              type="text"
              placeholder="Supplier Depot"
              value={poSupplier}
              onChange={(e) => setPoSupplier(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={poGrade}
                onChange={(e) => setPoGrade(e.target.value as FuelGrade)}
                className="px-2 py-2 rounded border border-slate-300 text-xs bg-white min-h-[40px]"
              >
                {ALL_FUEL_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={poLitres}
                onChange={(e) => setPoLitres(e.target.value)}
                placeholder="Litres"
                className="px-2.5 py-2 rounded border border-slate-300 text-xs font-mono"
              />
              <input
                type="number"
                value={poCost}
                onChange={(e) => setPoCost(e.target.value)}
                placeholder="FCFA/L"
                className="px-2.5 py-2 rounded border border-slate-300 text-xs font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Create Supplier PO
            </button>

            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="text-xs font-semibold text-slate-700">Active Purchase Orders</div>
              {visiblePOs.slice(0, 4).map((po) => (
                <div key={po.id} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    {po.id} · {po.grade} ({formatLitres(po.orderedLitres)})
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{po.status}</span>
                    <button
                      type="button"
                      onClick={() => onDeletePO(po.id)}
                      aria-label={`Delete PO ${po.id}`}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {visiblePOs.length === 0 && (
                <div className="text-xs text-slate-400">No active supplier purchase orders.</div>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Tanker Delivery History & Dipstick Calibration Audit Log */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-900">
              Tanker Delivery History (BoL vs. Actual &amp; WAC Invoice)
            </h3>
            <p className="text-xs text-slate-500">
              Auditable depot receipts with Accounts Payable totals in FCFA
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Tank / Supplier</th>
                  <th className="px-4 py-3 text-right">BoL (L)</th>
                  <th className="px-4 py-3 text-right">Actual (L)</th>
                  <th className="px-4 py-3 text-right">Invoice (FCFA)</th>
                  <th className="px-4 py-3 text-right">Received</th>
                  {canDeliver && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleDeliveries.map((del) => {
                  const transitDelta = del.actualReceivedLitres - del.bolLitres;
                  return (
                    <tr key={del.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{del.tankName}</div>
                        <div className="text-slate-500">{del.supplierName}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{formatLitres(del.bolLitres)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        <div className="font-semibold text-slate-900">{formatLitres(del.actualReceivedLitres)}</div>
                        <div className={transitDelta < -50 ? 'text-red-600' : 'text-slate-500'}>
                          {transitDelta > 0 ? `+${transitDelta}` : transitDelta} L delta
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatFcfa(del.totalInvoiceFcfa)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">
                        {formatShortDate(del.receivedAt)}
                      </td>
                      {canDeliver && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteDelivery(del.id)}
                            aria-label={`Delete delivery ${del.id}`}
                            className="p-1 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {visibleDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={canDeliver ? 6 : 5} className="px-4 py-6 text-center text-slate-500">
                      No tanker deliveries recorded for this station scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-900">
              Physical Dipstick Calibration Log
            </h3>
            <p className="text-xs text-slate-500">
              Book stock vs. physical dipstick comparisons and shrinkage alerts
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Tank</th>
                  <th className="px-4 py-3 text-right">Book (L)</th>
                  <th className="px-4 py-3 text-right">Measured (L)</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                  <th className="px-4 py-3 text-right">Recorded</th>
                  {canDeliver && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleDipsticks.map((dip) => (
                  <tr key={dip.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">{dip.tankName}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatLitres(dip.bookLitres)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                      {formatLitres(dip.measuredLitres)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                        Math.abs(dip.varianceLitres) > 100 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {dip.varianceLitres > 0 ? `+${dip.varianceLitres}` : dip.varianceLitres} L
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      {formatShortDate(dip.recordedAt)}
                    </td>
                    {canDeliver && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteDipstick(dip.id)}
                          aria-label={`Delete dipstick ${dip.id}`}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {visibleDipsticks.length === 0 && (
                  <tr>
                    <td colSpan={canDeliver ? 6 : 5} className="px-4 py-6 text-center text-slate-500">
                      No dipstick calibrations recorded for this station scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
