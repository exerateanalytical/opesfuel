import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Circle,
  Cloud,
  CloudOff,
  CreditCard,
  Fuel,
  Gauge,
  Menu,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { INSTITUTIONAL_FUEL_CATALOG } from '../../api/opesfuelClient';
import { canAccessSection, canPerformAction } from '../../auth/auth0';
import { formatFcfa, formatLitres, gradeLabel } from '../../domain/formatters';
import {
  AiSubscriptionState,
  Employee,
  FinancialReportBundle,
  FleetAccount,
  FuelGrade,
  FuelTank,
  InstitutionalSetupSelection,
  Pump,
  ShiftRecord,
  ShopItem,
  Station,
  UserRole,
} from '../../domain/types';

export type MobileShowcaseTab = 'shifts' | 'inventory' | 'fleet' | 'reports' | 'sync' | 'ai' | 'setup';

interface OfflineQueueEntry {
  id: string;
  idempotencyKey: string;
  label: string;
  endpoint: string;
  createdAt: string;
  execute: () => void;
}

interface MobileAppShowcaseProps {
  role?: UserRole;
  stations: Station[];
  activeStationId?: string;
  tanks: FuelTank[];
  pumps: Pump[];
  shifts: ShiftRecord[];
  employees: Employee[];
  fleetAccounts: FleetAccount[];
  shopItems: ShopItem[];
  report: FinancialReportBundle;
  aiSubscription: AiSubscriptionState;
  transportMode?: 'SPRING_BOOT_REMOTE' | 'OPENAPI_PREVIEW_ADAPTER';
  onOpenShift?: (stationId: string, pumpId: string, attendantId: string) => void;
  onCloseShift?: (
    shiftId: string,
    payload: {
      closingMeterLitres: number;
      cashFcfa: number;
      mobileMoneyFcfa: number;
      cardFcfa: number;
      fleetCreditFcfa: number;
    }
  ) => void;
  onRecordDipstick?: (tankId: string, measuredLitres: number) => void;
  onRecordVoucher?: (input: {
    accountId: string;
    stationId: string;
    vehiclePlate: string;
    driverName: string;
    grade: FuelGrade;
    litres: number;
  }) => void;
  onRecordShopSale?: (itemId: string, quantity: number, paymentMethod: 'CASH' | 'MOBILE_MONEY' | 'CARD') => void;
  onToggleAiSubscription?: (enable: boolean) => void;
  onRunInstitutionalSetup?: (
    stationId: string,
    selections: InstitutionalSetupSelection[],
    lubricantsPack?: { includeLubricants: boolean; oilBottlesQty: number; lpgCylindersQty: number }
  ) => void;
  onOpenConsole?: () => void;
}

