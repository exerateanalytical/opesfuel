import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Building2, Gauge, Scale, Thermometer } from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { formatLitres } from '../../domain/formatters';
import { FuelTank, PurchaseOrder, UserRole } from '../../domain/types';

interface InventoryAdvancedPanelProps {
  engine: OpesFuelApiEngine;
  role: UserRole;
  tanks: FuelTank[];
  purchaseOrders: PurchaseOrder[];
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const InventoryAdvancedPanel: React.FC<InventoryAdvancedPanelProps> = ({
  engine,
  role,
  tanks,
  purchaseOrders,
  onNotify,
}) => {
  const canManage = role === 'OWNER' || role === 'MANAGER';
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [supName, setSupName] = useState('');
  const [supTaxId, setSupTaxId] = useState('');
  const [supPhone, setSupPhone] = useState('+237 233 ');
  const [supTerms, setSupTerms] = useState('14');

  // Shrinkage reconciliation
  const [shrinkTankId, setShrinkTankId] = useState(tanks[0]?.id ?? '');
  const [shrinkReason, setShrinkReason] = useState('Monthly physical dipstick calibration');

  // ATG 15°C Telemetry
  const [atgTankId, setAtgTankId] = useState(tanks[0]?.id ?? '');
  const [atgGrossLitres, setAtgGrossLitres] = useState('18450');
  const [atgTempC, setAtgTempC] = useState('29.5');
  const [atgWaterMm, setAtgWaterMm] = useState('2');
  const [atgResult, setAtgResult] = useState<Record<string, unknown> | null>(null);

  const loadSuppliers = useCallback(async () => {
    const list = await engine.listSuppliers().catch(() => []);
    setSuppliers(Array.isArray(list) ? list : []);
  }, [engine]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    try {
      await engine.createSupplier({
        name: supName.trim(),
        taxId: supTaxId.trim() || undefined,
        contactPhone: supPhone.trim() || undefined,
        paymentTermsDays: Number(supTerms) || 14,
      });
      onNotify('success', `Registered fuel supplier ${supName.trim()}.`);
      setSupName('');
      setSupTaxId('');
      await loadSuppliers();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to create supplier.');
    }
  };

  const handleReconcileShrinkage = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTank = shrinkTankId || tanks[0]?.id;
    if (!targetTank) return;
    try {
      const res = (await engine.reconcileTankShrinkage(targetTank, shrinkReason.trim())) as Record<string, unknown>;
      onNotify(
        'success',
        `Reconciled tank shrinkage (${String(res.reconciledLitres ?? res.varianceLitres ?? 0)} L) and aligned book stock with physical dipstick.`
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Shrinkage reconciliation failed.');
    }
  };

  const handleAtgTelemetry = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTank = atgTankId || tanks[0]?.id;
    if (!targetTank) return;
    try {
      const res = await engine.ingestAtgTelemetry(targetTank, {
        grossObservedLitres: Number(atgGrossLitres) || 0,
        temperatureCelsius: Number(atgTempC) || 15,
        waterLevelMm: Number(atgWaterMm) || 0,
      });
      setAtgResult(res);
      onNotify('success', 'Ingested ATG probe reading with 15°C thermal expansion compensation.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ATG telemetry ingestion failed.');
    }
  };

