import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, CreditCard, FileText, Plus, Printer, Trash2 } from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { canPerformAction } from '../../auth/auth0';
import { ALL_FUEL_GRADES, formatFcfa, formatLitres, formatShortDate, gradeLabel } from '../../domain/formatters';
import { FleetAccount, FleetTransaction, FuelGrade, ShopItem, UserRole } from '../../domain/types';
import { printFleetStatementPdf } from '../../utils/documentTemplates';
import { printFleetVoucherSlip, printShopPosThermalSlip } from '../../utils/thermalReceipt';
import { FormModal } from '../shared/FormModal';
import { FleetShopAdvancedPanel } from './FleetShopAdvancedPanel';
import { ShopCartAndFefoPanel } from './ShopCartAndFefoPanel';

interface FleetShopSectionProps {
  engine: OpesFuelApiEngine;
  role: UserRole;
  stationId: string;
  defaultStationId: string;
  fleetAccounts: FleetAccount[];
  fleetTransactions: FleetTransaction[];
  shopItems: ShopItem[];
  onRecordVoucher: (input: {
    accountId: string;
    stationId: string;
    vehiclePlate: string;
    driverName: string;
    grade: FuelGrade;
    litres: number;
  }) => void;
  onSettleFleet: (
    accountId: string,
    stationId: string,
    amountFcfa: number,
    method: 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CASH'
  ) => void;
  onRecordShopSale: (itemId: string, quantity: number, paymentMethod: 'CASH' | 'MOBILE_MONEY' | 'CARD') => void;
  onRestockShopItem: (itemId: string, quantity: number) => void;
  onCreateFleetAccount: (input: { companyName: string; taxId: string; creditLimitFcfa: number }) => void;
  onDeleteFleetAccount: (accountId: string) => void;
  onCreateShopItem: (input: {
    stationId: string;
    sku: string;
    name: string;
    category: ShopItem['category'];
    stockQty: number;
    reorderLevel: number;
    unitPriceFcfa: number;
    unitCostFcfa: number;
  }) => void;
  onDeleteShopItem: (itemId: string) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const FleetShopSection: React.FC<FleetShopSectionProps> = ({
  engine,
  role,
  stationId,
  defaultStationId,
  fleetAccounts,
  fleetTransactions,
  shopItems,
  onRecordVoucher,
  onSettleFleet,
  onRecordShopSale,
  onRestockShopItem,
  onCreateFleetAccount,
  onDeleteFleetAccount,
  onCreateShopItem,
  onDeleteShopItem,
  onNotify,
}) => {
  const canVoucher = canPerformAction(role, 'OPEN_CLOSE_SHIFT');
  const canSettle = canPerformAction(role, 'SETTLE_FLEET');
  const canRestock = canPerformAction(role, 'RECORD_DELIVERY');
  const canDelete = canPerformAction(role, 'VOID_FINANCIAL_RECORDS');
  const effectiveStation = stationId === 'ALL' ? defaultStationId : stationId;

  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);
  const [fleetModal, setFleetModal] = useState<'voucher' | 'settle' | null>(null);

  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newTaxId, setNewTaxId] = useState('');
  const [newLimit, setNewLimit] = useState('3000000');

  const [showNewSku, setShowNewSku] = useState(false);
  const [skuCode, setSkuCode] = useState('');
  const [skuName, setSkuName] = useState('');
  const [skuCat, setSkuCat] = useState<ShopItem['category']>('LUBRICANT');
  const [skuQty, setSkuQty] = useState('25');
  const [skuPrice, setSkuPrice] = useState('12000');
  const [skuCost, setSkuCost] = useState('8500');

  const [accountId, setAccountId] = useState('');
  const [plate, setPlate] = useState('LT-904-CE');
  const [driver, setDriver] = useState('Haman Bello');
  const [grade, setGrade] = useState<FuelGrade>('GASOIL');
  const [litres, setLitres] = useState('180');

  const [settleId, setSettleId] = useState('');
  const [settleAmount, setSettleAmount] = useState('500000');
  const [settleMethod, setSettleMethod] = useState<'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CASH'>('BANK_TRANSFER');

  const [portalInviteAccount, setPortalInviteAccount] = useState<FleetAccount | null>(null);
  const [portalEmail, setPortalEmail] = useState('');
  const [portalName, setPortalName] = useState('');
  const [portalPassword, setPortalPassword] = useState('FleetPass2026!');

  const [skuQuantities, setSkuQuantities] = useState<Record<string, number>>({});

  const visibleItems = shopItems.filter((i) => stationId === 'ALL' || i.stationId === stationId);

  const handleVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const targetAccId = accountId || fleetAccounts[0]?.id;
    if (!targetAccId) return;
    onRecordVoucher({
      accountId: targetAccId,
      stationId: effectiveStation,
      vehiclePlate: plate,
      driverName: driver,
      grade,
      litres: Number(litres) || 0,
    });
  };

  const handleSettle = (e: React.FormEvent) => {
    e.preventDefault();
    const targetSettleId = settleId || fleetAccounts[0]?.id;
    if (!targetSettleId) return;
    onSettleFleet(targetSettleId, effectiveStation, Number(settleAmount) || 0, settleMethod);
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.trim() || !newTaxId.trim()) return;
    onCreateFleetAccount({
      companyName: newCompany.trim(),
      taxId: newTaxId.trim(),
      creditLimitFcfa: Number(newLimit) || 1000000,
    });
    setNewCompany('');
    setNewTaxId('');
    setShowNewAccount(false);
  };

  const handleCreateSku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuCode.trim() || !skuName.trim()) return;
    onCreateShopItem({
      stationId: effectiveStation,
      sku: skuCode.trim(),
      name: skuName.trim(),
      category: skuCat,
      stockQty: Number(skuQty) || 0,
      reorderLevel: 10,
      unitPriceFcfa: Number(skuPrice) || 1000,
      unitCostFcfa: Number(skuCost) || 500,
    });
    setSkuCode('');
    setSkuName('');
    setShowNewSku(false);
  };

  // Dedicated Corporate Fleet Account Detail Page
  const activeDetailAccount = detailAccountId ? fleetAccounts.find((a) => a.id === detailAccountId) : null;
  if (activeDetailAccount) {
    const accountVouchers = fleetTransactions.filter((t) => t.accountId === activeDetailAccount.id);
    const utilizationPct = Math.min(
      100,
      Math.round((activeDetailAccount.balanceOwedFcfa / Math.max(1, activeDetailAccount.creditLimitFcfa)) * 100)
    );
    const availableFcfa = Math.max(0, activeDetailAccount.creditLimitFcfa - activeDetailAccount.balanceOwedFcfa);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDetailAccountId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Fleet Credit &amp; POS
          </button>
          <div className="flex items-center gap-2">
            {canSettle && (
              <button
                type="button"
                onClick={() =>
                  printFleetStatementPdf({
                    stationName: 'OpesFuel Forecourt Station',
                    account: activeDetailAccount,
                    transactions: accountVouchers,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
              >
                <FileText className="w-3.5 h-3.5" /> Print Statement &amp; Tax Invoice PDF
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  onDeleteFleetAccount(activeDetailAccount.id);
                  setDetailAccountId(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Corporate Client
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg icon-glass text-slate-900 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">{activeDetailAccount.companyName}</h2>
                <p className="text-xs text-slate-500">
                  Tax ID / NIU: <span className="font-mono">{activeDetailAccount.taxId}</span> · Status:{' '}
                  {activeDetailAccount.status}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Outstanding Receivables (AR 1100)</div>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                {formatFcfa(activeDetailAccount.balanceOwedFcfa)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700">Credit Line Utilization ({utilizationPct}%)</span>
              <span className="font-mono tabular-nums text-slate-900">
                Available: {formatFcfa(availableFcfa)} / Limit {formatFcfa(activeDetailAccount.creditLimitFcfa)}
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${utilizationPct > 85 ? 'bg-red-600' : 'bg-amber-600'}`}
                style={{ width: `${utilizationPct}%` }}
              />
            </div>
          </div>

          {canSettle && activeDetailAccount.balanceOwedFcfa > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSettleFleet(activeDetailAccount.id, effectiveStation, Number(settleAmount) || 0, settleMethod);
              }}
              className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3"
            >
              <span className="text-xs font-semibold text-slate-800">Record Direct Payment:</span>
              <input
                type="number"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="px-3 py-1.5 rounded border border-slate-300 text-xs font-mono bg-white"
              />
              <select
                value={settleMethod}
                onChange={(e) => setSettleMethod(e.target.value as 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CASH')}
                className="px-3 py-1.5 rounded border border-slate-300 text-xs bg-white"
              >
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="CASH">Cash</option>
              </select>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Clear AR Balance
              </button>
            </form>
          )}

          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 mb-3">
              Fueling Voucher Ledger ({accountVouchers.length})
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Vehicle Plate</th>
                    <th className="px-4 py-2.5">Driver</th>
                    <th className="px-4 py-2.5">Grade</th>
                    <th className="px-4 py-2.5 text-right">Litres</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-right">Issued</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accountVouchers.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{tx.vehiclePlate}</td>
                      <td className="px-4 py-2.5 text-slate-700">{tx.driverName}</td>
                      <td className="px-4 py-2.5 text-slate-600">{tx.grade}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatLitres(tx.litres)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold">
                        {formatFcfa(tx.amountFcfa)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                        {formatShortDate(tx.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {accountVouchers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                        No fleet fuel vouchers issued to this client yet.
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
  }

  return (
    <div className="space-y-6">
      {/* Corporate Fleet Credit Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">Corporate Fleet Credit Accounts</h2>
              <p className="text-xs text-slate-500">
                Click any client for credit line utilization &amp; vehicle voucher ledger in FCFA
              </p>
            </div>
            {canSettle && (
              <button
                type="button"
                onClick={() => setShowNewAccount(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> New Fleet Client
              </button>
            )}
          </div>

          <FormModal
            open={showNewAccount && canSettle}
            onClose={() => setShowNewAccount(false)}
            title="Onboard Corporate Fleet Client"
            subtitle="Sets up a corporate fuel credit account with a monthly FCFA limit."
          >
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="opes-label">Company Legal Name</label>
                <input type="text" required placeholder="e.g. Littoral Logistics SA" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} className="opes-input" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="opes-label">Tax ID / NIU</label>
                  <input type="text" required placeholder="e.g. M09221849302" value={newTaxId} onChange={(e) => setNewTaxId(e.target.value)} className="opes-input font-mono" />
                </div>
                <div>
                  <label className="opes-label">Credit Limit (FCFA)</label>
                  <input type="number" min={50000} required value={newLimit} onChange={(e) => setNewLimit(e.target.value)} className="opes-input font-mono" />
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setShowNewAccount(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Save Fleet Client</button>
              </div>
            </form>
          </FormModal>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Tax ID</th>
                  <th className="px-4 py-3 text-right">Credit Limit</th>
                  <th className="px-4 py-3 text-right">Balance Owed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Statement / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fleetAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDetailAccountId(acc.id)}
                        className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-amber-700"
                      >
                        <span>{acc.companyName}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{acc.taxId}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatFcfa(acc.creditLimitFcfa)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatFcfa(acc.balanceOwedFcfa)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-emerald-700">{acc.status}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {canSettle && (
                          <button
                            type="button"
                            onClick={() =>
                              printFleetStatementPdf({
                                stationName: 'OpesFuel Forecourt Station',
                                account: acc,
                                transactions: fleetTransactions.filter((t) => t.accountId === acc.id),
                              })
                            }
                            title="Print Corporate Fleet Statement & Tax Invoice PDF"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
                          >
                            <Printer className="w-3 h-3" /> Statement PDF
                          </button>
                        )}
                        {canSettle && (
                          <button
                            type="button"
                            onClick={() => setPortalInviteAccount(acc)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-semibold"
                          >
                            Invite Portal Client
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onDeleteFleetAccount(acc.id)}
                            aria-label={`Delete fleet account ${acc.companyName}`}
                            className="p-1.5 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {fleetAccounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-500">
                      No corporate fleet accounts onboarded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <FormModal
            open={Boolean(portalInviteAccount)}
            onClose={() => setPortalInviteAccount(null)}
            title={`Invite Corporate Fleet Portal User — ${portalInviteAccount?.companyName ?? ''}`}
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!portalInviteAccount || !portalEmail.trim() || !portalName.trim()) return;
                const apiBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/+$/, '');
                if (apiBase) {
                  try {
                    const res = await fetch(
                      `${apiBase}/api/v1/fleet/accounts/${encodeURIComponent(portalInviteAccount.id)}/portal-users`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: portalEmail.trim(),
                          fullName: portalName.trim(),
                          temporaryPassword: portalPassword,
                        }),
                      }
                    );
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  } catch (err) {
                    onNotify('error', err instanceof Error ? err.message : 'Unable to invite fleet portal user.');
                    return;
                  }
                }
                onNotify(
                  'success',
                  `Invited ${portalEmail.trim()} to Corporate Fleet Self-Service Portal (/#/fleet-portal) for ${portalInviteAccount.companyName}.`
                );
                setPortalInviteAccount(null);
                setPortalEmail('');
                setPortalName('');
              }}
              className="space-y-3"
            >
              <div>
                <label className="opes-label">Client Manager Full Name</label>
                <input required value={portalName} onChange={(e) => setPortalName(e.target.value)} placeholder="e.g. Marc Fotso" className="opes-input text-xs" />
              </div>
              <div>
                <label className="opes-label">Corporate Email</label>
                <input type="email" required value={portalEmail} onChange={(e) => setPortalEmail(e.target.value)} placeholder="fleetmgr@company.cm" className="opes-input text-xs" />
              </div>
              <div>
                <label className="opes-label">Temporary Portal Password</label>
                <input type="text" required minLength={6} value={portalPassword} onChange={(e) => setPortalPassword(e.target.value)} className="opes-input text-xs font-mono" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <a href="#/fleet-portal" className="text-[11px] font-semibold text-amber-700 underline">
                  Preview Fleet Portal →
                </a>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPortalInviteAccount(null)} className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Send Portal Invite</button>
                </div>
              </div>
            </form>
          </FormModal>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 space-y-2">
            <div className="text-xs font-semibold text-slate-700">Recent Fleet Vouchers</div>
            {fleetTransactions.slice(0, 4).map((tx) => (
              <div key={tx.id} className="flex flex-wrap justify-between text-xs text-slate-600">
                <span>
                  <span className="font-mono font-semibold text-slate-900">{tx.vehiclePlate}</span> · {tx.companyName} ({tx.driverName})
                </span>
                <span className="font-mono tabular-nums">
                  {formatLitres(tx.litres)} {tx.grade} · {formatFcfa(tx.amountFcfa)} · {formatShortDate(tx.createdAt)}
                </span>
              </div>
            ))}
            {fleetTransactions.length === 0 && (
              <div className="text-xs text-slate-400">No fleet fueling vouchers recorded yet.</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <h3 className="font-display text-base font-bold text-slate-950">Corporate Fleet Actions</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Issue a signed corporate fuel voucher at the pump or post an incoming bank/MoMo payment against corporate receivables.
            </p>
          </div>
          <div className="space-y-2.5">
            {canVoucher && (
              <button
                type="button"
                disabled={fleetAccounts.length === 0}
                onClick={() => setFleetModal('voucher')}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" /> Issue Fleet Fuel Voucher
              </button>
            )}
            {canSettle && (
              <button
                type="button"
                disabled={fleetAccounts.length === 0}
                onClick={() => setFleetModal('settle')}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" /> Settle Corporate Invoice
              </button>
            )}
            {fleetTransactions[0] && (
              <button
                type="button"
                onClick={() => {
                  const tx = fleetTransactions[0];
                  const acc = fleetAccounts.find((a) => a.id === tx.accountId);
                  printFleetVoucherSlip({
                    stationName: 'OpesFuel Forecourt Station',
                    voucherId: tx.id,
                    companyName: acc?.companyName ?? 'Corporate Fleet',
                    vehiclePlate: tx.vehiclePlate,
                    driverName: tx.driverName,
                    grade: tx.grade,
                    litres: tx.litres,
                    amountFcfa: tx.amountFcfa,
                    createdAt: tx.createdAt,
                  });
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" /> Print Latest 80mm Fleet Voucher
              </button>
            )}
          </div>
        </div>
      </div>

      <FormModal
        open={fleetModal === 'voucher'}
        title="Issue Corporate Fleet Fuel Voucher"
        subtitle="Charges the approved vehicle plate and updates corporate balance owed."
        onClose={() => setFleetModal(null)}
      >
        <form
          onSubmit={(e) => {
            handleVoucher(e);
            setFleetModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="opes-label">Corporate Account</label>
              <select
                value={accountId || fleetAccounts[0]?.id || ''}
                onChange={(e) => setAccountId(e.target.value)}
                className="opes-input"
                required
              >
                {fleetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.companyName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Vehicle License Plate</label>
              <input type="text" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="LT-402-CM" className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Driver Name</label>
              <input type="text" value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Driver full name" className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Fuel Grade</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value as FuelGrade)} className="opes-input">
                {ALL_FUEL_GRADES.map((g) => (
                  <option key={g} value={g}>{gradeLabel(g)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Volume (Litres)</label>
              <input type="number" min={1} value={litres} onChange={(e) => setLitres(e.target.value)} className="opes-input font-mono" required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setFleetModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              Charge Fleet Account
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={fleetModal === 'settle'}
        title="Settle Corporate Fleet Invoice"
        subtitle="Records incoming customer payment and reduces Fleet Accounts Receivable."
        onClose={() => setFleetModal(null)}
      >
        <form
          onSubmit={(e) => {
            handleSettle(e);
            setFleetModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="opes-label">Corporate Account</label>
              <select value={settleId || fleetAccounts[0]?.id || ''} onChange={(e) => setSettleId(e.target.value)} className="opes-input" required>
                {fleetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.companyName} ({formatFcfa(a.balanceOwedFcfa)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Payment Amount (FCFA)</label>
              <input type="number" min={1} value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Payment Method</label>
              <select
                value={settleMethod}
                onChange={(e) => setSettleMethod(e.target.value as 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CASH')}
                className="opes-input"
              >
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setFleetModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">
              Post Settlement to AR
            </button>
          </div>
        </form>
      </FormModal>

      {/* Lubricants, LPG & Forecourt Shop POS (Hidden from Holding Group CFO & Chief Accountant executive/AR views) */}
      {role !== 'GROUP_CFO' && role !== 'ACCOUNTANT' && (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Lubricants, LPG &amp; Forecourt Shop POS</h2>
            <p className="text-xs text-slate-500">Non-fuel inventory deductions and instant counter revenue posting</p>
          </div>
          {canRestock && (
            <button
              type="button"
              onClick={() => setShowNewSku(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add Shop SKU
            </button>
          )}
        </div>

        <FormModal
          open={showNewSku && canRestock}
          onClose={() => setShowNewSku(false)}
          title="Add Lubricant, LPG or Shop SKU"
          subtitle="Adds a non-fuel retail product to your forecourt POS inventory."
        >
          <form onSubmit={handleCreateSku} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="opes-label">SKU Code</label>
                <input type="text" required placeholder="e.g. LUB-20W50" value={skuCode} onChange={(e) => setSkuCode(e.target.value)} className="opes-input font-mono" />
              </div>
              <div>
                <label className="opes-label">Category</label>
                <select value={skuCat} onChange={(e) => setSkuCat(e.target.value as ShopItem['category'])} className="opes-input">
                  <option value="LUBRICANT">Lubricant</option>
                  <option value="LPG">LPG Gas</option>
                  <option value="SHOP">Shop</option>
                </select>
              </div>
            </div>
            <div>
              <label className="opes-label">Product Name</label>
              <input type="text" required placeholder="e.g. Total Quartz 5W-30 (4L)" value={skuName} onChange={(e) => setSkuName(e.target.value)} className="opes-input" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="opes-label">Opening Qty</label>
                <input type="number" min={0} required value={skuQty} onChange={(e) => setSkuQty(e.target.value)} className="opes-input font-mono" />
              </div>
              <div>
                <label className="opes-label">Selling Price (FCFA)</label>
                <input type="number" min={1} required value={skuPrice} onChange={(e) => setSkuPrice(e.target.value)} className="opes-input font-mono" />
              </div>
              <div>
                <label className="opes-label">Unit Cost (FCFA)</label>
                <input type="number" min={1} required value={skuCost} onChange={(e) => setSkuCost(e.target.value)} className="opes-input font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button type="button" onClick={() => setShowNewSku(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold">Cancel</button>
              <button type="submit" className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Save SKU</button>
            </div>
          </form>
        </FormModal>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Quick Sale &amp; Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleItems.map((item) => {
                const qty = skuQuantities[item.id] ?? 1;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.sku}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{item.category}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                      {item.stockQty} {item.stockQty <= item.reorderLevel ? '(Low)' : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatFcfa(item.unitPriceFcfa)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {canVoucher && (
                          <>
                            <input
                              type="number"
                              min={1}
                              max={Math.max(1, item.stockQty)}
                              value={qty}
                              onChange={(e) => setSkuQuantities({ ...skuQuantities, [item.id]: Number(e.target.value) || 1 })}
                              className="w-14 px-2 py-1 rounded border border-slate-300 text-xs font-mono text-right"
                            />
                            <button
                              type="button"
                              onClick={() => onRecordShopSale(item.id, qty, 'MOBILE_MONEY')}
                              className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap"
                            >
                              Sell (MoMo)
                            </button>
                            <button
                              type="button"
                              onClick={() => onRecordShopSale(item.id, qty, 'CASH')}
                              className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap"
                            >
                              Sell (Cash)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                printShopPosThermalSlip({
                                  stationName: 'OpesFuel Shop POS',
                                  sku: item.sku,
                                  itemName: item.name,
                                  quantity: qty,
                                  unitPriceFcfa: item.unitPriceFcfa,
                                  paymentMethod: 'CASH / MOMO',
                                })
                              }
                              title={`Print 80mm Shop Receipt for ${item.name}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold whitespace-nowrap"
                            >
                              <Printer className="w-3 h-3" /> 80mm
                            </button>
                          </>
                        )}
                        {canRestock && (
                          <>
                            <button
                              type="button"
                              onClick={() => onRestockShopItem(item.id, 10)}
                              className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold whitespace-nowrap"
                            >
                              +10 Restock
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteShopItem(item.id)}
                              aria-label={`Delete SKU ${item.sku}`}
                              className="p-1.5 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-500">
                    No lubricants, LPG cylinders, or shop SKUs configured for this station scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {role !== 'GROUP_CFO' && role !== 'ACCOUNTANT' && (
        <ShopCartAndFefoPanel
          role={role}
          shopItems={visibleItems}
          onRecordShopSale={onRecordShopSale}
          onNotify={onNotify}
        />
      )}

      <FleetShopAdvancedPanel
        engine={engine}
        role={role}
        stationId={stationId}
        fleetAccounts={fleetAccounts}
        onNotify={onNotify}
      />
    </div>
  );
};
