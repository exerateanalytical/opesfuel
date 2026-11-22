import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Building2, Gauge, Plus, Scale, Thermometer } from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { formatLitres } from '../../domain/formatters';
import { FuelTank, PurchaseOrder, UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

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
  const canManage = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN';
  const [modal, setModal] = useState<'shrink' | 'atg' | 'supplier' | null>(null);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [supName, setSupName] = useState('');
  const [supTaxId, setSupTaxId] = useState('');
  const [supPhone, setSupPhone] = useState('+237 233 ');
  const [supTerms, setSupTerms] = useState('14');

  const [shrinkTankId, setShrinkTankId] = useState(tanks[0]?.id ?? '');
  const [shrinkReason, setShrinkReason] = useState('Monthly physical dipstick calibration');

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

  useEffect(() => {
    if (tanks.length === 0) return;
    if (!tanks.some((t) => t.id === shrinkTankId)) setShrinkTankId(tanks[0].id);
    if (!tanks.some((t) => t.id === atgTankId)) setAtgTankId(tanks[0].id);
  }, [tanks, shrinkTankId, atgTankId]);

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
      setModal(null);
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
      setModal(null);
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
      setModal(null);
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
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-slate-900" />
                Dipstick Shrinkage Reconciliation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Align underground tank book stock with verified physical dipstick readings and post shrinkage/gain journals.
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                disabled={tanks.length === 0}
                onClick={() => setModal('shrink')}
                className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold shrink-0"
              >
                Reconcile Variance
              </button>
            )}
          </div>

          {openPos.length > 0 && canManage && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-xs font-semibold text-slate-700">Open Purchase Orders</div>
              {openPos.map((po) => (
                <div key={po.id} className="flex items-center justify-between gap-2 text-xs py-1">
                  <span className="truncate text-slate-700">
                    {po.supplierName} · {formatLitres(po.orderedLitres)} ({po.grade})
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCancelPo(po.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 bg-white text-red-700 hover:bg-red-50 text-[11px] font-semibold shrink-0"
                  >
                    <Ban className="w-3 h-3" /> Cancel PO
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-slate-900" />
                ATG IoT Probe Telemetry (15°C Volume)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ingest Automatic Tank Gauge readings with ASTM 15°C thermal expansion compensation.
              </p>
            </div>
            <button
              type="button"
              disabled={tanks.length === 0}
              onClick={() => setModal('atg')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold shrink-0"
            >
              <Gauge className="w-3.5 h-3.5" /> Ingest Probe Reading
            </button>
          </div>

          {atgResult && (
            <div className="p-3 rounded-lg bg-white border border-slate-200 border-l-4 border-l-emerald-600 text-xs font-mono text-slate-900">
              15°C Net Standard Volume:{' '}
              <strong>{formatLitres(Number(atgResult.netStandardVolume15CLitres ?? atgResult.compensatedLitres ?? 0))}</strong>{' '}
              · Variance: <strong>{formatLitres(Number(atgResult.varianceLitres ?? 0))}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Fuel Supplier Registry */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-900" />
              Fuel Depot &amp; Supplier Registry
            </h3>
            <p className="text-xs text-slate-500">Approved fuel marketers, depot terminals, and payment terms.</p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setModal('supplier')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Register Fuel Supplier
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="px-4 py-2.5">Supplier</th>
                <th className="px-4 py-2.5">Tax ID</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5 text-right">Terms</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {suppliers.map((sup) => (
                <tr key={String(sup.id)} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{String(sup.name)}</td>
                  <td className="px-4 py-2.5 font-mono">{String(sup.taxId ?? '-')}</td>
                  <td className="px-4 py-2.5 font-mono">{String(sup.contactPhone ?? '-')}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{String(sup.paymentTermsDays ?? 14)} d</td>
                  <td className="px-4 py-2.5">
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

      {/* Popup FormModal: Reconcile Shrinkage */}
      <FormModal
        open={modal === 'shrink'}
        onClose={() => setModal(null)}
        title="Reconcile Tank Shrinkage / Gain"
        subtitle="Posts an inventory adjustment journal and resets tank book volume to the physical dipstick reading."
      >
        <form onSubmit={(e) => void handleReconcileShrinkage(e)} className="space-y-4">
          <div>
            <label className="opes-label">Select Underground Tank</label>
            <select
              value={shrinkTankId || tanks[0]?.id || ''}
              onChange={(e) => setShrinkTankId(e.target.value)}
              className="opes-input"
            >
              {tanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.grade}) — Variance: {formatLitres(t.varianceLitres)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="opes-label">Audit Justification</label>
            <input
              type="text"
              required
              value={shrinkReason}
              onChange={(e) => setShrinkReason(e.target.value)}
              className="opes-input"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              Post Shrinkage Reconciliation
            </button>
          </div>
        </form>
      </FormModal>

      {/* Popup FormModal: ATG Telemetry */}
      <FormModal
        open={modal === 'atg'}
        onClose={() => setModal(null)}
        title="Ingest ATG IoT Probe Reading"
        subtitle="Applies ASTM 15°C thermal expansion compensation to observed probe volume."
      >
        <form onSubmit={(e) => void handleAtgTelemetry(e)} className="space-y-4">
          <div>
            <label className="opes-label">Underground Tank</label>
            <select
              value={atgTankId || tanks[0]?.id || ''}
              onChange={(e) => setAtgTankId(e.target.value)}
              className="opes-input"
            >
              {tanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.grade})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="opes-label">Gross Observed (L)</label>
              <input type="number" step="0.1" value={atgGrossLitres} onChange={(e) => setAtgGrossLitres(e.target.value)} className="opes-input font-mono" />
            </div>
            <div>
              <label className="opes-label">Probe Temp (°C)</label>
              <input type="number" step="0.1" value={atgTempC} onChange={(e) => setAtgTempC(e.target.value)} className="opes-input font-mono" />
            </div>
            <div>
              <label className="opes-label">Water Level (mm)</label>
              <input type="number" step="0.1" value={atgWaterMm} onChange={(e) => setAtgWaterMm(e.target.value)} className="opes-input font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              Ingest Probe Reading
            </button>
          </div>
        </form>
      </FormModal>

      {/* Popup FormModal: Add Supplier */}
      <FormModal
        open={modal === 'supplier'}
        onClose={() => setModal(null)}
        title="Register Fuel Depot / Supplier"
        subtitle="Adds an approved fuel supplier to your station purchase order directory."
      >
        <form onSubmit={(e) => void handleCreateSupplier(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Supplier / Depot Name</label>
              <input type="text" required placeholder="e.g. SCDP Depot Douala" value={supName} onChange={(e) => setSupName(e.target.value)} className="opes-input" />
            </div>
            <div>
              <label className="opes-label">Tax ID (NIU)</label>
              <input type="text" placeholder="e.g. M01234567890" value={supTaxId} onChange={(e) => setSupTaxId(e.target.value)} className="opes-input font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Contact Phone</label>
              <input type="text" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} className="opes-input font-mono" />
            </div>
            <div>
              <label className="opes-label">Payment Terms (Days)</label>
              <input type="number" min={0} value={supTerms} onChange={(e) => setSupTerms(e.target.value)} className="opes-input font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              Save Fuel Supplier
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