export const MobileAppShowcase: React.FC<MobileAppShowcaseProps> = ({
  role,
  stations,
  activeStationId,
  tanks,
  pumps,
  shifts,
  employees,
  fleetAccounts,
  shopItems,
  report,
  aiSubscription,
  transportMode = 'OPENAPI_PREVIEW_ADAPTER',
  onOpenShift,
  onCloseShift,
  onRecordDipstick,
  onRecordVoucher,
  onRecordShopSale,
  onToggleAiSubscription,
  onRunInstitutionalSetup,
  onOpenConsole,
}) => {
  const canSeeTanks = !role || canAccessSection(role, 'inventory');
  const canSeeReports = !role || canPerformAction(role, 'VIEW_FINANCIALS');
  const canSeeAi = !role || canAccessSection(role, 'ai-assistant');
  const canToggleAiBilling = !role || canPerformAction(role, 'MANAGE_AI_ADDON');
  const canSeeSetup = !role || role === 'PLATFORM_ADMIN' || role === 'OWNER' || role === 'MANAGER';
  const [selectedStationId, setSelectedStationId] = useState<string>(
    activeStationId && activeStationId !== 'ALL' ? activeStationId : stations[0]?.id ?? ''
  );
  const [tab, setTab] = useState<MobileShowcaseTab>('shifts');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Master -> Detail drill-down navigation IDs
  const [detailPumpId, setDetailPumpId] = useState<string | null>(null);
  const [detailTankId, setDetailTankId] = useState<string | null>(null);
  const [detailFleetId, setDetailFleetId] = useState<string | null>(null);
  const [posSubTab, setPosSubTab] = useState<'fleet' | 'shop'>('fleet');

  // Offline-first synchronization queue
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueEntry[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [mobileToast, setMobileToast] = useState<string | null>(null);

  // Pump / Shift action states
  const [selectedAttendantId, setSelectedAttendantId] = useState(employees[0]?.id ?? '');
  const [closeLitresDelta, setCloseLitresDelta] = useState('420');
  const [closeCash, setCloseCash] = useState('250000');
  const [closeMoMo, setCloseMoMo] = useState('102800');

  // Tank dipstick state
  const [dipLitres, setDipLitres] = useState('');

  // Fleet voucher state
  const [voucherPlate, setVoucherPlate] = useState('LT-482-AK');
  const [voucherDriver, setVoucherDriver] = useState('Jean-Luc Fotso');
  const [voucherGrade, setVoucherGrade] = useState<FuelGrade>('GASOIL');
  const [voucherLitres, setVoucherLitres] = useState('120');

  // Shop POS state
  const [shopPayment, setShopPayment] = useState<'CASH' | 'MOBILE_MONEY' | 'CARD'>('CASH');

  // Institutional Fuel Setup drawer screen state
  const [setupRows, setSetupRows] = useState(() =>
    INSTITUTIONAL_FUEL_CATALOG.map((item) => ({
      selected: item.code === 'SUPER' || item.code === 'GASOIL',
      grade: item.code,
      label: item.label,
      tankName: item.tankName,
      capacityLitres: String(item.defaultCapacityLitres),
      openingLitres: String(item.defaultOpeningLitres),
      unitCostFcfa: String(item.defaultUnitCostFcfa),
      sellingPriceFcfa: String(item.defaultSellingPriceFcfa),
      nozzleCount: String(item.defaultNozzleCount),
    }))
  );

  useEffect(() => {
    if (activeStationId && activeStationId !== 'ALL') {
      setSelectedStationId(activeStationId);
    } else if (!selectedStationId && stations[0]?.id) {
      setSelectedStationId(stations[0].id);
    }
  }, [activeStationId, stations, selectedStationId]);

  const currentStation = useMemo(
    () => stations.find((s) => s.id === selectedStationId) ?? stations[0],
    [stations, selectedStationId]
  );

  const stationPumps = useMemo(
    () => pumps.filter((p) => !currentStation || p.stationId === currentStation.id),
    [pumps, currentStation]
  );
  const stationTanks = useMemo(
    () => tanks.filter((t) => !currentStation || t.stationId === currentStation.id),
    [tanks, currentStation]
  );
  const stationShifts = useMemo(
    () => shifts.filter((s) => !currentStation || s.stationId === currentStation.id),
    [shifts, currentStation]
  );
  const stationEmployees = useMemo(
    () => employees.filter((e) => !currentStation || e.stationId === currentStation.id),
    [employees, currentStation]
  );

  const detailPump = stationPumps.find((p) => p.id === detailPumpId) ?? null;
  const detailTank = stationTanks.find((t) => t.id === detailTankId) ?? null;
  const detailFleet = fleetAccounts.find((f) => f.id === detailFleetId) ?? null;

  const showToast = (msg: string) => {
    setMobileToast(msg);
    window.setTimeout(() => setMobileToast(null), 3500);
  };

  const dispatchOrQueue = (label: string, endpoint: string, execute: () => void) => {
    const key = `idemp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    if (simulateOffline) {
      setOfflineQueue((prev) => [
        {
          id: `q_${Date.now().toString(36)}`,
          idempotencyKey: key,
          label,
          endpoint,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          execute,
        },
        ...prev,
      ]);
      showToast(`Saved offline (${key.slice(0, 12)}) — will sync when online.`);
    } else {
      execute();
      setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      showToast(`Synced live: ${label}`);
    }
  };

  const flushQueue = () => {
    if (offlineQueue.length === 0) return;
    const items = [...offlineQueue].reverse();
    items.forEach((entry) => entry.execute());
    setOfflineQueue([]);
    setSimulateOffline(false);
    setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    showToast(`Synchronized ${items.length} offline operation(s) cleanly with zero duplicates.`);
  };

  const switchTab = (next: MobileShowcaseTab) => {
    setTab(next);
    setDetailPumpId(null);
    setDetailTankId(null);
    setDetailFleetId(null);
    setDrawerOpen(false);
  };

  const openShiftsCount = stationShifts.filter((s) => s.status === 'OPEN').length;
  const todayLitres = stationShifts.reduce((sum, s) => sum + s.litresSold, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner — Pure White + Obsidian Navy */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl icon-glass flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-700">
              React Native Expo · Offline-First Forecourt Companion
            </div>
            <h2 className="font-display text-xl font-bold text-slate-950 mt-0.5">
              OpesFuel Mobile App — Clean Master-Detail &amp; Offline Sync
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Tap any pump, tank, or fleet client inside the phone below to explore dedicated detail pages, toggle Offline Mode to queue field readings with conflict-free UUID keys, and sync live to the ledger.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSimulateOffline((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
              simulateOffline
                ? 'border-amber-600 bg-white text-amber-800'
                : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
            }`}
          >
            {simulateOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            {simulateOffline ? 'Offline Mode Active' : 'Simulate Offline'}
          </button>
          {onOpenConsole && (
            <button
              type="button"
              onClick={onOpenConsole}
              className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Open Full Web Console
            </button>
          )}
        </div>
      </div>

      {/* Main Split: Interactive Phone Frame (Left) + Clear Architecture & Controls Guide (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Clean, Spacious Phone Frame */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-[392px] rounded-[2.25rem] border-[6px] border-[#0F172A] bg-white shadow-xl overflow-hidden flex flex-col h-[760px]">
            {/* App Top Bar */}
            <div className="bg-[#0F172A] text-white px-4 py-3.5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open mobile menu"
                  className="p-2 rounded-lg hover:bg-slate-800 text-white shrink-0"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-white truncate">
                    {currentStation?.name ?? 'OpesFuel Station'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {currentStation?.city ?? 'Douala'} · Synced {lastSyncedAt}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => switchTab('sync')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-mono font-semibold shrink-0 border ${
                  simulateOffline
                    ? 'border-amber-500 text-amber-300 bg-slate-900'
                    : 'border-slate-700 text-slate-200 bg-slate-800'
                }`}
              >
                {simulateOffline ? <CloudOff className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
                <span>{offlineQueue.length > 0 ? `${offlineQueue.length} Q` : simulateOffline ? 'OFF' : 'LIVE'}</span>
              </button>
            </div>

            {/* Mobile Toast Banner */}
            {mobileToast && (
              <div className="px-4 py-2.5 bg-slate-900 text-white text-xs font-medium border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
                <span className="truncate">{mobileToast}</span>
                <button type="button" onClick={() => setMobileToast(null)} className="text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Slide-Over Hamburger Drawer */}
            {drawerOpen && (
              <div className="absolute inset-0 z-30 flex">
                <div className="w-72 bg-[#0F172A] text-white h-full flex flex-col p-5 space-y-5 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <div className="font-display text-base font-bold text-white">OpesFuel Mobile</div>
                      <div className="text-[11px] text-slate-400">
                        {transportMode === 'SPRING_BOOT_REMOTE' ? 'Connected to Live API' : 'Interactive Forecourt App'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                      aria-label="Close drawer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Station Switcher (Locked when single-station assigned) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Active Petrol Station
                    </label>
                    {stations.length <= 1 ? (
                      <div className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-semibold">
                        {currentStation ? `${currentStation.name} (${currentStation.city})` : 'Assigned Station'}
                      </div>
                    ) : (
                      <select
                        value={currentStation?.id ?? ''}
                        onChange={(e) => {
                          setSelectedStationId(e.target.value);
                          setDetailPumpId(null);
                          setDetailTankId(null);
                        }}
                        className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                      >
                        {stations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.city})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Drawer Navigation Links (Strictly RBAC Filtered) */}
                  <div className="space-y-1.5 flex-1">
                    {[
                      { id: 'shifts' as const, label: 'Forecourt & Shifts', icon: Fuel, allowed: true },
                      { id: 'inventory' as const, label: 'Underground Tanks', icon: Gauge, allowed: canSeeTanks },
                      { id: 'fleet' as const, label: 'Fleet Credit & Shop POS', icon: CreditCard, allowed: true },
                      { id: 'reports' as const, label: 'Daily Reports & P&L', icon: TrendingUp, allowed: canSeeReports },
                      { id: 'sync' as const, label: `Offline Sync Queue (${offlineQueue.length})`, icon: RefreshCw, allowed: true },
                      { id: 'setup' as const, label: 'Fuel Grade Setup', icon: Wrench, allowed: canSeeSetup },
                      { id: 'ai' as const, label: 'AI Station Copilot', icon: Sparkles, allowed: canSeeAi },
                    ]
                      .filter((item) => item.allowed)
                      .map((item) => {
                        const Icon = item.icon;
                        const active = tab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => switchTab(item.id)}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                              active ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                  </div>

                  <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-300 shrink-0" />
                    <span>Zero-duplicate UUID offline sync</span>
                  </div>
                </div>
                <div className="flex-1 bg-slate-950/50" onClick={() => setDrawerOpen(false)} />
              </div>
            )}

            {/* Main Scrollable Screen Body — Pure White Canvas */}
            <div className="flex-1 overflow-y-auto bg-white p-4 space-y-4">
              {/* =================================================================
                  TAB 1: SHIFTS (Master List + Pump Detail Drill-Down)
                 ================================================================= */}
              {tab === 'shifts' && !detailPump && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500 font-medium">Active Shifts</div>
                      <div className="font-mono text-xl font-bold text-slate-950 mt-1">
                        {openShiftsCount} / {stationPumps.length}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500 font-medium">Dispensed Volume</div>
                      <div className="font-mono text-xl font-bold text-slate-950 mt-1">
                        {formatLitres(todayLitres)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <h3 className="font-display text-sm font-bold text-slate-950">Forecourt Pumps</h3>
                    <span className="text-[11px] text-slate-500">Tap a pump for details</span>
                  </div>

                  <div className="space-y-3">
                    {stationPumps.map((pump) => {
                      const activeShift = stationShifts.find((s) => s.pumpId === pump.id && s.status === 'OPEN');
                      return (
                        <button
                          key={pump.id}
                          type="button"
                          onClick={() => {
                            setDetailPumpId(pump.id);
                            if (activeShift) {
                              const expected = Math.round(420 * pump.unitPriceFcfa);
                              setCloseLitresDelta('420');
                              setCloseCash(String(Math.round(expected * 0.7)));
                              setCloseMoMo(String(expected - Math.round(expected * 0.7)));
                            }
                          }}
                          className="w-full text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-400 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-slate-950">{pump.code}</span>
                              <span className="text-xs text-slate-600">{gradeLabel(pump.grade)}</span>
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {activeShift ? `Attendant: ${activeShift.attendantName}` : 'Idle — Ready to open shift'}
                            </div>
                            <div className="font-mono text-[11px] text-slate-700">
                              Meter: {formatLitres(pump.totalizerLitres)} · {formatFcfa(pump.unitPriceFcfa)}/L
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                activeShift
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {activeShift ? 'OPEN' : 'IDLE'}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Pump Detail Page */}
              {tab === 'shifts' && detailPump && (() => {
                const openShift = stationShifts.find((s) => s.pumpId === detailPump.id && s.status === 'OPEN');
                const deltaNum = Math.max(1, Number(closeLitresDelta) || 0);
                const closingMeterVal = detailPump.totalizerLitres + deltaNum;
                const expectedRev = Math.round(deltaNum * detailPump.unitPriceFcfa);
                const enteredTotal = (Number(closeCash) || 0) + (Number(closeMoMo) || 0);
                const variance = expectedRev - enteredTotal;

                return (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setDetailPumpId(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Pumps
                    </button>

                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display text-base font-bold text-slate-950">
                            Pump {detailPump.code}
                          </div>
                          <div className="text-xs text-slate-500">{gradeLabel(detailPump.grade)}</div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded font-mono text-[10px] font-bold ${
                            openShift ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {openShift ? 'SHIFT OPEN' : 'IDLE'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <div className="text-slate-500">Current Totalizer</div>
                          <div className="font-mono font-bold text-slate-950 mt-0.5">
                            {formatLitres(detailPump.totalizerLitres)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Unit Tariff</div>
                          <div className="font-mono font-bold text-slate-950 mt-0.5">
                            {formatFcfa(detailPump.unitPriceFcfa)} / L
                          </div>
                        </div>
                      </div>
                    </div>

                    {!openShift ? (
                      <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3.5">
                        <div className="font-display text-sm font-bold text-slate-950">Open New Pump Shift</div>
                        <div>
                          <label className="opes-label">Assign Attendant</label>
                          <select
                            value={selectedAttendantId}
                            onChange={(e) => setSelectedAttendantId(e.target.value)}
                            className="opes-input"
                          >
                            {stationEmployees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.fullName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!currentStation || !onOpenShift) return;
                            const attId = selectedAttendantId || stationEmployees[0]?.id || 'emp_01';
                            dispatchOrQueue(
                              `Open Shift on ${detailPump.code}`,
                              '/api/v1/forecourt/shifts/open',
                              () => onOpenShift(currentStation.id, detailPump.id, attId)
                            );
                          }}
                          className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                        >
                          Start Shift on {detailPump.code}
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3.5">
                        <div className="font-display text-sm font-bold text-slate-950">
                          Close &amp; Reconcile Shift ({openShift.attendantName})
                        </div>
                        <div>
                          <label className="opes-label">Litres Sold This Shift</label>
                          <input
                            type="number"
                            min={1}
                            value={closeLitresDelta}
                            onChange={(e) => setCloseLitresDelta(e.target.value)}
                            className="opes-input font-mono"
                          />
                          <div className="text-[11px] font-mono text-slate-500 mt-1">
                            Closing Meter: {formatLitres(closingMeterVal)} · Expected: {formatFcfa(expectedRev)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="opes-label">Cash (FCFA)</label>
                            <input
                              type="number"
                              min={0}
                              value={closeCash}
                              onChange={(e) => setCloseCash(e.target.value)}
                              className="opes-input font-mono"
                            />
                          </div>
                          <div>
                            <label className="opes-label">Mobile Money</label>
                            <input
                              type="number"
                              min={0}
                              value={closeMoMo}
                              onChange={(e) => setCloseMoMo(e.target.value)}
                              className="opes-input font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs py-2 border-t border-slate-100">
                          <span className="text-slate-600">Cash Variance</span>
                          <span
                            className={`font-mono font-bold ${
                              variance > 0 ? 'text-red-700' : 'text-emerald-700'
                            }`}
                          >
                            {variance === 0 ? '0 FCFA (Exact)' : formatFcfa(-variance)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!onCloseShift) return;
                            dispatchOrQueue(
                              `Close Shift ${detailPump.code} (${deltaNum} L)`,
                              `/api/v1/forecourt/shifts/${openShift.id}/close`,
                              () =>
                                onCloseShift(openShift.id, {
                                  closingMeterLitres: closingMeterVal,
                                  cashFcfa: Number(closeCash) || 0,
                                  mobileMoneyFcfa: Number(closeMoMo) || 0,
                                  cardFcfa: 0,
                                  fleetCreditFcfa: 0,
                                })
                            );
                            setDetailPumpId(null);
                          }}
                          className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                        >
                          Submit Closing Reading
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* =================================================================
                  TAB 2: TANKS (Master List + Tank Detail Drill-Down)
                 ================================================================= */}
              {tab === 'inventory' && !detailTank && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-slate-950">Underground Fuel Tanks</h3>
                    <span className="text-[11px] text-slate-500">Tap to dipstick</span>
                  </div>
                  <div className="space-y-3">
                    {stationTanks.map((tank) => {
                      const pct = Math.min(100, Math.round((tank.bookVolumeLitres / Math.max(1, tank.capacityLitres)) * 100));
                      return (
                        <button
                          key={tank.id}
                          type="button"
                          onClick={() => {
                            setDetailTankId(tank.id);
                            setDipLitres(String(tank.bookVolumeLitres));
                          }}
                          className="w-full text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-400 transition-colors space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-sm text-slate-950">{tank.name}</div>
                              <div className="text-xs text-slate-500">{gradeLabel(tank.grade)}</div>
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-900">{pct}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                pct < 20 ? 'bg-red-600' : pct < 40 ? 'bg-amber-600' : 'bg-[#0F172A]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
                            <span>Book: {formatLitres(tank.bookVolumeLitres)}</span>
                            <span className={Math.abs(tank.varianceLitres) > 100 ? 'text-red-700 font-bold' : ''}>
                              Delta: {tank.varianceLitres > 0 ? `+${tank.varianceLitres}` : tank.varianceLitres} L
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Tank Detail Page */}
              {tab === 'inventory' && detailTank && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setDetailTankId(null)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Tanks
                  </button>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="font-display text-base font-bold text-slate-950">{detailTank.name}</div>
                    <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-100">
                      <div>
                        <div className="text-slate-500">Book Stock</div>
                        <div className="font-mono font-bold text-slate-950 mt-0.5">
                          {formatLitres(detailTank.bookVolumeLitres)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Last Dipstick</div>
                        <div className="font-mono font-bold text-slate-950 mt-0.5">
                          {formatLitres(detailTank.lastDipLitres)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3.5">
                    <div className="font-display text-sm font-bold text-slate-950">Record Physical Dipstick</div>
                    <div>
                      <label className="opes-label">Measured Volume (Litres)</label>
                      <input
                        type="number"
                        min={0}
                        value={dipLitres}
                        onChange={(e) => setDipLitres(e.target.value)}
                        className="opes-input font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!onRecordDipstick) return;
                        const val = Number(dipLitres) || 0;
                        dispatchOrQueue(
                          `Dipstick ${detailTank.name}: ${val} L`,
                          `/api/v1/inventory/tanks/${detailTank.id}/dipstick`,
                          () => onRecordDipstick(detailTank.id, val)
                        );
                        setDetailTankId(null);
                      }}
                      className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                    >
                      Save Dipstick Calibration
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================================
                  TAB 3: POS (Fleet Credit Detail + Lube & Shop POS)
                 ================================================================= */}
              {tab === 'fleet' && !detailFleet && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setPosSubTab('fleet')}
                      className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                        posSubTab === 'fleet' ? 'bg-[#0F172A] text-white' : 'text-slate-600'
                      }`}
                    >
                      Fleet Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosSubTab('shop')}
                      className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                        posSubTab === 'shop' ? 'bg-[#0F172A] text-white' : 'text-slate-600'
                      }`}
                    >
                      Shop &amp; Lubes
                    </button>
                  </div>

                  {posSubTab === 'fleet' ? (
                    <div className="space-y-3">
                      {fleetAccounts.map((acc) => {
                        const pct = Math.min(100, Math.round((acc.balanceOwedFcfa / Math.max(1, acc.creditLimitFcfa)) * 100));
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setDetailFleetId(acc.id)}
                            className="w-full text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-400 transition-colors space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-sm text-slate-950 truncate">{acc.companyName}</span>
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            </div>
                            <div className="flex items-center justify-between text-xs font-mono text-slate-600">
                              <span>Bal: {formatFcfa(acc.balanceOwedFcfa)}</span>
                              <span>{pct}% limit</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#0F172A] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-700">Payment Method</span>
                        <select
                          value={shopPayment}
                          onChange={(e) => setShopPayment(e.target.value as 'CASH' | 'MOBILE_MONEY' | 'CARD')}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                        >
                          <option value="CASH">Cash</option>
                          <option value="MOBILE_MONEY">Mobile Money</option>
                          <option value="CARD">Card</option>
                        </select>
                      </div>
                      {shopItems.slice(0, 6).map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-slate-950 truncate">{item.name}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {formatFcfa(item.unitPriceFcfa)} · Stock: {item.stockQty}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!onRecordShopSale) return;
                              dispatchOrQueue(
                                `Shop Sale: 1x ${item.name}`,
                                '/api/v1/shop/sales',
                                () => onRecordShopSale(item.id, 1, shopPayment)
                              );
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0"
                          >
                            Sell 1
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fleet Account Detail Page */}
              {tab === 'fleet' && detailFleet && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setDetailFleetId(null)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Fleet Accounts
                  </button>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                    <div className="font-display text-base font-bold text-slate-950">{detailFleet.companyName}</div>
                    <div className="text-xs text-slate-500">
                      Available Credit: {formatFcfa(Math.max(0, detailFleet.creditLimitFcfa - detailFleet.balanceOwedFcfa))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3.5">
                    <div className="font-display text-sm font-bold text-slate-950">Issue Fleet Fuel Voucher</div>
                    <div>
                      <label className="opes-label">Vehicle Plate</label>
                      <input
                        type="text"
                        value={voucherPlate}
                        onChange={(e) => setVoucherPlate(e.target.value)}
                        className="opes-input font-mono"
                      />
                    </div>
                    <div>
                      <label className="opes-label">Driver Name</label>
                      <input
                        type="text"
                        value={voucherDriver}
                        onChange={(e) => setVoucherDriver(e.target.value)}
                        className="opes-input"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="opes-label">Fuel Grade</label>
                        <select
                          value={voucherGrade}
                          onChange={(e) => setVoucherGrade(e.target.value as FuelGrade)}
                          className="opes-input"
                        >
                          <option value="GASOIL">Diesel</option>
                          <option value="SUPER">Super</option>
                          <option value="KEROSENE">Kerosene</option>
                        </select>
                      </div>
                      <div>
                        <label className="opes-label">Litres</label>
                        <input
                          type="number"
                          min={1}
                          value={voucherLitres}
                          onChange={(e) => setVoucherLitres(e.target.value)}
                          className="opes-input font-mono"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!onRecordVoucher || !currentStation) return;
                        dispatchOrQueue(
                          `Fleet Voucher ${voucherPlate} (${voucherLitres} L)`,
                          '/api/v1/fleet/vouchers',
                          () =>
                            onRecordVoucher({
                              accountId: detailFleet.id,
                              stationId: currentStation.id,
                              vehiclePlate: voucherPlate.trim() || 'LT-482-AK',
                              driverName: voucherDriver.trim() || 'Driver',
                              grade: voucherGrade,
                              litres: Number(voucherLitres) || 50,
                            })
                        );
                        setDetailFleetId(null);
                      }}
                      className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                    >
                      Post Fleet Fuel Voucher
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================================
                  TAB 4: REPORTS (Clean Daily Financial Snapshot)
                 ================================================================= */}
              {tab === 'reports' && (
                <div className="space-y-3.5">
                  <h3 className="font-display text-sm font-bold text-slate-950">Live Station P&amp;L Snapshot</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">Total Revenue</div>
                      <div className="font-mono text-sm font-bold text-slate-950 mt-1">
                        {formatFcfa(report.totalRevenueFcfa)}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">Net Profit</div>
                      <div className="font-mono text-sm font-bold text-slate-950 mt-1">
                        {formatFcfa(report.netIncomeFcfa)}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">Cash + MoMo</div>
                      <div className="font-mono text-sm font-bold text-slate-950 mt-1">
                        {formatFcfa(report.cashOnHandFcfa + report.mobileMoneyClearingFcfa)}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">VAT Payable</div>
                      <div className="font-mono text-sm font-bold text-slate-950 mt-1">
                        {formatFcfa(report.vatPayableFcfa)}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">SYSCOHADA Trial Balance</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {report.trialBalanceBalanced ? 'BALANCED' : 'CHECK'}
                    </span>
                  </div>
                </div>
              )}

              {/* =================================================================
                  TAB 5: OFFLINE SYNC QUEUE SCREEN
                 ================================================================= */}
              {tab === 'sync' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-display text-sm font-bold text-slate-950">Offline Sync Engine</div>
                        <div className="text-[11px] text-slate-500">
                          {simulateOffline ? 'Offline — actions queued locally' : 'Online — real-time cloud sync'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSimulateOffline((v) => !v)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900"
                      >
                        {simulateOffline ? 'Go Online' : 'Go Offline'}
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={offlineQueue.length === 0}
                      onClick={flushQueue}
                      className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sync All Queued Actions ({offlineQueue.length})
                    </button>
                  </div>

                  {offlineQueue.length === 0 ? (
                    <div className="p-6 rounded-xl border border-slate-200 bg-white text-center space-y-1.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-700 mx-auto" />
                      <div className="text-xs font-semibold text-slate-900">All Forecourt Data Synchronized</div>
                      <p className="text-[11px] text-slate-500">
                        Toggle &ldquo;Go Offline&rdquo; above and close a shift or record a dipstick to test queued synchronization.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {offlineQueue.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="text-xs font-semibold text-slate-950">{item.label}</div>
                            <div className="font-mono text-[10px] text-slate-500 truncate">{item.endpoint}</div>
                            <div className="font-mono text-[10px] text-amber-700">
                              UUID: {item.idempotencyKey} · {item.createdAt}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOfflineQueue((prev) => prev.filter((x) => x.id !== item.id))}
                            aria-label="Discard queued item"
                            className="p-1.5 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* =================================================================
                  DRAWER SCREEN: FUEL GRADE SETUP
                 ================================================================= */}
              {tab === 'setup' && (
                <div className="space-y-3.5">
                  <div className="font-display text-sm font-bold text-slate-950">Station Fuel Setup</div>
                  <div className="space-y-2.5">
                    {setupRows.map((row, idx) => (
                      <div
                        key={row.grade}
                        className={`p-3.5 rounded-xl border bg-white space-y-2 ${
                          row.selected ? 'border-slate-900' : 'border-slate-200 opacity-70'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSetupRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
                            )
                          }
                          className="w-full flex items-center justify-between text-left"
                        >
                          <span className="text-xs font-bold text-slate-950">{row.label}</span>
                          {row.selected ? (
                            <CheckCircle2 className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        {row.selected && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="text-[10px] text-slate-500">Opening L</label>
                              <input
                                type="number"
                                value={row.openingLitres}
                                onChange={(e) =>
                                  setSetupRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, openingLitres: e.target.value } : r))
                                  )
                                }
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Price FCFA/L</label>
                              <input
                                type="number"
                                value={row.sellingPriceFcfa}
                                onChange={(e) =>
                                  setSetupRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, sellingPriceFcfa: e.target.value } : r))
                                  )
                                }
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs font-mono"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!onRunInstitutionalSetup || !currentStation) return;
                      const picked: InstitutionalSetupSelection[] = setupRows
                        .filter((r) => r.selected)
                        .map((r) => ({
                          grade: r.grade,
                          tankName: r.tankName,
                          capacityLitres: Number(r.capacityLitres) || 30000,
                          openingLitres: Number(r.openingLitres) || 10000,
                          unitCostFcfa: Number(r.unitCostFcfa) || 700,
                          sellingPriceFcfa: Number(r.sellingPriceFcfa) || 820,
                          nozzleCount: Number(r.nozzleCount) || 2,
                        }));
                      dispatchOrQueue(
                        `Sync ${picked.length} Fuel Grade(s)`,
                        `/api/v1/stations/${currentStation.id}/onboarding-setup`,
                        () => onRunInstitutionalSetup(currentStation.id, picked)
                      );
                    }}
                    className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                  >
                    Apply Fuel Setup
                  </button>
                </div>
              )}

              {/* =================================================================
                  DRAWER SCREEN: AI COPILOT
                 ================================================================= */}
              {tab === 'ai' && canSeeAi && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-bold text-slate-950">AI Station Copilot</span>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {aiSubscription.active ? 'ACTIVE' : 'PRO ADD-ON'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Detects unusual dipstick shrinkage, cash shortfalls, and predicts tank restock dates before run-outs.
                    </p>
                    {onToggleAiSubscription && canToggleAiBilling && (
                      <button
                        type="button"
                        onClick={() => onToggleAiSubscription(!aiSubscription.active)}
                        className="w-full py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold"
                      >
                        {aiSubscription.active ? 'Pause AI Copilot' : 'Activate AI Copilot'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Clean RBAC-Filtered Fixed Bottom Navigation Bar */}
            {(() => {
              const bottomTabs = [
                { id: 'shifts' as const, label: 'Shifts', icon: Fuel, allowed: true },
                { id: 'inventory' as const, label: 'Tanks', icon: Gauge, allowed: canSeeTanks },
                { id: 'fleet' as const, label: 'POS', icon: CreditCard, allowed: true },
                { id: 'reports' as const, label: 'Reports', icon: TrendingUp, allowed: canSeeReports },
                { id: 'sync' as const, label: 'Sync', icon: RefreshCw, allowed: true },
              ].filter((item) => item.allowed);
              const gridCols =
                bottomTabs.length === 3
                  ? 'grid-cols-3'
                  : bottomTabs.length === 4
                  ? 'grid-cols-4'
                  : 'grid-cols-5';
              return (
                <div className={`h-16 bg-white border-t border-slate-200 grid ${gridCols} shrink-0`}>
                  {bottomTabs.map((item) => {
                    const Icon = item.icon;
                    const active = tab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => switchTab(item.id)}
                        className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                          active ? 'text-amber-700' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {active && <span className="absolute top-0 inset-x-3 h-0.5 bg-amber-600 rounded-full" />}
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                        {item.id === 'sync' && offlineQueue.length > 0 && (
                          <span className="absolute top-1.5 right-3 min-w-[16px] h-4 px-1 rounded-full bg-amber-600 text-white font-mono text-[9px] font-bold flex items-center justify-center">
                            {offlineQueue.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Right Side: Clean UX & Workflow Overview */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-950">
                Built for Real Forecourts — Spacious, Uncramped &amp; Offline-First
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Pump attendants and station managers work outdoors in bright sunlight and areas with patchy mobile data. Every screen uses high-contrast Obsidian Navy typography on pure white with generous tap targets.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  title: 'Master → Detail Drill-Down',
                  desc: 'Clean summary cards open full detail pages for every Pump Shift, Underground Tank, and Corporate Fleet client — never cramped tables on a small screen.',
                },
                {
                  title: 'Conflict-Free Offline Sync Queue',
                  desc: 'When mobile internet drops, shift closings, dipstick readings, and fleet vouchers save to AsyncStorage with unique UUID Idempotency Keys and replay automatically.',
                },
                {
                  title: 'Hamburger Drawer + 5-Tab Bar',
                  desc: 'Instant thumb access to Shifts, Tanks, POS, Reports, and Sync Queue at the bottom, with Station Switching, Fuel Setup, and AI Copilot in the slide-over drawer.',
                },
                {
                  title: 'Real-Time Ledger Synchronization',
                  desc: 'Every action posted from Android or iOS updates tank book volumes, shift variance reports, and double-entry SYSCOHADA journals immediately.',
                },
              ].map((card) => (
                <div key={card.title} className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5">
                  <div className="font-display text-sm font-bold text-slate-950">{card.title}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
            <div className="font-display text-sm font-bold text-slate-950">
              Try Offline Synchronization Live
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 leading-relaxed">
              <li>Click <strong>Simulate Offline</strong> above (or inside the phone&rsquo;s <strong>Sync</strong> tab).</li>
              <li>Tap any Pump in <strong>Shifts</strong> or Tank in <strong>Tanks</strong> to open its Detail page and submit a reading.</li>
              <li>Open the <strong>Sync</strong> tab to inspect the queued operation with its unique UUID idempotency key.</li>
              <li>Tap <strong>Sync All Queued Actions</strong> — all queued events flush directly into the station&rsquo;s live accounting ledger.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
