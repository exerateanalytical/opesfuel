import React, { useState } from 'react';
import { Barcode, CheckCircle2, Layers, Plus, Printer, ShoppingCart, Trash2 } from 'lucide-react';
import { formatFcfa } from '../../domain/formatters';
import { ShopItem, UserRole } from '../../domain/types';
import { printShopPosThermalSlip } from '../../utils/thermalReceipt';
import { FormModal } from '../shared/FormModal';

export interface ShopBatchItem {
  id: string;
  sku: string;
  barcode: string;
  itemName: string;
  batchCode: string;
  expiryDate: string;
  quantityRemaining: number;
  unitPriceFcfa: number;
}

export interface StockAdjustmentItem {
  id: string;
  sku: string;
  itemName: string;
  qtyDelta: number;
  unitCostFcfa: number;
  reason: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'REJECTED';
  createdBy: string;
  approvedBy?: string;
}

interface ShopCartAndFefoPanelProps {
  role: UserRole;
  stationName?: string;
  shopItems: ShopItem[];
  onRecordShopSale: (itemId: string, quantity: number, paymentMethod: 'CASH' | 'MOBILE_MONEY' | 'CARD') => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const ShopCartAndFefoPanel: React.FC<ShopCartAndFefoPanelProps> = ({
  role,
  stationName = 'OpesFuel Shop POS',
  shopItems,
  onRecordShopSale,
  onNotify,
}) => {
  const [tab, setTab] = useState<'cart' | 'fefo' | 'adjustments'>('cart');
  const [modal, setModal] = useState<'batch' | 'adjustment' | null>(null);
  const currentActor = `${role.toLowerCase()}@opesfuel.cm`;

  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<Array<{ itemId: string; sku: string; name: string; unitPriceFcfa: number; qty: number }>>([]);
  const [tender, setTender] = useState<'CASH' | 'MOBILE_MONEY' | 'CARD'>('MOBILE_MONEY');

  const [batches, setBatches] = useState<ShopBatchItem[]>(() => [
    {
      id: 'bch_01',
      sku: shopItems[0]?.sku ?? 'LUB-5W30',
      barcode: '3425901018508',
      itemName: shopItems[0]?.name ?? 'Total Quartz 5W-30 (4L)',
      batchCode: 'LOT-2026-A1',
      expiryDate: '2027-02-15',
      quantityRemaining: 14,
      unitPriceFcfa: shopItems[0]?.unitPriceFcfa ?? 18500,
    },
    {
      id: 'bch_02',
      sku: shopItems[1]?.sku ?? 'LUB-15W40',
      barcode: '3425901019201',
      itemName: shopItems[1]?.name ?? 'Rubia Tir 15W-40 (5L)',
      batchCode: 'LOT-2026-B4',
      expiryDate: '2027-08-30',
      quantityRemaining: 22,
      unitPriceFcfa: shopItems[1]?.unitPriceFcfa ?? 19500,
    },
  ]);

  const [adjustments, setAdjustments] = useState<StockAdjustmentItem[]>([
    {
      id: 'adj_01',
      sku: 'LUB-5W30',
      itemName: 'Total Quartz 5W-30 (4L)',
      qtyDelta: -1,
      unitCostFcfa: 13200,
      reason: 'Punctured cap during shelf restock',
      status: 'PENDING_APPROVAL',
      createdBy: 'manager@opesfuel.cm',
    },
  ]);

  // Batch modal state
  const [bSku, setBSku] = useState(shopItems[0]?.sku ?? 'LUB-5W30');
  const [bBarcode, setBBarcode] = useState('3425901018999');
  const [bName, setBName] = useState(shopItems[0]?.name ?? 'Engine Oil 4L');
  const [bLot, setBLot] = useState('LOT-2026-C1');
  const [bExpiry, setBExpiry] = useState('2027-12-31');
  const [bQty, setBQty] = useState('20');
  const [bPrice, setBPrice] = useState('18500');

  // Adjustment modal state
  const [aSku, setASku] = useState(shopItems[0]?.sku ?? 'LUB-5W30');
  const [aDelta, setADelta] = useState('-1');
  const [aCost, setACost] = useState('13000');
  const [aReason, setAReason] = useState('');

  const addItemToCart = (item: ShopItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        return prev.map((c) => (c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { itemId: item.id, sku: item.sku, name: item.name, unitPriceFcfa: item.unitPriceFcfa, qty: 1 }];
    });
  };

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const q = barcodeInput.trim().toLowerCase();
    if (!q) return;
    const batchMatch = batches.find((b) => b.barcode.toLowerCase() === q || b.sku.toLowerCase() === q);
    const shopMatch = shopItems.find(
      (i) => i.sku.toLowerCase() === q || i.name.toLowerCase().includes(q) || (batchMatch && i.sku.toLowerCase() === batchMatch.sku.toLowerCase())
    );
    if (shopMatch) {
      addItemToCart(shopMatch);
      setBarcodeInput('');
      onNotify('success', `Scanned ${shopMatch.sku} (${shopMatch.name}) into POS basket.`);
    } else {
      onNotify('error', `No SKU or barcode matched "${barcodeInput}".`);
    }
  };

  const cartTotalFcfa = cart.reduce((s, c) => s + c.unitPriceFcfa * c.qty, 0);

  const checkoutCart = () => {
    if (cart.length === 0) return;
    for (const line of cart) {
      onRecordShopSale(line.itemId, line.qty, tender);
      // FEFO batch deduction
      setBatches((prev) => {
        let toPick = line.qty;
        return [...prev]
          .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
          .map((b) => {
            if (toPick <= 0 || b.sku.toUpperCase() !== line.sku.toUpperCase()) return b;
            const take = Math.min(b.quantityRemaining, toPick);
            toPick -= take;
            return { ...b, quantityRemaining: b.quantityRemaining - take };
          });
      });
    }
    const summaryLabel = cart.map((c) => `${c.qty}x ${c.name}`).join(', ');
    printShopPosThermalSlip({
      stationName,
      sku: cart.length === 1 ? cart[0].sku : `BASKET-${cart.length}-ITEMS`,
      itemName: summaryLabel.slice(0, 64),
      quantity: 1,
      unitPriceFcfa: cartTotalFcfa,
      paymentMethod: tender,
    });
    setCart([]);
    onNotify('success', `Checked out ${formatFcfa(cartTotalFcfa)} via ${tender} with FEFO batch deduction & 80mm receipt.`);
  };

  const transitionAdjustment = (id: string, nextStatus: StockAdjustmentItem['status']) => {
    const target = adjustments.find((a) => a.id === id);
    if (!target) return;
    if (nextStatus === 'APPROVED' && target.createdBy.toLowerCase() === currentActor.toLowerCase()) {
      onNotify('error', 'Maker-Checker rule: creator cannot approve their own stock adjustment.');
      return;
    }
    setAdjustments((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: nextStatus, approvedBy: nextStatus === 'APPROVED' ? currentActor : a.approvedBy }
          : a
      )
    );
    onNotify('success', `Stock adjustment ${id} moved to ${nextStatus.replace(/_/g, ' ')}.`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950">
            Barcode Multi-Item Shop Cart (M16), FEFO Batches &amp; Stock Adjustments (M17)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Scan barcodes into a counter basket, automatically pick earliest-expiry FEFO lots, and enforce maker-checker stock write-offs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModal('batch')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Add FEFO Batch
          </button>
          <button
            type="button"
            onClick={() => setModal('adjustment')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Draft Stock Adjustment
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'cart', label: `Barcode POS Cart (${cart.reduce((s, c) => s + c.qty, 0)})`, icon: ShoppingCart },
            { id: 'fefo', label: `FEFO Expiry Batches (${batches.length})`, icon: Layers },
            { id: 'adjustments', label: `Stock Adjustments (${adjustments.length})`, icon: CheckCircle2 },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
                tab === t.id ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'cart' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-3">
            <form onSubmit={handleBarcodeScan} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan EAN barcode (e.g. 3425901018508) or type SKU code..."
                  className="opes-input pl-9 font-mono text-xs"
                />
              </div>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">
                Scan / Add
              </button>
            </form>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {shopItems.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addItemToCart(item)}
                  className="p-3 rounded-lg border border-slate-200 bg-white hover:border-amber-500 text-left transition-colors"
                >
                  <div className="font-mono text-[10px] text-slate-500">{item.sku}</div>
                  <div className="text-xs font-semibold text-slate-900 truncate mt-0.5">{item.name}</div>
                  <div className="font-mono text-xs font-bold text-amber-700 mt-1">{formatFcfa(item.unitPriceFcfa)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-display text-sm font-bold text-slate-950">Active POS Basket</span>
              <span className="font-mono text-xs text-slate-500">{cart.length} line(s)</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto text-xs">
              {cart.map((line) => (
                <div key={line.itemId} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{line.name}</div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {line.qty} × {formatFcfa(line.unitPriceFcfa)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-slate-900">{formatFcfa(line.unitPriceFcfa * line.qty)}</span>
                    <button
                      type="button"
                      onClick={() => setCart((prev) => prev.filter((c) => c.itemId !== line.itemId))}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <div className="py-6 text-center text-slate-400">Scan a barcode or tap a quick-tile to add items.</div>}
            </div>
            <div className="pt-2 border-t border-slate-200 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">Basket Total (incl. VAT)</span>
                <span className="font-mono text-base font-bold text-slate-950">{formatFcfa(cartTotalFcfa)}</span>
              </div>
              <div className="flex items-center gap-2">
                <select value={tender} onChange={(e) => setTender(e.target.value as 'CASH' | 'MOBILE_MONEY' | 'CARD')} className="opes-input text-xs py-2">
                  <option value="MOBILE_MONEY">Orange Money / MTN MoMo</option>
                  <option value="CASH">Cash Counter</option>
                  <option value="CARD">Bank Card POS</option>
                </select>
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={checkoutCart}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" /> Checkout &amp; 80mm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'fefo' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Batch / Lot</th>
                <th className="px-4 py-3">SKU &amp; EAN Barcode</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Expiry (FEFO Order)</th>
                <th className="px-4 py-3 text-right">Remaining Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {[...batches]
                .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
                .map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{b.batchCode}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {b.sku} · {b.barcode}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{b.itemName}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-amber-700">{b.expiryDate}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{b.quantityRemaining}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatFcfa(b.unitPriceFcfa)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'adjustments' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">ID &amp; SKU</th>
                <th className="px-4 py-3">Reason &amp; Maker</th>
                <th className="px-4 py-3 text-right">Qty Delta</th>
                <th className="px-4 py-3 text-right">Cost Impact</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">Workflow Transition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {adjustments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                    {a.id} · {a.sku}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{a.reason}</div>
                    <div className="text-[11px] text-slate-500">Maker: {a.createdBy}{a.approvedBy ? ` · Checker: ${a.approvedBy}` : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-red-700">{a.qtyDelta}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatFcfa(Math.abs(a.qtyDelta) * a.unitCostFcfa)}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{a.status.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                    {a.status === 'DRAFT' && (
                      <button type="button" onClick={() => transitionAdjustment(a.id, 'PENDING_APPROVAL')} className="px-2 py-1 rounded bg-amber-600 text-white font-semibold">
                        Submit
                      </button>
                    )}
                    {a.status === 'PENDING_APPROVAL' && (
                      <>
                        <button type="button" onClick={() => transitionAdjustment(a.id, 'APPROVED')} className="px-2 py-1 rounded bg-[#0F172A] text-white font-semibold">
                          Approve
                        </button>
                        <button type="button" onClick={() => transitionAdjustment(a.id, 'REJECTED')} className="px-2 py-1 rounded border border-slate-300 text-slate-700 font-semibold">
                          Reject
                        </button>
                      </>
                    )}
                    {a.status === 'APPROVED' && (
                      <button type="button" onClick={() => transitionAdjustment(a.id, 'POSTED')} className="px-2 py-1 rounded bg-emerald-700 text-white font-semibold">
                        Post to GL
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Popup Modals */}
      <FormModal open={modal === 'batch'} title="Register FEFO Stock Batch & Barcode" subtitle="Adds a traceable lot with expiry date for First-Expired-First-Out POS picking." onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBatches((prev) => [
              {
                id: `bch_${Date.now().toString(36)}`,
                sku: bSku.trim().toUpperCase(),
                barcode: bBarcode.trim(),
                itemName: bName.trim(),
                batchCode: bLot.trim().toUpperCase(),
                expiryDate: bExpiry,
                quantityRemaining: Number(bQty) || 1,
                unitPriceFcfa: Number(bPrice) || 1000,
              },
              ...prev,
            ]);
            setModal(null);
            onNotify('success', `Registered FEFO batch ${bLot} (${bExpiry}).`);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="opes-label">SKU Code</label><input value={bSku} onChange={(e) => setBSku(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">EAN / UPC Barcode</label><input value={bBarcode} onChange={(e) => setBBarcode(e.target.value)} className="opes-input font-mono" required /></div>
            <div className="sm:col-span-2"><label className="opes-label">Product Name</label><input value={bName} onChange={(e) => setBName(e.target.value)} className="opes-input" required /></div>
            <div><label className="opes-label">Batch / Lot Code</label><input value={bLot} onChange={(e) => setBLot(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Expiry Date</label><input type="date" value={bExpiry} onChange={(e) => setBExpiry(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Opening Qty</label><input type="number" min={1} value={bQty} onChange={(e) => setBQty(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Selling Price (FCFA)</label><input type="number" min={100} value={bPrice} onChange={(e) => setBPrice(e.target.value)} className="opes-input font-mono" required /></div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold">Save FEFO Batch</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'adjustment'} title="Draft Stock Adjustment (Maker-Checker)" subtitle="Enforces DRAFT -> PENDING_APPROVAL -> APPROVED -> POSTED workflow." onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!aReason.trim()) return;
            const match = shopItems.find((i) => i.sku.toUpperCase() === aSku.trim().toUpperCase());
            setAdjustments((prev) => [
              {
                id: `adj_${Date.now().toString(36)}`,
                sku: aSku.trim().toUpperCase(),
                itemName: match?.name ?? aSku.trim(),
                qtyDelta: Number(aDelta) || -1,
                unitCostFcfa: Number(aCost) || 10000,
                reason: aReason.trim(),
                status: 'DRAFT',
                createdBy: currentActor,
              },
              ...prev,
            ]);
            setAReason('');
            setModal(null);
            onNotify('success', 'Created stock adjustment in DRAFT state.');
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="opes-label">SKU Code</label><input value={aSku} onChange={(e) => setASku(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Quantity Delta (e.g. -2)</label><input type="number" value={aDelta} onChange={(e) => setADelta(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Unit Cost (FCFA)</label><input type="number" min={0} value={aCost} onChange={(e) => setACost(e.target.value)} className="opes-input font-mono" required /></div>
            <div className="sm:col-span-2"><label className="opes-label">Audit Reason</label><input value={aReason} onChange={(e) => setAReason(e.target.value)} placeholder="e.g. Damaged container during count" className="opes-input" required /></div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold">Create Draft</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