  const handleCancelPo = async (poId: string) => {
    try {
      await engine.cancelPurchaseOrder(poId);
      onNotify('success', `Cancelled purchase order ${poId}.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to cancel purchase order.');
    }
  };

  const openPos = purchaseOrders.filter((p) => p.status === 'PENDING');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shrinkage Reconciliation & Open PO Cancel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-600" />
              Dipstick Shrinkage Reconciliation
            </h3>
            <p className="text-xs text-slate-500">
              Post inventory shrinkage/gain journal (<span className="font-mono">POST /inventory/tanks/&#123;id&#125;/reconcile-shrinkage</span>) and reset book volume to physical dip.
            </p>
          </div>

          <form onSubmit={(e) => void handleReconcileShrinkage(e)} className="space-y-3">
            <select
              value={shrinkTankId || tanks[0]?.id || ''}
              onChange={(e) => setShrinkTankId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
            >
              {tanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.grade}) — Variance: {formatLitres(t.varianceLitres)}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={shrinkReason}
              onChange={(e) => setShrinkReason(e.target.value)}
              placeholder="Audit justification"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <button
              type="submit"
              disabled={!canManage || tanks.length === 0}
              className="w-full py-2 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold"
            >
              Reconcile Tank Variance to Ledger
            </button>
          </form>

          {openPos.length > 0 && canManage && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-xs font-semibold text-slate-700">Open Purchase Orders (Cancelable)</div>
              {openPos.map((po) => (
                <div key={po.id} className="flex items-center justify-between gap-2 text-xs py-1">
                  <span className="truncate text-slate-700">
                    {po.supplierName} · {formatLitres(po.orderedLitres)} ({po.grade})
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCancelPo(po.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 text-[11px] font-semibold shrink-0"
                  >
                    <Ban className="w-3 h-3" /> Cancel PO
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ATG IoT 15°C Thermal Telemetry */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-emerald-700" />
              ATG IoT Probe Telemetry (15°C Standard Volume)
            </h3>
            <p className="text-xs text-slate-500">
              Automatic Tank Gauge API (<span className="font-mono">POST /inventory/tanks/&#123;id&#125;/atg-telemetry</span>) with ASTM thermal expansion compensation.
            </p>
          </div>

          <form onSubmit={(e) => void handleAtgTelemetry(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={atgTankId || tanks[0]?.id || ''}
              onChange={(e) => setAtgTankId(e.target.value)}
              className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
            >
              {tanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.grade})
                </option>
              ))}
            </select>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gross Observed (L)</label>
              <input
                type="number"
                step="0.1"
                value={atgGrossLitres}
                onChange={(e) => setAtgGrossLitres(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Probe Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={atgTempC}
                onChange={(e) => setAtgTempC(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Water Level (mm)</label>
              <input
                type="number"
                step="0.1"
                value={atgWaterMm}
                onChange={(e) => setAtgWaterMm(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={tanks.length === 0}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold"
              >
                <Gauge className="w-3.5 h-3.5" /> Ingest Probe Reading
              </button>
            </div>
          </form>

          {atgResult && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-900">
              15°C Net Standard Volume:{' '}
              <strong>{formatLitres(Number(atgResult.netStandardVolume15CLitres ?? atgResult.compensatedLitres ?? 0))}</strong>{' '}
              · Variance: <strong>{formatLitres(Number(atgResult.varianceLitres ?? 0))}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Fuel Supplier Registry */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-600" />
            Fuel Depot &amp; Supplier Registry
          </h3>
          <p className="text-xs text-slate-500">
            Managed via <span className="font-mono">GET/POST /api/v1/inventory/suppliers</span>
          </p>
        </div>

        {canManage && (
          <form onSubmit={(e) => void handleCreateSupplier(e)} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            <input
              type="text"
              required
              placeholder="Supplier / Depot Name"
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <input
              type="text"
              placeholder="Tax ID (NIU)"
              value={supTaxId}
              onChange={(e) => setSupTaxId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
            />
            <input
              type="text"
              placeholder="Contact Phone"
              value={supPhone}
              onChange={(e) => setSupPhone(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
            />
            <input
              type="number"
              min={0}
              placeholder="Terms (days)"
              value={supTerms}
              onChange={(e) => setSupTerms(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Add Supplier
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-semibold">Supplier</th>
                <th className="py-2 pr-3 font-semibold">Tax ID</th>
                <th className="py-2 pr-3 font-semibold">Phone</th>
                <th className="py-2 pr-3 font-semibold text-right">Terms</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((sup) => (
                <tr key={String(sup.id)}>
                  <td className="py-2 pr-3 font-semibold text-slate-900">{String(sup.name)}</td>
                  <td className="py-2 pr-3 font-mono">{String(sup.taxId ?? '-')}</td>
                  <td className="py-2 pr-3 font-mono">{String(sup.contactPhone ?? '-')}</td>
                  <td className="py-2 pr-3 text-right font-mono">{String(sup.paymentTermsDays ?? 14)} d</td>
                  <td className="py-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                      {String(sup.status ?? 'ACTIVE')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
