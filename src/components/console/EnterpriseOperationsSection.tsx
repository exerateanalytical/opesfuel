import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Building2,
  Car,
  Gift,
  Plus,
  Printer,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react';
import {
  BulkWholesaleOrderItem,
  EvUtilityReadingItem,
  FranchiseAgreementItem,
  InterstationTransferItem,
  LoyaltyVoucherItem,
  ServiceBayTicketItem,
} from '../../api/enterpriseModulesData';
import { ALL_FUEL_GRADES, formatFcfa, formatLitres, formatShortDate, gradeLabel } from '../../domain/formatters';
import { FuelGrade, FuelTank, ShiftRecord, Station, UserRole } from '../../domain/types';
import { printInterstationTransferPdf } from '../../utils/documentTemplates';
import { printPrepaidVoucherThermalSlip, printServiceBayThermalSlip } from '../../utils/thermalReceipt';
import { FormModal } from '../shared/FormModal';

interface EnterpriseOperationsSectionProps {
  role: UserRole;
  stationId: string;
  stationName: string;
  stations: Station[];
  tanks: FuelTank[];
  shifts: ShiftRecord[];
  serviceBayTickets: ServiceBayTicketItem[];
  transfers: InterstationTransferItem[];
  vouchers: LoyaltyVoucherItem[];
  bulkOrders: BulkWholesaleOrderItem[];
  evUtility: EvUtilityReadingItem[];
  franchises: FranchiseAgreementItem[];
  onCreateServiceBay: (t: Omit<ServiceBayTicketItem, 'id' | 'status' | 'createdAt'>) => void;
  onCreateTransfer: (t: Omit<InterstationTransferItem, 'id' | 'receivedLitres' | 'status' | 'dispatchedAt'>) => void;
  onReceiveTransfer: (id: string, receivedLitres: number) => void;
  onIssueVoucher: (v: { stationId: string; customerName: string; customerPhone: string; issuedFcfa: number }) => void;
  onRedeemVoucher: (id: string, amountFcfa: number) => void;
  onCreateBulkOrder: (o: Omit<BulkWholesaleOrderItem, 'id' | 'totalFcfa' | 'status' | 'createdAt'>) => void;
  onCreateEvUtility: (e: Omit<EvUtilityReadingItem, 'id' | 'recordedAt'>) => void;
  onCreateFranchise: (f: Omit<FranchiseAgreementItem, 'id' | 'status'>) => void;
  onRaiseSuggestedPo: (grade: FuelGrade, litres: number, unitCostFcfa: number) => void;
}

