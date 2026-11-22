import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Fuel,
  Gauge,
  Plus,
  RotateCcw,
  Ruler,
  ShieldAlert,
} from 'lucide-react';
import { formatFcfa } from '../../domain/formatters';
import { FuelTank, UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

interface GlobalCatalogItem {
  gradeCode: string;
  label: string;
  category: string;
  unit: string;
  sellingPrice: number | null;
  proposedSellingPrice: number | null;
  pricingStatus: 'UNSET_PENDING_TENANT_APPROVAL' | 'PENDING_APPROVAL' | 'ACTIVE';
  proposedBy: string | null;
  approvedBy: string | null;
}

interface TankCalibrationVersion {
  id: string;
  tankId: string;
  versionNo: number;
  slopeLitresPerMm: number;
  offsetLitres: number;
  status: 'ACTIVE' | 'SUPERSEDED';
  approvedBy: string;
  effectiveFrom: string;
}

interface VersionedDipReading {
  id: string;
  tankId: string;
  calibrationVersionNo: number;
  dipMm: number;
  calibratedLitres: number;
  recordedBy: string;
  recordedAt: string;
}

interface ShopReturnItem {
  id: string;
  originalSaleId: string;
  sku: string;
  originalQty: number;
  returnedQty: number;
  refundAmountFcfa: number;
  reason: string;
  processedBy: string;
  createdAt: string;
}

interface WetStockCalibrationAndCatalogPanelProps {
  role: UserRole;
  stationId: string;
  stationName: string;
  currentActorEmail: string;
  tanks: FuelTank[];
  onPostBackend: (path: string, method: 'POST' | 'PATCH', body?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const INITIAL_GLOBAL_CATALOG: GlobalCatalogItem[] = [
  { gradeCode: 'SUPER', label: 'Super Unleaded (RON 95)', category: 'LIQUID_FUEL', unit: 'LITRE', sellingPrice: null, proposedSellingPrice: null, pricingStatus: 'UNSET_PENDING_TENANT_APPROVAL', proposedBy: null, approvedBy: null },
  { gradeCode: 'GASOIL', label: 'Gasoil / Automotive Diesel', category: 'LIQUID_FUEL', unit: 'LITRE', sellingPrice: null, proposedSellingPrice: null, pricingStatus: 'UNSET_PENDING_TENANT_APPROVAL', proposedBy: null, approvedBy: null },
  { gradeCode: 'KEROSENE', label: 'Domestic Kerosene (DPK)', category: 'LIQUID_FUEL', unit: 'LITRE', sellingPrice: null, proposedSellingPrice: null, pricingStatus: 'UNSET_PENDING_TENANT_APPROVAL', proposedBy: null, approvedBy: null },
  { gradeCode: 'JET_A1', label: 'Aviation Jet A-1', category: 'AVIATION', unit: 'LITRE', sellingPrice: null, proposedSellingPrice: null, pricingStatus: 'UNSET_PENDING_TENANT_APPROVAL', proposedBy: null, approvedBy: null },
  { gradeCode: 'LPG', label: 'Liquefied Petroleum Gas (LPG)', category: 'GAS', unit: 'KG', sellingPrice: null, proposedSellingPrice: null, pricingStatus: 'UNSET_PENDING_TENANT_APPROVAL', proposedBy: null, approvedBy: null },
  { gradeCode: 'EV_KWH', label: 'EV Fast Charging Energy', category: 'ELECTRIC', unit: 'KWH', sellingPrice: null, proposedSellingPrice: null, pricingStatus: 'UNSET_PENDING_TENANT_APPROVAL', proposedBy: null, approvedBy: null },
  { gradeCode: 'ADBLUE', label: 'AdBlue / DEF Exhaust Fluid', category: 'ADDITIVE', unit: 'LITRE', sellingPrice: null, proposedSellingPrice: null, pricingStatus: 'UNSET_PENDING_TENANT_APPROVAL', proposedBy: null, approvedBy: null },
];

export const WetStockCalibrationAndCatalogPanel: React.FC<WetStockCalibrationAndCatalogPanelProps> = ({
  role,
  stationId,
  stationName,
  currentActorEmail,
  tanks,
  onPostBackend,
  onNotify,
}) => {
  const [tab, setTab] = useState<'catalog' | 'calibration' | 'returns'>('catalog');
  const [modal, setModal] = useState<'proposePrice' | 'newChart' | 'logDip' | 'shopReturn' | null>(null);

  const canManage = role === 'PLATFORM_ADMIN' || role === 'OWNER' || role === 'MANAGER';
  const canApprove = role === 'PLATFORM_ADMIN' || role === 'OWNER' || role === 'ACCOUNTANT';
  const defaultTankId = tanks[0]?.id ?? 'tk_super_01';

  // T007: Global Catalog with empty selling prices
  const [catalog, setCatalog] = useState<GlobalCatalogItem[]>(INITIAL_GLOBAL_CATALOG);
  const [selectedGrade, setSelectedGrade] = useState<string>('SUPER');
  const [proposedPriceInput, setProposedPriceInput] = useState<string>('840');

  // T010: Versioned Tank Calibration Charts
  const [activeTankId, setActiveTankId] = useState<string>(defaultTankId);
  const [charts, setCharts] = useState<TankCalibrationVersion[]>([
    {
      id: 'tcv_01',
      tankId: defaultTankId,
      versionNo: 1,
      slopeLitresPerMm: 12.0,
      offsetLitres: 0,
      status: 'ACTIVE',
      approvedBy: 'owner@opesfuel.cm',
      effectiveFrom: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    },
  ]);
  const [readings, setReadings] = useState<VersionedDipReading[]>([
    {
      id: 'dipv_01',
      tankId: defaultTankId,
      calibrationVersionNo: 1,
      dipMm: 1500,
      calibratedLitres: 18000,
      recordedBy: 'attendant@opesfuel.cm',
      recordedAt: new Date(Date.now() - 86_400_000 * 2).toISOString(),
    },
  ]);
  const [slopeInput, setSlopeInput] = useState('12.5');
  const [offsetInput, setOffsetInput] = useState('45');
  const [dipMmInput, setDipMmInput] = useState('1500');

  // T019: Shop Returns
  const [returns, setReturns] = useState<ShopReturnItem[]>([
    {
      id: 'ret_init01',
      originalSaleId: 'RCP-2026-4401',
      sku: 'LUB-5W30-4L',
      originalQty: 2,
      returnedQty: 1,
      refundAmountFcfa: 18500,
      reason: 'Customer requested 10W40 viscosity exchange',
      processedBy: 'manager@opesfuel.cm',
      createdAt: new Date(Date.now() - 7_200_000).toISOString(),
    },
  ]);
  const [retSaleId, setRetSaleId] = useState('RCP-2026-4401');
  const [retSku, setRetSku] = useState('LUB-5W30-4L');
  const [retOrigQty, setRetOrigQty] = useState('2');
  const [retQty, setRetQty] = useState('1');
  const [retUnitPrice, setRetUnitPrice] = useState('18500');
  const [retReason, setRetReason] = useState('Sealed bottle returned within 7 days');

  const tankCharts = charts.filter((c) => c.tankId === activeTankId);
  const currentActiveChart = tankCharts.find((c) => c.status === 'ACTIVE') ?? tankCharts[0];
  const tankReadings = readings.filter((r) => r.tankId === activeTankId);

  const handleProposePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(proposedPriceInput);
    if (!price || price <= 0) {
      onNotify('error', 'Selling price must be greater than zero.');
      return;
    }
    await onPostBackend('/api/v1/enterprise/global-fuel-catalog/propose-price', 'POST', {
      gradeCode: selectedGrade,
      sellingPrice: price,
      currencyCode: 'FCFA',
    });
    setCatalog((prev) =>
      prev.map((item) =>
        item.gradeCode === selectedGrade
          ? {
              ...item,
              proposedSellingPrice: price,
              pricingStatus: 'PENDING_APPROVAL',
              proposedBy: currentActorEmail,
            }
          : item
      )
    );
    setModal(null);
    onNotify('success', `Proposed ${formatFcfa(price)} for ${selectedGrade} (selling price stays locked until independent approval).`);
  };

  const handleApprovePrice = async (item: GlobalCatalogItem) => {
    if (!item.proposedSellingPrice) return;
    if (item.proposedBy && item.proposedBy.toLowerCase() === currentActorEmail.toLowerCase()) {
      onNotify('error', 'Maker-Checker Guard (T005/T007): proposer cannot self-approve fuel catalog selling price.');
      return;
    }
    await onPostBackend(`/api/v1/enterprise/global-fuel-catalog/${encodeURIComponent(item.gradeCode)}/approve`, 'PATCH');
    setCatalog((prev) =>
      prev.map((row) =>
        row.gradeCode === item.gradeCode
          ? {
              ...row,
              sellingPrice: item.proposedSellingPrice,
              pricingStatus: 'ACTIVE',
              approvedBy: currentActorEmail,
            }
          : row
      )
    );
    onNotify('success', `Approved and activated ${item.gradeCode} selling price at ${formatFcfa(item.proposedSellingPrice)}.`);
  };

  const handlePublishChart = async (e: React.FormEvent) => {
    e.preventDefault();
    const slope = Number(slopeInput);
    const offset = Number(offsetInput) || 0;
    if (!slope || slope <= 0) {
      onNotify('error', 'Calibration slope (L/mm) must be positive.');
      return;
    }
    await onPostBackend(`/api/v1/enterprise/tanks/${encodeURIComponent(activeTankId)}/calibrations`, 'POST', {
      slopeLitresPerMm: slope,
      offsetLitres: offset,
    });
    const nextVer = tankCharts.reduce((max, c) => Math.max(max, c.versionNo), 0) + 1;
    const newChart: TankCalibrationVersion = {
      id: `tcv_${Date.now().toString(36)}`,
      tankId: activeTankId,
      versionNo: nextVer,
      slopeLitresPerMm: slope,
      offsetLitres: offset,
      status: 'ACTIVE',
      approvedBy: currentActorEmail,
      effectiveFrom: new Date().toISOString(),
    };
    setCharts((prev) => [
      newChart,
      ...prev.map((c) => (c.tankId === activeTankId ? { ...c, status: 'SUPERSEDED' as const } : c)),
    ]);
    setModal(null);
    onNotify('success', `Activated strapping chart v${nextVer} (${slope} L/mm). All historical v${nextVer - 1} dips remain immutable.`);
  };

  const handleLogVersionedDip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentActiveChart) {
      onNotify('error', 'Publish a calibration chart version for this tank first.');
      return;
    }
    const mm = Number(dipMmInput);
    if (!mm || mm <= 0) return;
    await onPostBackend(`/api/v1/enterprise/tanks/${encodeURIComponent(activeTankId)}/versioned-dip`, 'POST', {
      dipMm: mm,
    });
    const litres = Math.round((mm * currentActiveChart.slopeLitresPerMm + currentActiveChart.offsetLitres) * 100) / 100;
    setReadings((prev) => [
      ...prev,
      {
        id: `dipv_${Date.now().toString(36)}`,
        tankId: activeTankId,
        calibrationVersionNo: currentActiveChart.versionNo,
        dipMm: mm,
        calibratedLitres: litres,
        recordedBy: currentActorEmail,
        recordedAt: new Date().toISOString(),
      },
    ]);
    setModal(null);
    onNotify('success', `Recorded ${mm} mm dip using chart v${currentActiveChart.versionNo} → ${litres.toLocaleString()} L.`);
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const origQty = Math.max(1, Number(retOrigQty) || 1);
    const qty = Math.max(1, Number(retQty) || 1);
    const unitPrice = Math.max(1, Number(retUnitPrice) || 1);
    const skuNorm = retSku.trim().toUpperCase();
    const alreadyReturned = returns
      .filter((r) => r.originalSaleId === retSaleId.trim() && r.sku === skuNorm)
      .reduce((sum, r) => sum + r.returnedQty, 0);

    if (alreadyReturned + qty > origQty) {
      onNotify(
        'error',
        `Over-return blocked (T019): cumulative returned qty (${alreadyReturned + qty}) exceeds original receipt qty (${origQty}).`
      );
      return;
    }

    await onPostBackend('/api/v1/enterprise/shop-returns', 'POST', {
      stationId,
      originalSaleId: retSaleId.trim(),
      sku: skuNorm,
      originalQty: origQty,
      returnQty: qty,
      unitPriceFcfa: unitPrice,
      reason: retReason.trim(),
    });
    const refund = qty * unitPrice;
    setReturns((prev) => [
      {
        id: `ret_${Date.now().toString(36)}`,
        originalSaleId: retSaleId.trim(),
        sku: skuNorm,
        originalQty: origQty,
        returnedQty: qty,
        refundAmountFcfa: refund,
        reason: retReason.trim(),
        processedBy: currentActorEmail,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setModal(null);
    onNotify('success', `Processed shop return for ${qty}x ${skuNorm} (${formatFcfa(refund)} refunded & stock restored).`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950">
            Global Unpriced Fuel Catalog (T007) · Versioned Tank Calibration (T010) · Shop Returns (T019)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Zero-default-price international fuel onboarding, immutable historical strapping chart calculations, and receipt-bounded POS return reversals for {stationName}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('catalog')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
              tab === 'catalog' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Fuel className="w-3.5 h-3.5" /> Unpriced Catalog (T007)
          </button>
          <button
            type="button"
            onClick={() => setTab('calibration')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
              tab === 'calibration' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" /> Tank Calibration (T010)
          </button>
          <button
            type="button"
            onClick={() => setTab('returns')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
              tab === 'returns' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Shop Returns (T019)
          </button>
        </div>
      </div>

      {tab === 'catalog' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>All global catalog grades initialize with <strong className="text-slate-950">empty (UNSET) selling prices</strong> until tenant proposal &amp; second-actor approval.</span>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0F172A] text-white font-mono text-[11px] uppercase">
                  <th className="py-2.5 px-3">Grade</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3 text-right">Proposed</th>
                  <th className="py-2.5 px-3 text-right">Active Selling Price</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {catalog.map((item) => {
                  const selfBlocked =
                    item.pricingStatus === 'PENDING_APPROVAL' &&
                    item.proposedBy?.toLowerCase() === currentActorEmail.toLowerCase();
                  return (
                    <tr key={item.gradeCode} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-950">{item.gradeCode}</td>
                      <td className="py-2.5 px-3 text-slate-800">{item.label}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{item.unit}</td>
                      <td className="py-2.5 px-3 font-mono text-right text-slate-600">
                        {item.proposedSellingPrice != null ? formatFcfa(item.proposedSellingPrice) : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right font-bold text-slate-950">
                        {item.sellingPrice != null ? formatFcfa(item.sellingPrice) : <span className="text-amber-700">UNSET (null)</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-[11px] font-semibold ${
                            item.pricingStatus === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : item.pricingStatus === 'PENDING_APPROVAL'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {item.pricingStatus === 'ACTIVE' && <CheckCircle2 className="w-3 h-3" />}
                          {item.pricingStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGrade(item.gradeCode);
                              setProposedPriceInput(String(item.proposedSellingPrice ?? 840));
                              setModal('proposePrice');
                            }}
                            className="px-2.5 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            Propose Price
                          </button>
                        )}
                        {canApprove && item.pricingStatus === 'PENDING_APPROVAL' && (
                          <button
                            type="button"
                            onClick={() => void handleApprovePrice(item)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border ${
                              selfBlocked
                                ? 'bg-white text-red-700 border-red-200'
                                : 'bg-[#D97706] text-white border-[#D97706] hover:bg-amber-700'
                            }`}
                          >
                            {selfBlocked && <ShieldAlert className="w-3 h-3" />}
                            Approve
                          </button>
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

      {tab === 'calibration' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">Tank:</label>
              <select
                value={activeTankId}
                onChange={(e) => setActiveTankId(e.target.value)}
                className="opes-input text-xs py-1.5"
              >
                {tanks.length > 0 ? (
                  tanks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.grade})
                    </option>
                  ))
                ) : (
                  <option value={defaultTankId}>Underground Tank 01</option>
                )}
              </select>
              {currentActiveChart && (
                <span className="px-2.5 py-1 rounded border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-800">
                  Active Chart: <strong>v{currentActiveChart.versionNo}</strong> ({currentActiveChart.slopeLitresPerMm} L/mm + {currentActiveChart.offsetLitres} L)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModal('logDip')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:bg-slate-50"
              >
                <Gauge className="w-3.5 h-3.5" /> Log Dip (mm)
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setModal('newChart')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> New Calibration Version
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0F172A] text-white font-mono text-[11px] uppercase">
                  <th className="py-2.5 px-3">Reading ID</th>
                  <th className="py-2.5 px-3">Chart Version</th>
                  <th className="py-2.5 px-3 text-right">Dip Height (mm)</th>
                  <th className="py-2.5 px-3 text-right">Immutable Calibrated Litres</th>
                  <th className="py-2.5 px-3">Recorded By</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {tankReadings.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{r.id}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-950">v{r.calibrationVersionNo}</td>
                    <td className="py-2.5 px-3 font-mono text-right text-slate-700">{r.dipMm.toLocaleString()} mm</td>
                    <td className="py-2.5 px-3 font-mono text-right font-bold text-slate-950">
                      {r.calibratedLitres.toLocaleString()} L
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{r.recordedBy}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{new Date(r.recordedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'returns' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Cumulative returns per receipt cannot exceed original sold quantity (`409 Conflict` enforced).
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setModal('shopReturn')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Process Shop Return
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0F172A] text-white font-mono text-[11px] uppercase">
                  <th className="py-2.5 px-3">Receipt Ref</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-right">Returned / Orig</th>
                  <th className="py-2.5 px-3 text-right">Refunded</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Processed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-950">{r.originalSaleId}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{r.sku}</td>
                    <td className="py-2.5 px-3 font-mono text-right text-slate-900">
                      {r.returnedQty} / {r.originalQty}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right font-bold text-slate-950">
                      {formatFcfa(r.refundAmountFcfa)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{r.reason}</td>
                    <td className="py-2.5 px-3 text-slate-600">{r.processedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormModal
        open={modal === 'proposePrice'}
        title={`Propose Selling Price — ${selectedGrade}`}
        subtitle="Submits price into PENDING_APPROVAL. An independent Owner or Accountant must approve before pump activation."
        onClose={() => setModal(null)}
      >
        <form onSubmit={(e) => void handleProposePrice(e)} className="space-y-4">
          <div>
            <label className="opes-label">Proposed Selling Price (FCFA)</label>
            <input
              type="number"
              min={1}
              required
              value={proposedPriceInput}
              onChange={(e) => setProposedPriceInput(e.target.value)}
              className="opes-input font-mono text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] text-white text-xs font-semibold">
              Submit Proposal
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={modal === 'newChart'}
        title="Publish New Tank Calibration Chart"
        subtitle="Supersedes the previous chart for future dips while preserving all past historical calibrated volumes."
        onClose={() => setModal(null)}
      >
        <form onSubmit={(e) => void handlePublishChart(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Slope (Litres / mm)</label>
              <input
                type="number"
                step="0.01"
                required
                value={slopeInput}
                onChange={(e) => setSlopeInput(e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Zero-Offset (Litres)</label>
              <input
                type="number"
                step="0.1"
                value={offsetInput}
                onChange={(e) => setOffsetInput(e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] text-white text-xs font-semibold">
              Activate Chart
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={modal === 'logDip'}
        title="Log Versioned Wet-Stock Dipstick Reading"
        subtitle="Calculates calibrated litres using the active strapping chart and locks the historical snapshot."
        onClose={() => setModal(null)}
      >
        <form onSubmit={(e) => void handleLogVersionedDip(e)} className="space-y-4">
          <div>
            <label className="opes-label">Dipstick Height (mm)</label>
            <input
              type="number"
              step="1"
              min={1}
              required
              value={dipMmInput}
              onChange={(e) => setDipMmInput(e.target.value)}
              className="opes-input font-mono text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] text-white text-xs font-semibold">
              Save Reading
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={modal === 'shopReturn'}
        title="Process Shop POS Return / Refund (T019)"
        subtitle="Enforces cumulative receipt quantity bounds and posts inventory & ledger reversal."
        onClose={() => setModal(null)}
      >
        <form onSubmit={(e) => void handleProcessReturn(e)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Original Receipt ID</label>
              <input required value={retSaleId} onChange={(e) => setRetSaleId(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">SKU Code</label>
              <input required value={retSku} onChange={(e) => setRetSku(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="opes-label">Orig Sold Qty</label>
              <input type="number" min={1} required value={retOrigQty} onChange={(e) => setRetOrigQty(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Return Qty</label>
              <input type="number" min={1} required value={retQty} onChange={(e) => setRetQty(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
            <div>
              <label className="opes-label">Unit Price (FCFA)</label>
              <input type="number" min={1} required value={retUnitPrice} onChange={(e) => setRetUnitPrice(e.target.value)} className="opes-input font-mono text-xs" />
            </div>
          </div>
          <div>
            <label className="opes-label">Return Reason</label>
            <input required value={retReason} onChange={(e) => setRetReason(e.target.value)} className="opes-input text-xs" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#D97706] text-white text-xs font-semibold">
              Confirm Refund
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
