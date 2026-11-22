import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Flame, PackagePlus, Plus, Printer, RefreshCw, ShieldAlert } from 'lucide-react';
import { formatFcfa } from '../../domain/formatters';
import { UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';
import { printThermalReceipt } from '../../utils/thermalReceipt';

interface LpgSku {
  id: string;
  brand: string;
  sizeKg: number;
  skuCode: string;
  gasRefillPriceFcfa: number;
  depositFcfa: number;
  crossBrandSwapFeeFcfa: number;
  fullQty: number;
  emptyQty: number;
  damagedQty: number;
}

interface LpgTx {
  id: string;
  receiptNo: string;
  skuCode: string;
  txType: string;
  quantity: number;
  customerName: string;
  gasAmountFcfa: number;
  depositDeltaFcfa: number;
  swapFeeFcfa: number;
  totalFcfa: number;
  createdAt: string;
}

interface LpgCylinderExchangePanelProps {
  role: UserRole;
  stationId: string;
  stationName: string;
  onPostBackend: (path: string, method: 'POST' | 'PATCH' | 'PUT', body?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const LpgCylinderExchangePanel: React.FC<LpgCylinderExchangePanelProps> = ({
  role,
  stationId,
  stationName,
  onPostBackend,
  onNotify,
}) => {
  const canManageStock = role === 'PLATFORM_ADMIN' || role === 'OWNER' || role === 'MANAGER';
  const canTransact = canManageStock || role === 'ATTENDANT';

  const [skus, setSkus] = useState<LpgSku[]>([
    { id: 'lpg_tdx_12', brand: 'TRADEX', sizeKg: 12.5, skuCode: 'TDX-12.5KG', gasRefillPriceFcfa: 6500, depositFcfa: 18000, crossBrandSwapFeeFcfa: 1500, fullQty: 42, emptyQty: 18, damagedQty: 1 },
    { id: 'lpg_tot_12', brand: 'TOTALGAZ', sizeKg: 12.5, skuCode: 'TOT-12.5KG', gasRefillPriceFcfa: 6500, depositFcfa: 18000, crossBrandSwapFeeFcfa: 1500, fullQty: 28, emptyQty: 14, damagedQty: 0 },
    { id: 'lpg_sctm_6', brand: 'SCTM', sizeKg: 6, skuCode: 'SCTM-6KG', gasRefillPriceFcfa: 3500, depositFcfa: 12000, crossBrandSwapFeeFcfa: 1000, fullQty: 35, emptyQty: 9, damagedQty: 0 },
    { id: 'lpg_cam_35', brand: 'CAMGAZ', sizeKg: 35, skuCode: 'CMG-35KG', gasRefillPriceFcfa: 19500, depositFcfa: 45000, crossBrandSwapFeeFcfa: 3000, fullQty: 10, emptyQty: 4, damagedQty: 0 },
  ]);

  const [txs, setTxs] = useState<LpgTx[]>([
    {
      id: 'lpgtx_01',
      receiptNo: 'LPG-20261122-A12F',
      skuCode: 'TDX-12.5KG',
      txType: 'REFILL_EXCHANGE',
      quantity: 2,
      customerName: 'Restaurant Le Wouri',
      gasAmountFcfa: 13000,
      depositDeltaFcfa: 0,
      swapFeeFcfa: 0,
      totalFcfa: 13000,
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
    },
  ]);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [skuModalOpen, setSkuModalOpen] = useState(false);

  // Transaction form
  const [txType, setTxType] = useState('REFILL_EXCHANGE');
  const [skuId, setSkuId] = useState('lpg_tdx_12');
  const [swapFromSkuId, setSwapFromSkuId] = useState('lpg_tot_12');
  const [qty, setQty] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // New SKU form
  const [newBrand, setNewBrand] = useState('TRADEX');
  const [newSizeKg, setNewSizeKg] = useState('12.5');
  const [newCode, setNewCode] = useState('');
  const [newRefillPrice, setNewRefillPrice] = useState('6500');
  const [newDeposit, setNewDeposit] = useState('18000');

  const totals = useMemo(() => {
    const full = skus.reduce((s, k) => s + k.fullQty, 0);
    const empty = skus.reduce((s, k) => s + k.emptyQty, 0);
    const damaged = skus.reduce((s, k) => s + k.damagedQty, 0);
    const depositLiability = txs.reduce((s, t) => s + t.depositDeltaFcfa, 0);
    const gasRev = txs.reduce((s, t) => s + t.gasAmountFcfa + t.swapFeeFcfa, 0);
    return { full, empty, damaged, depositLiability, gasRev };
  }, [skus, txs]);

  const handleRecordTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = skus.find((s) => s.id === skuId);
    if (!target) return;
    if (['SUPPLIER_DELIVERY', 'EMPTY_PICKUP', 'DAMAGE_WRITEOFF'].includes(txType) && !canManageStock) {
      onNotify('error', 'Only Station Manager or Owner may record supplier deliveries, pickups, or write-offs.');
      return;
    }
    if (['REFILL_EXCHANGE', 'NEW_SALE_WITH_DEPOSIT', 'CROSS_BRAND_SWAP'].includes(txType) && target.fullQty < qty) {
      onNotify('error', `Insufficient FULL stock for ${target.skuCode} (${target.fullQty} available).`);
      return;
    }
    if (['EMPTY_PICKUP', 'DAMAGE_WRITEOFF'].includes(txType) && target.emptyQty < qty) {
      onNotify('error', `Insufficient EMPTY stock for ${target.skuCode} (${target.emptyQty} available).`);
      return;
    }

    const remote = await onPostBackend('/api/v1/lpg/transactions', 'POST', {
      stationId,
      skuId: target.id,
      swapFromSkuId: txType === 'CROSS_BRAND_SWAP' ? swapFromSkuId : undefined,
      txType,
      quantity: qty,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      paymentMethod,
    });

    let gasAmt = 0;
    let depDelta = 0;
    let swapFee = 0;
    setSkus((prev) =>
      prev.map((k) => {
        if (k.id === target.id) {
          if (txType === 'REFILL_EXCHANGE') {
            gasAmt = k.gasRefillPriceFcfa * qty;
            return { ...k, fullQty: k.fullQty - qty, emptyQty: k.emptyQty + qty };
          }
          if (txType === 'NEW_SALE_WITH_DEPOSIT') {
            gasAmt = k.gasRefillPriceFcfa * qty;
            depDelta = k.depositFcfa * qty;
            return { ...k, fullQty: k.fullQty - qty };
          }
          if (txType === 'DEPOSIT_REFUND') {
            depDelta = -(k.depositFcfa * qty);
            return { ...k, emptyQty: k.emptyQty + qty };
          }
          if (txType === 'CROSS_BRAND_SWAP') {
            gasAmt = k.gasRefillPriceFcfa * qty;
            swapFee = k.crossBrandSwapFeeFcfa * qty;
            return { ...k, fullQty: k.fullQty - qty };
          }
          if (txType === 'SUPPLIER_DELIVERY') return { ...k, fullQty: k.fullQty + qty };
          if (txType === 'EMPTY_PICKUP') return { ...k, emptyQty: k.emptyQty - qty };
          if (txType === 'DAMAGE_WRITEOFF') return { ...k, emptyQty: k.emptyQty - qty, damagedQty: k.damagedQty + qty };
        }
        if (txType === 'CROSS_BRAND_SWAP' && k.id === swapFromSkuId) {
          return { ...k, emptyQty: k.emptyQty + qty };
        }
        return k;
      })
    );

    const total = gasAmt + depDelta + swapFee;
    const receiptNo = String(remote?.receiptNo ?? `LPG-${Date.now().toString().slice(-6)}`);
    setTxs((prev) => [
      {
        id: String(remote?.id ?? `lpgtx_${Date.now()}`),
        receiptNo,
        skuCode: target.skuCode,
        txType,
        quantity: qty,
        customerName: customerName.trim() || 'Walk-in Customer',
        gasAmountFcfa: gasAmt,
        depositDeltaFcfa: depDelta,
        swapFeeFcfa: swapFee,
        totalFcfa: total,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setTxModalOpen(false);
    setCustomerName('');
    setCustomerPhone('');
    setQty(1);
    onNotify('success', `Recorded ${txType.replace(/_/g, ' ')} x${qty} ${target.skuCode} (${receiptNo}).`);
  };

  const handleCreateSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    const payload = {
      brand: newBrand.trim().toUpperCase(),
      sizeKg: Number(newSizeKg),
      skuCode: newCode.trim().toUpperCase(),
      gasRefillPriceFcfa: Number(newRefillPrice),
      depositFcfa: Number(newDeposit),
      crossBrandSwapFeeFcfa: 1500,
    };
    const remote = await onPostBackend('/api/v1/lpg/skus', 'POST', payload);
    setSkus((prev) => [
      ...prev,
      { id: String(remote?.id ?? `lpg_${Date.now()}`), ...payload, fullQty: 0, emptyQty: 0, damagedQty: 0 },
    ]);
    setSkuModalOpen(false);
    setNewCode('');
    onNotify('success', `Added LPG cylinder SKU ${payload.skuCode}.`);
  };

  const printReceipt = (t: LpgTx) => {
    printThermalReceipt({
      title: `LPG CYLINDER ${t.txType.replace(/_/g, ' ')}`,
      stationName,
      receiptNo: t.receiptNo,
      dateIso: t.createdAt,
      customerName: t.customerName,
      lines: [
        { label: `${t.skuCode} x${t.quantity}`, amountFcfa: t.gasAmountFcfa },
        ...(t.depositDeltaFcfa !== 0 ? [{ label: 'Bottle Consignation Deposit', amountFcfa: t.depositDeltaFcfa }] : []),
        ...(t.swapFeeFcfa > 0 ? [{ label: 'Cross-Brand Swap Fee', amountFcfa: t.swapFeeFcfa }] : []),
      ],
      totalFcfa: t.totalFcfa,
      footerNote: 'Keep this consignation slip for refundable cylinder deposit.',
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-600" />
            LPG Bottled Gas Cylinder Exchange &amp; Consignation
          </h3>
          <p className="text-xs text-slate-500">
            Track FULL / EMPTY / DAMAGED bottles (6kg, 12.5kg, 35kg, 50kg), refundable deposits, cross-brand swaps, and negative-stock guards for {stationName}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageStock && (
            <button
              type="button"
              onClick={() => setSkuModalOpen(true)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <PackagePlus className="w-3.5 h-3.5" /> Add Cylinder SKU
            </button>
          )}
          {canTransact && (
            <button
              type="button"
              onClick={() => setTxModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" /> Record LPG Exchange / Movement
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] text-slate-500 uppercase font-semibold">Full Bottles</div>
          <div className="font-mono text-2xl font-bold text-emerald-700">{totals.full}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] text-slate-500 uppercase font-semibold">Empty Shells</div>
          <div className="font-mono text-2xl font-bold text-slate-900">{totals.empty}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] text-slate-500 uppercase font-semibold">Damaged</div>
          <div className="font-mono text-2xl font-bold text-red-700">{totals.damaged}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] text-slate-500 uppercase font-semibold">Deposit Liability</div>
          <div className="font-mono text-lg font-bold text-slate-900">{formatFcfa(totals.depositLiability)}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] text-slate-500 uppercase font-semibold">Gas + Swap Rev</div>
          <div className="font-mono text-lg font-bold text-amber-700">{formatFcfa(totals.gasRev)}</div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-900 text-white text-left">
            <tr>
              <th className="px-4 py-3">SKU / Brand</th>
              <th className="px-4 py-3 text-right">Size</th>
              <th className="px-4 py-3 text-right">Refill Price</th>
              <th className="px-4 py-3 text-right">Deposit</th>
              <th className="px-4 py-3 text-right">FULL</th>
              <th className="px-4 py-3 text-right">EMPTY</th>
              <th className="px-4 py-3 text-right">DAMAGED</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {skus.map((k) => (
              <tr key={k.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {k.brand} <span className="font-mono text-slate-500">({k.skuCode})</span>
                </td>
                <td className="px-4 py-3 text-right font-mono">{k.sizeKg} kg</td>
                <td className="px-4 py-3 text-right font-mono">{formatFcfa(k.gasRefillPriceFcfa)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatFcfa(k.depositFcfa)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{k.fullQty}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{k.emptyQty}</td>
                <td className="px-4 py-3 text-right font-mono text-red-700">{k.damagedQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Recent LPG Bottle Movements &amp; Consignation Slips
        </div>
        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-white text-left">
              <tr>
                <th className="px-4 py-2.5">Receipt</th>
                <th className="px-4 py-2.5">Movement</th>
                <th className="px-4 py-2.5">SKU × Qty</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5 text-right">Deposit Δ</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5 text-right">80mm Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txs.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono">{t.receiptNo}</td>
                  <td className="px-4 py-2.5 font-semibold">{t.txType.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5 font-mono">{t.skuCode} × {t.quantity}</td>
                  <td className="px-4 py-2.5">{t.customerName}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatFcfa(t.depositDeltaFcfa)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">{formatFcfa(t.totalFcfa)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button type="button" onClick={() => printReceipt(t)} className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 inline-flex items-center gap-1">
                      <Printer className="w-3 h-3" /> Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FormModal open={txModalOpen} onClose={() => setTxModalOpen(false)} title="Record LPG Cylinder Exchange / Movement">
        <form onSubmit={(e) => void handleRecordTx(e)} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Transaction Type</label>
            <select value={txType} onChange={(e) => setTxType(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
              <option value="REFILL_EXCHANGE">Refill Exchange (Empty In → Full Out)</option>
              <option value="NEW_SALE_WITH_DEPOSIT">New Sale + Refundable Deposit</option>
              <option value="DEPOSIT_REFUND">Deposit Refund (Customer Returns Empty)</option>
              <option value="CROSS_BRAND_SWAP">Cross-Brand Swap (+ Swap Fee)</option>
              {canManageStock && <option value="SUPPLIER_DELIVERY">Supplier Delivery (Fulls In)</option>}
              {canManageStock && <option value="EMPTY_PICKUP">Supplier Empty Pickup (Empties Out)</option>}
              {canManageStock && <option value="DAMAGE_WRITEOFF">Damaged Bottle Write-Off</option>}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Target Cylinder SKU</label>
              <select value={skuId} onChange={(e) => setSkuId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                {skus.map((k) => (
                  <option key={k.id} value={k.id}>{k.brand} {k.sizeKg}kg (Full: {k.fullQty})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Quantity</label>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
          </div>
          {txType === 'CROSS_BRAND_SWAP' && (
            <div>
              <label className="text-xs font-semibold text-slate-700">Incoming Empty Brand (Swap From)</label>
              <select value={swapFromSkuId} onChange={(e) => setSwapFromSkuId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                {skus.map((k) => (
                  <option key={k.id} value={k.id}>{k.brand} {k.sizeKg}kg ({k.skuCode})</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Customer Name</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in / Depot" className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                <option value="CASH">Cash</option>
                <option value="MTN_MOMO">MTN MoMo</option>
                <option value="ORANGE_MONEY">Orange Money</option>
              </select>
            </div>
          </div>
          {!canManageStock && (
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Supplier deliveries &amp; damage write-offs require Manager/Owner role.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTxModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Commit Movement</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={skuModalOpen} onClose={() => setSkuModalOpen(false)} title="Add LPG Cylinder Brand SKU">
        <form onSubmit={(e) => void handleCreateSku(e)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Brand</label>
              <input type="text" required value={newBrand} onChange={(e) => setNewBrand(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Weight (kg)</label>
              <select value={newSizeKg} onChange={(e) => setNewSizeKg(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                <option value="6">6 kg</option>
                <option value="12.5">12.5 kg</option>
                <option value="35">35 kg</option>
                <option value="50">50 kg</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">SKU Code</label>
            <input type="text" required value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. BVS-12.5KG" className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Gas Refill Price (FCFA)</label>
              <input type="number" required value={newRefillPrice} onChange={(e) => setNewRefillPrice(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Bottle Deposit (FCFA)</label>
              <input type="number" required value={newDeposit} onChange={(e) => setNewDeposit(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setSkuModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Save SKU</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