export const EnterpriseOperationsSection: React.FC<EnterpriseOperationsSectionProps> = ({
  role,
  stationId,
  stationName,
  stations,
  tanks,
  shifts,
  serviceBayTickets,
  transfers,
  vouchers,
  bulkOrders,
  evUtility,
  franchises,
  onCreateServiceBay,
  onCreateTransfer,
  onReceiveTransfer,
  onIssueVoucher,
  onRedeemVoucher,
  onCreateBulkOrder,
  onCreateEvUtility,
  onCreateFranchise,
  onRaiseSuggestedPo,
}) => {
  const [tab, setTab] = useState<'bay' | 'forecast' | 'transfers' | 'loyalty' | 'bulk' | 'ev'>('bay');
  const [modal, setModal] = useState<'bay' | 'transfer' | 'voucher' | 'bulk' | 'ev' | 'franchise' | null>(null);
  const canManage = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN';

  // Service Bay state
  const [bayCat, setBayCat] = useState<ServiceBayTicketItem['serviceCategory']>('CAR_WASH');
  const [bayPlate, setBayPlate] = useState('LT-');
  const [bayCust, setBayCust] = useState('');
  const [bayTech, setBayTech] = useState('Tech. Rodrigue');
  const [bayAmt, setBayAmt] = useState('15000');
  const [bayPay, setBayPay] = useState<ServiceBayTicketItem['paymentMethod']>('CASH');

  // Transfer state
  const [trfToStation, setTrfToStation] = useState(stations[1]?.id ?? stations[0]?.id ?? 'st_bastos');
  const [trfGrade, setTrfGrade] = useState<FuelGrade>('GASOIL');
  const [trfLitres, setTrfLitres] = useState('5000');
  const [trfSeal, setTrfSeal] = useState('SEAL-CM-');
  const [trfPlate, setTrfPlate] = useState('LT-884-TK');
  const [trfDriver, setTrfDriver] = useState('Ibrahim Souley');

  // Voucher state
  const [vchName, setVchName] = useState('');
  const [vchPhone, setVchPhone] = useState('+237 6');
  const [vchAmt, setVchAmt] = useState('50000');

  // Bulk wholesale state
  const [blkCompany, setBlkCompany] = useState('');
  const [blkGrade, setBlkGrade] = useState<FuelGrade>('GASOIL');
  const [blkVol, setBlkVol] = useState('10000');
  const [blkPrice, setBlkPrice] = useState('795');
  const [blkTruck, setBlkTruck] = useState('TRK-OPF-01 (24kL)');
  const [blkDriver, setBlkDriver] = useState('Moussa Bello');
  const [blkDest, setBlkDest] = useState('');

  // EV & Utility state
  const [evType, setEvType] = useState<EvUtilityReadingItem['meterType']>('EV_CHARGER_SESSION');
  const [evMeter, setEvMeter] = useState('CCS2-DC-60kW Bay #1');
  const [evQty, setEvQty] = useState('35');
  const [evAmt, setEvAmt] = useState('12250');

  // Franchise state
  const [frnDealer, setFrnDealer] = useState('');
  const [frnModel, setFrnModel] = useState<FranchiseAgreementItem['operatingModel']>('CODO');
  const [frnRoyalty, setFrnRoyalty] = useState('9.5');
  const [frnTarget, setFrnTarget] = useState('200000');
  const [frnRenewal, setFrnRenewal] = useState('2028-12-31');

  // M40 Fuel Demand & Replenishment Forecasting per tank
  const forecastRows = tanks.map((tk) => {
    const gradeLitres = shifts
      .filter((s) => s.status === 'CLOSED' && s.grade === tk.grade)
      .reduce((acc, s) => acc + s.litresSold, 0);
    const dailyBurn = Math.max(850, Math.round(gradeLitres / 7));
    const daysOfCover = Number((tk.bookVolumeLitres / dailyBurn).toFixed(1));
    const ullage = Math.max(0, tk.capacityLitres - tk.bookVolumeLitres);
    const reorderQty = Math.max(5000, Math.round((ullage * 0.85) / 500) * 500);
    const risk = daysOfCover < 4 ? 'CRITICAL' : daysOfCover < 8 ? 'REORDER_NOW' : 'HEALTHY';
    return { tank: tk, dailyBurn, daysOfCover, ullage, reorderQty, risk };
  });

  const bayTotalFcfa = serviceBayTickets.reduce((s, t) => s + t.amountFcfa, 0);
  const bulkTotalFcfa = bulkOrders.reduce((s, b) => s + b.totalFcfa, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="font-mono text-[11px] font-bold text-amber-700 tracking-wide">
              M18 SERVICE BAY · M40 FORECASTING · M25 TRANSFERS · M23 LOYALTY · M24/M52 BULK · M51/M53 EV &amp; DEALERS
            </div>
            <h2 className="font-display text-xl font-bold text-slate-950 mt-0.5">
              Ancillary Services, Replenishment, Logistics &amp; Network Operations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete commercial station revenue streams, automated fuel days-of-cover forecasting, inter-station tanker transfers, loyalty vouchers &amp; EV/franchise management.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModal('bay')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> New Service Bay Ticket
            </button>
            <button
              type="button"
              onClick={() => setModal('voucher')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Issue Fuel Voucher
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setModal('transfer')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Dispatch Inter-Station Transfer
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'bay', label: `Car Wash & Service Bay (${serviceBayTickets.length})`, icon: Car },
              { id: 'forecast', label: `Demand Forecasting (${forecastRows.filter((r) => r.risk !== 'HEALTHY').length} Alerts)`, icon: TrendingUp },
              { id: 'transfers', label: `Inter-Station Transfers (${transfers.length})`, icon: ArrowRightLeft },
              { id: 'loyalty', label: `Loyalty & Vouchers (${vouchers.length})`, icon: Gift },
              { id: 'bulk', label: `B2B Bulk & Tankers (${bulkOrders.length})`, icon: Truck },
              { id: 'ev', label: `EV / Utilities & Franchises (${evUtility.length + franchises.length})`, icon: Zap },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  tab === t.id
                    ? 'bg-[#0F172A] text-white border-[#0F172A]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: CAR WASH & SERVICE BAY POS (M18) */}
      {tab === 'bay' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Car Wash, Lube Pit &amp; Service Bay POS
              </h3>
              <p className="text-xs text-slate-500">
                Ancillary bay revenue posted directly with 80mm thermal receipts · Total: <span className="font-mono font-bold text-slate-900">{formatFcfa(bayTotalFcfa)}</span>
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Service Category</th>
                  <th className="px-4 py-3">Vehicle &amp; Customer</th>
                  <th className="px-4 py-3">Technician</th>
                  <th className="px-4 py-3">Tender</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {serviceBayTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-500">{formatShortDate(t.createdAt)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{t.serviceCategory.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-slate-950">{t.vehiclePlate}</span> · {t.customerName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{t.technicianName}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{t.paymentMethod}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{formatFcfa(t.amountFcfa)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          printServiceBayThermalSlip({
                            stationName,
                            ticketId: t.id,
                            serviceCategory: t.serviceCategory,
                            vehiclePlate: t.vehiclePlate,
                            customerName: t.customerName,
                            technicianName: t.technicianName,
                            amountFcfa: t.amountFcfa,
                            paymentMethod: t.paymentMethod,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
                      >
                        <Printer className="w-3 h-3" /> 80mm
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FUEL DEMAND PLANNING & REPLENISHMENT FORECASTING (M40) */}
      {tab === 'forecast' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-900">
              Tank Days-of-Cover, Burn Rate &amp; Automated Replenishment PO Engine
            </h3>
            <p className="text-xs text-slate-500">
              Calculates daily consumption velocity, remaining tank ullage, and triggers 1-click supplier Purchase Orders before stockouts occur.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-3">Underground Tank</th>
                  <th className="px-4 py-3 text-right">Book Stock</th>
                  <th className="px-4 py-3 text-right">Available Ullage</th>
                  <th className="px-4 py-3 text-right">Burn Rate (L/day)</th>
                  <th className="px-4 py-3 text-right">Days of Cover</th>
                  <th className="px-4 py-3">Risk State</th>
                  <th className="px-4 py-3 text-right">Suggested Replenishment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {forecastRows.map((r) => (
                  <tr key={r.tank.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{r.tank.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{gradeLabel(r.tank.grade)}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatLitres(r.tank.bookVolumeLitres)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{formatLitres(r.ullage)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{formatLitres(r.dailyBurn)}/d</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{r.daysOfCover} days</td>
                    <td className="px-4 py-3 font-mono font-bold">
                      <span className={r.risk === 'CRITICAL' ? 'text-red-600' : r.risk === 'REORDER_NOW' ? 'text-amber-700' : 'text-emerald-700'}>
                        {r.risk.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onRaiseSuggestedPo(r.tank.grade, r.reorderQty, r.tank.unitCostFcfa)}
                          className="px-2.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold"
                        >
                          Raise PO ({formatLitres(r.reorderQty)})
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INTER-STATION TRANSFERS (M25) */}
      {tab === 'transfers' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-900">
              Inter-Station Sealed Tanker Transfers &amp; Custody Reconciliation
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-3">Manifest #</th>
                  <th className="px-4 py-3">Route (From → To)</th>
                  <th className="px-4 py-3">Grade &amp; Seal #</th>
                  <th className="px-4 py-3 text-right">Dispatched</th>
                  <th className="px-4 py-3 text-right">Received</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions &amp; PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {transfers.map((trf) => (
                  <tr key={trf.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{trf.id}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900">{trf.fromStationName}</span> →{' '}
                      <span className="font-semibold text-amber-700">{trf.toStationName}</span>
                      <div className="text-slate-500 font-mono text-[11px]">{trf.tankerPlate} · {trf.driverName}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{trf.fuelGrade} · {trf.sealNumber}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{formatLitres(trf.dispatchedLitres)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {trf.receivedLitres !== null ? formatLitres(trf.receivedLitres) : 'In Transit'}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">{trf.status}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {trf.status === 'IN_TRANSIT' && canManage && (
                          <button
                            type="button"
                            onClick={() => onReceiveTransfer(trf.id, trf.dispatchedLitres)}
                            className="px-2 py-1 rounded bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-semibold"
                          >
                            Confirm Receipt
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => printInterstationTransferPdf(trf)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
                        >
                          <Printer className="w-3 h-3" /> Manifest PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LOYALTY & PREPAID VOUCHERS (M23) */}
      {tab === 'loyalty' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-900">
              Customer Loyalty Points &amp; Prepaid Fuel Gift Vouchers
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-3">Voucher Code</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Issued</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Loyalty Pts</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Redeem &amp; 80mm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {vouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-amber-700">{v.voucherCode}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{v.customerName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{v.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatFcfa(v.issuedFcfa)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{formatFcfa(v.balanceFcfa)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">{v.loyaltyPoints} pts</td>
                    <td className="px-4 py-3 font-mono font-semibold">{v.status}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {v.balanceFcfa > 0 && (
                          <button
                            type="button"
                            onClick={() => onRedeemVoucher(v.id, Math.min(10000, v.balanceFcfa))}
                            className="px-2 py-1 rounded bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-semibold"
                          >
                            Redeem 10k
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            printPrepaidVoucherThermalSlip({
                              stationName,
                              voucherCode: v.voucherCode,
                              customerName: v.customerName,
                              issuedFcfa: v.issuedFcfa,
                              balanceFcfa: v.balanceFcfa,
                              loyaltyPoints: v.loyaltyPoints,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
                        >
                          <Printer className="w-3 h-3" /> 80mm
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: B2B BULK WHOLESALE & OWN-FLEET TANKERS (M24 & M52) */}
      {tab === 'bulk' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                B2B Bulk Wholesale Fuel Orders &amp; Own-Fleet Tanker Route Dispatch
              </h3>
              <p className="text-xs text-slate-500">
                Industrial/generator bulk deliveries · Total Booked: <span className="font-mono font-bold text-slate-900">{formatFcfa(bulkTotalFcfa)}</span>
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setModal('bulk')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> New Bulk Tanker Order
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">B2B Customer &amp; Destination</th>
                  <th className="px-4 py-3">Tanker &amp; Driver</th>
                  <th className="px-4 py-3 text-right">Volume</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {bulkOrders.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{b.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{b.customerCompany}</div>
                      <div className="text-slate-500">{b.deliveryDestination}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {b.tankerTruckCode} · <span className="font-sans text-slate-700">{b.driverName}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {formatLitres(b.volumeLitres)} ({b.fuelGrade})
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{formatFcfa(b.totalFcfa)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{b.status.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: EV CHARGING, SOLAR & FRANCHISE DEALERS (M53 & M51) */}
      {tab === 'ev' && (
        <div className={`grid grid-cols-1 ${(role === 'OWNER' || role === 'GROUP_CFO' || role === 'PLATFORM_ADMIN') ? 'xl:grid-cols-2' : ''} gap-6`}>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600" /> EV Charging, Solar &amp; Generator Utilities (M53)
                </h3>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setModal('ev')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Meter
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Charger / Meter</th>
                    <th className="px-4 py-2.5 text-right">Quantity</th>
                    <th className="px-4 py-2.5 text-right">Value (FCFA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {evUtility.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2.5 font-mono font-semibold">{e.meterType.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2.5 text-slate-700">{e.connectorOrMeter}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">
                        {e.quantityUnit} {e.unitLabel}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">{formatFcfa(e.revenueOrCostFcfa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(role === 'OWNER' || role === 'GROUP_CFO' || role === 'PLATFORM_ADMIN') && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-900" /> Franchise &amp; Dealer Operations (M51)
                </h3>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setModal('franchise')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Dealer
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th className="px-4 py-2.5">Dealer / Model</th>
                      <th className="px-4 py-2.5 text-right">Royalty/L</th>
                      <th className="px-4 py-2.5 text-right">Target Vol.</th>
                      <th className="px-4 py-2.5 text-right">Audit Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {franchises.map((f) => (
                      <tr key={f.id}>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-slate-950">{f.dealerName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{f.operatingModel} · Renews {f.renewalDate}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{f.royaltyFcfaPerLitre} FCFA</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatLitres(f.monthlyTargetLitres)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">{f.complianceScorePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <FormModal open={modal === 'bay'} title="New Car Wash / Service Bay Ticket" subtitle="Logs bay service and prints an 80mm receipt." onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!bayPlate.trim() || !bayCust.trim()) return;
            onCreateServiceBay({
              stationId,
              serviceCategory: bayCat,
              vehiclePlate: bayPlate.trim().toUpperCase(),
              customerName: bayCust.trim(),
              technicianName: bayTech.trim(),
              amountFcfa: Number(bayAmt) || 5000,
              paymentMethod: bayPay,
            });
            setBayCust('');
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Service Category</label>
              <select value={bayCat} onChange={(e) => setBayCat(e.target.value as ServiceBayTicketItem['serviceCategory'])} className="opes-input">
                <option value="CAR_WASH">Full Car Wash</option>
                <option value="OIL_CHANGE">Oil &amp; Filter Change</option>
                <option value="TIRE_SERVICE">Tire &amp; Alignment</option>
                <option value="DIAGNOSTIC">Engine Diagnostic</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Vehicle Plate</label>
              <input value={bayPlate} onChange={(e) => setBayPlate(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Customer Name</label>
              <input value={bayCust} onChange={(e) => setBayCust(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Technician</label>
              <input value={bayTech} onChange={(e) => setBayTech(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Amount (FCFA)</label>
              <input type="number" min={500} value={bayAmt} onChange={(e) => setBayAmt(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Payment Tender</label>
              <select value={bayPay} onChange={(e) => setBayPay(e.target.value as ServiceBayTicketItem['paymentMethod'])} className="opes-input">
                <option value="CASH">Cash</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="CARD">Bank Card</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Record Bay Sale</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'voucher'} title="Issue Prepaid Fuel & Loyalty Voucher" subtitle="Generates a unique redeemable fuel code and credits loyalty points." onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!vchName.trim()) return;
            onIssueVoucher({
              stationId,
              customerName: vchName.trim(),
              customerPhone: vchPhone.trim(),
              issuedFcfa: Number(vchAmt) || 25000,
            });
            setVchName('');
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="opes-label">Customer / Organization Name</label>
              <input value={vchName} onChange={(e) => setVchName(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Phone / WhatsApp</label>
              <input value={vchPhone} onChange={(e) => setVchPhone(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Prepaid Value (FCFA)</label>
              <input type="number" min={1000} value={vchAmt} onChange={(e) => setVchAmt(e.target.value)} className="opes-input font-mono" required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">Issue Voucher Code</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'transfer'} title="Dispatch Sealed Inter-Station Transfer" subtitle="Moves bulk fuel between network stations with tanker seal verification." onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const dest = stations.find((s) => s.id === trfToStation) ?? stations[0];
            onCreateTransfer({
              fromStationId: stationId,
              fromStationName: stationName,
              toStationId: dest?.id ?? 'st_bastos',
              toStationName: dest?.name ?? 'Destination Branch',
              fuelGrade: trfGrade,
              dispatchedLitres: Number(trfLitres) || 5000,
              sealNumber: trfSeal.trim() || `SEAL-${Date.now().toString().slice(-5)}`,
              tankerPlate: trfPlate.trim(),
              driverName: trfDriver.trim(),
            });
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Destination Station</label>
              <select value={trfToStation} onChange={(e) => setTrfToStation(e.target.value)} className="opes-input">
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Fuel Grade</label>
              <select value={trfGrade} onChange={(e) => setTrfGrade(e.target.value as FuelGrade)} className="opes-input">
                {ALL_FUEL_GRADES.map((g) => (
                  <option key={g} value={g}>{gradeLabel(g)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Dispatched Litres</label>
              <input type="number" min={500} value={trfLitres} onChange={(e) => setTrfLitres(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Tanker Seal #</label>
              <input value={trfSeal} onChange={(e) => setTrfSeal(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Tanker Plate</label>
              <input value={trfPlate} onChange={(e) => setTrfPlate(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Driver Name</label>
              <input value={trfDriver} onChange={(e) => setTrfDriver(e.target.value)} className="opes-input" required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">Dispatch Transfer</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'bulk'} title="Schedule B2B Bulk Wholesale Tanker Delivery" subtitle="Creates an industrial bulk order and assigns an own-fleet delivery tanker." onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!blkCompany.trim()) return;
            onCreateBulkOrder({
              stationId,
              customerCompany: blkCompany.trim(),
              fuelGrade: blkGrade,
              volumeLitres: Number(blkVol) || 10000,
              unitPriceFcfa: Number(blkPrice) || 795,
              tankerTruckCode: blkTruck.trim(),
              driverName: blkDriver.trim(),
              deliveryDestination: blkDest.trim() || 'Client Site',
            });
            setBlkCompany('');
            setBlkDest('');
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="opes-label">B2B Customer Company</label>
              <input value={blkCompany} onChange={(e) => setBlkCompany(e.target.value)} placeholder="e.g. ENEO Industrial Plant" className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Fuel Grade</label>
              <select value={blkGrade} onChange={(e) => setBlkGrade(e.target.value as FuelGrade)} className="opes-input">
                {ALL_FUEL_GRADES.map((g) => (
                  <option key={g} value={g}>{gradeLabel(g)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Volume (Litres)</label>
              <input type="number" min={500} value={blkVol} onChange={(e) => setBlkVol(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Wholesale Unit Price (FCFA/L)</label>
              <input type="number" min={100} value={blkPrice} onChange={(e) => setBlkPrice(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Tanker Truck</label>
              <input value={blkTruck} onChange={(e) => setBlkTruck(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Driver</label>
              <input value={blkDriver} onChange={(e) => setBlkDriver(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Delivery Site</label>
              <input value={blkDest} onChange={(e) => setBlkDest(e.target.value)} placeholder="Industrial zone address" className="opes-input" required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Create Bulk Order</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'ev'} title="Log EV Charger Session or Utility Meter" subtitle="Tracks EV kWh revenue, canopy solar yield, grid electricity, or standby generator diesel." onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreateEvUtility({
              stationId,
              meterType: evType,
              connectorOrMeter: evMeter.trim(),
              quantityUnit: Number(evQty) || 0,
              unitLabel: evType === 'GENERATOR_DIESEL' ? 'Litres' : 'kWh',
              revenueOrCostFcfa: Number(evAmt) || 0,
            });
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Meter Type</label>
              <select value={evType} onChange={(e) => setEvType(e.target.value as EvUtilityReadingItem['meterType'])} className="opes-input">
                <option value="EV_CHARGER_SESSION">EV Charger Session (kWh)</option>
                <option value="SOLAR_GENERATION">Solar Generation (kWh)</option>
                <option value="GRID_ELECTRICITY">Grid Electricity Utility (kWh)</option>
                <option value="GENERATOR_DIESEL">Generator Diesel Consumption (L)</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Connector / Meter Label</label>
              <input value={evMeter} onChange={(e) => setEvMeter(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Quantity ({evType === 'GENERATOR_DIESEL' ? 'Litres' : 'kWh'})</label>
              <input type="number" step="0.1" value={evQty} onChange={(e) => setEvQty(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Revenue / Utility Cost (FCFA)</label>
              <input type="number" min={0} value={evAmt} onChange={(e) => setEvAmt(e.target.value)} className="opes-input font-mono" required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">Save Meter Reading</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'franchise'} title="Register Franchise / Dealer Agreement" subtitle="Configures COCO / CODO / DODO dealer royalty per litre and compliance scoring." onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!frnDealer.trim()) return;
            onCreateFranchise({
              stationId,
              dealerName: frnDealer.trim(),
              operatingModel: frnModel,
              royaltyFcfaPerLitre: Number(frnRoyalty) || 0,
              monthlyTargetLitres: Number(frnTarget) || 150000,
              complianceScorePct: 95,
              renewalDate: frnRenewal,
            });
            setFrnDealer('');
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="opes-label">Dealer / Franchise Partner Name</label>
              <input value={frnDealer} onChange={(e) => setFrnDealer(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Operating Model</label>
              <select value={frnModel} onChange={(e) => setFrnModel(e.target.value as FranchiseAgreementItem['operatingModel'])} className="opes-input">
                <option value="COCO">COCO (Company Owned / Operated)</option>
                <option value="CODO">CODO (Company Owned / Dealer Operated)</option>
                <option value="DODO">DODO (Dealer Owned / Dealer Operated)</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Royalty Levy (FCFA / Litre)</label>
              <input type="number" step="0.5" value={frnRoyalty} onChange={(e) => setFrnRoyalty(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Monthly Target Volume (Litres)</label>
              <input type="number" value={frnTarget} onChange={(e) => setFrnTarget(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Contract Renewal Date</label>
              <input type="date" value={frnRenewal} onChange={(e) => setFrnRenewal(e.target.value)} className="opes-input font-mono" required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Save Dealer Agreement</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
