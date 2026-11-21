import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Cpu,
  CreditCard,
  Database,
  Flame,
  Fuel,
  Gauge,
  Menu,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { INSTITUTIONAL_FUEL_CATALOG } from '../../api/opesfuelClient';
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
} from '../../domain/types';

export type MobileShowcaseTab = 'shifts' | 'inventory' | 'fleet' | 'reports' | 'ai' | 'setup';

interface OfflineQueueEntry {
  id: string;
  idempotencyKey: string;
  label: string;
  endpoint: string;
  createdAt: string;
  execute: () => void;
}

interface MobileAppShowcaseProps {
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
    payload: { closingMeterLitres: number; cashFcfa: number; mobileMoneyFcfa: number; cardFcfa: number; fleetCreditFcfa: number }
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

const SCREEN_GUIDE: Record<
  MobileShowcaseTab,
  {
    code: string;
    title: string;
    persona: string;
    endpoint: string;
    domainEvent: string;
    accountingImpact: string;
    stylingNotes: string[];
    howItWorks: string[];
  }
> = {
  shifts: {
    code: '01',
    title: 'Forecourt Shifts & Meter Reconciliation',
    persona: 'Pump Attendant & Forecourt Manager',
    endpoint: 'POST /api/v1/forecourt/shifts/{id}/close',
    domainEvent: 'ShiftClosedEvent',
    accountingImpact: 'DR 1010 Cash / 1020 MoMo · CR 4010 Revenue + 2200 VAT · DR 5010 COGS / CR 1200 Tank Asset',
    stylingNotes: [
      'High-contrast outdoor daylight card surface (#FFFFFF) on #F8FAFC background with 1px #E2E8F0 borders.',
      '44px+ touch hitboxes on all inputs and primary #D97706 amber CTA buttons for rapid thumb entry beside pumps.',
      'Numeric keypad enforcement for closing totalizer (Litres), Cash Safe (FCFA), and OM/MTN MoMo counts.',
    ],
    howItWorks: [
      'Select an active shift (or open a new shift on an idle dispenser).',
      'Enter the mechanical/digital closing totalizer reading and counted Cash + Mobile Money tenders.',
      'When connected to Java Spring Boot, submitting immediately closes the shift, deducts tank volume, and posts balanced ledger lines.',
      'When offline-queued mode is active, the command is stamped with a UUID Idempotency-Key and safely queued for sync.',
    ],
  },
  inventory: {
    code: '02',
    title: 'Underground Tanks & Physical Dipsticks',
    persona: 'Station Manager & Depot Supervisor',
    endpoint: 'POST /api/v1/inventory/dipsticks',
    domainEvent: 'DipstickVarianceFlaggedEvent (if |delta| > 100 L)',
    accountingImpact: 'Updates book vs. physical tank variance status and triggers low-stock (<20%) alerts',
    stylingNotes: [
      'Interactive tap-to-select tank rows highlight the active tank in warm amber tint (#FFFBEB border #D97706).',
      'Color-coded capacity fill bars & tabular Litres alignment prevent misreads during morning/evening checks.',
      'Instant variance feedback badge highlights shrinkage exceeding 100 Litres in crimson (#DC2626).',
    ],
    howItWorks: [
      'Tap any underground tank row to load its last measured physical dipstick baseline.',
      'Enter the new calibrated stick reading in Litres and tap Record Dipstick Check.',
      'Reconciles physical vs. book volume in real time and alerts management if variance exceeds 100 L.',
    ],
  },
  fleet: {
    code: '03',
    title: 'Corporate Fleet Credit & Shop POS',
    persona: 'Pump Attendant & Counter Cashier',
    endpoint: 'POST /api/v1/fleet/vouchers & POST /api/v1/shop/sales',
    domainEvent: 'FleetVoucherRecordedEvent / ShopSaleRecordedEvent',
    accountingImpact: 'DR 1100 Fleet AR (or 1020 MoMo for Lubricants/LPG) · CR 4010/4020 Revenue + 2200 VAT',
    stylingNotes: [
      'Touch-friendly 5-grade fuel selector pills (SUPER, GASOIL, KEROSENE, LPG_BULK, HEAVY_FUEL) in high-contrast #0F172A slate.',
      'Two clean single-purpose stacked cards separate postpaid corporate vehicle vouchers from lubricants & 12.5kg LPG counter sales.',
    ],
    howItWorks: [
      'Pick a corporate fleet account, enter vehicle plate, choose any of the 5 fuel grades, and enter Litres.',
      'Dynamic per-station grade tariff computes the exact FCFA charge and enforces corporate credit limits.',
      'Ring up OpesLube 5L motor oils or 12.5kg domestic gas refills directly via Cash or Mobile Money.',
    ],
  },
  reports: {
    code: '04',
    title: 'Live Owner Financial Report (FCFA)',
    persona: 'Station Owner & Chief Accountant',
    endpoint: 'GET /api/v1/accounting/reports?stationId={id}',
    domainEvent: 'CQRS Live Ledger Projection',
    accountingImpact: 'Real-time SYSCOHADA / IFRS P&L, Gross Margin, VAT Payable & Trial Balance Integrity',
    stylingNotes: [
      'Strict right-aligned tabular monospace typography for integer FCFA columns so hundreds of thousands and millions align vertically.',
      'Semantic #16A34A green profit line item anchored under a 1px hairline divider.',
    ],
    howItWorks: [
      'Aggregates every closed pump shift, fleet voucher, lubricant sale, delivery AP, and expense journal.',
      'Updates automatically whenever a field attendant closes a shift or flushes queued offline transactions.',
    ],
  },
  ai: {
    code: '05',
    title: 'Paid AI Copilot (Predictive Operations)',
    persona: 'Station Owner & Network Operations Director',
    endpoint: 'POST /api/v1/ai/analyze & POST /api/v1/ai/chat',
    domainEvent: 'AiCopilotSubscriptionUpdatedEvent',
    accountingImpact: 'Optional 25 000 FCFA/mo SaaS Add-On (Included Free on Network Enterprise)',
    stylingNotes: [
      'Signature deep slate (#0F172A) intelligence banner paired with #F59E0B amber Sparkles branding.',
      'Clear activation toggle separates paid subscription gating from live forecasting & conversational advisor cards.',
    ],
    howItWorks: [
      'Activate the Paid AI Copilot add-on cleanly from mobile or console.',
      'Run 30-day FCFA revenue and underground tank stockout day predictions grounded in live station reserves.',
      'Ask station-specific questions (e.g. which tank runs out first or how to reduce cash variance).',
    ],
  },
  setup: {
    code: '06',
    title: 'Onboarding & Institutional Fuel Setup',
    persona: 'Station Owner during Initial Commissioning',
    endpoint: 'POST /api/v1/stations/{id}/onboarding-setup',
    domainEvent: 'StationInstitutionalSetupEvent',
    accountingImpact: 'DR 1200 Opening Fuel Inventory · CR 3010 Owner Paid-In Capital (and syncs mobile/web)',
    stylingNotes: [
      '5-step live progress tracker with emerald #16A34A completed checkmarks and clear numeric step labels.',
      'Tick-box institutional fuel cards let operators check Diesel/Gasoil, Super, Kerosene, LPG Gaz, or Heavy Fuel and input Litres in seconds.',
    ],
    howItWorks: [
      'Tick the fuel grades carried at the petrol station and adjust tank capacity, opening Litres, and selling FCFA/L tariff.',
      'Include the Lubricants & 12.5kg Domestic Cooking Gas starter pack if desired.',
      'Tap Apply & Sync Station Modules to create tanks, nozzles, and opening capital journals across Mobile and Web Console.',
    ],
  },
};

export const MobileAppShowcase: React.FC<MobileAppShowcaseProps> = ({
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
  transportMode = 'SPRING_BOOT_REMOTE',
  onOpenShift,
  onCloseShift,
  onRecordDipstick,
  onRecordVoucher,
  onRecordShopSale,
  onToggleAiSubscription,
  onRunInstitutionalSetup,
  onOpenConsole,
}) => {
  const effectiveStation =
    stations.find((s) => s.id === activeStationId) ?? stations[0];
  const stationId = effectiveStation?.id ?? 'st_plateau';

  const stationTanks = useMemo(
    () => tanks.filter((t) => t.stationId === stationId || activeStationId === 'ALL'),
    [tanks, stationId, activeStationId]
  );
  const stationPumps = useMemo(
    () => pumps.filter((p) => p.stationId === stationId || activeStationId === 'ALL'),
    [pumps, stationId, activeStationId]
  );
  const stationShifts = useMemo(
    () => shifts.filter((s) => s.stationId === stationId || activeStationId === 'ALL'),
    [shifts, stationId, activeStationId]
  );
  const stationEmployees = useMemo(
    () => employees.filter((e) => e.stationId === stationId || activeStationId === 'ALL'),
    [employees, stationId, activeStationId]
  );
  const stationShop = useMemo(
    () => shopItems.filter((i) => i.stationId === stationId || activeStationId === 'ALL'),
    [shopItems, stationId, activeStationId]
  );

  // Mobile state
  const [mobileRole, setMobileRole] = useState<'OWNER' | 'MANAGER' | 'ATTENDANT' | 'ACCOUNTANT'>('OWNER');
  const [activeTab, setActiveTab] = useState<MobileShowcaseTab>('shifts');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isOfflineSimulated, setIsOfflineSimulated] = useState(false);
  const [isCheckingSync, setIsCheckingSync] = useState(false);
  const [latencyMs, setLatencyMs] = useState(14);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => new Date().toISOString());
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueEntry[]>([]);
  const [mobileBanner, setMobileBanner] = useState<string | null>(null);

  // Local fallback demo state when mounted on Public Website without write handlers
  const [localTanks, setLocalTanks] = useState<FuelTank[]>(stationTanks);
  const [localAiActive, setLocalAiActive] = useState(aiSubscription.active);
  const [localShiftClosed, setLocalShiftClosed] = useState(stationShifts.some((s) => s.status === 'CLOSED'));

  useEffect(() => {
    setLocalTanks(stationTanks);
  }, [stationTanks]);

  useEffect(() => {
    setLocalAiActive(aiSubscription.active);
  }, [aiSubscription.active]);

  const effectiveTanks = onRunInstitutionalSetup ? stationTanks : localTanks;
  const effectiveAiActive = onToggleAiSubscription ? aiSubscription.active : localAiActive;

  // Shifts form state
  const openShift = stationShifts.find((s) => s.status === 'OPEN');
  const activeOrFirstPump = openShift
    ? stationPumps.find((p) => p.id === openShift.pumpId) ?? stationPumps[0]
    : stationPumps[0];

  const [closingMeter, setClosingMeter] = useState(() =>
    String((openShift?.openingMeterLitres ?? activeOrFirstPump?.totalizerLitres ?? 484200) + 1220)
  );
  const [cashFcfa, setCashFcfa] = useState('720000');
  const [momoFcfa, setMomoFcfa] = useState('304800');

  useEffect(() => {
    if (openShift) {
      setClosingMeter(String(openShift.openingMeterLitres + 1220));
    }
  }, [openShift?.id]);

  // Tanks dipstick state
  const [dipTankId, setDipTankId] = useState(effectiveTanks[0]?.id ?? '');
  const [dipLitres, setDipLitres] = useState(() => String(effectiveTanks[0]?.lastDipLitres ?? 24645));
  useEffect(() => {
    if (effectiveTanks.length > 0 && !effectiveTanks.some((t) => t.id === dipTankId)) {
      setDipTankId(effectiveTanks[0].id);
      setDipLitres(String(effectiveTanks[0].lastDipLitres));
    }
  }, [effectiveTanks, dipTankId]);

  // Fleet & POS state
  const [fleetAccountId, setFleetAccountId] = useState(fleetAccounts[0]?.id ?? 'flt_01');
  const [fleetPlate, setFleetPlate] = useState('LT-482-AK');
  const [fleetGrade, setFleetGrade] = useState<FuelGrade>('GASOIL');
  const [fleetLitres, setFleetLitres] = useState('150');
  const [shopItemId, setShopItemId] = useState(stationShop[0]?.id ?? 'sku_01');
  const [shopQty, setShopQty] = useState('2');

  // AI Copilot mobile state
  const [aiForecastText, setAiForecastText] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiChatReply, setAiChatReply] = useState<string | null>(null);

  // Institutional setup draft
  const [setupDrafts, setSetupDrafts] = useState(() =>
    INSTITUTIONAL_FUEL_CATALOG.map((tpl) => ({
      selected: tpl.code === 'SUPER' || tpl.code === 'GASOIL' || tpl.code === 'KEROSENE',
      grade: tpl.code,
      label: tpl.label,
      tankName: tpl.tankName,
      capacityLitres: String(tpl.defaultCapacityLitres),
      openingLitres: String(tpl.defaultOpeningLitres),
      unitCostFcfa: String(tpl.defaultUnitCostFcfa),
      sellingPriceFcfa: String(tpl.defaultSellingPriceFcfa),
      nozzleCount: String(tpl.defaultNozzleCount),
    }))
  );
  const [includeLubricants, setIncludeLubricants] = useState(true);

  const onboardingCompleted = [
    effectiveTanks.length > 0,
    stationPumps.length > 0,
    localShiftClosed || stationShifts.some((s) => s.status === 'CLOSED'),
    report.trialBalanceBalanced,
    effectiveAiActive,
  ].filter(Boolean).length;

  const isLiveConnected = !isOfflineSimulated && offlineQueue.length === 0;

  const dispatchMobileCommand = (label: string, endpoint: string, execute: () => void) => {
    if (isOfflineSimulated) {
      const uuid =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `idem-${Math.random().toString(36).slice(2, 10)}`;
      setOfflineQueue((prev) => [
        ...prev,
        {
          id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          idempotencyKey: uuid,
          label,
          endpoint,
          createdAt: new Date().toISOString(),
          execute,
        },
      ]);
      setMobileBanner(`Offline-Queued Mode: "${label}" cached with Idempotency-Key ${uuid.slice(0, 8)}...`);
      return;
    }

    try {
      execute();
      setLastSyncedAt(new Date().toISOString());
      setLatencyMs(9 + Math.floor(Math.random() * 14));
      setMobileBanner(`Live Synced to Java Spring Boot: ${label}`);
    } catch (err) {
      setMobileBanner(err instanceof Error ? err.message : 'Unable to execute command.');
    }
  };

  const handleFlushQueue = () => {
    if (isOfflineSimulated) {
      setMobileBanner('Reconnect to Java Spring Boot before flushing queued offline commands.');
      return;
    }
    const count = offlineQueue.length;
    if (count === 0) {
      handlePingSync();
      return;
    }
    for (const item of offlineQueue) {
      try {
        item.execute();
      } catch {
        // Ignore stale open shift if already closed
      }
    }
    setOfflineQueue([]);
    setLastSyncedAt(new Date().toISOString());
    setMobileBanner(`Flushed & reconciled ${count} queued idempotent command(s) to Java Spring Boot.`);
  };

  const handlePingSync = () => {
    setIsCheckingSync(true);
    setTimeout(() => {
      setIsCheckingSync(false);
      if (!isOfflineSimulated) {
        setLatencyMs(8 + Math.floor(Math.random() * 12));
        setLastSyncedAt(new Date().toISOString());
        setMobileBanner('Verified live heartbeat with Java Spring Boot API.');
      }
    }, 320);
  };

  const handleSubmitShift = () => {
    const closing = Number(closingMeter) || 0;
    const cash = Number(cashFcfa) || 0;
    const momo = Number(momoFcfa) || 0;

    if (onCloseShift && openShift) {
      dispatchMobileCommand(`Close Shift ${openShift.pumpCode}`, `/api/v1/forecourt/shifts/${openShift.id}/close`, () => {
        onCloseShift(openShift.id, {
          closingMeterLitres: closing,
          cashFcfa: cash,
          mobileMoneyFcfa: momo,
          cardFcfa: 0,
          fleetCreditFcfa: 0,
        });
        setLocalShiftClosed(true);
      });
    } else if (onOpenShift && stationPumps.length > 0 && stationEmployees.length > 0) {
      const idlePump = stationPumps.find((p) => p.status === 'IDLE') ?? stationPumps[0];
      const att = stationEmployees.find((e) => e.role === 'ATTENDANT') ?? stationEmployees[0];
      dispatchMobileCommand(`Open Shift ${idlePump.code}`, '/api/v1/forecourt/shifts/open', () => {
        onOpenShift(stationId, idlePump.id, att.id);
      });
    } else {
      dispatchMobileCommand('Close Shift (Preview)', '/api/v1/forecourt/shifts/sh_101/close', () => {
        setLocalShiftClosed(true);
      });
    }
  };

  const handleDipstickSubmit = () => {
    const targetId = dipTankId || effectiveTanks[0]?.id;
    const measured = Number(dipLitres) || 0;
    if (!targetId) {
      setMobileBanner('Select or provision an underground tank first.');
      return;
    }
    dispatchMobileCommand(`Dipstick Check (${formatLitres(measured)})`, '/api/v1/inventory/dipsticks', () => {
      if (onRecordDipstick) {
        onRecordDipstick(targetId, measured);
      } else {
        setLocalTanks((prev) =>
          prev.map((t) => {
            if (t.id !== targetId) return t;
            const variance = Number((measured - t.bookVolumeLitres).toFixed(2));
            return {
              ...t,
              lastDipLitres: measured,
              varianceLitres: variance,
              status: Math.abs(variance) > 100 ? 'VARIANCE_ALERT' : t.bookVolumeLitres / t.capacityLitres < 0.2 ? 'LOW_STOCK' : 'NOMINAL',
            };
          })
        );
      }
    });
  };

  const handleFleetSubmit = () => {
    const litres = Math.max(1, Number(fleetLitres) || 0);
    dispatchMobileCommand(`Fleet Voucher ${fleetPlate} (${fleetGrade})`, '/api/v1/fleet/vouchers', () => {
      if (onRecordVoucher && fleetAccounts.length > 0) {
        onRecordVoucher({
          accountId: fleetAccountId || fleetAccounts[0].id,
          stationId,
          vehiclePlate: fleetPlate,
          driverName: 'Mobile Driver',
          grade: fleetGrade,
          litres,
        });
      }
    });
  };

  const handleShopSubmit = () => {
    const qty = Math.max(1, Number(shopQty) || 1);
    dispatchMobileCommand(`POS Sale (${qty}x SKU)`, '/api/v1/shop/sales', () => {
      if (onRecordShopSale && stationShop.length > 0) {
        onRecordShopSale(shopItemId || stationShop[0].id, qty, 'MOBILE_MONEY');
      }
    });
  };

  const handleToggleAi = () => {
    const next = !effectiveAiActive;
    dispatchMobileCommand(next ? 'Activate Paid AI Copilot' : 'Pause Paid AI Copilot', '/api/v1/ai/subscription/activate', () => {
      if (onToggleAiSubscription) {
        onToggleAiSubscription(next);
      } else {
        setLocalAiActive(next);
      }
    });
  };

  const handleRunAiForecast = () => {
    const lowest = [...effectiveTanks].sort(
      (a, b) => a.bookVolumeLitres / Math.max(1, a.capacityLitres) - b.bookVolumeLitres / Math.max(1, b.capacityLitres)
    )[0];
    setAiForecastText(
      `30-Day Revenue Projection: ${formatFcfa(Math.max(4200000, report.totalRevenueFcfa * 1.12))}.\n` +
        (lowest
          ? `Urgent Tank Horizon: ${lowest.name} at ${formatLitres(lowest.bookVolumeLitres)} (${Math.round(
              (lowest.bookVolumeLitres / Math.max(1, lowest.capacityLitres)) * 100
            )}%) — recommend SCDP refill within 48h.`
          : 'Provision tanks in Setup to generate reserve horizon curves.')
    );
  };

  const handleAskAiAdvisor = () => {
    const q = aiPrompt.trim();
    if (!q) return;
    setAiPrompt('');
    const lowest = [...effectiveTanks].sort((a, b) => a.bookVolumeLitres - b.bookVolumeLitres)[0];
    setAiChatReply(
      lowest
        ? `OpesFuel AI: Lowest reserve is ${lowest.name} (${formatLitres(lowest.bookVolumeLitres)}). Trial Balance is ${
            report.trialBalanceBalanced ? 'Balanced (DR = CR)' : 'Pending check'
          }. Keep cash variance under 0 FCFA by requiring OM/MoMo slip verification at shift close.`
        : 'OpesFuel AI: Tick your institutional fuels in the Setup tab so reserve & margin coaching activates immediately.'
    );
  };

  const handleApplySetup = () => {
    const selected = setupDrafts.filter((d) => d.selected);
    if (selected.length === 0) {
      setMobileBanner('Select at least one fuel type to sync.');
      return;
    }
    const selections: InstitutionalSetupSelection[] = selected.map((d) => ({
      grade: d.grade,
      tankName: d.tankName,
      capacityLitres: Math.max(1000, Number(d.capacityLitres) || 20000),
      openingLitres: Math.max(0, Number(d.openingLitres) || 0),
      unitCostFcfa: Math.max(100, Number(d.unitCostFcfa) || 500),
      sellingPriceFcfa: Math.max(100, Number(d.sellingPriceFcfa) || 600),
      nozzleCount: Math.max(1, Number(d.nozzleCount) || 1),
    }));

    dispatchMobileCommand(`Sync ${selections.length} Institutional Fuels`, `/api/v1/stations/${stationId}/onboarding-setup`, () => {
      if (onRunInstitutionalSetup) {
        onRunInstitutionalSetup(stationId, selections, {
          includeLubricants,
          oilBottlesQty: 30,
          lpgCylindersQty: 24,
        });
      } else {
        setLocalTanks(
          selections.map((s, idx) => ({
            id: `tk_mob_${idx + 1}`,
            stationId,
            name: s.tankName,
            grade: s.grade,
            capacityLitres: s.capacityLitres,
            bookVolumeLitres: s.openingLitres,
            lastDipLitres: s.openingLitres,
            varianceLitres: 0,
            unitCostFcfa: s.unitCostFcfa,
            status: s.openingLitres / s.capacityLitres < 0.2 ? 'LOW_STOCK' : 'NOMINAL',
          }))
        );
      }
    });
  };

  const activeGuide = SCREEN_GUIDE[activeTab];
  const expectedShiftFcfa = openShift
    ? Math.max(0, (Number(closingMeter) || 0) - openShift.openingMeterLitres) * openShift.unitPriceFcfa
    : Math.max(0, (Number(closingMeter) || 0) - 484200) * (activeOrFirstPump?.unitPriceFcfa ?? 840);
  const declaredShiftFcfa = (Number(cashFcfa) || 0) + (Number(momoFcfa) || 0);
  const shiftVarianceFcfa = declaredShiftFcfa - expectedShiftFcfa;

  return (
    <div className="space-y-8">
      {/* Top Interactive Controls & Connectivity Toggle */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-amber-700">
            <Smartphone className="w-4 h-4" />
            <span>OpesFuel Mobile App for Android &amp; iPhone · Live Interactive Walkthrough</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            All 6 Mobile App Screens — Styled &amp; Working Live
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
            Inspect the exact visual layout, thumb-zone styling, real-time Java Spring Boot Sync Status bar,
            and offline idempotent queueing across every screen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              const next = !isOfflineSimulated;
              setIsOfflineSimulated(next);
              setMobileBanner(
                next
                  ? 'Simulated network drop: actions now queue offline with UUID Idempotency-Keys.'
                  : 'Reconnected to Java Spring Boot server.'
              );
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors min-h-[44px] whitespace-nowrap ${
              isOfflineSimulated
                ? 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            {isOfflineSimulated ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            <span>{isOfflineSimulated ? 'Restore Live Connection' : 'Simulate Offline Mode'}</span>
          </button>

          {offlineQueue.length > 0 && !isOfflineSimulated && (
            <button
              type="button"
              onClick={handleFlushQueue}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold min-h-[44px] whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Flush Queue ({offlineQueue.length})
            </button>
          )}

          {onOpenConsole && (
            <button
              type="button"
              onClick={onOpenConsole}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold min-h-[44px] whitespace-nowrap"
            >
              Open Full Console
            </button>
          )}
        </div>
      </div>

      {/* Main Split: Realistic Interactive Phone Viewport + Detailed Screen Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: Interactive Android & iPhone Device Viewport */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="relative w-full max-w-[390px] rounded-[2.25rem] border-[6px] border-slate-900 bg-[#F8FAFC] shadow-xl overflow-hidden flex flex-col">
            {/* Hardware Status Strip */}
            <div className="bg-slate-900 text-white px-5 py-2 flex items-center justify-between text-[11px] font-mono">
              <span>09:41</span>
              <div className="w-20 h-3.5 bg-slate-800 rounded-full" />
              <span>5G · 94%</span>
            </div>

            {/* Slide-Over Mobile Hamburger Navigation Drawer */}
            {drawerOpen && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Mobile app navigation drawer"
                className="absolute inset-0 top-[30px] z-30 flex"
              >
                <div className="w-[82%] max-w-[300px] h-full bg-slate-900 text-slate-100 flex flex-col shadow-2xl">
                  <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-600/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                        <Flame className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-white truncate">
                          Opes<span className="text-amber-400">Fuel</span> Mobile
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {effectiveStation?.name ?? 'Station Plateau'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      aria-label="Close mobile menu"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Role Switcher inside Drawer */}
                  <div className="px-4 py-3 border-b border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-amber-400" /> Active Role
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['OWNER', 'MANAGER', 'ATTENDANT', 'ACCOUNTANT'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setMobileRole(r)}
                          className={`px-2 py-1.5 rounded text-[10px] font-mono font-bold transition-colors ${
                            mobileRole === r
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Full Vertical Navigation List */}
                  <nav aria-label="Mobile drawer links" className="flex-1 overflow-y-auto p-3 space-y-1">
                    {(
                      [
                        { id: 'shifts', label: 'Shifts & Pumps', icon: Fuel, badge: openShift ? '1 OPEN' : null },
                        { id: 'inventory', label: 'Underground Tanks', icon: Gauge, badge: `${localTanks.length}` },
                        { id: 'fleet', label: 'Fleet Credit & POS', icon: CreditCard, badge: null },
                        { id: 'reports', label: 'Financial Reports', icon: TrendingUp, badge: 'FCFA' },
                        { id: 'ai', label: 'AI Copilot', icon: Sparkles, badge: effectiveAiActive ? 'ON' : 'PRO' },
                        { id: 'setup', label: 'Station Setup', icon: Wrench, badge: `${onboardingCompleted}/5` },
                      ] as const
                    ).map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(item.id);
                            setDrawerOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-amber-600 text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{item.label}</span>
                          </span>
                          {item.badge && (
                            <span
                              className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                                active ? 'bg-white/20 text-white' : 'bg-slate-800 text-amber-300'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>

                  {/* Drawer Footer: Offline Queue & Connection */}
                  <div className="p-3 border-t border-slate-800 space-y-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOfflineSimulated((v) => !v);
                        setDrawerOpen(false);
                      }}
                      className="w-full py-2 px-3 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold flex items-center justify-between"
                    >
                      <span>{isOfflineSimulated ? 'Switch to Online Mode' : 'Test Offline Queue Mode'}</span>
                      {isOfflineSimulated ? (
                        <WifiOff className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div
                  className="flex-1 bg-slate-950/55 backdrop-blur-[1px]"
                  onClick={() => setDrawerOpen(false)}
                />
              </div>
            )}

            {/* Clean Native Top App Bar + Compact Sync Status Bar */}
            <div className="bg-white border-b border-slate-200">
              <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open mobile navigation menu"
                  className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 flex items-center justify-center shrink-0"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-extrabold text-slate-900 leading-tight truncate">
                    {activeTab === 'shifts'
                      ? 'Forecourt Shifts'
                      : activeTab === 'inventory'
                      ? 'Underground Tanks'
                      : activeTab === 'fleet'
                      ? 'Fleet & Shop POS'
                      : activeTab === 'reports'
                      ? 'Financial Reports'
                      : activeTab === 'ai'
                      ? 'AI Copilot'
                      : 'Station Setup'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {effectiveStation?.name ?? 'Station Plateau'} · {mobileRole}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={offlineQueue.length > 0 && !isOfflineSimulated ? handleFlushQueue : handlePingSync}
                  title="Tap to sync with Java Spring Boot"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-mono font-bold shrink-0 border ${
                    isCheckingSync
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : isLiveConnected
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCheckingSync
                        ? 'bg-amber-500 animate-pulse'
                        : isLiveConnected
                        ? 'bg-emerald-600'
                        : 'bg-red-600 animate-pulse'
                    }`}
                  />
                  {isCheckingSync
                    ? 'Sync…'
                    : isLiveConnected
                    ? `${latencyMs}ms`
                    : offlineQueue.length > 0
                    ? `${offlineQueue.length} Q`
                    : 'Offline'}
                  <RefreshCw className={`w-2.5 h-2.5 ${isCheckingSync ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Scrollable Mobile Viewport Body */}
            <div className="p-3.5 space-y-3 h-[520px] overflow-y-auto">
              {mobileBanner && (
                <div className="p-2.5 rounded-lg bg-amber-100 border border-amber-400 text-amber-950 text-[11px] font-semibold flex items-start justify-between gap-2">
                  <span>{mobileBanner}</span>
                  <button
                    type="button"
                    onClick={() => setMobileBanner(null)}
                    className="underline text-[10px] shrink-0"
                  >
                    Hide
                  </button>
                </div>
              )}

              {offlineQueue.length > 0 && (
                <div className="bg-white border border-red-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span>Offline Sync Queue ({offlineQueue.length})</span>
                    <span className="font-mono text-[10px] text-red-700">Idempotency Protected</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isOfflineSimulated
                      ? 'Waiting for Spring Boot network reconnection...'
                      : 'Connection restored — ready to flush queue.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleFlushQueue}
                    className="w-full py-2 rounded-md bg-slate-900 text-white text-xs font-semibold min-h-[40px]"
                  >
                    Sync Now
                  </button>
                </div>
              )}

              {/* SCREEN 1: SHIFTS */}
              {activeTab === 'shifts' && (
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="text-sm font-bold text-slate-900">
                    {openShift
                      ? `Close Pump Shift (${openShift.pumpCode} · ${openShift.grade})`
                      : activeOrFirstPump
                      ? `Open / Close Shift (${activeOrFirstPump.code})`
                      : 'Pump Shift Capture'}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Closing Totalizer (Litres)
                    </label>
                    <input
                      type="number"
                      value={closingMeter}
                      onChange={(e) => setClosingMeter(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-slate-300 bg-slate-50 text-xs font-mono tabular-nums text-slate-900 min-h-[40px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Cash Collected (FCFA)
                    </label>
                    <input
                      type="number"
                      value={cashFcfa}
                      onChange={(e) => setCashFcfa(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-slate-300 bg-slate-50 text-xs font-mono tabular-nums text-slate-900 min-h-[40px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Mobile Money OM/MoMo (FCFA)
                    </label>
                    <input
                      type="number"
                      value={momoFcfa}
                      onChange={(e) => setMomoFcfa(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-slate-300 bg-slate-50 text-xs font-mono tabular-nums text-slate-900 min-h-[40px]"
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5 flex justify-between items-center text-[11px]">
                    <span className="text-slate-600">Expected vs Declared</span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        shiftVarianceFcfa < 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      Var: {formatFcfa(shiftVarianceFcfa)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmitShift}
                    className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold min-h-[44px]"
                  >
                    {openShift || !onCloseShift
                      ? isOfflineSimulated
                        ? 'Queue Shift Closure Offline'
                        : 'Submit & Post Ledger'
                      : 'Open Shift on Idle Pump'}
                  </button>
                </div>
              )}

              {/* SCREEN 2: TANKS */}
              {activeTab === 'inventory' && (
                <div className="space-y-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
                    <div className="text-sm font-bold text-slate-900">
                      Underground Tanks ({effectiveTanks.length})
                    </div>
                    {effectiveTanks.map((tank) => {
                      const pct = Math.min(100, Math.round((tank.bookVolumeLitres / Math.max(1, tank.capacityLitres)) * 100));
                      const isSelected = dipTankId === tank.id;
                      return (
                        <button
                          key={tank.id}
                          type="button"
                          onClick={() => {
                            setDipTankId(tank.id);
                            setDipLitres(String(tank.lastDipLitres));
                          }}
                          className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                            isSelected ? 'border-amber-600 bg-amber-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">{tank.name}</span>
                            <span className="font-mono tabular-nums text-xs font-bold text-slate-900 shrink-0">
                              {formatLitres(tank.bookVolumeLitres)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                            <span>
                              {gradeLabel(tank.grade)} · {pct}% of {formatLitres(tank.capacityLitres)}
                            </span>
                            <span
                              className={`font-semibold ${
                                tank.status === 'VARIANCE_ALERT'
                                  ? 'text-red-600'
                                  : tank.status === 'LOW_STOCK'
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {tank.status}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {effectiveTanks.length === 0 && (
                      <div className="text-xs text-slate-500 py-2">
                        No tanks provisioned yet. Open Setup to tick fuels &amp; volumes.
                      </div>
                    )}
                  </div>

                  {effectiveTanks.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                      <div className="text-sm font-bold text-slate-900">Record Physical Dipstick</div>
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Measured Dipstick Volume (Litres)
                      </label>
                      <input
                        type="number"
                        value={dipLitres}
                        onChange={(e) => setDipLitres(e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-slate-300 bg-slate-50 text-xs font-mono tabular-nums min-h-[40px]"
                      />
                      <button
                        type="button"
                        onClick={handleDipstickSubmit}
                        className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold min-h-[44px]"
                      >
                        Record Dipstick Check
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* SCREEN 3: FLEET/POS */}
              {activeTab === 'fleet' && (
                <div className="space-y-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                    <div className="text-sm font-bold text-slate-900">Corporate Fleet Voucher</div>
                    {fleetAccounts.length > 0 && (
                      <select
                        value={fleetAccountId}
                        onChange={(e) => setFleetAccountId(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-md border border-slate-300 bg-slate-50 text-xs min-h-[38px]"
                      >
                        {fleetAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.companyName}
                          </option>
                        ))}
                      </select>
                    )}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Vehicle Plate</label>
                      <input
                        type="text"
                        value={fleetPlate}
                        onChange={(e) => setFleetPlate(e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-slate-300 bg-slate-50 text-xs font-mono min-h-[38px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Fuel Grade</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['SUPER', 'GASOIL', 'KEROSENE', 'LPG_BULK', 'HEAVY_FUEL'] as FuelGrade[]).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setFleetGrade(g)}
                            className={`px-2 py-1.5 rounded text-[10px] font-bold border ${
                              fleetGrade === g
                                ? 'bg-slate-900 border-slate-900 text-amber-400'
                                : 'bg-slate-50 border-slate-300 text-slate-700'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Dispensed Litres</label>
                      <input
                        type="number"
                        value={fleetLitres}
                        onChange={(e) => setFleetLitres(e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-slate-300 bg-slate-50 text-xs font-mono tabular-nums min-h-[38px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleFleetSubmit}
                      className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold min-h-[44px]"
                    >
                      Charge Fleet Account
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
                    <div className="text-sm font-bold text-slate-900">Lubricants &amp; 12.5kg Gas POS</div>
                    {stationShop.length > 0 ? (
                      <select
                        value={shopItemId}
                        onChange={(e) => setShopItemId(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-md border border-slate-300 bg-slate-50 text-xs min-h-[38px]"
                      >
                        {stationShop.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {formatFcfa(item.unitPriceFcfa)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs text-slate-500">OpesLube 15W40 (5L) · 18 500 FCFA</div>
                    )}
                    <input
                      type="number"
                      min={1}
                      value={shopQty}
                      onChange={(e) => setShopQty(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-slate-300 bg-slate-50 text-xs font-mono tabular-nums min-h-[38px]"
                    />
                    <button
                      type="button"
                      onClick={handleShopSubmit}
                      className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold min-h-[44px]"
                    >
                      Record Mobile Money Sale
                    </button>
                  </div>
                </div>
              )}

              {/* SCREEN 4: REPORTS */}
              {activeTab === 'reports' && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                  <div className="text-sm font-bold text-slate-900">Automated Financial Report (FCFA)</div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Fuel &amp; Shop Revenue</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {formatFcfa(report.totalRevenueFcfa)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Gross Operating Margin</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {formatFcfa(report.grossProfitFcfa)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Operating Expenses</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {formatFcfa(report.operatingExpensesFcfa)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">VAT Payable (19.25%)</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {formatFcfa(report.vatPayableFcfa)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 items-center">
                    <span className="text-sm font-bold text-slate-900">Net Income</span>
                    <span className="font-mono tabular-nums text-sm font-bold text-emerald-700">
                      {formatFcfa(report.netIncomeFcfa)}
                    </span>
                  </div>
                  <div className="pt-2 text-[11px] font-mono text-slate-500 flex justify-between">
                    <span>SYSCOHADA Double-Entry</span>
                    <span className={report.trialBalanceBalanced ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                      {report.trialBalanceBalanced ? 'Balanced (DR = CR)' : 'Imbalance'}
                    </span>
                  </div>
                </div>
              )}

              {/* SCREEN 5: AI COPILOT */}
              {activeTab === 'ai' && (
                <div className="space-y-3">
                  <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-bold">OpesFuel Paid AI Copilot</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {effectiveAiActive
                        ? 'Active SaaS Intelligence · Tank stockout warnings, 30-day FCFA forecasts & cash variance coaching.'
                        : '25 000 FCFA/mo Add-On (Free with Enterprise). Unlock live stockout forecasts and AI Q&A.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleToggleAi}
                      className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold min-h-[44px]"
                    >
                      {effectiveAiActive ? 'Pause Paid AI Copilot' : 'Activate Paid AI Copilot (25 000 FCFA/mo)'}
                    </button>
                  </div>

                  {effectiveAiActive && (
                    <>
                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
                        <div className="text-xs font-bold text-slate-900">Predictive Tank &amp; Margin Analysis</div>
                        <button
                          type="button"
                          onClick={handleRunAiForecast}
                          className="w-full py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold min-h-[40px]"
                        >
                          Run AI Stockout &amp; Revenue Forecast
                        </button>
                        {aiForecastText && (
                          <pre className="whitespace-pre-wrap font-sans text-[11px] text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2.5 leading-relaxed">
                            {aiForecastText}
                          </pre>
                        )}
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
                        <div className="text-xs font-bold text-slate-900">Ask OpesFuel AI Advisor</div>
                        <input
                          type="text"
                          placeholder="e.g. Which tank runs out first?"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          className="w-full px-3 py-2 rounded-md border border-slate-300 bg-slate-50 text-xs min-h-[38px]"
                        />
                        <button
                          type="button"
                          onClick={handleAskAiAdvisor}
                          className="w-full py-2 rounded-lg bg-amber-600 text-white text-xs font-bold min-h-[40px]"
                        >
                          Ask Station Advisor
                        </button>
                        {aiChatReply && (
                          <div className="text-[11px] text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2.5 leading-relaxed">
                            {aiChatReply}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* SCREEN 6: SETUP */}
              {activeTab === 'setup' && (
                <div className="space-y-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Wrench className="w-3.5 h-3.5 text-amber-600" />
                      <span>Onboarding Guide ({onboardingCompleted}/5)</span>
                    </div>
                    {[
                      { label: '1. Institutional Fuels & Volumes', done: effectiveTanks.length > 0 },
                      { label: '2. Forecourt Pumps & Roster', done: stationPumps.length > 0 },
                      { label: '3. Reconcile First Shift', done: localShiftClosed || stationShifts.some((s) => s.status === 'CLOSED') },
                      { label: '4. Audit Balanced Trial Balance', done: report.trialBalanceBalanced },
                      { label: '5. Activate Paid AI Copilot', done: effectiveAiActive },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-2 text-[11px] text-slate-700 py-0.5">
                        {s.done ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-slate-900">Institutional Fuels &amp; Opening Volumes</div>
                    {setupDrafts.map((row) => (
                      <div
                        key={row.grade}
                        className={`p-2 rounded-lg border ${
                          row.selected ? 'border-amber-500 bg-amber-50/70' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSetupDrafts((prev) =>
                              prev.map((r) => (r.grade === row.grade ? { ...r, selected: !r.selected } : r))
                            )
                          }
                          className="w-full flex items-center gap-2 text-left text-xs font-bold text-slate-900"
                        >
                          {row.selected ? (
                            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span>{row.label}</span>
                        </button>
                        {row.selected && (
                          <div className="grid grid-cols-3 gap-1.5 mt-2">
                            <div>
                              <span className="block text-[9px] text-slate-500">Cap (L)</span>
                              <input
                                type="number"
                                value={row.capacityLitres}
                                onChange={(e) =>
                                  setSetupDrafts((prev) =>
                                    prev.map((r) =>
                                      r.grade === row.grade ? { ...r, capacityLitres: e.target.value } : r
                                    )
                                  )
                                }
                                className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white text-[10px] font-mono"
                              />
                            </div>
                            <div>
                              <span className="block text-[9px] text-slate-500">Open (L)</span>
                              <input
                                type="number"
                                value={row.openingLitres}
                                onChange={(e) =>
                                  setSetupDrafts((prev) =>
                                    prev.map((r) =>
                                      r.grade === row.grade ? { ...r, openingLitres: e.target.value } : r
                                    )
                                  )
                                }
                                className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white text-[10px] font-mono"
                              />
                            </div>
                            <div>
                              <span className="block text-[9px] text-slate-500">FCFA/L</span>
                              <input
                                type="number"
                                value={row.sellingPriceFcfa}
                                onChange={(e) =>
                                  setSetupDrafts((prev) =>
                                    prev.map((r) =>
                                      r.grade === row.grade ? { ...r, sellingPriceFcfa: e.target.value } : r
                                    )
                                  )
                                }
                                className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white text-[10px] font-mono"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => setIncludeLubricants(!includeLubricants)}
                      className="w-full flex items-center gap-2 text-left text-xs font-semibold text-slate-800 py-1"
                    >
                      {includeLubricants ? (
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>Include Lubricants &amp; 12.5kg Gas Cylinders</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApplySetup}
                      className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold min-h-[44px]"
                    >
                      Apply &amp; Sync Station Modules
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Native 5-Tab Mobile Bottom Navigation Bar */}
            <div className="bg-white border-t border-slate-200">
              <div className="grid grid-cols-5 px-1 pt-1.5 pb-1">
                {(
                  [
                    { id: 'shifts', label: 'Shifts', icon: Fuel },
                    { id: 'inventory', label: 'Tanks', icon: Gauge },
                    { id: 'fleet', label: 'POS', icon: CreditCard },
                    { id: 'reports', label: 'Reports', icon: TrendingUp },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                        active ? 'text-amber-600 bg-amber-50/70' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                    activeTab === 'ai' || activeTab === 'setup'
                      ? 'text-amber-600 bg-amber-50/70'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Menu className="w-4 h-4" />
                  <span>More</span>
                  {offlineQueue.length > 0 && (
                    <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-red-600" />
                  )}
                </button>
              </div>
              <div className="pb-1.5 pt-0.5 flex justify-center">
                <div className="w-24 h-1 rounded-full bg-slate-300" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Complete 6-Screen Selector, Styling Specs & Workflow Mechanics */}
        <div className="lg:col-span-7 space-y-6">
          {/* 6-Screen Quick Switch Grid */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-slate-900">
                Inspect Every Mobile Screen (Click to Open on Phone)
              </h2>
              <span className="font-mono text-xs text-slate-500">6 Production Screens</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(
                [
                  { id: 'shifts', label: '01. Shifts', sub: 'Meter & Tender Close', icon: Fuel },
                  { id: 'inventory', label: '02. Tanks', sub: 'Reserves & Dipsticks', icon: Gauge },
                  { id: 'fleet', label: '03. Fleet / POS', sub: 'Vouchers & Shop', icon: CreditCard },
                  { id: 'reports', label: '04. Reports', sub: 'Automated FCFA P&L', icon: TrendingUp },
                  { id: 'ai', label: '05. AI Copilot', sub: 'Predictive & Q&A', icon: Cpu },
                  { id: 'setup', label: '06. Setup', sub: 'Fuels & Volumes', icon: Database },
                ] as const
              ).map((card) => {
                const Icon = card.icon;
                const selected = activeTab === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setActiveTab(card.id)}
                    className={`p-3.5 rounded-lg border text-left transition-colors flex items-start gap-3 ${
                      selected
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${selected ? 'text-amber-400' : 'text-amber-600'}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{card.label}</div>
                      <div className={`text-[11px] truncate ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {card.sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Screen Detailed Spec: Styling + How It Works + Spring Boot Contract */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="font-mono text-xs font-semibold text-amber-700">
                  Screen {activeGuide.code} · {activeGuide.persona}
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-1">{activeGuide.title}</h3>
              </div>
              <div className="text-right font-mono text-[11px] text-slate-500">
                <div>Transport: {transportMode === 'SPRING_BOOT_REMOTE' ? 'Java 25 Spring Boot' : 'OpenAPI 3.1 Adapter'}</div>
                <div>Last Sync: {lastSyncedAt.slice(11, 19)} UTC</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Visual Styling &amp; Touch Ergonomics
                </h4>
                <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                  {activeGuide.stylingNotes.map((note) => (
                    <li key={note} className="flex items-start gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Step-by-Step Workflow Mechanics
                </h4>
                <ol className="space-y-2 text-xs text-slate-700 leading-relaxed list-decimal list-inside">
                  {activeGuide.howItWorks.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-200 rounded-lg p-4 space-y-2 text-xs font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-amber-400 font-semibold">Spring Boot REST Contract</span>
                <span className="text-slate-400">Event: {activeGuide.domainEvent}</span>
              </div>
              <div className="text-white font-semibold break-all">{activeGuide.endpoint}</div>
              <div className="text-slate-300 text-[11px] pt-1 border-t border-slate-800">
                Ledger Impact: {activeGuide.accountingImpact}
              </div>
            </div>
          </div>

          {/* Offline-Queued Commands Inspector */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Real-Time Sync Telemetry &amp; Idempotent Queue ({offlineQueue.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Header connectivity monitor toggles cleanly between live Spring Boot mode and offline-queued mode
                </p>
              </div>
              {offlineQueue.length > 0 && !isOfflineSimulated && (
                <button
                  type="button"
                  onClick={handleFlushQueue}
                  className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap"
                >
                  Flush {offlineQueue.length} Queued Item(s)
                </button>
              )}
            </div>

            {offlineQueue.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {offlineQueue.map((item) => (
                  <div key={item.id} className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">{item.label}</div>
                      <div className="font-mono text-[11px] text-slate-500">{item.endpoint}</div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-amber-700">
                      Key: {item.idempotencyKey.slice(0, 12)}...
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                No commands waiting offline. Click <strong>Simulate Offline Mode</strong> above and submit any shift,
                dipstick, voucher, or setup form on the phone to watch commands queue with UUID idempotency keys and flush back into the station ledger.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
