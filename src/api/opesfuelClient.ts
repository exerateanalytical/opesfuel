import { canPerformAction } from '../auth/auth0';
import {
  AccountDefinition,
  ApiKeyRecord,
  DipstickReadingRecord,
  DomainEventLog,
  Employee,
  FinancialReportBundle,
  FleetAccount,
  FleetTransaction,
  FuelGrade,
  FuelTank,
  InstitutionalFuelTemplate,
  InstitutionalSetupSelection,
  JournalEntry,
  JournalLine,
  Pump,
  PurchaseOrder,
  ShiftRecord,
  ShopItem,
  Station,
  StationExpense,
  SubscriptionPlan,
  TankDeliveryRecord,
  TenantWorkspace,
  TreasuryDeposit,
  TrialBalanceRow,
  UserRole,
  WebhookSubscription,
} from '../domain/types';

export const DEFAULT_FUEL_PRICES: Record<FuelGrade, number> = {
  SUPER: 840,
  GASOIL: 828,
  KEROSENE: 550,
  LPG_BULK: 620,
  HEAVY_FUEL: 765,
};

export function normalizeStationPrices(prices?: Partial<Record<FuelGrade, number>>): Record<FuelGrade, number> {
  return {
    ...DEFAULT_FUEL_PRICES,
    ...(prices ?? {}),
  };
}

export const INSTITUTIONAL_FUEL_CATALOG: InstitutionalFuelTemplate[] = [
  {
    code: 'SUPER',
    label: 'Super Petrol (SP95)',
    tankName: 'Tank T-01 (Super SP95)',
    category: 'LIQUID_FUEL',
    unitLabel: 'Litres',
    defaultCapacityLitres: 40000,
    defaultOpeningLitres: 24500,
    defaultUnitCostFcfa: 745,
    defaultSellingPriceFcfa: 840,
    defaultNozzleCount: 2,
    description: 'High-octane unleaded petrol for passenger cars, motorcycles, and urban fleets.',
  },
  {
    code: 'GASOIL',
    label: 'Diesel / Gasoil',
    tankName: 'Tank T-02 (Gasoil)',
    category: 'LIQUID_FUEL',
    unitLabel: 'Litres',
    defaultCapacityLitres: 50000,
    defaultOpeningLitres: 31000,
    defaultUnitCostFcfa: 735,
    defaultSellingPriceFcfa: 828,
    defaultNozzleCount: 2,
    description: 'Commercial diesel for logistics trucks, buses, and heavy transport vehicles.',
  },
  {
    code: 'KEROSENE',
    label: 'Kerosene / Pétrole Lampant',
    tankName: 'Tank T-03 (Kerosene)',
    category: 'LIQUID_FUEL',
    unitLabel: 'Litres',
    defaultCapacityLitres: 20000,
    defaultOpeningLitres: 11200,
    defaultUnitCostFcfa: 470,
    defaultSellingPriceFcfa: 550,
    defaultNozzleCount: 1,
    description: 'Domestic lighting fuel and regulated household kerosene reserve.',
  },
  {
    code: 'LPG_BULK',
    label: 'LPG Autogas / Gaz GPL',
    tankName: 'Skid LPG-01 (Gaz GPL)',
    category: 'GASEOUS_FUEL',
    unitLabel: 'Litres',
    defaultCapacityLitres: 15000,
    defaultOpeningLitres: 8500,
    defaultUnitCostFcfa: 445,
    defaultSellingPriceFcfa: 620,
    defaultNozzleCount: 1,
    description: 'Autogas skid reserve and 12.5 kg cooking gas cylinder refill feed.',
  },
  {
    code: 'HEAVY_FUEL',
    label: 'Heavy Fuel / Generator Diesel',
    tankName: 'Tank T-05 (Industrial Fuel)',
    category: 'INDUSTRIAL_FUEL',
    unitLabel: 'Litres',
    defaultCapacityLitres: 30000,
    defaultOpeningLitres: 14000,
    defaultUnitCostFcfa: 560,
    defaultSellingPriceFcfa: 765,
    defaultNozzleCount: 1,
    description: 'Bulk industrial generator fuel oil and commercial depot reserves.',
  },
];

const STORAGE_KEY = 'opesfuel_saas_workspace_v2';

export const CHART_OF_ACCOUNTS: AccountDefinition[] = [
  { code: '1010', name: 'Cash on Hand & Safe', accountType: 'ASSET' },
  { code: '1020', name: 'Mobile Money Clearing (OM/MoMo)', accountType: 'ASSET' },
  { code: '1030', name: 'Bank Operating Account', accountType: 'ASSET' },
  { code: '1100', name: 'Fleet Accounts Receivable', accountType: 'ASSET' },
  { code: '1200', name: 'Fuel & Lubricant Inventory', accountType: 'ASSET' },
  { code: '2010', name: 'Supplier Accounts Payable', accountType: 'LIABILITY' },
  { code: '2200', name: 'Fuel VAT & Excise Payable', accountType: 'LIABILITY' },
  { code: '3010', name: 'Owner Paid-In Capital', accountType: 'EQUITY' },
  { code: '4010', name: 'Forecourt Fuel Sales Revenue', accountType: 'REVENUE' },
  { code: '4020', name: 'Lubricants & Shop Revenue', accountType: 'REVENUE' },
  { code: '5010', name: 'Cost of Fuel Sold (COGS)', accountType: 'EXPENSE' },
  { code: '6010', name: 'Station Operating Expenses', accountType: 'EXPENSE' },
  { code: '6100', name: 'Shift Cash Over / Short Variance', accountType: 'EXPENSE' },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter Station',
    audience: 'For independent single-site stations',
    monthlyPriceFcfa: 25000,
    pumpLimit: 'Up to 6 pumps · 3 tanks',
    apiQuotaPerMonth: '50,000 API calls / month',
    features: [
      'Pump & shift meter reconciliation in FCFA',
      'Underground tank dipstick tracking',
      'Automated daily P&L and cash ledger',
      'Mobile app for Android & iPhone (3 seats)',
    ],
  },
  {
    id: 'pro',
    name: 'Multi-Pump Pro',
    audience: 'For high-volume urban forecourts',
    monthlyPriceFcfa: 55000,
    pumpLimit: 'Up to 18 pumps · 8 tanks',
    apiQuotaPerMonth: '250,000 API calls / month',
    recommended: true,
    features: [
      'Everything in Starter Station',
      'Corporate fleet credit & invoicing',
      'Lubricants, LPG & shop POS ledger',
      'Full Trial Balance, Balance Sheet & VAT export',
    ],
  },
  {
    id: 'enterprise',
    name: 'Network Enterprise',
    audience: 'For regional networks & ERP integrators',
    monthlyPriceFcfa: 120000,
    pumpLimit: 'Unlimited stations & pumps',
    apiQuotaPerMonth: 'Unlimited API + HMAC Webhooks',
    features: [
      'Consolidated multi-station reporting',
      'Dedicated Auth0 tenant & custom RBAC',
      'Signed domain event webhooks',
      'Dedicated onboarding & 99.95% SLA',
    ],
  },
];

export interface OpesFuelStoreState {
  tenant: TenantWorkspace;
  stations: Station[];
  tanks: FuelTank[];
  pumps: Pump[];
  shifts: ShiftRecord[];
  fleetAccounts: FleetAccount[];
  fleetTransactions: FleetTransaction[];
  shopItems: ShopItem[];
  purchaseOrders: PurchaseOrder[];
  deliveries: TankDeliveryRecord[];
  dipsticks: DipstickReadingRecord[];
  employees: Employee[];
  journals: JournalEntry[];
  expenses: StationExpense[];
  deposits: TreasuryDeposit[];
  events: DomainEventLog[];
  apiKeys: ApiKeyRecord[];
  webhooks: WebhookSubscription[];
}

const nowMinusHours = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();

function accountName(code: string): string {
  return CHART_OF_ACCOUNTS.find((a) => a.code === code)?.name ?? code;
}

function makeLine(accountCode: string, debitFcfa: number, creditFcfa: number): JournalLine {
  return { accountCode, accountName: accountName(accountCode), debitFcfa, creditFcfa };
}

export function createSeedState(): OpesFuelStoreState {
  const tenant: TenantWorkspace = {
    tenantId: 'ten_opes_cm',
    organizationName: 'OpesFuel Demo Network',
    ownerName: 'Jean-Paul Mbarga',
    ownerEmail: 'owner@opesfuel.com',
    createdAt: nowMinusHours(72),
    isSampleData: true,
    aiSubscription: {
      active: false,
      planCode: 'AI_COPILOT_ADDON',
      monthlyFeeFcfa: 25000,
      activatedAt: null,
    },
    onboardingCompletedSteps: [
      'INSTITUTIONAL_FUELS_VOLUMES',
      'FORECOURT_PUMPS_STAFF',
      'SHIFT_RECONCILIATION',
      'DOUBLE_ENTRY_AUDIT',
    ],
  };
  const stations: Station[] = [
    {
      id: 'st_plateau',
      code: 'OPF-DLA-01',
      name: 'OpesFuel Bonanjo Plateau',
      city: 'Douala',
      currency: 'FCFA',
      planName: 'Multi-Pump Pro',
      monthlyFeeFcfa: 55000,
      prices: { ...DEFAULT_FUEL_PRICES },
    },
    {
      id: 'st_bastos',
      code: 'OPF-YDE-02',
      name: 'OpesFuel Bastos Express',
      city: 'Yaounde',
      currency: 'FCFA',
      planName: 'Starter Station',
      monthlyFeeFcfa: 25000,
      prices: { ...DEFAULT_FUEL_PRICES },
    },
  ];

  const tanks: FuelTank[] = [
    {
      id: 'tk_01',
      stationId: 'st_plateau',
      name: 'Underground Tank T-01 (Super)',
      grade: 'SUPER',
      capacityLitres: 35000,
      bookVolumeLitres: 24680,
      lastDipLitres: 24645,
      varianceLitres: -35,
      unitCostFcfa: 745,
      status: 'NOMINAL',
    },
    {
      id: 'tk_02',
      stationId: 'st_plateau',
      name: 'Underground Tank T-02 (Gasoil)',
      grade: 'GASOIL',
      capacityLitres: 45000,
      bookVolumeLitres: 31200,
      lastDipLitres: 31180,
      varianceLitres: -20,
      unitCostFcfa: 735,
      status: 'NOMINAL',
    },
    {
      id: 'tk_03',
      stationId: 'st_plateau',
      name: 'Underground Tank T-03 (Kerosene)',
      grade: 'KEROSENE',
      capacityLitres: 15000,
      bookVolumeLitres: 2450,
      lastDipLitres: 2370,
      varianceLitres: -80,
      unitCostFcfa: 470,
      status: 'LOW_STOCK',
    },
    {
      id: 'tk_04',
      stationId: 'st_bastos',
      name: 'Underground Tank B-01 (Super)',
      grade: 'SUPER',
      capacityLitres: 30000,
      bookVolumeLitres: 19400,
      lastDipLitres: 19390,
      varianceLitres: -10,
      unitCostFcfa: 745,
      status: 'NOMINAL',
    },
  ];

  const pumps: Pump[] = [
    {
      id: 'pmp_01',
      stationId: 'st_plateau',
      tankId: 'tk_01',
      code: 'P-01A',
      grade: 'SUPER',
      totalizerLitres: 484210,
      unitPriceFcfa: 840,
      status: 'ACTIVE_SHIFT',
    },
    {
      id: 'pmp_02',
      stationId: 'st_plateau',
      tankId: 'tk_02',
      code: 'P-02A',
      grade: 'GASOIL',
      totalizerLitres: 612940,
      unitPriceFcfa: 828,
      status: 'ACTIVE_SHIFT',
    },
    {
      id: 'pmp_03',
      stationId: 'st_plateau',
      tankId: 'tk_01',
      code: 'P-03B',
      grade: 'SUPER',
      totalizerLitres: 298120,
      unitPriceFcfa: 840,
      status: 'IDLE',
    },
    {
      id: 'pmp_04',
      stationId: 'st_plateau',
      tankId: 'tk_03',
      code: 'P-04K',
      grade: 'KEROSENE',
      totalizerLitres: 114300,
      unitPriceFcfa: 550,
      status: 'IDLE',
    },
    {
      id: 'pmp_05',
      stationId: 'st_bastos',
      tankId: 'tk_04',
      code: 'B-01A',
      grade: 'SUPER',
      totalizerLitres: 205400,
      unitPriceFcfa: 840,
      status: 'IDLE',
    },
  ];

  const employees: Employee[] = [
    {
      id: 'emp_01',
      stationId: 'st_plateau',
      fullName: 'Koffi Mensah',
      role: 'ATTENDANT',
      phone: '+237 677 12 45 90',
      shiftWindow: '06:00 - 14:00',
      clockedIn: true,
      baseSalaryFcfa: 145000,
      cumulativeVarianceFcfa: -2500,
    },
    {
      id: 'emp_02',
      stationId: 'st_plateau',
      fullName: 'Samuel Etoundi',
      role: 'ATTENDANT',
      phone: '+237 699 44 10 21',
      shiftWindow: '06:00 - 14:00',
      clockedIn: true,
      baseSalaryFcfa: 145000,
      cumulativeVarianceFcfa: 0,
    },
    {
      id: 'emp_03',
      stationId: 'st_plateau',
      fullName: 'Amina Diallo',
      role: 'MANAGER',
      phone: '+237 655 81 09 32',
      shiftWindow: '07:30 - 17:30',
      clockedIn: true,
      baseSalaryFcfa: 320000,
      cumulativeVarianceFcfa: 0,
    },
    {
      id: 'emp_04',
      stationId: 'st_plateau',
      fullName: 'Clarisse Ndiaye',
      role: 'ACCOUNTANT',
      phone: '+237 670 33 78 15',
      shiftWindow: '08:00 - 17:00',
      clockedIn: true,
      baseSalaryFcfa: 360000,
      cumulativeVarianceFcfa: 0,
    },
    {
      id: 'emp_05',
      stationId: 'st_bastos',
      fullName: 'Ibrahim Bello',
      role: 'ATTENDANT',
      phone: '+237 691 22 65 40',
      shiftWindow: '06:00 - 14:00',
      clockedIn: false,
      baseSalaryFcfa: 140000,
      cumulativeVarianceFcfa: 0,
    },
  ];

  const shifts: ShiftRecord[] = [
    {
      id: 'sh_101',
      stationId: 'st_plateau',
      pumpId: 'pmp_01',
      pumpCode: 'P-01A',
      grade: 'SUPER',
      attendantId: 'emp_01',
      attendantName: 'Koffi Mensah',
      openingMeterLitres: 484210,
      closingMeterLitres: null,
      litresSold: 0,
      unitPriceFcfa: 840,
      expectedRevenueFcfa: 0,
      cashFcfa: 0,
      mobileMoneyFcfa: 0,
      cardFcfa: 0,
      fleetCreditFcfa: 0,
      varianceFcfa: 0,
      status: 'OPEN',
      openedAt: nowMinusHours(4),
      closedAt: null,
    },
    {
      id: 'sh_102',
      stationId: 'st_plateau',
      pumpId: 'pmp_02',
      pumpCode: 'P-02A',
      grade: 'GASOIL',
      attendantId: 'emp_02',
      attendantName: 'Samuel Etoundi',
      openingMeterLitres: 612940,
      closingMeterLitres: null,
      litresSold: 0,
      unitPriceFcfa: 828,
      expectedRevenueFcfa: 0,
      cashFcfa: 0,
      mobileMoneyFcfa: 0,
      cardFcfa: 0,
      fleetCreditFcfa: 0,
      varianceFcfa: 0,
      status: 'OPEN',
      openedAt: nowMinusHours(4),
      closedAt: null,
    },
    {
      id: 'sh_099',
      stationId: 'st_plateau',
      pumpId: 'pmp_03',
      pumpCode: 'P-03B',
      grade: 'SUPER',
      attendantId: 'emp_01',
      attendantName: 'Koffi Mensah',
      openingMeterLitres: 296270,
      closingMeterLitres: 298120,
      litresSold: 1850,
      unitPriceFcfa: 840,
      expectedRevenueFcfa: 1554000,
      cashFcfa: 920000,
      mobileMoneyFcfa: 411500,
      cardFcfa: 120000,
      fleetCreditFcfa: 100000,
      varianceFcfa: -2500,
      status: 'CLOSED',
      openedAt: nowMinusHours(14),
      closedAt: nowMinusHours(6),
    },
  ];

  const fleetAccounts: FleetAccount[] = [
    {
      id: 'flt_01',
      companyName: 'TransCameroun Logistics SA',
      taxId: 'M041200918442K',
      creditLimitFcfa: 5000000,
      balanceOwedFcfa: 1420000,
      status: 'ACTIVE',
    },
    {
      id: 'flt_02',
      companyName: 'Societe Agro-Express SARL',
      taxId: 'M081700441209B',
      creditLimitFcfa: 2500000,
      balanceOwedFcfa: 685000,
      status: 'ACTIVE',
    },
  ];

  const fleetTransactions: FleetTransaction[] = [
    {
      id: 'ftx_01',
      accountId: 'flt_01',
      companyName: 'TransCameroun Logistics SA',
      stationId: 'st_plateau',
      vehiclePlate: 'LT-482-AK',
      driverName: 'Moussa Oumarou',
      grade: 'GASOIL',
      litres: 320,
      amountFcfa: 264960,
      createdAt: nowMinusHours(5),
    },
  ];

  const shopItems: ShopItem[] = [
    {
      id: 'sku_01',
      stationId: 'st_plateau',
      sku: 'LUB-15W40-5L',
      name: 'OpesLube Heavy Duty 15W40 (5L)',
      category: 'LUBRICANT',
      stockQty: 42,
      reorderLevel: 12,
      unitPriceFcfa: 18500,
      unitCostFcfa: 13200,
    },
    {
      id: 'sku_02',
      stationId: 'st_plateau',
      sku: 'LUB-5W30-1L',
      name: 'Synthetic Motor Oil 5W30 (1L)',
      category: 'LUBRICANT',
      stockQty: 68,
      reorderLevel: 20,
      unitPriceFcfa: 6500,
      unitCostFcfa: 4400,
    },
    {
      id: 'sku_03',
      stationId: 'st_plateau',
      sku: 'LPG-12KG',
      name: 'Domestic Cooking Gas Refill 12.5kg',
      category: 'LPG',
      stockQty: 19,
      reorderLevel: 15,
      unitPriceFcfa: 6500,
      unitCostFcfa: 5400,
    },
  ];

  const purchaseOrders: PurchaseOrder[] = [
    {
      id: 'po_204',
      stationId: 'st_plateau',
      supplierName: 'SCDP Depot Douala',
      grade: 'KEROSENE',
      orderedLitres: 10000,
      unitCostFcfa: 470,
      status: 'PENDING',
      createdAt: nowMinusHours(10),
    },
  ];

  const journals: JournalEntry[] = [
    {
      id: 'je_001',
      stationId: 'st_plateau',
      reference: 'OPENING-CAP',
      sourceEvent: 'StationSeededEvent',
      description: 'Opening station working capital & fuel tank asset valuation',
      postedAt: nowMinusHours(48),
      lines: [
        makeLine('1030', 12000000, 0),
        makeLine('1200', 42473700, 0),
        makeLine('1100', 2105000, 0),
        makeLine('3010', 0, 56578700),
      ],
    },
    {
      id: 'je_002',
      stationId: 'st_plateau',
      reference: 'SHIFT-sh_099',
      sourceEvent: 'ShiftClosedEvent',
      description: 'Shift sh_099 closed (1,850 L Super · Cash, MoMo, Card & Fleet)',
      postedAt: nowMinusHours(6),
      lines: [
        makeLine('1010', 920000, 0),
        makeLine('1020', 411500, 0),
        makeLine('1030', 120000, 0),
        makeLine('1100', 100000, 0),
        makeLine('6100', 2500, 0),
        makeLine('4010', 0, 1303145),
        makeLine('2200', 0, 250855),
        makeLine('5010', 1378250, 0),
        makeLine('1200', 0, 1378250),
      ],
    },
    {
      id: 'je_003',
      stationId: 'st_plateau',
      reference: 'EXP-exp_401',
      sourceEvent: 'ExpenseRecordedEvent',
      description: 'UTILITIES: ENEO 3-Phase Forecourt Power Bill',
      postedAt: nowMinusHours(3),
      lines: [
        makeLine('6010', 185000, 0),
        makeLine('1030', 0, 185000),
      ],
    },
  ];

  const expenses: StationExpense[] = [
    {
      id: 'exp_401',
      stationId: 'st_plateau',
      category: 'UTILITIES',
      description: 'ENEO 3-Phase Forecourt Power Bill',
      amountFcfa: 185000,
      paymentSource: 'BANK',
      status: 'POSTED',
      createdAt: nowMinusHours(3),
    },
  ];

  const deposits: TreasuryDeposit[] = [
    {
      id: 'dep_01',
      stationId: 'st_plateau',
      sourceAccount: 'CASH_ON_HAND',
      bankName: 'Afriland First Bank',
      slipReference: 'AFB-992104',
      amountFcfa: 500000,
      depositedAt: nowMinusHours(2),
    },
  ];

  // Ensure deposit journal matches seed deposit
  journals.unshift({
    id: 'je_004',
    stationId: 'st_plateau',
    reference: 'DEP-dep_01',
    sourceEvent: 'TreasuryDepositedEvent',
    description: 'Safe cash drop deposited to Afriland First Bank (AFB-992104)',
    postedAt: nowMinusHours(2),
    lines: [
      makeLine('1030', 500000, 0),
      makeLine('1010', 0, 500000),
    ],
  });

  const events: DomainEventLog[] = [
    {
      eventId: 'evt_104',
      eventType: 'TreasuryDepositedEvent',
      aggregateType: 'Treasury',
      aggregateId: 'dep_01',
      stationId: 'st_plateau',
      summary: 'Deposited 500 000 FCFA from Cash Safe to Afriland First Bank (AFB-992104).',
      occurredAt: nowMinusHours(2),
      payload: { amountFcfa: 500000, bankName: 'Afriland First Bank' },
    },
    {
      eventId: 'evt_103',
      eventType: 'ExpenseRecordedEvent',
      aggregateType: 'Accounting',
      aggregateId: 'exp_401',
      stationId: 'st_plateau',
      summary: 'Expense UTILITIES posted: 185 000 FCFA (ENEO 3-Phase Forecourt Power Bill).',
      occurredAt: nowMinusHours(3),
      payload: { category: 'UTILITIES', amountFcfa: 185000 },
    },
    {
      eventId: 'evt_102',
      eventType: 'ShiftClosedEvent',
      aggregateType: 'ForecourtShift',
      aggregateId: 'sh_099',
      stationId: 'st_plateau',
      summary: 'Shift sh_099 closed: 1,850 L Super sold, 1 554 000 FCFA expected, -2 500 FCFA variance.',
      occurredAt: nowMinusHours(6),
      payload: { litresSold: 1850, expectedRevenueFcfa: 1554000, varianceFcfa: -2500 },
    },
  ];

  const apiKeys: ApiKeyRecord[] = [
    {
      id: 'key_01',
      label: 'Sage / SYSCOHADA ERP Sync',
      maskedKey: 'opf_live_84f2a1_••••••••••••',
      scopes: ['accounting:read', 'events:read', 'stations:read'],
      createdAt: nowMinusHours(72),
    },
    {
      id: 'key_02',
      label: 'Mobile App Attendant Fleet (Android & iPhone)',
      maskedKey: 'opf_live_19c4d8_••••••••••••',
      scopes: ['forecourt:write', 'inventory:write', 'fleet:write'],
      createdAt: nowMinusHours(36),
    },
  ];

  const webhooks: WebhookSubscription[] = [
    {
      id: 'wh_01',
      targetUrl: 'https://erp.transcameroun.cm/hooks/opesfuel',
      subscribedEvents: ['ShiftClosedEvent', 'FleetAccountSettledEvent'],
      active: true,
    },
    {
      id: 'wh_02',
      targetUrl: 'https://alerts.opesware.com/depot-watch',
      subscribedEvents: ['DipstickVarianceFlaggedEvent', 'FuelDeliveryRecordedEvent'],
      active: true,
    },
  ];

  const deliveries: TankDeliveryRecord[] = [
    {
      id: 'del_101',
      tankId: 'tk_01',
      tankName: 'Underground Tank T-01 (Super)',
      supplierName: 'SCDP Depot Douala',
      bolLitres: 15000,
      actualReceivedLitres: 14975,
      unitCostFcfa: 745,
      totalInvoiceFcfa: 11156375,
      receivedAt: nowMinusHours(30),
    },
  ];

  const dipsticks: DipstickReadingRecord[] = [
    {
      id: 'dip_101',
      tankId: 'tk_01',
      tankName: 'Underground Tank T-01 (Super)',
      bookLitres: 24680,
      measuredLitres: 24645,
      varianceLitres: -35,
      recordedAt: nowMinusHours(5),
    },
    {
      id: 'dip_102',
      tankId: 'tk_03',
      tankName: 'Underground Tank T-03 (Kerosene)',
      bookLitres: 2450,
      measuredLitres: 2370,
      varianceLitres: -80,
      recordedAt: nowMinusHours(5),
    },
  ];

  return {
    tenant,
    stations,
    tanks,
    pumps,
    shifts,
    fleetAccounts,
    fleetTransactions,
    shopItems,
    purchaseOrders,
    deliveries,
    dipsticks,
    employees,
    journals,
    expenses,
    deposits,
    events,
    apiKeys,
    webhooks,
  };
}

export function createCleanTenantState(params: {
  organizationName: string;
  ownerName: string;
  ownerEmail: string;
  stationCode: string;
  stationName: string;
  city: string;
  planName: string;
  monthlyFeeFcfa: number;
}): OpesFuelStoreState {
  const stationId = `st_${Math.random().toString(36).slice(2, 8)}`;
  return {
    tenant: {
      tenantId: `ten_${Math.random().toString(36).slice(2, 8)}`,
      organizationName: params.organizationName.trim(),
      ownerName: params.ownerName.trim(),
      ownerEmail: params.ownerEmail.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
      isSampleData: false,
      aiSubscription: {
        active: params.monthlyFeeFcfa >= 120000,
        planCode: params.monthlyFeeFcfa >= 120000 ? 'INCLUDED_ENTERPRISE' : 'AI_COPILOT_ADDON',
        monthlyFeeFcfa: params.monthlyFeeFcfa >= 120000 ? 0 : 25000,
        activatedAt: params.monthlyFeeFcfa >= 120000 ? new Date().toISOString() : null,
      },
      onboardingCompletedSteps: [],
    },
    stations: [
      {
        id: stationId,
        code: params.stationCode.trim().toUpperCase(),
        name: params.stationName.trim(),
        city: params.city.trim(),
        currency: 'FCFA',
        planName: params.planName,
        monthlyFeeFcfa: params.monthlyFeeFcfa,
        prices: { ...DEFAULT_FUEL_PRICES },
      },
    ],
    tanks: [],
    pumps: [],
    shifts: [],
    fleetAccounts: [],
    fleetTransactions: [],
    shopItems: [],
    purchaseOrders: [],
    deliveries: [],
    dipsticks: [],
    employees: [],
    journals: [],
    expenses: [],
    deposits: [],
    events: [
      {
        eventId: `evt_${Math.random().toString(36).slice(2, 8)}`,
        eventType: 'TenantWorkspaceProvisionedEvent',
        aggregateType: 'Tenant',
        aggregateId: stationId,
        stationId,
        summary: `Provisioned clean SaaS workspace for ${params.organizationName.trim()} (${params.stationName.trim()}).`,
        occurredAt: new Date().toISOString(),
        payload: { planName: params.planName, monthlyFeeFcfa: params.monthlyFeeFcfa },
      },
    ],
    apiKeys: [],
    webhooks: [],
  };
}

export function computeFinancialReports(state: OpesFuelStoreState, stationId: string): FinancialReportBundle {
  const stationJournals = state.journals.filter((j) => stationId === 'ALL' || j.stationId === stationId);
  const debitTotals = new Map<string, number>();
  const creditTotals = new Map<string, number>();

  for (const acc of CHART_OF_ACCOUNTS) {
    debitTotals.set(acc.code, 0);
    creditTotals.set(acc.code, 0);
  }

  for (const entry of stationJournals) {
    for (const line of entry.lines) {
      debitTotals.set(line.accountCode, (debitTotals.get(line.accountCode) ?? 0) + line.debitFcfa);
      creditTotals.set(line.accountCode, (creditTotals.get(line.accountCode) ?? 0) + line.creditFcfa);
    }
  }

  let totalDebitSum = 0;
  let totalCreditSum = 0;

  const trialBalance: TrialBalanceRow[] = CHART_OF_ACCOUNTS.map((acc) => {
    const d = debitTotals.get(acc.code) ?? 0;
    const c = creditTotals.get(acc.code) ?? 0;
    totalDebitSum += d;
    totalCreditSum += c;
    const net =
      acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE'
        ? d - c
        : c - d;
    return {
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.accountType,
      debitTotalFcfa: d,
      creditTotalFcfa: c,
      netBalanceFcfa: net,
    };
  });

  const netOf = (code: string) => trialBalance.find((r) => r.accountCode === code)?.netBalanceFcfa ?? 0;

  const fuelRev = netOf('4010');
  const nonFuelRevenueFcfa = netOf('4020');
  const totalRevenueFcfa = fuelRev + nonFuelRevenueFcfa;
  const cogsFcfa = netOf('5010');
  const grossProfitFcfa = totalRevenueFcfa - cogsFcfa;
  const operatingExpensesFcfa = netOf('6010');
  const cashVarianceFcfa = netOf('6100');
  const netIncomeFcfa = grossProfitFcfa - operatingExpensesFcfa - cashVarianceFcfa;

  return {
    currency: 'FCFA',
    totalRevenueFcfa,
    nonFuelRevenueFcfa,
    cogsFcfa,
    grossProfitFcfa,
    operatingExpensesFcfa,
    cashVarianceFcfa,
    netIncomeFcfa,
    vatPayableFcfa: netOf('2200'),
    cashOnHandFcfa: netOf('1010'),
    mobileMoneyClearingFcfa: netOf('1020'),
    bankBalanceFcfa: netOf('1030'),
    fleetReceivablesFcfa: netOf('1100'),
    inventoryAssetFcfa: netOf('1200'),
    accountsPayableFcfa: netOf('2010'),
    trialBalanceBalanced: totalDebitSum === totalCreditSum,
    trialBalance,
  };
}

export class OpesFuelApiEngine {
  private state: OpesFuelStoreState;
  private readonly springBootBaseUrl: string;
  private accessToken: string | null = null;
  private onRemoteError: ((message: string) => void) | null = null;
  private onStateSynced: ((nextState: OpesFuelStoreState) => void) | null = null;

  constructor(initialState?: OpesFuelStoreState) {
    this.springBootBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    if (initialState) {
      this.state = initialState;
    } else {
      this.state = this.loadPersistedState() ?? createSeedState();
    }
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getSpringBootBaseUrl(): string {
    return this.springBootBaseUrl;
  }

  setRemoteCallbacks(callbacks: {
    onError?: (message: string) => void;
    onSynced?: (nextState: OpesFuelStoreState) => void;
  }) {
    this.onRemoteError = callbacks.onError ?? null;
    this.onStateSynced = callbacks.onSynced ?? null;
  }

  private loadPersistedState(): OpesFuelStoreState | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<OpesFuelStoreState>;
      if (!parsed || !Array.isArray(parsed.stations) || parsed.stations.length === 0) return null;
      const fallback = createSeedState();
      const stations = parsed.stations.map((s) => ({
        ...s,
        prices: normalizeStationPrices(s.prices),
      }));
      const mergedTenant: TenantWorkspace = {
        ...fallback.tenant,
        ...(parsed.tenant ?? {}),
        aiSubscription: parsed.tenant?.aiSubscription ?? fallback.tenant.aiSubscription,
        onboardingCompletedSteps: parsed.tenant?.onboardingCompletedSteps ?? fallback.tenant.onboardingCompletedSteps,
      };
      return {
        ...fallback,
        ...parsed,
        stations,
        tenant: mergedTenant,
      };
    } catch {
      return null;
    }
  }

  private persistState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore quota errors in restricted iframe environments
    }
  }

  getTransportMode(): 'SPRING_BOOT_REMOTE' | 'OPENAPI_PREVIEW_ADAPTER' {
    return this.springBootBaseUrl ? 'SPRING_BOOT_REMOTE' : 'OPENAPI_PREVIEW_ADAPTER';
  }

  getSnapshot(): OpesFuelStoreState {
    this.persistState();
    return structuredClone(this.state);
  }

  private assertRole(role: UserRole, allowed: boolean, actionLabel: string) {
    if (!allowed) {
      throw new Error(`403 Forbidden (Auth0 RBAC): Role ${role} cannot execute ${actionLabel}.`);
    }
  }

  private pushJournal(
    stationId: string,
    reference: string,
    sourceEvent: string,
    description: string,
    lines: Array<Omit<JournalLine, 'accountName'> & { accountName?: string }>
  ) {
    const cleanLines: JournalLine[] = lines
      .filter((l) => l.debitFcfa > 0 || l.creditFcfa > 0)
      .map((l) => ({
        accountCode: l.accountCode,
        accountName: l.accountName ?? CHART_OF_ACCOUNTS.find((a) => a.code === l.accountCode)?.name ?? l.accountCode,
        debitFcfa: l.debitFcfa,
        creditFcfa: l.creditFcfa,
      }));
    const debitSum = cleanLines.reduce((s, l) => s + l.debitFcfa, 0);
    const creditSum = cleanLines.reduce((s, l) => s + l.creditFcfa, 0);
    if (debitSum !== creditSum) {
      throw new Error(`Double-entry invariant violated: debit=${debitSum}, credit=${creditSum}`);
    }
    this.state.journals.unshift({
      id: `je_${Math.random().toString(36).slice(2, 8)}`,
      stationId,
      reference,
      sourceEvent,
      description,
      postedAt: new Date().toISOString(),
      lines: cleanLines,
    });
  }

  private pushEvent(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    stationId: string,
    summary: string,
    payload: Record<string, unknown>
  ) {
    this.state.events.unshift({
      eventId: `evt_${Math.random().toString(36).slice(2, 8)}`,
      eventType,
      aggregateType,
      aggregateId,
      stationId,
      summary,
      occurredAt: new Date().toISOString(),
      payload,
    });
  }

  private async extractErrorMessage(res: Response): Promise<string> {
    try {
      const text = await res.text();
      if (!text) return `HTTP ${res.status} ${res.statusText}`;
      try {
        const parsed = JSON.parse(text) as { detail?: string; title?: string; message?: string; error?: string };
        return parsed.detail || parsed.message || parsed.title || parsed.error || `HTTP ${res.status}`;
      } catch {
        return text.slice(0, 220);
      }
    } catch {
      return `HTTP ${res.status} ${res.statusText}`;
    }
  }

  private async dispatchRemoteIfConfigured(
    path: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: unknown,
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) return;
    const effectiveToken = token ?? this.accessToken;
    try {
      const res = await fetch(`${this.springBootBaseUrl}/api/v1${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        const detail = await this.extractErrorMessage(res);
        this.onRemoteError?.(`Backend rejected ${method} ${path} (${res.status}): ${detail}`);
        // Re-hydrate from server to roll back rejected optimistic local state
        const authoritative = await this.hydrateFromSpringBoot(effectiveToken);
        if (authoritative) {
          this.onStateSynced?.(authoritative);
        }
        return;
      }
      // Adopt server-generated UUIDs, calculated WAC COGS, and authoritative ledger entries
      const synced = await this.hydrateFromSpringBoot(effectiveToken);
      if (synced) {
        this.onStateSynced?.(synced);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error reaching Spring Boot API';
      this.onRemoteError?.(`Sync warning (${method} ${path}): ${msg}`);
    }
  }

  createTenantWorkspace(input: {
    organizationName: string;
    ownerName: string;
    ownerEmail: string;
    stationCode: string;
    stationName: string;
    city: string;
    planName: string;
    monthlyFeeFcfa: number;
    includeSampleData: boolean;
  }) {
    if (input.includeSampleData) {
      const seeded = createSeedState();
      const enterpriseIncluded = input.monthlyFeeFcfa >= 120000;
      seeded.tenant = {
        tenantId: `ten_${Math.random().toString(36).slice(2, 8)}`,
        organizationName: input.organizationName.trim(),
        ownerName: input.ownerName.trim(),
        ownerEmail: input.ownerEmail.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        isSampleData: true,
        aiSubscription: {
          active: enterpriseIncluded,
          planCode: enterpriseIncluded ? 'INCLUDED_ENTERPRISE' : 'AI_COPILOT_ADDON',
          monthlyFeeFcfa: enterpriseIncluded ? 0 : 25000,
          activatedAt: enterpriseIncluded ? new Date().toISOString() : null,
        },
        onboardingCompletedSteps: seeded.tenant.onboardingCompletedSteps,
      };
      seeded.stations[0] = {
        ...seeded.stations[0],
        code: input.stationCode.trim().toUpperCase(),
        name: input.stationName.trim(),
        city: input.city.trim(),
        planName: input.planName,
        monthlyFeeFcfa: input.monthlyFeeFcfa,
        prices: { ...DEFAULT_FUEL_PRICES },
      };
      this.state = seeded;
    } else {
      this.state = createCleanTenantState(input);
    }
    void this.dispatchRemoteIfConfigured('/tenants/onboard', 'POST', {
      organizationName: input.organizationName,
      ownerName: input.ownerName,
      ownerEmail: input.ownerEmail,
      stationCode: input.stationCode,
      stationName: input.stationName,
      city: input.city,
      planName: input.planName,
      monthlyFeeFcfa: input.monthlyFeeFcfa,
    });
    return this.getSnapshot();
  }

  clearAllDemoData(role: UserRole) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_STATIONS_PRICES'), 'ClearDemoDataCommand');
    const primaryStation = {
      ...this.state.stations[0],
      prices: normalizeStationPrices(this.state.stations[0].prices),
    };
    this.state = {
      tenant: {
        ...this.state.tenant,
        isSampleData: false,
        onboardingCompletedSteps: [],
      },
      stations: [primaryStation],
      tanks: [],
      pumps: [],
      shifts: [],
      fleetAccounts: [],
      fleetTransactions: [],
      shopItems: [],
      purchaseOrders: [],
      deliveries: [],
      dipsticks: [],
      employees: [],
      journals: [],
      expenses: [],
      deposits: [],
      events: [
        {
          eventId: `evt_${Math.random().toString(36).slice(2, 8)}`,
          eventType: 'WorkspaceResetCleanEvent',
          aggregateType: 'Tenant',
          aggregateId: this.state.tenant.tenantId,
          stationId: primaryStation.id,
          summary: `Cleared all demo operational & ledger data. Clean SaaS workspace ready for ${primaryStation.name}.`,
          occurredAt: new Date().toISOString(),
          payload: { cleared: true },
        },
      ],
      apiKeys: [],
      webhooks: [],
    };
    void this.dispatchRemoteIfConfigured('/tenants/current/reset-demo', 'POST');
    return this.getSnapshot();
  }

  restoreSampleDemoData(role: UserRole) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_STATIONS_PRICES'), 'RestoreDemoDataCommand');
    this.state = createSeedState();
    return this.getSnapshot();
  }

  createStation(role: UserRole, input: { code: string; name: string; city: string; planName: string; monthlyFeeFcfa: number }) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_STATIONS_PRICES'), 'CreateStationCommand');
    const st: Station = {
      id: `st_${Math.random().toString(36).slice(2, 8)}`,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      city: input.city.trim(),
      currency: 'FCFA',
      planName: input.planName,
      monthlyFeeFcfa: input.monthlyFeeFcfa,
      prices: { ...DEFAULT_FUEL_PRICES },
    };
    this.state.stations.push(st);
    this.pushEvent('StationOnboardedEvent', 'Station', st.id, st.id, `Onboarded station ${st.name} (${st.city}).`, { code: st.code });
    void this.dispatchRemoteIfConfigured('/stations', 'POST', input);
    return this.getSnapshot();
  }

  updateStation(role: UserRole, stationId: string, input: { code: string; name: string; city: string }) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_STATIONS_PRICES'), 'UpdateStationCommand');
    const station = this.state.stations.find((s) => s.id === stationId);
    if (!station) throw new Error('Station not found.');
    if (!input.code.trim() || !input.name.trim() || !input.city.trim()) {
      throw new Error('Station code, name, and city are required.');
    }
    station.code = input.code.trim().toUpperCase();
    station.name = input.name.trim();
    station.city = input.city.trim();
    this.pushEvent(
      'StationUpdatedEvent',
      'Station',
      stationId,
      stationId,
      `Updated station metadata: ${station.name} (${station.code}, ${station.city}).`,
      { code: station.code, name: station.name, city: station.city }
    );
    void this.dispatchRemoteIfConfigured(`/stations/${stationId}`, 'PUT', {
      code: station.code,
      name: station.name,
      city: station.city,
    });
    return this.getSnapshot();
  }

  deleteStation(role: UserRole, stationId: string) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_STATIONS_PRICES'), 'DeleteStationCommand');
    if (this.state.stations.length <= 1) {
      throw new Error('At least one active petrol station must remain in the SaaS workspace.');
    }
    const target = this.state.stations.find((s) => s.id === stationId);
    if (!target) throw new Error('Station not found.');
    this.state.stations = this.state.stations.filter((s) => s.id !== stationId);
    this.state.pumps = this.state.pumps.filter((p) => p.stationId !== stationId);
    this.state.tanks = this.state.tanks.filter((t) => t.stationId !== stationId);
    this.state.shifts = this.state.shifts.filter((sh) => sh.stationId !== stationId);
    this.state.employees = this.state.employees.filter((e) => e.stationId !== stationId);
    this.state.shopItems = this.state.shopItems.filter((i) => i.stationId !== stationId);
    this.state.purchaseOrders = this.state.purchaseOrders.filter((po) => po.stationId !== stationId);
    this.state.expenses = this.state.expenses.filter((ex) => ex.stationId !== stationId);
    this.state.deposits = this.state.deposits.filter((d) => d.stationId !== stationId);
    this.state.journals = this.state.journals.filter((j) => j.stationId !== stationId);
    this.pushEvent('StationRemovedEvent', 'Station', stationId, stationId, `Removed station ${target.name} (${target.code}).`, { code: target.code });
    void this.dispatchRemoteIfConfigured(`/stations/${stationId}`, 'DELETE');
    return this.getSnapshot();
  }

  updateStationSubscription(role: UserRole, stationId: string, planName: string, monthlyFeeFcfa: number) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_STATIONS_PRICES'), 'UpdateSubscriptionCommand');
    const station = this.state.stations.find((s) => s.id === stationId);
    if (!station) throw new Error('Station not found.');
    station.planName = planName;
    station.monthlyFeeFcfa = monthlyFeeFcfa;
    if (monthlyFeeFcfa >= 120000) {
      this.state.tenant.aiSubscription = {
        active: true,
        planCode: 'INCLUDED_ENTERPRISE',
        monthlyFeeFcfa: 0,
        activatedAt: this.state.tenant.aiSubscription.activatedAt ?? new Date().toISOString(),
      };
    }
    this.pushEvent(
      'SubscriptionUpdatedEvent',
      'Billing',
      stationId,
      stationId,
      `Updated ${station.name} subscription to ${planName} (${monthlyFeeFcfa} FCFA/mo).`,
      { planName, monthlyFeeFcfa }
    );
    void this.dispatchRemoteIfConfigured(`/stations/${stationId}/subscription`, 'PUT', { planName, monthlyFeeFcfa });
    return this.getSnapshot();
  }

  activateAiSubscription(role: UserRole, enable: boolean) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_AI_ADDON'), 'UpdateAiSubscriptionCommand');
    const hasEnterprise = this.state.stations.some((s) => s.monthlyFeeFcfa >= 120000);
    const planCode = hasEnterprise ? 'INCLUDED_ENTERPRISE' : 'AI_COPILOT_ADDON';
    const monthlyFeeFcfa = hasEnterprise ? 0 : 25000;
    this.state.tenant.aiSubscription = {
      active: enable,
      planCode,
      monthlyFeeFcfa,
      activatedAt: enable ? new Date().toISOString() : null,
    };
    const primaryStationId = this.state.stations[0]?.id ?? 'st_plateau';
    this.pushEvent(
      'AiCopilotSubscriptionUpdatedEvent',
      'Billing',
      this.state.tenant.tenantId,
      primaryStationId,
      enable
        ? `Activated Paid AI Copilot (${hasEnterprise ? 'Included on Network Enterprise' : '25 000 FCFA/month'}).`
        : 'Paused Paid AI Copilot subscription.',
      { active: enable, planCode, monthlyFeeFcfa }
    );
    void this.dispatchRemoteIfConfigured('/ai/subscription/activate', 'POST', {
      stationId: primaryStationId,
      active: enable,
      planCode,
    });
    return this.getSnapshot();
  }

  runInstitutionalSetup(
    role: UserRole,
    stationId: string,
    selections: InstitutionalSetupSelection[],
    lubricantsPack?: { includeLubricants: boolean; oilBottlesQty: number; lpgCylindersQty: number }
  ) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DELIVERY'), 'StationInstitutionalSetupCommand');
    const station = this.state.stations.find((s) => s.id === stationId);
    if (!station) throw new Error('Station not found.');
    if (selections.length === 0) throw new Error('Select at least one fuel product to provision.');

    let openingInventoryAssetFcfa = 0;
    let provisionedNozzles = 0;

    for (const sel of selections) {
      station.prices[sel.grade] = Math.round(sel.sellingPriceFcfa);

      const existingTank = this.state.tanks.find(
        (t) => t.stationId === stationId && t.grade === sel.grade && t.name.toLowerCase() === sel.tankName.toLowerCase()
      );

      let targetTankId: string;
      if (existingTank) {
        existingTank.capacityLitres = sel.capacityLitres;
        existingTank.bookVolumeLitres = sel.openingLitres;
        existingTank.lastDipLitres = sel.openingLitres;
        existingTank.varianceLitres = 0;
        existingTank.unitCostFcfa = Math.round(sel.unitCostFcfa);
        existingTank.status = sel.openingLitres / sel.capacityLitres < 0.2 ? 'LOW_STOCK' : 'NOMINAL';
        targetTankId = existingTank.id;
      } else {
        const tank: FuelTank = {
          id: `tk_${Math.random().toString(36).slice(2, 7)}`,
          stationId,
          name: sel.tankName.trim(),
          grade: sel.grade,
          capacityLitres: sel.capacityLitres,
          bookVolumeLitres: sel.openingLitres,
          lastDipLitres: sel.openingLitres,
          varianceLitres: 0,
          unitCostFcfa: Math.round(sel.unitCostFcfa),
          status: sel.openingLitres / sel.capacityLitres < 0.2 ? 'LOW_STOCK' : 'NOMINAL',
        };
        this.state.tanks.push(tank);
        targetTankId = tank.id;
      }

      openingInventoryAssetFcfa += Math.round(sel.openingLitres * sel.unitCostFcfa);

      // Update any existing pumps of this grade to match new tariff
      for (const pump of this.state.pumps) {
        if (pump.stationId === stationId && pump.grade === sel.grade) {
          pump.unitPriceFcfa = Math.round(sel.sellingPriceFcfa);
        }
      }

      const existingGradePumps = this.state.pumps.filter((p) => p.stationId === stationId && p.grade === sel.grade).length;
      const missingNozzles = Math.max(0, sel.nozzleCount - existingGradePumps);
      for (let i = 0; i < missingNozzles; i++) {
        const seq = this.state.pumps.filter((p) => p.stationId === stationId).length + 1;
        const prefix = sel.grade.slice(0, 3);
        const pump: Pump = {
          id: `pmp_${Math.random().toString(36).slice(2, 7)}`,
          stationId,
          tankId: targetTankId,
          code: `P-${String(seq).padStart(2, '0')}${prefix.charAt(0)}`,
          grade: sel.grade,
          totalizerLitres: 0,
          unitPriceFcfa: Math.round(sel.sellingPriceFcfa),
          status: 'IDLE',
        };
        this.state.pumps.push(pump);
        provisionedNozzles += 1;
      }
    }

    if (lubricantsPack?.includeLubricants) {
      if (lubricantsPack.oilBottlesQty > 0) {
        const oilItem: ShopItem = {
          id: `sku_${Math.random().toString(36).slice(2, 7)}`,
          stationId,
          sku: 'LUB-15W40-5L',
          name: 'Heavy Duty Engine Oil 15W40 (5L)',
          category: 'LUBRICANT',
          stockQty: lubricantsPack.oilBottlesQty,
          reorderLevel: 10,
          unitPriceFcfa: 18500,
          unitCostFcfa: 13200,
        };
        this.state.shopItems.push(oilItem);
        openingInventoryAssetFcfa += lubricantsPack.oilBottlesQty * 13200;
      }
      if (lubricantsPack.lpgCylindersQty > 0) {
        const lpgItem: ShopItem = {
          id: `sku_${Math.random().toString(36).slice(2, 7)}`,
          stationId,
          sku: 'LPG-12KG',
          name: 'Cooking Gas Cylinder Refill 12.5kg',
          category: 'LPG',
          stockQty: lubricantsPack.lpgCylindersQty,
          reorderLevel: 12,
          unitPriceFcfa: 6500,
          unitCostFcfa: 5400,
        };
        this.state.shopItems.push(lpgItem);
        openingInventoryAssetFcfa += lubricantsPack.lpgCylindersQty * 5400;
      }
    }

    if (openingInventoryAssetFcfa > 0) {
      this.pushJournal(
        stationId,
        `INIT-${Date.now().toString().slice(-6)}`,
        'StationInstitutionalSetupEvent',
        `Institutional inventory & pump sync for ${station.name} (${selections.length} grades, ${provisionedNozzles} nozzles)`,
        [makeLine('1200', openingInventoryAssetFcfa, 0), makeLine('3010', 0, openingInventoryAssetFcfa)]
      );
    }

    if (!this.state.tenant.onboardingCompletedSteps.includes('INSTITUTIONAL_FUELS_VOLUMES')) {
      this.state.tenant.onboardingCompletedSteps.push('INSTITUTIONAL_FUELS_VOLUMES');
    }

    this.pushEvent(
      'StationInstitutionalSetupEvent',
      'StationOnboarding',
      stationId,
      stationId,
      `Synchronized ${selections.length} fuel grades & opening volumes (${openingInventoryAssetFcfa} FCFA capital) across Inventory, Forecourt, and Ledger for ${station.name}.`,
      { gradesCount: selections.length, provisionedNozzles, openingInventoryAssetFcfa }
    );

    void this.dispatchRemoteIfConfigured(`/stations/${stationId}/onboarding-setup`, 'POST', {
      items: selections,
      lubricantsPack,
    });
    return this.getSnapshot();
  }

  async hydrateFromSpringBoot(token?: string | null): Promise<OpesFuelStoreState | null> {
    if (!this.springBootBaseUrl) return null;
    try {
      const effectiveToken = token ?? this.accessToken;
      const headers: Record<string, string> = effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {};
      const fetchJson = async <T,>(path: string): Promise<T | null> => {
        try {
          const res = await fetch(`${this.springBootBaseUrl}/api/v1${path}`, { headers });
          if (!res.ok) return null;
          return (await res.json()) as T;
        } catch {
          return null;
        }
      };

      const [rawTenant, rawStations] = await Promise.all([
        fetchJson<{ id: string; name: string; ownerEmail: string; createdAt?: string }>('/tenants/current'),
        fetchJson<Array<Omit<Station, 'prices'> & { prices?: Partial<Record<FuelGrade, number>> }>>('/stations'),
      ]);
      if (rawTenant && rawTenant.id) {
        this.state.tenant = {
          ...this.state.tenant,
          tenantId: rawTenant.id,
          organizationName: rawTenant.name || this.state.tenant.organizationName,
          ownerEmail: rawTenant.ownerEmail || this.state.tenant.ownerEmail,
          createdAt: rawTenant.createdAt || this.state.tenant.createdAt,
          isSampleData: false,
        };
      }
      if (!Array.isArray(rawStations) || rawStations.length === 0) return null;

      const priceLists = await Promise.all(
        rawStations.map((s) =>
          fetchJson<Array<{ grade: FuelGrade; pricePerLitreFcfa: number }>>(`/stations/${s.id}/fuel-prices`)
        )
      );

      this.state.stations = rawStations.map((s, idx) => {
        const pricesMap: Partial<Record<FuelGrade, number>> = { ...(s.prices ?? {}) };
        const entries = priceLists[idx];
        if (Array.isArray(entries)) {
          // fuel-prices returns newest first; first occurrence per grade is active tariff
          for (const entry of entries) {
            if (pricesMap[entry.grade] === undefined) {
              pricesMap[entry.grade] = Number(entry.pricePerLitreFcfa);
            }
          }
        }
        return {
          ...s,
          currency: 'FCFA',
          prices: normalizeStationPrices(pricesMap),
        };
      });

      const primaryStationId = this.state.stations[0].id;

      const [
        rawTanks,
        rawPumps,
        rawShifts,
        rawEmployees,
        rawFleetAccounts,
        rawFleetTx,
        rawShopItems,
        rawPurchaseOrders,
        rawDeliveries,
        rawDipsticks,
        rawJournals,
        rawExpenses,
        rawDeposits,
        rawEvents,
        rawApiKeys,
        rawWebhooks,
        rawAiSub,
        rawOnboardingSteps,
      ] = await Promise.all([
        fetchJson<Array<{ id: string; stationId: string; name: string; grade: FuelGrade; capacityLitres: number; bookVolumeLitres: number; lastDipLitres: number; unitCostFcfa: number }>>('/inventory/tanks?stationId=ALL'),
        fetchJson<Pump[]>('/forecourt/pumps?stationId=ALL'),
        fetchJson<Array<{ id: string; stationId: string; pumpId: string; attendantId: string; openingMeterLitres: number; closingMeterLitres: number | null; unitPriceFcfa: number; cashFcfa: number; mobileMoneyFcfa: number; cardFcfa: number; fleetCreditFcfa: number; varianceFcfa: number; status: 'OPEN' | 'CLOSED'; openedAt: string; closedAt: string | null }>>('/forecourt/shifts?stationId=ALL'),
        fetchJson<Employee[]>('/workforce/employees?stationId=ALL'),
        fetchJson<FleetAccount[]>('/fleet/accounts'),
        fetchJson<Array<{ id: string; accountId: string; stationId: string; vehiclePlate: string; driverName: string; grade: FuelGrade; litres: number; amountFcfa: number; createdAt: string }>>('/fleet/vouchers'),
        fetchJson<Array<{ id: string; stationId: string; sku: string; name: string; category: ShopItem['category']; stockQty: number; reorderLevel: number; unitPriceFcfa: number; unitCostFcfa?: number }>>('/shop/items?stationId=ALL'),
        fetchJson<PurchaseOrder[]>('/inventory/purchase-orders?stationId=ALL'),
        fetchJson<Array<{ id: string; tankId: string; supplierName: string; bolLitres: number; actualReceivedLitres: number; unitCostFcfa: number; receivedAt: string }>>('/inventory/deliveries'),
        fetchJson<Array<{ id: string; tankId: string; bookLitres: number; measuredLitres: number; varianceLitres: number; recordedAt: string }>>('/inventory/dipsticks'),
        fetchJson<Array<{ id: string; stationId: string; reference: string; sourceEvent: string; description: string; postedAt: string; lines: Array<{ accountCode: string; debitFcfa: number; creditFcfa: number }> }>>('/accounting/journals?stationId=ALL'),
        fetchJson<StationExpense[]>('/accounting/expenses?stationId=ALL'),
        fetchJson<TreasuryDeposit[]>('/accounting/deposits?stationId=ALL'),
        fetchJson<Array<{ eventId: string; eventType: string; aggregateType: string; aggregateId: string; summary: string; occurredAt: string }>>('/platform/events'),
        fetchJson<ApiKeyRecord[]>('/platform/api-keys'),
        fetchJson<WebhookSubscription[]>('/platform/webhooks'),
        fetchJson<{ active: boolean; planCode: 'AI_COPILOT_ADDON' | 'INCLUDED_ENTERPRISE'; monthlyFeeFcfa: number; activatedAt: string | null }>(`/ai/subscription?stationId=${encodeURIComponent(primaryStationId)}`),
        fetchJson<Array<{ stepKey: string }>>(`/stations/${encodeURIComponent(primaryStationId)}/onboarding-steps`),
      ]);

      if (Array.isArray(rawTanks)) {
        this.state.tanks = rawTanks.map((t) => {
          const cap = Number(t.capacityLitres) || 1;
          const book = Number(t.bookVolumeLitres) || 0;
          const dip = Number(t.lastDipLitres) || 0;
          const varianceLitres = Number((dip - book).toFixed(2));
          const status: FuelTank['status'] =
            Math.abs(varianceLitres) > 100
              ? 'VARIANCE_ALERT'
              : book / cap < 0.2
              ? 'LOW_STOCK'
              : 'NOMINAL';
          return {
            id: t.id,
            stationId: t.stationId,
            name: t.name,
            grade: t.grade,
            capacityLitres: cap,
            bookVolumeLitres: book,
            lastDipLitres: dip,
            varianceLitres,
            unitCostFcfa: Number(t.unitCostFcfa),
            status,
          };
        });
      }

      if (Array.isArray(rawPumps)) {
        this.state.pumps = rawPumps.map((p) => ({
          ...p,
          totalizerLitres: Number(p.totalizerLitres),
          unitPriceFcfa: Number(p.unitPriceFcfa),
        }));
      }

      if (Array.isArray(rawEmployees)) {
        this.state.employees = rawEmployees.map((e) => ({
          ...e,
          baseSalaryFcfa: Number(e.baseSalaryFcfa),
          cumulativeVarianceFcfa: Number(e.cumulativeVarianceFcfa),
        }));
      }

      if (Array.isArray(rawShifts)) {
        this.state.shifts = rawShifts.map((sh) => {
          const pump = this.state.pumps.find((p) => p.id === sh.pumpId);
          const emp = this.state.employees.find((e) => e.id === sh.attendantId);
          const opening = Number(sh.openingMeterLitres) || 0;
          const closing = sh.closingMeterLitres != null ? Number(sh.closingMeterLitres) : null;
          const litresSold = closing != null ? Number(Math.max(0, closing - opening).toFixed(2)) : 0;
          const unitPrice = Number(sh.unitPriceFcfa) || pump?.unitPriceFcfa || 0;
          return {
            id: sh.id,
            stationId: sh.stationId,
            pumpId: sh.pumpId,
            pumpCode: pump?.code ?? sh.pumpId,
            grade: pump?.grade ?? 'SUPER',
            attendantId: sh.attendantId,
            attendantName: emp?.fullName ?? sh.attendantId,
            openingMeterLitres: opening,
            closingMeterLitres: closing,
            litresSold,
            unitPriceFcfa: unitPrice,
            expectedRevenueFcfa: Math.round(litresSold * unitPrice),
            cashFcfa: Number(sh.cashFcfa) || 0,
            mobileMoneyFcfa: Number(sh.mobileMoneyFcfa) || 0,
            cardFcfa: Number(sh.cardFcfa) || 0,
            fleetCreditFcfa: Number(sh.fleetCreditFcfa) || 0,
            varianceFcfa: Number(sh.varianceFcfa) || 0,
            status: sh.status,
            openedAt: sh.openedAt,
            closedAt: sh.closedAt,
          };
        });
      }

      if (Array.isArray(rawFleetAccounts)) {
        this.state.fleetAccounts = rawFleetAccounts.map((f) => ({
          ...f,
          creditLimitFcfa: Number(f.creditLimitFcfa),
          balanceOwedFcfa: Number(f.balanceOwedFcfa),
        }));
      }

      if (Array.isArray(rawFleetTx)) {
        this.state.fleetTransactions = rawFleetTx.map((tx) => ({
          id: tx.id,
          accountId: tx.accountId,
          companyName: this.state.fleetAccounts.find((a) => a.id === tx.accountId)?.companyName ?? tx.accountId,
          stationId: tx.stationId,
          vehiclePlate: tx.vehiclePlate,
          driverName: tx.driverName,
          grade: tx.grade,
          litres: Number(tx.litres),
          amountFcfa: Number(tx.amountFcfa),
          createdAt: tx.createdAt,
        }));
      }

      if (Array.isArray(rawShopItems)) {
        this.state.shopItems = rawShopItems.map((i) => ({
          id: i.id,
          stationId: i.stationId,
          sku: i.sku,
          name: i.name,
          category: i.category,
          stockQty: Number(i.stockQty),
          reorderLevel: Number(i.reorderLevel),
          unitPriceFcfa: Number(i.unitPriceFcfa),
          unitCostFcfa: Number(i.unitCostFcfa ?? Math.round(Number(i.unitPriceFcfa) * 0.72)),
        }));
      }

      if (Array.isArray(rawPurchaseOrders)) {
        this.state.purchaseOrders = rawPurchaseOrders.map((po) => ({
          ...po,
          orderedLitres: Number(po.orderedLitres),
          unitCostFcfa: Number(po.unitCostFcfa),
        }));
      }

      if (Array.isArray(rawDeliveries)) {
        this.state.deliveries = rawDeliveries.map((d) => ({
          id: d.id,
          tankId: d.tankId,
          tankName: this.state.tanks.find((t) => t.id === d.tankId)?.name ?? d.tankId,
          supplierName: d.supplierName,
          bolLitres: Number(d.bolLitres),
          actualReceivedLitres: Number(d.actualReceivedLitres),
          unitCostFcfa: Number(d.unitCostFcfa),
          totalInvoiceFcfa: Math.round(Number(d.actualReceivedLitres) * Number(d.unitCostFcfa)),
          receivedAt: d.receivedAt,
        }));
      }

      if (Array.isArray(rawDipsticks)) {
        this.state.dipsticks = rawDipsticks.map((dip) => ({
          id: dip.id,
          tankId: dip.tankId,
          tankName: this.state.tanks.find((t) => t.id === dip.tankId)?.name ?? dip.tankId,
          bookLitres: Number(dip.bookLitres),
          measuredLitres: Number(dip.measuredLitres),
          varianceLitres: Number(dip.varianceLitres),
          recordedAt: dip.recordedAt,
        }));
      }

      if (Array.isArray(rawJournals)) {
        this.state.journals = rawJournals.map((j) => ({
          id: j.id,
          stationId: j.stationId,
          reference: j.reference,
          sourceEvent: j.sourceEvent,
          description: j.description,
          postedAt: j.postedAt,
          lines: (j.lines ?? []).map((l) => makeLine(l.accountCode, Number(l.debitFcfa), Number(l.creditFcfa))),
        }));
      }

      if (Array.isArray(rawExpenses)) {
        this.state.expenses = rawExpenses.map((ex) => ({
          ...ex,
          amountFcfa: Number(ex.amountFcfa),
        }));
      }

      if (Array.isArray(rawDeposits)) {
        this.state.deposits = rawDeposits.map((dep) => ({
          ...dep,
          amountFcfa: Number(dep.amountFcfa),
        }));
      }

      if (Array.isArray(rawEvents)) {
        this.state.events = rawEvents.map((ev) => ({
          eventId: ev.eventId,
          eventType: ev.eventType,
          aggregateType: ev.aggregateType,
          aggregateId: ev.aggregateId,
          stationId: primaryStationId,
          summary: ev.summary,
          occurredAt: ev.occurredAt,
          payload: {},
        }));
      }

      if (Array.isArray(rawApiKeys)) {
        this.state.apiKeys = rawApiKeys;
      }

      if (Array.isArray(rawWebhooks)) {
        this.state.webhooks = rawWebhooks;
      }

      if (rawAiSub) {
        this.state.tenant.aiSubscription = {
          active: Boolean(rawAiSub.active),
          planCode: rawAiSub.planCode || 'AI_COPILOT_ADDON',
          monthlyFeeFcfa: Number(rawAiSub.monthlyFeeFcfa ?? 25000),
          activatedAt: rawAiSub.activatedAt ?? null,
        };
      }

      if (Array.isArray(rawOnboardingSteps)) {
        this.state.tenant.onboardingCompletedSteps = rawOnboardingSteps.map((st) => st.stepKey);
      }

      return this.getSnapshot();
    } catch {
      return null;
    }
  }

  updateFuelPrice(role: UserRole, stationId: string, grade: FuelGrade, newPriceFcfa: number) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_STATIONS_PRICES'), 'UpdateFuelPriceCommand');
    if (newPriceFcfa < 100) throw new Error('Fuel price must be at least 100 FCFA/L.');
    const station = this.state.stations.find((s) => s.id === stationId);
    if (!station) throw new Error('Station not found.');
    station.prices[grade] = Math.round(newPriceFcfa);
    for (const pump of this.state.pumps) {
      if (pump.stationId === stationId && pump.grade === grade) {
        pump.unitPriceFcfa = Math.round(newPriceFcfa);
      }
    }
    this.pushEvent(
      'FuelPriceUpdatedEvent',
      'Station',
      stationId,
      stationId,
      `Updated ${grade} pump price to ${Math.round(newPriceFcfa)} FCFA/L at ${station.name}.`,
      { grade, pricePerLitreFcfa: Math.round(newPriceFcfa) }
    );
    void this.dispatchRemoteIfConfigured(`/stations/${stationId}/fuel-prices`, 'POST', {
      grade,
      pricePerLitreFcfa: Math.round(newPriceFcfa),
    });
    return this.getSnapshot();
  }

  openShift(role: UserRole, stationId: string, pumpId: string, attendantId: string) {
    this.assertRole(role, canPerformAction(role, 'OPEN_CLOSE_SHIFT'), 'OpenShiftCommand');
    const pump = this.state.pumps.find((p) => p.id === pumpId);
    const emp = this.state.employees.find((e) => e.id === attendantId);
    if (!pump || !emp) throw new Error('Pump or employee not found.');
    if (pump.status === 'ACTIVE_SHIFT') throw new Error(`Pump ${pump.code} already has an active shift.`);

    pump.status = 'ACTIVE_SHIFT';
    const shift: ShiftRecord = {
      id: `sh_${Math.random().toString(36).slice(2, 7)}`,
      stationId,
      pumpId: pump.id,
      pumpCode: pump.code,
      grade: pump.grade,
      attendantId: emp.id,
      attendantName: emp.fullName,
      openingMeterLitres: pump.totalizerLitres,
      closingMeterLitres: null,
      litresSold: 0,
      unitPriceFcfa: pump.unitPriceFcfa,
      expectedRevenueFcfa: 0,
      cashFcfa: 0,
      mobileMoneyFcfa: 0,
      cardFcfa: 0,
      fleetCreditFcfa: 0,
      varianceFcfa: 0,
      status: 'OPEN',
      openedAt: new Date().toISOString(),
      closedAt: null,
    };
    this.state.shifts.unshift(shift);
    this.pushEvent('ShiftOpenedEvent', 'ForecourtShift', shift.id, stationId, `Opened shift ${shift.id} on ${pump.code} (${emp.fullName}).`, { pumpId });
    void this.dispatchRemoteIfConfigured('/forecourt/shifts/open', 'POST', { stationId, pumpId, attendantId });
    return this.getSnapshot();
  }

  closeShift(
    role: UserRole,
    shiftId: string,
    payload: { closingMeterLitres: number; cashFcfa: number; mobileMoneyFcfa: number; cardFcfa: number; fleetCreditFcfa: number }
  ) {
    this.assertRole(role, canPerformAction(role, 'OPEN_CLOSE_SHIFT'), 'CloseShiftCommand');
    const shift = this.state.shifts.find((s) => s.id === shiftId);
    if (!shift || shift.status !== 'OPEN') throw new Error('Shift is not open.');
    if (payload.closingMeterLitres < shift.openingMeterLitres) {
      throw new Error('Closing meter reading cannot be lower than opening meter.');
    }

    const pump = this.state.pumps.find((p) => p.id === shift.pumpId)!;
    const tank = this.state.tanks.find((t) => t.id === pump.tankId)!;
    const emp = this.state.employees.find((e) => e.id === shift.attendantId);

    const litresSold = Number((payload.closingMeterLitres - shift.openingMeterLitres).toFixed(2));
    const expectedFcfa = Math.round(litresSold * shift.unitPriceFcfa);
    const declaredFcfa = payload.cashFcfa + payload.mobileMoneyFcfa + payload.cardFcfa + payload.fleetCreditFcfa;
    const varianceFcfa = declaredFcfa - expectedFcfa;

    shift.closingMeterLitres = payload.closingMeterLitres;
    shift.litresSold = litresSold;
    shift.expectedRevenueFcfa = expectedFcfa;
    shift.cashFcfa = payload.cashFcfa;
    shift.mobileMoneyFcfa = payload.mobileMoneyFcfa;
    shift.cardFcfa = payload.cardFcfa;
    shift.fleetCreditFcfa = payload.fleetCreditFcfa;
    shift.varianceFcfa = varianceFcfa;
    shift.status = 'CLOSED';
    shift.closedAt = new Date().toISOString();

    pump.totalizerLitres = payload.closingMeterLitres;
    pump.status = 'IDLE';

    // Inventory event projection
    tank.bookVolumeLitres = Math.max(0, Number((tank.bookVolumeLitres - litresSold).toFixed(2)));
    tank.varianceLitres = Number((tank.lastDipLitres - tank.bookVolumeLitres).toFixed(2));
    if (tank.bookVolumeLitres / tank.capacityLitres < 0.2) {
      tank.status = 'LOW_STOCK';
    }

    // Workforce variance tracking
    if (emp && varianceFcfa !== 0) {
      emp.cumulativeVarianceFcfa += varianceFcfa;
    }

    // Accounting double-entry automation
    const vatFcfa = Math.round((expectedFcfa * 0.1925) / 1.1925);
    const netRevenueFcfa = expectedFcfa - vatFcfa;
    const cogsFcfa = Math.round(litresSold * tank.unitCostFcfa);

    const lines: JournalLine[] = [
      makeLine('1010', payload.cashFcfa, 0),
      makeLine('1020', payload.mobileMoneyFcfa, 0),
      makeLine('1030', payload.cardFcfa, 0),
      makeLine('1100', payload.fleetCreditFcfa, 0),
      ...(varianceFcfa < 0 ? [makeLine('6100', Math.abs(varianceFcfa), 0)] : []),
      ...(varianceFcfa > 0 ? [makeLine('6100', 0, varianceFcfa)] : []),
      makeLine('4010', 0, netRevenueFcfa),
      makeLine('2200', 0, vatFcfa),
      makeLine('5010', cogsFcfa, 0),
      makeLine('1200', 0, cogsFcfa),
    ];

    this.pushJournal(
      shift.stationId,
      `SHIFT-${shift.id}`,
      'ShiftClosedEvent',
      `Shift ${shift.id} (${pump.code}): ${litresSold} L sold, variance ${varianceFcfa} FCFA`,
      lines
    );

    this.pushEvent(
      'ShiftClosedEvent',
      'ForecourtShift',
      shift.id,
      shift.stationId,
      `Shift ${shift.id} closed on ${pump.code}: ${litresSold} L sold, ${expectedFcfa} FCFA expected (variance ${varianceFcfa} FCFA).`,
      { litresSold, expectedFcfa, varianceFcfa }
    );
    void this.dispatchRemoteIfConfigured(`/forecourt/shifts/${shiftId}/close`, 'POST', payload);
    return this.getSnapshot();
  }

  createPump(role: UserRole, input: { stationId: string; tankId: string; code: string; grade: FuelGrade; initialTotalizerLitres: number }) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_EMPLOYEES'), 'CreatePumpCommand');
    const station = this.state.stations.find((s) => s.id === input.stationId);
    const tank = this.state.tanks.find((t) => t.id === input.tankId);
    if (!station || !tank) throw new Error('Station or linked fuel tank not found.');
    const pump: Pump = {
      id: `pmp_${Math.random().toString(36).slice(2, 7)}`,
      stationId: input.stationId,
      tankId: input.tankId,
      code: input.code.trim().toUpperCase(),
      grade: input.grade,
      totalizerLitres: Math.max(0, input.initialTotalizerLitres),
      unitPriceFcfa: station.prices[input.grade],
      status: 'IDLE',
    };
    this.state.pumps.push(pump);
    this.pushEvent('PumpProvisionedEvent', 'Forecourt', pump.id, pump.stationId, `Added pump dispenser ${pump.code} (${pump.grade}).`, { code: pump.code });
    void this.dispatchRemoteIfConfigured('/forecourt/pumps', 'POST', {
      stationId: pump.stationId,
      tankId: pump.tankId,
      code: pump.code,
      grade: pump.grade,
      totalizerLitres: pump.totalizerLitres,
      unitPriceFcfa: pump.unitPriceFcfa,
    });
    return this.getSnapshot();
  }

  deletePump(role: UserRole, pumpId: string) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_EMPLOYEES'), 'DeletePumpCommand');
    const pump = this.state.pumps.find((p) => p.id === pumpId);
    if (!pump) throw new Error('Pump not found.');
    if (pump.status === 'ACTIVE_SHIFT') throw new Error(`Cannot delete pump ${pump.code} while a shift is active.`);
    this.state.pumps = this.state.pumps.filter((p) => p.id !== pumpId);
    this.pushEvent('PumpRemovedEvent', 'Forecourt', pumpId, pump.stationId, `Removed pump dispenser ${pump.code}.`, { code: pump.code });
    void this.dispatchRemoteIfConfigured(`/forecourt/pumps/${pumpId}`, 'DELETE');
    return this.getSnapshot();
  }

  deleteShift(role: UserRole, shiftId: string) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_EMPLOYEES'), 'DeleteShiftCommand');
    const shift = this.state.shifts.find((s) => s.id === shiftId);
    if (!shift) throw new Error('Shift record not found.');
    if (shift.status === 'OPEN') {
      const pump = this.state.pumps.find((p) => p.id === shift.pumpId);
      if (pump) pump.status = 'IDLE';
    }
    this.state.shifts = this.state.shifts.filter((s) => s.id !== shiftId);
    this.state.journals = this.state.journals.filter((j) => j.reference !== `SHIFT-${shiftId}`);
    this.pushEvent('ShiftDeletedEvent', 'ForecourtShift', shiftId, shift.stationId, `Deleted shift ${shiftId} on ${shift.pumpCode}.`, { shiftId });
    void this.dispatchRemoteIfConfigured(`/forecourt/shifts/${shiftId}`, 'DELETE');
    return this.getSnapshot();
  }

  recordFleetVoucher(
    role: UserRole,
    input: { accountId: string; stationId: string; vehiclePlate: string; driverName: string; grade: FuelGrade; litres: number }
  ) {
    this.assertRole(role, canPerformAction(role, 'OPEN_CLOSE_SHIFT'), 'RecordFleetVoucherCommand');
    const acc = this.state.fleetAccounts.find((a) => a.id === input.accountId);
    const station = this.state.stations.find((s) => s.id === input.stationId);
    if (!acc || !station) throw new Error('Fleet account or station not found.');
    const amountFcfa = Math.round(input.litres * station.prices[input.grade]);
    if (acc.balanceOwedFcfa + amountFcfa > acc.creditLimitFcfa) {
      throw new Error(`Credit limit exceeded for ${acc.companyName}.`);
    }
    acc.balanceOwedFcfa += amountFcfa;
    const tx: FleetTransaction = {
      id: `ftx_${Math.random().toString(36).slice(2, 7)}`,
      accountId: acc.id,
      companyName: acc.companyName,
      stationId: input.stationId,
      vehiclePlate: input.vehiclePlate.toUpperCase(),
      driverName: input.driverName,
      grade: input.grade,
      litres: input.litres,
      amountFcfa,
      createdAt: new Date().toISOString(),
    };
    this.state.fleetTransactions.unshift(tx);

    const vatFcfa = Math.round((amountFcfa * 0.1925) / 1.1925);
    this.pushJournal(
      input.stationId,
      `FLT-${tx.id}`,
      'FleetVoucherRecordedEvent',
      `Fleet credit voucher ${tx.vehiclePlate} (${acc.companyName}) · ${input.litres} L`,
      [
        makeLine('1100', amountFcfa, 0),
        makeLine('4010', 0, amountFcfa - vatFcfa),
        makeLine('2200', 0, vatFcfa),
      ]
    );
    this.pushEvent(
      'FleetVoucherRecordedEvent',
      'FleetCredit',
      tx.id,
      input.stationId,
      `Fleet voucher ${tx.vehiclePlate}: ${input.litres} L (${amountFcfa} FCFA) charged to ${acc.companyName}.`,
      { amountFcfa }
    );
    void this.dispatchRemoteIfConfigured('/fleet/vouchers', 'POST', input);
    return this.getSnapshot();
  }

  settleFleetAccount(role: UserRole, accountId: string, stationId: string, amountFcfa: number, method: 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CASH') {
    this.assertRole(role, canPerformAction(role, 'SETTLE_FLEET'), 'SettleFleetCommand');
    const acc = this.state.fleetAccounts.find((a) => a.id === accountId);
    if (!acc) throw new Error('Fleet account not found.');
    if (amountFcfa <= 0 || amountFcfa > acc.balanceOwedFcfa) {
      throw new Error('Settlement amount must be between 1 FCFA and the current balance owed.');
    }
    acc.balanceOwedFcfa -= amountFcfa;
    const debitCode = method === 'BANK_TRANSFER' ? '1030' : method === 'MOBILE_MONEY' ? '1020' : '1010';
    this.pushJournal(
      stationId,
      `FSET-${acc.id}`,
      'FleetAccountSettledEvent',
      `Corporate settlement from ${acc.companyName} via ${method}`,
      [makeLine(debitCode, amountFcfa, 0), makeLine('1100', 0, amountFcfa)]
    );
    this.pushEvent(
      'FleetAccountSettledEvent',
      'FleetCredit',
      acc.id,
      stationId,
      `Received ${amountFcfa} FCFA settlement from ${acc.companyName} via ${method}.`,
      { amountFcfa, method }
    );
    void this.dispatchRemoteIfConfigured(`/fleet/accounts/${accountId}/settle`, 'POST', { stationId, amountFcfa, method });
    return this.getSnapshot();
  }

  recordShopSale(role: UserRole, itemId: string, quantity: number, paymentMethod: 'CASH' | 'MOBILE_MONEY' | 'CARD') {
    this.assertRole(role, canPerformAction(role, 'OPEN_CLOSE_SHIFT'), 'RecordShopSaleCommand');
    const item = this.state.shopItems.find((i) => i.id === itemId);
    if (!item) throw new Error('Shop item not found.');
    if (quantity <= 0 || quantity > item.stockQty) throw new Error('Insufficient SKU stock.');

    item.stockQty -= quantity;
    const grossFcfa = item.unitPriceFcfa * quantity;
    const cogsFcfa = item.unitCostFcfa * quantity;
    const vatFcfa = Math.round((grossFcfa * 0.1925) / 1.1925);
    const debitCode = paymentMethod === 'CASH' ? '1010' : paymentMethod === 'MOBILE_MONEY' ? '1020' : '1030';

    this.pushJournal(
      item.stationId,
      `POS-${item.sku}`,
      'ShopSaleRecordedEvent',
      `Counter sale: ${quantity}x ${item.name}`,
      [
        makeLine(debitCode, grossFcfa, 0),
        makeLine('4020', 0, grossFcfa - vatFcfa),
        makeLine('2200', 0, vatFcfa),
        makeLine('5010', cogsFcfa, 0),
        makeLine('1200', 0, cogsFcfa),
      ]
    );
    this.pushEvent(
      'ShopSaleRecordedEvent',
      'ShopPOS',
      item.id,
      item.stationId,
      `Sold ${quantity}x ${item.name} (${grossFcfa} FCFA via ${paymentMethod}).`,
      { grossFcfa }
    );
    void this.dispatchRemoteIfConfigured('/shop/sales', 'POST', { itemId, quantity, paymentMethod });
    return this.getSnapshot();
  }

  restockShopItem(role: UserRole, itemId: string, quantity: number) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DELIVERY'), 'RestockShopItemCommand');
    const item = this.state.shopItems.find((i) => i.id === itemId);
    if (!item) throw new Error('Shop item not found.');
    if (quantity <= 0) throw new Error('Restock quantity must be positive.');
    item.stockQty += quantity;
    const costFcfa = quantity * item.unitCostFcfa;
    this.pushJournal(
      item.stationId,
      `STK-${item.sku}`,
      'ShopInventoryRestockedEvent',
      `Restocked ${quantity}x ${item.name} into inventory`,
      [makeLine('1200', costFcfa, 0), makeLine('2010', 0, costFcfa)]
    );
    this.pushEvent(
      'ShopInventoryRestockedEvent',
      'ShopPOS',
      item.id,
      item.stationId,
      `Restocked ${quantity}x ${item.name} (${costFcfa} FCFA AP).`,
      { quantity, costFcfa }
    );
    void this.dispatchRemoteIfConfigured(`/shop/items/${itemId}/restock`, 'POST', { quantity });
    return this.getSnapshot();
  }

  createFleetAccount(role: UserRole, input: { companyName: string; taxId: string; creditLimitFcfa: number }) {
    this.assertRole(role, canPerformAction(role, 'SETTLE_FLEET'), 'CreateFleetAccountCommand');
    const acc: FleetAccount = {
      id: `flt_${Math.random().toString(36).slice(2, 7)}`,
      companyName: input.companyName.trim(),
      taxId: input.taxId.trim().toUpperCase(),
      creditLimitFcfa: Math.max(10000, input.creditLimitFcfa),
      balanceOwedFcfa: 0,
      status: 'ACTIVE',
    };
    this.state.fleetAccounts.unshift(acc);
    this.pushEvent('FleetAccountCreatedEvent', 'FleetCredit', acc.id, this.state.stations[0]?.id ?? 'st_plateau', `Onboarded fleet client ${acc.companyName}.`, { limit: acc.creditLimitFcfa });
    void this.dispatchRemoteIfConfigured('/fleet/accounts', 'POST', input);
    return this.getSnapshot();
  }

  deleteFleetAccount(role: UserRole, accountId: string) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_EMPLOYEES'), 'DeleteFleetAccountCommand');
    const acc = this.state.fleetAccounts.find((a) => a.id === accountId);
    if (!acc) throw new Error('Fleet account not found.');
    this.state.fleetAccounts = this.state.fleetAccounts.filter((a) => a.id !== accountId);
    this.state.fleetTransactions = this.state.fleetTransactions.filter((t) => t.accountId !== accountId);
    this.pushEvent('FleetAccountDeletedEvent', 'FleetCredit', accountId, this.state.stations[0]?.id ?? 'st_plateau', `Deleted corporate fleet account ${acc.companyName}.`, { accountId });
    void this.dispatchRemoteIfConfigured(`/fleet/accounts/${accountId}`, 'DELETE');
    return this.getSnapshot();
  }

  createShopItem(
    role: UserRole,
    input: { stationId: string; sku: string; name: string; category: ShopItem['category']; stockQty: number; reorderLevel: number; unitPriceFcfa: number; unitCostFcfa: number }
  ) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DELIVERY'), 'CreateShopItemCommand');
    const item: ShopItem = {
      id: `sku_${Math.random().toString(36).slice(2, 7)}`,
      stationId: input.stationId,
      sku: input.sku.trim().toUpperCase(),
      name: input.name.trim(),
      category: input.category,
      stockQty: Math.max(0, input.stockQty),
      reorderLevel: Math.max(0, input.reorderLevel),
      unitPriceFcfa: Math.max(100, input.unitPriceFcfa),
      unitCostFcfa: Math.max(50, input.unitCostFcfa),
    };
    this.state.shopItems.push(item);
    this.pushEvent('ShopItemCreatedEvent', 'ShopPOS', item.id, item.stationId, `Added shop SKU ${item.sku} (${item.name}).`, { sku: item.sku });
    void this.dispatchRemoteIfConfigured('/shop/items', 'POST', item);
    return this.getSnapshot();
  }

  deleteShopItem(role: UserRole, itemId: string) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DELIVERY'), 'DeleteShopItemCommand');
    const item = this.state.shopItems.find((i) => i.id === itemId);
    if (!item) throw new Error('Shop SKU not found.');
    this.state.shopItems = this.state.shopItems.filter((i) => i.id !== itemId);
    this.pushEvent('ShopItemDeletedEvent', 'ShopPOS', itemId, item.stationId, `Removed SKU ${item.sku} (${item.name}).`, { itemId });
    void this.dispatchRemoteIfConfigured(`/shop/items/${itemId}`, 'DELETE');
    return this.getSnapshot();
  }

  createTank(
    role: UserRole,
    input: { stationId: string; name: string; grade: FuelGrade; capacityLitres: number; bookVolumeLitres: number; unitCostFcfa: number }
  ) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DELIVERY'), 'CreateTankCommand');
    const vol = Math.min(input.capacityLitres, Math.max(0, input.bookVolumeLitres));
    const tank: FuelTank = {
      id: `tk_${Math.random().toString(36).slice(2, 7)}`,
      stationId: input.stationId,
      name: input.name.trim(),
      grade: input.grade,
      capacityLitres: Math.max(1000, input.capacityLitres),
      bookVolumeLitres: vol,
      lastDipLitres: vol,
      varianceLitres: 0,
      unitCostFcfa: Math.max(100, input.unitCostFcfa),
      status: vol / Math.max(1000, input.capacityLitres) < 0.2 ? 'LOW_STOCK' : 'NOMINAL',
    };
    this.state.tanks.push(tank);
    this.pushEvent('TankProvisionedEvent', 'Inventory', tank.id, tank.stationId, `Provisioned tank ${tank.name} (${tank.capacityLitres} L).`, { grade: tank.grade });
    void this.dispatchRemoteIfConfigured('/inventory/tanks', 'POST', tank);
    return this.getSnapshot();
  }

  deleteTank(role: UserRole, tankId: string) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DELIVERY'), 'DeleteTankCommand');
    const linkedPump = this.state.pumps.find((p) => p.tankId === tankId);
    if (linkedPump) throw new Error(`Delete or reassign linked pump ${linkedPump.code} before deleting this tank.`);
    const tank = this.state.tanks.find((t) => t.id === tankId);
    if (!tank) throw new Error('Tank not found.');
    this.state.tanks = this.state.tanks.filter((t) => t.id !== tankId);
    this.state.deliveries = this.state.deliveries.filter((d) => d.tankId !== tankId);
    this.state.dipsticks = this.state.dipsticks.filter((d) => d.tankId !== tankId);
    this.pushEvent('TankRemovedEvent', 'Inventory', tankId, tank.stationId, `Removed tank ${tank.name}.`, { tankId });
    void this.dispatchRemoteIfConfigured(`/inventory/tanks/${tankId}`, 'DELETE');
    return this.getSnapshot();
  }

  deletePurchaseOrder(role: UserRole, poId: string) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DELIVERY'), 'DeletePurchaseOrderCommand');
    const po = this.state.purchaseOrders.find((p) => p.id === poId);
    if (!po) throw new Error('Purchase order not found.');
    this.state.purchaseOrders = this.state.purchaseOrders.filter((p) => p.id !== poId);
    this.pushEvent('PurchaseOrderDeletedEvent', 'Inventory', poId, po.stationId, `Removed supplier PO ${poId}.`, { poId });
    void this.dispatchRemoteIfConfigured(`/inventory/purchase-orders/${poId}`, 'DELETE');
    return this.getSnapshot();
  }

  deleteDelivery(role: UserRole, deliveryId: string) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DELIVERY'), 'DeleteDeliveryCommand');
    const del = this.state.deliveries.find((d) => d.id === deliveryId);
    if (!del) throw new Error('Delivery record not found.');
    this.state.deliveries = this.state.deliveries.filter((d) => d.id !== deliveryId);
    this.state.journals = this.state.journals.filter((j) => j.reference !== `DEL-${deliveryId}`);
    void this.dispatchRemoteIfConfigured(`/inventory/deliveries/${deliveryId}`, 'DELETE');
    return this.getSnapshot();
  }

  deleteDipstick(role: UserRole, dipstickId: string) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DELIVERY'), 'DeleteDipstickCommand');
    this.state.dipsticks = this.state.dipsticks.filter((d) => d.id !== dipstickId);
    void this.dispatchRemoteIfConfigured(`/inventory/dipsticks/${dipstickId}`, 'DELETE');
    return this.getSnapshot();
  }

  createPurchaseOrder(role: UserRole, input: { stationId: string; supplierName: string; grade: FuelGrade; orderedLitres: number; unitCostFcfa: number }) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DELIVERY'), 'CreatePurchaseOrderCommand');
    const po: PurchaseOrder = {
      id: `po_${Math.random().toString(36).slice(2, 6)}`,
      stationId: input.stationId,
      supplierName: input.supplierName,
      grade: input.grade,
      orderedLitres: input.orderedLitres,
      unitCostFcfa: input.unitCostFcfa,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    this.state.purchaseOrders.unshift(po);
    this.pushEvent(
      'PurchaseOrderCreatedEvent',
      'Inventory',
      po.id,
      input.stationId,
      `Raised supplier PO ${po.id}: ${po.orderedLitres} L ${po.grade} from ${po.supplierName}.`,
      { orderedLitres: po.orderedLitres }
    );
    void this.dispatchRemoteIfConfigured('/inventory/purchase-orders', 'POST', input);
    return this.getSnapshot();
  }

  receiveDelivery(
    role: UserRole,
    input: { tankId: string; purchaseOrderId?: string; supplierName: string; bolLitres: number; actualReceivedLitres: number; unitCostFcfa: number }
  ) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DELIVERY'), 'ReceiveDeliveryCommand');
    const tank = this.state.tanks.find((t) => t.id === input.tankId);
    if (!tank) throw new Error('Tank not found.');

    // Weighted Average Cost (WAC) valuation
    const existingValue = tank.bookVolumeLitres * tank.unitCostFcfa;
    const incomingValue = input.actualReceivedLitres * input.unitCostFcfa;
    const combinedVol = tank.bookVolumeLitres + input.actualReceivedLitres;
    if (combinedVol > 0) {
      tank.unitCostFcfa = Math.round((existingValue + incomingValue) / combinedVol);
    }

    tank.bookVolumeLitres = Math.min(tank.capacityLitres, Number((tank.bookVolumeLitres + input.actualReceivedLitres).toFixed(2)));
    tank.lastDipLitres = Math.min(tank.capacityLitres, Number((tank.lastDipLitres + input.actualReceivedLitres).toFixed(2)));
    tank.varianceLitres = Number((tank.lastDipLitres - tank.bookVolumeLitres).toFixed(2));
    tank.status = tank.bookVolumeLitres / tank.capacityLitres < 0.2 ? 'LOW_STOCK' : 'NOMINAL';

    if (input.purchaseOrderId) {
      const po = this.state.purchaseOrders.find((p) => p.id === input.purchaseOrderId);
      if (po) po.status = 'RECEIVED';
    }

    const invoiceFcfa = Math.round(input.actualReceivedLitres * input.unitCostFcfa);
    const delRecord: TankDeliveryRecord = {
      id: `del_${Math.random().toString(36).slice(2, 7)}`,
      tankId: tank.id,
      tankName: tank.name,
      supplierName: input.supplierName,
      bolLitres: input.bolLitres,
      actualReceivedLitres: input.actualReceivedLitres,
      unitCostFcfa: input.unitCostFcfa,
      totalInvoiceFcfa: invoiceFcfa,
      receivedAt: new Date().toISOString(),
    };
    this.state.deliveries.unshift(delRecord);

    this.pushJournal(
      tank.stationId,
      `DEL-${delRecord.id}`,
      'FuelDeliveryRecordedEvent',
      `Tanker receipt from ${input.supplierName}: ${input.actualReceivedLitres} L (BoL ${input.bolLitres} L, WAC ${tank.unitCostFcfa} FCFA/L)`,
      [makeLine('1200', invoiceFcfa, 0), makeLine('2010', 0, invoiceFcfa)]
    );
    this.pushEvent(
      'FuelDeliveryRecordedEvent',
      'Inventory',
      delRecord.id,
      tank.stationId,
      `Delivery to ${tank.name} from ${input.supplierName}: ${input.actualReceivedLitres} L received (${invoiceFcfa} FCFA AP).`,
      { invoiceFcfa, wacFcfa: tank.unitCostFcfa }
    );
    void this.dispatchRemoteIfConfigured('/inventory/deliveries', 'POST', input);
    return this.getSnapshot();
  }

  recordDipstick(role: UserRole, tankId: string, measuredLitres: number) {
    this.assertRole(role, canPerformAction(role, 'RECORD_DIPSTICK'), 'RecordDipstickCommand');
    const tank = this.state.tanks.find((t) => t.id === tankId);
    if (!tank) throw new Error('Tank not found.');
    tank.lastDipLitres = measuredLitres;
    tank.varianceLitres = Number((measuredLitres - tank.bookVolumeLitres).toFixed(2));

    const dipRec: DipstickReadingRecord = {
      id: `dip_${Math.random().toString(36).slice(2, 7)}`,
      tankId: tank.id,
      tankName: tank.name,
      bookLitres: tank.bookVolumeLitres,
      measuredLitres,
      varianceLitres: tank.varianceLitres,
      recordedAt: new Date().toISOString(),
    };
    this.state.dipsticks.unshift(dipRec);

    if (Math.abs(tank.varianceLitres) > 100) {
      tank.status = 'VARIANCE_ALERT';
      this.pushEvent(
        'DipstickVarianceFlaggedEvent',
        'Inventory',
        dipRec.id,
        tank.stationId,
        `Dipstick variance alert on ${tank.name}: ${tank.varianceLitres} L delta vs book stock.`,
        { varianceLitres: tank.varianceLitres }
      );
    } else {
      tank.status = tank.bookVolumeLitres / tank.capacityLitres < 0.2 ? 'LOW_STOCK' : 'NOMINAL';
      this.pushEvent(
        'DipstickRecordedEvent',
        'Inventory',
        dipRec.id,
        tank.stationId,
        `Dipstick check on ${tank.name}: ${measuredLitres} L measured (variance ${tank.varianceLitres} L).`,
        { measuredLitres }
      );
    }
    void this.dispatchRemoteIfConfigured('/inventory/dipsticks', 'POST', { tankId, measuredLitres });
    return this.getSnapshot();
  }

  createEmployee(role: UserRole, input: { stationId: string; fullName: string; role: UserRole; phone: string; shiftWindow: string; baseSalaryFcfa: number }) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_EMPLOYEES'), 'CreateEmployeeCommand');
    const emp: Employee = {
      id: `emp_${Math.random().toString(36).slice(2, 7)}`,
      stationId: input.stationId,
      fullName: input.fullName,
      role: input.role,
      phone: input.phone,
      shiftWindow: input.shiftWindow,
      clockedIn: false,
      baseSalaryFcfa: input.baseSalaryFcfa,
      cumulativeVarianceFcfa: 0,
    };
    this.state.employees.push(emp);
    this.pushEvent('EmployeeOnboardedEvent', 'Workforce', emp.id, input.stationId, `Onboarded ${emp.fullName} (${emp.role}).`, { role: emp.role });
    void this.dispatchRemoteIfConfigured('/workforce/employees', 'POST', input);
    return this.getSnapshot();
  }

  updateEmployee(
    role: UserRole,
    employeeId: string,
    input: { fullName: string; role: UserRole; phone: string; shiftWindow: string; baseSalaryFcfa: number }
  ) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_EMPLOYEES'), 'UpdateEmployeeCommand');
    const emp = this.state.employees.find((e) => e.id === employeeId);
    if (!emp) throw new Error('Employee not found.');
    emp.fullName = input.fullName.trim();
    emp.role = input.role;
    emp.phone = input.phone.trim();
    emp.shiftWindow = input.shiftWindow.trim();
    emp.baseSalaryFcfa = Math.max(0, input.baseSalaryFcfa);
    this.pushEvent('EmployeeUpdatedEvent', 'Workforce', emp.id, emp.stationId, `Updated profile for ${emp.fullName} (${emp.role}).`, { role: emp.role });
    void this.dispatchRemoteIfConfigured(`/workforce/employees/${employeeId}`, 'PUT', input);
    return this.getSnapshot();
  }

  deleteEmployee(role: UserRole, employeeId: string) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_EMPLOYEES'), 'DeleteEmployeeCommand');
    const emp = this.state.employees.find((e) => e.id === employeeId);
    if (!emp) throw new Error('Employee not found.');
    this.state.employees = this.state.employees.filter((e) => e.id !== employeeId);
    this.pushEvent('EmployeeRemovedEvent', 'Workforce', employeeId, emp.stationId, `Removed employee ${emp.fullName}.`, { employeeId });
    void this.dispatchRemoteIfConfigured(`/workforce/employees/${employeeId}`, 'DELETE');
    return this.getSnapshot();
  }

  toggleAttendance(role: UserRole, employeeId: string) {
    this.assertRole(role, canPerformAction(role, 'OPEN_CLOSE_SHIFT'), 'ToggleAttendanceCommand');
    const emp = this.state.employees.find((e) => e.id === employeeId);
    if (!emp) throw new Error('Employee not found.');
    emp.clockedIn = !emp.clockedIn;
    this.pushEvent(
      'AttendanceToggledEvent',
      'Workforce',
      emp.id,
      emp.stationId,
      `${emp.fullName} ${emp.clockedIn ? 'clocked in' : 'clocked out'} for shift.`,
      { clockedIn: emp.clockedIn }
    );
    void this.dispatchRemoteIfConfigured(`/workforce/employees/${employeeId}/attendance`, 'POST', {});
    return this.getSnapshot();
  }

  recordExpense(
    role: UserRole,
    input: { stationId: string; category: StationExpense['category']; description: string; amountFcfa: number; paymentSource: StationExpense['paymentSource'] }
  ) {
    this.assertRole(role, canPerformAction(role, 'RECORD_EXPENSE_DEPOSIT'), 'RecordExpenseCommand');
    const exp: StationExpense = {
      id: `exp_${Math.random().toString(36).slice(2, 7)}`,
      stationId: input.stationId,
      category: input.category,
      description: input.description,
      amountFcfa: input.amountFcfa,
      paymentSource: input.paymentSource,
      status: 'POSTED',
      createdAt: new Date().toISOString(),
    };
    this.state.expenses.unshift(exp);
    const creditCode = input.paymentSource === 'BANK' ? '1030' : '1010';
    this.pushJournal(
      input.stationId,
      `EXP-${exp.id}`,
      'ExpenseRecordedEvent',
      `${input.category}: ${input.description}`,
      [makeLine('6010', input.amountFcfa, 0), makeLine(creditCode, 0, input.amountFcfa)]
    );
    this.pushEvent(
      'ExpenseRecordedEvent',
      'Accounting',
      exp.id,
      input.stationId,
      `Posted ${input.category} expense of ${input.amountFcfa} FCFA (${input.description}).`,
      { amountFcfa: input.amountFcfa }
    );
    void this.dispatchRemoteIfConfigured('/accounting/expenses', 'POST', input);
    return this.getSnapshot();
  }

  deleteExpense(role: UserRole, expenseId: string) {
    this.assertRole(role, canPerformAction(role, 'RECORD_EXPENSE_DEPOSIT'), 'DeleteExpenseCommand');
    const exp = this.state.expenses.find((e) => e.id === expenseId);
    if (!exp) throw new Error('Expense record not found.');
    this.state.expenses = this.state.expenses.filter((e) => e.id !== expenseId);
    this.state.journals = this.state.journals.filter((j) => j.reference !== `EXP-${expenseId}`);
    this.pushEvent('ExpenseDeletedEvent', 'Accounting', expenseId, exp.stationId, `Deleted expense ${exp.description}.`, { expenseId });
    void this.dispatchRemoteIfConfigured(`/accounting/expenses/${expenseId}`, 'DELETE');
    return this.getSnapshot();
  }

  recordDeposit(
    role: UserRole,
    input: { stationId: string; sourceAccount: TreasuryDeposit['sourceAccount']; bankName: string; slipReference: string; amountFcfa: number }
  ) {
    this.assertRole(role, canPerformAction(role, 'RECORD_EXPENSE_DEPOSIT'), 'RecordTreasuryDepositCommand');
    const dep: TreasuryDeposit = {
      id: `dep_${Math.random().toString(36).slice(2, 7)}`,
      stationId: input.stationId,
      sourceAccount: input.sourceAccount,
      bankName: input.bankName,
      slipReference: input.slipReference,
      amountFcfa: input.amountFcfa,
      depositedAt: new Date().toISOString(),
    };
    this.state.deposits.unshift(dep);
    const creditCode = input.sourceAccount === 'MOBILE_MONEY_CLEARING' ? '1020' : '1010';
    this.pushJournal(
      input.stationId,
      `DEP-${dep.id}`,
      'TreasuryDepositedEvent',
      `Treasury transfer to ${input.bankName} (Slip ${input.slipReference})`,
      [makeLine('1030', input.amountFcfa, 0), makeLine(creditCode, 0, input.amountFcfa)]
    );
    this.pushEvent(
      'TreasuryDepositedEvent',
      'Accounting',
      dep.id,
      input.stationId,
      `Transferred ${input.amountFcfa} FCFA from ${input.sourceAccount} to ${input.bankName}.`,
      { amountFcfa: input.amountFcfa }
    );
    void this.dispatchRemoteIfConfigured('/accounting/deposits', 'POST', input);
    return this.getSnapshot();
  }

  deleteDeposit(role: UserRole, depositId: string) {
    this.assertRole(role, canPerformAction(role, 'RECORD_EXPENSE_DEPOSIT'), 'DeleteDepositCommand');
    const dep = this.state.deposits.find((d) => d.id === depositId);
    if (!dep) throw new Error('Treasury deposit not found.');
    this.state.deposits = this.state.deposits.filter((d) => d.id !== depositId);
    this.state.journals = this.state.journals.filter((j) => j.reference !== `DEP-${depositId}`);
    this.pushEvent('TreasuryDepositDeletedEvent', 'Accounting', depositId, dep.stationId, `Deleted treasury deposit ${dep.slipReference}.`, { depositId });
    void this.dispatchRemoteIfConfigured(`/accounting/deposits/${depositId}`, 'DELETE');
    return this.getSnapshot();
  }

  createApiKey(role: UserRole, label: string, scopes: string[]) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_API_PLATFORM'), 'CreateApiKeyCommand');
    const key: ApiKeyRecord = {
      id: `key_${Math.random().toString(36).slice(2, 7)}`,
      label,
      maskedKey: `opf_live_${Math.random().toString(36).slice(2, 8)}_••••••••••••`,
      scopes,
      createdAt: new Date().toISOString(),
    };
    this.state.apiKeys.unshift(key);
    this.pushEvent('ApiKeyProvisionedEvent', 'ApiPlatform', key.id, this.state.stations[0]?.id ?? 'st_plateau', `Provisioned API key "${label}".`, { scopes });
    void this.dispatchRemoteIfConfigured('/platform/api-keys', 'POST', { label, scopes });
    return this.getSnapshot();
  }

  revokeApiKey(role: UserRole, keyId: string) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_API_PLATFORM'), 'RevokeApiKeyCommand');
    const target = this.state.apiKeys.find((k) => k.id === keyId);
    if (!target) throw new Error('API key not found.');
    this.state.apiKeys = this.state.apiKeys.filter((k) => k.id !== keyId);
    this.pushEvent('ApiKeyRevokedEvent', 'ApiPlatform', keyId, this.state.stations[0]?.id ?? 'st_plateau', `Revoked API key "${target.label}".`, { keyId });
    void this.dispatchRemoteIfConfigured(`/platform/api-keys/${keyId}`, 'DELETE');
    return this.getSnapshot();
  }

  createWebhook(role: UserRole, targetUrl: string, subscribedEvents: string[]) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_API_PLATFORM'), 'CreateWebhookCommand');
    const wh: WebhookSubscription = {
      id: `wh_${Math.random().toString(36).slice(2, 7)}`,
      targetUrl,
      subscribedEvents,
      active: true,
    };
    this.state.webhooks.unshift(wh);
    this.pushEvent('WebhookRegisteredEvent', 'ApiPlatform', wh.id, this.state.stations[0]?.id ?? 'st_plateau', `Registered webhook ${targetUrl}.`, { subscribedEvents });
    void this.dispatchRemoteIfConfigured('/platform/webhooks', 'POST', { targetUrl, subscribedEvents });
    return this.getSnapshot();
  }

  toggleWebhook(role: UserRole, webhookId: string) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_API_PLATFORM'), 'ToggleWebhookCommand');
    const wh = this.state.webhooks.find((w) => w.id === webhookId);
    if (!wh) throw new Error('Webhook not found.');
    wh.active = !wh.active;
    this.pushEvent('WebhookStatusToggledEvent', 'ApiPlatform', webhookId, this.state.stations[0]?.id ?? 'st_plateau', `${wh.active ? 'Activated' : 'Paused'} webhook ${wh.targetUrl}.`, { active: wh.active });
    void this.dispatchRemoteIfConfigured(`/platform/webhooks/${webhookId}`, 'PATCH');
    return this.getSnapshot();
  }

  deleteWebhook(role: UserRole, webhookId: string) {
    this.assertRole(role, canPerformAction(role, 'MANAGE_API_PLATFORM'), 'DeleteWebhookCommand');
    const wh = this.state.webhooks.find((w) => w.id === webhookId);
    if (!wh) throw new Error('Webhook not found.');
    this.state.webhooks = this.state.webhooks.filter((w) => w.id !== webhookId);
    this.pushEvent('WebhookDeletedEvent', 'ApiPlatform', webhookId, this.state.stations[0]?.id ?? 'st_plateau', `Deleted webhook ${wh.targetUrl}.`, { webhookId });
    void this.dispatchRemoteIfConfigured(`/platform/webhooks/${webhookId}`, 'DELETE');
    return this.getSnapshot();
  }

  private async requestBackendJson<T>(
    path: string,
    options: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; token?: string | null; syncAfter?: boolean } = {}
  ): Promise<T> {
    if (!this.springBootBaseUrl) {
      throw new Error('VITE_API_BASE_URL is not configured for live Spring Boot API calls.');
    }
    const method = options.method ?? 'GET';
    const effectiveToken = options.token ?? this.accessToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
      ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
    };
    const res = await fetch(`${this.springBootBaseUrl}/api/v1${path}`, {
      method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    if (!res.ok) {
      const detail = await this.extractErrorMessage(res);
      throw new Error(`API ${res.status}: ${detail}`);
    }
    const data = res.status === 204 ? (undefined as T) : ((await res.json()) as T);
    if (options.syncAfter && method !== 'GET') {
      const synced = await this.hydrateFromSpringBoot(effectiveToken);
      if (synced) {
        this.onStateSynced?.(synced);
      }
    }
    return data;
  }

  // --- Preview-mode in-memory caches for newer Spring Boot tables when VITE_API_BASE_URL is unset ---
  private previewInvites: Array<{
    id: string;
    stationId: string;
    employeeId?: string | null;
    email: string;
    role: string;
    inviteToken: string;
    status: string;
    expiresAt: string;
    createdAt: string;
  }> = [];

  private previewInvoices: Array<{
    id: string;
    invoiceNumber: string;
    periodLabel: string;
    stationsCount: number;
    subtotalFcfa: number;
    aiAddonFcfa: number;
    vatFcfa: number;
    totalFcfa: number;
    paidFcfa: number;
    status: string;
    dueAt: string;
    createdAt: string;
  }> = [];

  private previewNotifications: Array<{
    id: string;
    stationId: string | null;
    category: string;
    severity: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
  }> | null = null;

  private previewSuppliers: Array<{
    id: string;
    name: string;
    taxId: string;
    contactPhone: string;
    paymentTermsDays: number;
    status: string;
  }> = [
    { id: 'sup_scdp', name: 'SCDP Depot Douala', taxId: 'M018500001234Z', contactPhone: '+237 233 40 54 45', paymentTermsDays: 14, status: 'ACTIVE' },
    { id: 'sup_sonara', name: 'SONARA Limbe Refining', taxId: 'M027600009911A', contactPhone: '+237 233 33 22 38', paymentTermsDays: 30, status: 'ACTIVE' },
  ];

  private previewVehicles: Record<string, Array<{
    id: string;
    accountId: string;
    plateNumber: string;
    driverName: string;
    allowedGrade: string;
    monthlyLitreCap: number;
    status: string;
  }>> = {};

  private previewPayrollRuns: Array<{
    id: string;
    stationId: string;
    periodLabel: string;
    employeeCount: number;
    grossFcfa: number;
    deductionsFcfa: number;
    netPaidFcfa: number;
    paymentSource: string;
    executedAt: string;
  }> = [];

  private previewFiscalPeriods: Array<{
    id: string;
    stationId: string;
    periodKey: string;
    status: string;
    closedBy: string;
    closedAt: string;
  }> = [];

  private previewShopSales: Array<{
    id: string;
    stationId: string;
    itemId: string;
    sku: string;
    itemName: string;
    quantity: number;
    unitPriceFcfa: number;
    totalRevenueFcfa: number;
    totalCogsFcfa: number;
    paymentMethod: string;
    soldAt: string;
  }> = [];

  private previewAiHistory: Array<{
    id: string;
    stationId: string;
    actionType: string;
    promptSummary: string;
    responseSummary: string;
    modelUsed: string;
    createdAt: string;
  }> = [];

  private ensurePreviewNotifications() {
    if (this.previewNotifications !== null) return this.previewNotifications;
    const now = new Date().toISOString();
    const generated: Array<{
      id: string;
      stationId: string | null;
      category: string;
      severity: string;
      title: string;
      message: string;
      read: boolean;
      createdAt: string;
    }> = [];
    for (const tank of this.state.tanks) {
      if (Math.abs(tank.varianceLitres) > 100) {
        generated.push({
          id: `ntf_dip_${tank.id}`,
          stationId: tank.stationId,
          category: 'DIPSTICK_VARIANCE',
          severity: 'HIGH',
          title: `Dipstick Variance Alert — ${tank.name}`,
          message: `Variance of ${tank.varianceLitres} L detected between book (${tank.bookVolumeLitres} L) and physical dip (${tank.lastDipLitres} L).`,
          read: false,
          createdAt: now,
        });
      }
      if (tank.bookVolumeLitres / Math.max(1, tank.capacityLitres) < 0.25) {
        generated.push({
          id: `ntf_low_${tank.id}`,
          stationId: tank.stationId,
          category: 'LOW_STOCK',
          severity: 'MEDIUM',
          title: `Low Tank Volume — ${tank.name}`,
          message: `Remaining volume ${tank.bookVolumeLitres} L is below 25% of ${tank.capacityLitres} L capacity.`,
          read: false,
          createdAt: now,
        });
      }
    }
    if (generated.length === 0) {
      generated.push({
        id: 'ntf_welcome',
        stationId: this.state.stations[0]?.id ?? null,
        category: 'SYSTEM',
        severity: 'INFO',
        title: 'OpesFuel Alert Engine Active',
        message: 'Real-time shift variance, dipstick shrinkage, and fleet credit alerts are monitored automatically.',
        read: false,
        createdAt: now,
      });
    }
    this.previewNotifications = generated;
    return this.previewNotifications;
  }

  // --- Production Spring Boot Module Integrations (All 15 Modules) ---

  fetchCurrentTenant(token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve({
        id: this.state.tenant.tenantId,
        name: this.state.tenant.organizationName,
        ownerEmail: this.state.tenant.ownerEmail,
        defaultCurrency: 'FCFA',
        countryCode: 'CM',
        timezone: 'Africa/Douala',
        stationCount: this.state.stations.length,
        monthlyCommitmentFcfa: this.state.stations.reduce((s, st) => s + st.monthlyFeeFcfa, 0),
      });
    }
    return this.requestBackendJson<Record<string, unknown>>('/tenants/current', { token });
  }

  updateCurrentTenant(input: { name?: string; ownerEmail?: string; countryCode?: string; timezone?: string }, token?: string | null) {
    if (!this.springBootBaseUrl) {
      if (input.name) this.state.tenant.organizationName = input.name;
      if (input.ownerEmail) this.state.tenant.ownerEmail = input.ownerEmail;
      this.persistState();
      return Promise.resolve({ id: this.state.tenant.tenantId, ...input });
    }
    return this.requestBackendJson<Record<string, unknown>>('/tenants/current', {
      method: 'PATCH',
      body: input,
      token,
      syncAfter: true,
    });
  }

  fetchAuthenticatedProfile(token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve({
        principalId: 'demo-owner',
        tenantId: this.state.tenant.tenantId,
        auth0Sub: 'demo|owner',
        roles: ['OWNER'],
        scopes: [],
        allowedStationIds: [],
        apiKeyAuth: false,
        linkedEmployee: null,
        accessibleStationsCount: this.state.stations.length,
      });
    }
    return this.requestBackendJson<Record<string, unknown>>('/identity/me', { token });
  }

  listStaffInvites(token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve([...this.previewInvites]);
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>('/identity/invites', { token });
  }

  createStaffInvite(input: { stationId: string; employeeId?: string; email: string; role: UserRole }, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const inv = {
        id: `inv_${Math.random().toString(36).slice(2, 8)}`,
        stationId: input.stationId,
        employeeId: input.employeeId ?? null,
        email: input.email.trim().toLowerCase(),
        role: input.role,
        inviteToken: `opfinv_${Math.random().toString(36).slice(2, 14)}`,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      this.previewInvites.unshift(inv);
      return Promise.resolve(inv);
    }
    return this.requestBackendJson<Record<string, unknown>>('/identity/invites', { method: 'POST', body: input, token });
  }

  acceptStaffInvite(inviteToken: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const inv = this.previewInvites.find((i) => i.inviteToken === inviteToken);
      if (inv) inv.status = 'ACCEPTED';
      return Promise.resolve(inv ?? { inviteToken, status: 'ACCEPTED' });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/identity/invites/${encodeURIComponent(inviteToken)}/accept`,
      { method: 'POST', token, syncAfter: true }
    );
  }

  revokeStaffInvite(inviteId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const inv = this.previewInvites.find((i) => i.id === inviteId);
      if (inv) inv.status = 'REVOKED';
      return Promise.resolve();
    }
    return this.requestBackendJson<void>(`/identity/invites/${encodeURIComponent(inviteId)}`, {
      method: 'DELETE',
      token,
    });
  }

  fetchBillingSummary(token?: string | null) {
    if (!this.springBootBaseUrl) {
      const stationCommitmentFcfa = this.state.stations.reduce((s, st) => s + st.monthlyFeeFcfa, 0);
      const aiAddonMonthlyFcfa = this.state.tenant.aiSubscription.active ? this.state.tenant.aiSubscription.monthlyFeeFcfa : 0;
      const outstandingBalanceFcfa = this.previewInvoices.reduce((s, inv) => s + Math.max(0, inv.totalFcfa - inv.paidFcfa), 0);
      return Promise.resolve({
        tenantId: this.state.tenant.tenantId,
        stationCount: this.state.stations.length,
        stationCommitmentFcfa,
        aiAddonMonthlyFcfa,
        monthlyRecurringTotalFcfa: stationCommitmentFcfa + aiAddonMonthlyFcfa,
        outstandingBalanceFcfa,
        invoiceCount: this.previewInvoices.length,
      });
    }
    return this.requestBackendJson<Record<string, unknown>>('/billing/summary', { token });
  }

  listBillingInvoices(token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve([...this.previewInvoices]);
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>('/billing/invoices', { token });
  }

  generateBillingInvoice(periodLabel?: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const label = periodLabel || new Date().toISOString().slice(0, 7);
      const subtotal = this.state.stations.reduce((s, st) => s + st.monthlyFeeFcfa, 0);
      const aiAddon = this.state.tenant.aiSubscription.active ? this.state.tenant.aiSubscription.monthlyFeeFcfa : 0;
      const vat = Math.round((subtotal + aiAddon) * 0.1925);
      const inv = {
        id: `binv_${Math.random().toString(36).slice(2, 8)}`,
        invoiceNumber: `OPF-INV-${label.replace('-', '')}-${String(this.previewInvoices.length + 1).padStart(3, '0')}`,
        periodLabel: label,
        stationsCount: this.state.stations.length,
        subtotalFcfa: subtotal,
        aiAddonFcfa: aiAddon,
        vatFcfa: vat,
        totalFcfa: subtotal + aiAddon + vat,
        paidFcfa: 0,
        status: 'ISSUED',
        dueAt: new Date(Date.now() + 15 * 86400_000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      this.previewInvoices.unshift(inv);
      return Promise.resolve(inv);
    }
    return this.requestBackendJson<Record<string, unknown>>('/billing/invoices/generate', {
      method: 'POST',
      body: periodLabel ? { periodLabel } : {},
      token,
    });
  }

  payBillingInvoice(
    invoiceId: string,
    input: { amountFcfa: number; paymentChannel: 'ORANGE_MONEY' | 'MTN_MOMO' | 'BANK_TRANSFER' | 'CARD'; providerReference: string },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const inv = this.previewInvoices.find((i) => i.id === invoiceId);
      if (inv) {
        inv.paidFcfa = Math.min(inv.totalFcfa, inv.paidFcfa + input.amountFcfa);
        inv.status = inv.paidFcfa >= inv.totalFcfa ? 'PAID' : 'PARTIAL';
      }
      return Promise.resolve(inv ?? { invoiceId, status: 'PAID' });
    }
    return this.requestBackendJson<Record<string, unknown>>(`/billing/invoices/${encodeURIComponent(invoiceId)}/pay`, {
      method: 'POST',
      body: input,
      token,
    });
  }

  fetchExecutiveOverview(stationId = 'ALL', token?: string | null) {
    if (!this.springBootBaseUrl) {
      const report = computeFinancialReports(this.state, stationId);
      return Promise.resolve({
        stationScope: stationId,
        stationsCount: this.state.stations.length,
        ...report,
      });
    }
    return this.requestBackendJson<Record<string, unknown>>(`/reporting/overview?stationId=${encodeURIComponent(stationId)}`, { token });
  }

  fetchDailyZReport(stationId = 'ALL', date?: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const targetDate = date || new Date().toISOString().slice(0, 10);
      const scopedShifts = this.state.shifts.filter((s) => (stationId === 'ALL' || s.stationId === stationId) && s.status === 'CLOSED');
      return Promise.resolve({
        stationScope: stationId,
        businessDate: targetDate,
        closedShiftsCount: scopedShifts.length,
        totalLitresDispensed: Number(scopedShifts.reduce((s, sh) => s + sh.litresSold, 0).toFixed(2)),
        expectedRevenueFcfa: scopedShifts.reduce((s, sh) => s + sh.expectedRevenueFcfa, 0),
        cashCollectedFcfa: scopedShifts.reduce((s, sh) => s + sh.cashFcfa, 0),
        mobileMoneyCollectedFcfa: scopedShifts.reduce((s, sh) => s + sh.mobileMoneyFcfa, 0),
        cardCollectedFcfa: scopedShifts.reduce((s, sh) => s + sh.cardFcfa, 0),
        fleetCreditFcfa: scopedShifts.reduce((s, sh) => s + sh.fleetCreditFcfa, 0),
        totalVarianceFcfa: scopedShifts.reduce((s, sh) => s + sh.varianceFcfa, 0),
        generatedAt: new Date().toISOString(),
      });
    }
    const qs = new URLSearchParams({ stationId, ...(date ? { date } : {}) });
    return this.requestBackendJson<Record<string, unknown>>(`/reporting/z-report?${qs.toString()}`, { token });
  }

  async downloadAuthenticatedCsv(path: string, filename: string, fallbackCsv?: string, token?: string | null): Promise<void> {
    if (!this.springBootBaseUrl) {
      const content = fallbackCsv ?? '';
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const effectiveToken = token ?? this.accessToken;
    const res = await fetch(`${this.springBootBaseUrl}/api/v1${path}`, {
      headers: effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {},
    });
    if (!res.ok) {
      const detail = await this.extractErrorMessage(res);
      throw new Error(`CSV export failed (${res.status}): ${detail}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  fetchNotifications(stationId = 'ALL', unreadOnly = false, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const items = this.ensurePreviewNotifications().filter(
        (n) => (stationId === 'ALL' || !n.stationId || n.stationId === stationId) && (!unreadOnly || !n.read)
      );
      return Promise.resolve([...items]);
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>(
      `/notifications?stationId=${encodeURIComponent(stationId)}&unreadOnly=${unreadOnly}`,
      { token }
    );
  }

  markNotificationRead(alertId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const list = this.ensurePreviewNotifications();
      const target = list.find((n) => n.id === alertId);
      if (target) target.read = true;
      return Promise.resolve(target ?? { id: alertId, read: true });
    }
    return this.requestBackendJson<Record<string, unknown>>(`/notifications/${encodeURIComponent(alertId)}/read`, {
      method: 'PATCH',
      token,
    });
  }

  markAllNotificationsRead(token?: string | null) {
    if (!this.springBootBaseUrl) {
      const list = this.ensurePreviewNotifications();
      let count = 0;
      for (const n of list) {
        if (!n.read) {
          n.read = true;
          count += 1;
        }
      }
      return Promise.resolve({ markedReadCount: count });
    }
    return this.requestBackendJson<{ markedReadCount: number }>('/notifications/read-all', { method: 'POST', token });
  }

  listPayrollRuns(stationId = 'ALL', token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve(this.previewPayrollRuns.filter((r) => stationId === 'ALL' || r.stationId === stationId));
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>(`/workforce/payroll/runs?stationId=${encodeURIComponent(stationId)}`, { token });
  }

  executePayrollRun(input: { stationId: string; periodLabel: string; paymentSource: 'CASH_SAFE' | 'BANK' }, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const staff = this.state.employees.filter((e) => e.stationId === input.stationId);
      const grossFcfa = staff.reduce((s, e) => s + e.baseSalaryFcfa, 0);
      const deductionsFcfa = staff.reduce((s, e) => s + (e.cumulativeVarianceFcfa < 0 ? Math.abs(e.cumulativeVarianceFcfa) : 0), 0);
      const netPaidFcfa = Math.max(0, grossFcfa - deductionsFcfa);
      const run = {
        id: `pr_${Math.random().toString(36).slice(2, 8)}`,
        stationId: input.stationId,
        periodLabel: input.periodLabel,
        employeeCount: staff.length,
        grossFcfa,
        deductionsFcfa,
        netPaidFcfa,
        paymentSource: input.paymentSource,
        executedAt: new Date().toISOString(),
      };
      this.previewPayrollRuns.unshift(run);
      const creditAcc = input.paymentSource === 'BANK' ? '1030' : '1010';
      if (netPaidFcfa > 0) {
        this.pushJournal(input.stationId, `PAY-${input.periodLabel}`, 'PayrollExecutedEvent', `Monthly payroll ${input.periodLabel}`, [
          { accountCode: '6100', debitFcfa: netPaidFcfa, creditFcfa: 0 },
          { accountCode: creditAcc, debitFcfa: 0, creditFcfa: netPaidFcfa },
        ]);
        this.persistState();
        this.onStateSynced?.(this.getSnapshot());
      }
      return Promise.resolve(run);
    }
    return this.requestBackendJson<Record<string, unknown>>('/workforce/payroll/run', {
      method: 'POST',
      body: input,
      token,
      syncAfter: true,
    });
  }

  fetchEmployeePayslip(employeeId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const emp = this.state.employees.find((e) => e.id === employeeId);
      if (!emp) return Promise.reject(new Error('Employee not found.'));
      const shortageDeductionFcfa = emp.cumulativeVarianceFcfa < 0 ? Math.abs(emp.cumulativeVarianceFcfa) : 0;
      return Promise.resolve({
        employeeId: emp.id,
        fullName: emp.fullName,
        role: emp.role,
        stationId: emp.stationId,
        baseSalaryFcfa: emp.baseSalaryFcfa,
        shortageDeductionFcfa,
        overageNoteFcfa: emp.cumulativeVarianceFcfa > 0 ? emp.cumulativeVarianceFcfa : 0,
        netPayableFcfa: Math.max(0, emp.baseSalaryFcfa - shortageDeductionFcfa),
        generatedAt: new Date().toISOString(),
      });
    }
    return this.requestBackendJson<Record<string, unknown>>(`/workforce/payroll/payslips/${encodeURIComponent(employeeId)}`, { token });
  }

  fetchAttendanceLogs(employeeId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const emp = this.state.employees.find((e) => e.id === employeeId);
      return Promise.resolve([
        {
          id: `att_${employeeId}_1`,
          employeeId,
          stationId: emp?.stationId ?? '',
          action: emp?.clockedIn ? 'CLOCK_IN' : 'CLOCK_OUT',
          recordedAt: new Date().toISOString(),
        },
      ]);
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>(`/workforce/employees/${encodeURIComponent(employeeId)}/attendance-logs`, { token });
  }

  listSuppliers(token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve([...this.previewSuppliers]);
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>('/inventory/suppliers', { token });
  }

  createSupplier(input: { name: string; taxId?: string; contactPhone?: string; paymentTermsDays?: number }, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const sup = {
        id: `sup_${Math.random().toString(36).slice(2, 8)}`,
        name: input.name.trim(),
        taxId: input.taxId?.trim() || 'N/A',
        contactPhone: input.contactPhone?.trim() || '+237 600 00 00 00',
        paymentTermsDays: input.paymentTermsDays ?? 14,
        status: 'ACTIVE',
      };
      this.previewSuppliers.unshift(sup);
      return Promise.resolve(sup);
    }
    return this.requestBackendJson<Record<string, unknown>>('/inventory/suppliers', { method: 'POST', body: input, token });
  }

  cancelPurchaseOrder(poId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const po = this.state.purchaseOrders.find((p) => p.id === poId);
      if (po) po.status = 'CANCELLED';
      this.persistState();
      this.onStateSynced?.(this.getSnapshot());
      return Promise.resolve(po ?? { id: poId, status: 'CANCELLED' });
    }
    return this.requestBackendJson<Record<string, unknown>>(`/inventory/purchase-orders/${encodeURIComponent(poId)}/cancel`, {
      method: 'POST',
      token,
      syncAfter: true,
    });
  }

  reconcileTankShrinkage(tankId: string, reason?: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const tank = this.state.tanks.find((t) => t.id === tankId);
      if (!tank) return Promise.reject(new Error('Tank not found.'));
      const diffLitres = Number((tank.lastDipLitres - tank.bookVolumeLitres).toFixed(2));
      const amountFcfa = Math.round(Math.abs(diffLitres) * tank.unitCostFcfa);
      tank.bookVolumeLitres = tank.lastDipLitres;
      tank.varianceLitres = 0;
      tank.status = tank.bookVolumeLitres / Math.max(1, tank.capacityLitres) < 0.2 ? 'LOW_STOCK' : 'NOMINAL';
      if (amountFcfa > 0) {
        this.pushJournal(tank.stationId, `SHRINK-${tank.id.slice(-4)}`, 'TankShrinkageReconciledEvent', reason ?? 'Dipstick shrinkage reconciliation', [
          { accountCode: diffLitres < 0 ? '6300' : '1200', debitFcfa: amountFcfa, creditFcfa: 0 },
          { accountCode: diffLitres < 0 ? '1200' : '4010', debitFcfa: 0, creditFcfa: amountFcfa },
        ]);
      }
      this.persistState();
      this.onStateSynced?.(this.getSnapshot());
      return Promise.resolve({ tankId, reconciledLitres: diffLitres, adjustmentFcfa: amountFcfa });
    }
    return this.requestBackendJson<Record<string, unknown>>(`/inventory/tanks/${encodeURIComponent(tankId)}/reconcile-shrinkage`, {
      method: 'POST',
      body: { reason: reason ?? 'Physical dipstick calibration reconciliation' },
      token,
      syncAfter: true,
    });
  }

  ingestAtgTelemetry(tankId: string, input: { grossObservedLitres: number; temperatureCelsius: number; waterLevelMm?: number }, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const tank = this.state.tanks.find((t) => t.id === tankId);
      if (!tank) return Promise.reject(new Error('Tank not found.'));
      // 15°C thermal expansion compensation (approx 0.00095 / °C)
      const compensatedLitres = Number((input.grossObservedLitres * (1 - 0.00095 * (input.temperatureCelsius - 15))).toFixed(2));
      tank.lastDipLitres = compensatedLitres;
      tank.varianceLitres = Number((compensatedLitres - tank.bookVolumeLitres).toFixed(2));
      tank.status = Math.abs(tank.varianceLitres) > 100 ? 'VARIANCE_ALERT' : tank.bookVolumeLitres / Math.max(1, tank.capacityLitres) < 0.2 ? 'LOW_STOCK' : 'NOMINAL';
      this.persistState();
      this.onStateSynced?.(this.getSnapshot());
      return Promise.resolve({
        tankId,
        grossObservedLitres: input.grossObservedLitres,
        temperatureCelsius: input.temperatureCelsius,
        netStandardVolume15CLitres: compensatedLitres,
        varianceLitres: tank.varianceLitres,
      });
    }
    return this.requestBackendJson<Record<string, unknown>>(`/inventory/tanks/${encodeURIComponent(tankId)}/atg-telemetry`, {
      method: 'POST',
      body: input,
      token,
      syncAfter: true,
    });
  }

  updateFleetAccountStatus(accountId: string, status: 'ACTIVE' | 'HOLD', creditLimitFcfa?: number, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const acc = this.state.fleetAccounts.find((a) => a.id === accountId);
      if (acc) {
        acc.status = status;
        if (creditLimitFcfa !== undefined) acc.creditLimitFcfa = creditLimitFcfa;
      }
      this.persistState();
      this.onStateSynced?.(this.getSnapshot());
      return Promise.resolve(acc ?? { id: accountId, status });
    }
    return this.requestBackendJson<Record<string, unknown>>(`/fleet/accounts/${encodeURIComponent(accountId)}`, {
      method: 'PATCH',
      body: { status, ...(creditLimitFcfa !== undefined ? { creditLimitFcfa } : {}) },
      token,
      syncAfter: true,
    });
  }

  listFleetVehicles(accountId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve([...(this.previewVehicles[accountId] ?? [])]);
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>(`/fleet/accounts/${encodeURIComponent(accountId)}/vehicles`, { token });
  }

  registerFleetVehicle(
    accountId: string,
    input: { plateNumber: string; driverName: string; allowedGrade?: FuelGrade; monthlyLitreCap?: number },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const v = {
        id: `veh_${Math.random().toString(36).slice(2, 8)}`,
        accountId,
        plateNumber: input.plateNumber.trim().toUpperCase(),
        driverName: input.driverName.trim(),
        allowedGrade: input.allowedGrade ?? 'ANY',
        monthlyLitreCap: input.monthlyLitreCap ?? 5000,
        status: 'ACTIVE',
      };
      this.previewVehicles[accountId] = [v, ...(this.previewVehicles[accountId] ?? [])];
      return Promise.resolve(v);
    }
    return this.requestBackendJson<Record<string, unknown>>(`/fleet/accounts/${encodeURIComponent(accountId)}/vehicles`, {
      method: 'POST',
      body: input,
      token,
    });
  }

  deleteFleetVehicle(accountId: string, vehicleId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      this.previewVehicles[accountId] = (this.previewVehicles[accountId] ?? []).filter((v) => v.id !== vehicleId);
      return Promise.resolve();
    }
    return this.requestBackendJson<void>(
      `/fleet/accounts/${encodeURIComponent(accountId)}/vehicles/${encodeURIComponent(vehicleId)}`,
      { method: 'DELETE', token }
    );
  }

  fetchFleetStatement(accountId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const acc = this.state.fleetAccounts.find((a) => a.id === accountId);
      const txs = this.state.fleetTransactions.filter((t) => t.accountId === accountId);
      return Promise.resolve({
        accountId,
        companyName: acc?.companyName ?? accountId,
        taxId: acc?.taxId ?? '',
        status: acc?.status ?? 'ACTIVE',
        creditLimitFcfa: acc?.creditLimitFcfa ?? 0,
        balanceOwedFcfa: acc?.balanceOwedFcfa ?? 0,
        availableCreditFcfa: Math.max(0, (acc?.creditLimitFcfa ?? 0) - (acc?.balanceOwedFcfa ?? 0)),
        transactionCount: txs.length,
        totalLitresConsumed: Number(txs.reduce((s, t) => s + t.litres, 0).toFixed(2)),
        transactions: txs,
      });
    }
    return this.requestBackendJson<Record<string, unknown>>(`/fleet/accounts/${encodeURIComponent(accountId)}/statement`, { token });
  }

  listShopSales(stationId = 'ALL', token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve(this.previewShopSales.filter((s) => stationId === 'ALL' || s.stationId === stationId));
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>(`/shop/sales?stationId=${encodeURIComponent(stationId)}`, { token });
  }

  recordApPayment(input: { stationId: string; supplierName: string; reference: string; amountFcfa: number; paymentSource: 'CASH_SAFE' | 'BANK' }, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const creditAcc = input.paymentSource === 'BANK' ? '1030' : '1010';
      this.pushJournal(input.stationId, input.reference, 'SupplierApPaidEvent', `Supplier AP payment to ${input.supplierName}`, [
        { accountCode: '2010', debitFcfa: input.amountFcfa, creditFcfa: 0 },
        { accountCode: creditAcc, debitFcfa: 0, creditFcfa: input.amountFcfa },
      ]);
      this.persistState();
      this.onStateSynced?.(this.getSnapshot());
      return Promise.resolve({ status: 'POSTED', ...input });
    }
    return this.requestBackendJson<Record<string, unknown>>('/accounting/ap-payments', {
      method: 'POST',
      body: input,
      token,
      syncAfter: true,
    });
  }

  recordVatRemittance(input: { stationId: string; periodLabel: string; reference: string; amountFcfa: number; paymentSource: 'CASH_SAFE' | 'BANK' }, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const creditAcc = input.paymentSource === 'BANK' ? '1030' : '1010';
      this.pushJournal(input.stationId, input.reference, 'VatRemittedEvent', `VAT remittance ${input.periodLabel}`, [
        { accountCode: '2200', debitFcfa: input.amountFcfa, creditFcfa: 0 },
        { accountCode: creditAcc, debitFcfa: 0, creditFcfa: input.amountFcfa },
      ]);
      this.persistState();
      this.onStateSynced?.(this.getSnapshot());
      return Promise.resolve({ status: 'POSTED', ...input });
    }
    return this.requestBackendJson<Record<string, unknown>>('/accounting/vat-remittances', {
      method: 'POST',
      body: input,
      token,
      syncAfter: true,
    });
  }

  postManualJournal(
    input: { stationId: string; reference: string; description: string; lines: Array<{ accountCode: string; debitFcfa: number; creditFcfa: number }> },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      this.pushJournal(input.stationId, input.reference, 'ManualJournalPostedEvent', input.description, input.lines);
      this.persistState();
      this.onStateSynced?.(this.getSnapshot());
      return Promise.resolve({ status: 'POSTED', reference: input.reference });
    }
    return this.requestBackendJson<Record<string, unknown>>('/accounting/journals/manual', {
      method: 'POST',
      body: input,
      token,
      syncAfter: true,
    });
  }

  listFiscalPeriods(stationId = 'ALL', token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve(this.previewFiscalPeriods.filter((p) => stationId === 'ALL' || p.stationId === stationId));
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>(`/accounting/periods?stationId=${encodeURIComponent(stationId)}`, { token });
  }

  closeFiscalPeriod(stationId: string, periodKey: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const fp = {
        id: `fp_${Math.random().toString(36).slice(2, 8)}`,
        stationId,
        periodKey,
        status: 'CLOSED',
        closedBy: this.state.tenant.ownerEmail,
        closedAt: new Date().toISOString(),
      };
      this.previewFiscalPeriods.unshift(fp);
      return Promise.resolve(fp);
    }
    return this.requestBackendJson<Record<string, unknown>>('/accounting/periods/close', {
      method: 'POST',
      body: { stationId, periodKey },
      token,
    });
  }

  fetchAiHistory(stationId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve(this.previewAiHistory.filter((h) => stationId === 'ALL' || h.stationId === stationId));
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>(`/ai/history?stationId=${encodeURIComponent(stationId)}`, { token });
  }

  createWebhookLive(targetUrl: string, subscribedEvents: string[], token?: string | null) {
    if (!this.springBootBaseUrl) {
      const signingSecret = `whsec_${Math.random().toString(36).slice(2, 18)}${Math.random().toString(36).slice(2, 10)}`;
      this.createWebhook('OWNER', targetUrl, subscribedEvents);
      const created = this.state.webhooks[0];
      return Promise.resolve({ ...created, signingSecret });
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform/webhooks', {
      method: 'POST',
      body: { targetUrl, subscribedEvents },
      token,
      syncAfter: true,
    });
  }

  createApiKeyLive(label: string, scopes: string[], token?: string | null) {
    if (!this.springBootBaseUrl) {
      const rawKey = `opf_live_${Math.random().toString(36).slice(2, 16)}${Math.random().toString(36).slice(2, 10)}`;
      this.createApiKey('OWNER', label, scopes);
      const created = this.state.apiKeys[0];
      return Promise.resolve({ ...created, rawApiKey: rawKey });
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform/api-keys', {
      method: 'POST',
      body: { label, scopes },
      token,
      syncAfter: true,
    });
  }

  listWebhookDeliveries(webhookId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve([
        {
          id: `del_${webhookId}_1`,
          webhookId,
          eventType: 'ShiftClosedEvent',
          httpStatus: 200,
          success: true,
          attemptCount: 1,
          deliveredAt: new Date().toISOString(),
          responseSnippet: '{"received":true}',
        },
      ]);
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>(
      `/platform/webhooks/${encodeURIComponent(webhookId)}/deliveries`,
      { token }
    );
  }

  // --- SaaS Platform Super-Admin Control Plane (/api/v1/platform-admin/*) ---
  private previewPlatformTenants: Array<{
    id: string;
    name: string;
    ownerEmail: string;
    countryCode: string;
    timezone: string;
    status: string;
    planCode: string;
    trialEndsAt: string | null;
    billingStatus: string;
    stationCount: number;
    employeeCount: number;
    monthlyMrrFcfa: number;
    openTicketsCount: number;
    edgeDevicesOnline: number;
    createdAt: string;
  }> | null = null;

  private previewPlatformTickets: Array<Record<string, unknown>> = [
    {
      id: 'tkt_seed_01',
      ticketNumber: 'SUP-2026-0101',
      tenantId: 'ten_opes_cm',
      tenantName: 'OpesFuel Cameroon Flagship',
      stationId: 'st_plateau',
      requesterEmail: 'owner@opesfuel.cm',
      subject: 'Verify MTN MoMo webhook callback timeout on Station Plateau',
      category: 'PAYMENTS_MOMO',
      priority: 'HIGH',
      status: 'OPEN',
      assignedTo: 'superadmin@opesware.com',
      slaDueAt: new Date(Date.now() + 3600_000 * 4).toISOString(),
      resolvedAt: null,
      messageCount: 1,
      createdAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    },
    {
      id: 'tkt_seed_02',
      ticketNumber: 'SUP-2026-0102',
      tenantId: 'ten_atlantic_oil',
      tenantName: 'Atlantic Petroleum Cameroon SA',
      stationId: 'st_akwa',
      requesterEmail: 'ceo@atlanticoil.cm',
      subject: 'Edge Agent TLS certificate renewal for Wayne Dart pumps',
      category: 'EDGE_HARDWARE',
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      assignedTo: 'superadmin@opesware.com',
      slaDueAt: new Date(Date.now() + 3600_000 * 1.5).toISOString(),
      resolvedAt: null,
      messageCount: 2,
      createdAt: new Date(Date.now() - 3600_000 * 6).toISOString(),
      updatedAt: new Date(Date.now() - 1800_000).toISOString(),
    },
  ];

  private previewTicketMessages: Record<string, Array<Record<string, unknown>>> = {
    tkt_seed_01: [
      {
        id: 'tmsg_01',
        ticketId: 'tkt_seed_01',
        senderEmail: 'owner@opesfuel.cm',
        senderRole: 'OWNER',
        internalNote: false,
        body: 'We completed a subscription payment via MTN MoMo Cameroon and would like confirmation that the production callback URL is active on our workspace.',
        createdAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
      },
    ],
    tkt_seed_02: [
      {
        id: 'tmsg_02',
        ticketId: 'tkt_seed_02',
        senderEmail: 'ceo@atlanticoil.cm',
        senderRole: 'OWNER',
        internalNote: false,
        body: 'Our Douala Akwa Edge Agent device shows 4 queued pump readings waiting for sync.',
        createdAt: new Date(Date.now() - 3600_000 * 6).toISOString(),
      },
      {
        id: 'tmsg_03',
        ticketId: 'tkt_seed_02',
        senderEmail: 'superadmin@opesware.com',
        senderRole: 'PLATFORM_ADMIN',
        internalNote: true,
        body: 'Checked heartbeat telemetry: outbox depth is 4, rotating edge API key next.',
        createdAt: new Date(Date.now() - 1800_000).toISOString(),
      },
    ],
  };

  private previewImpersonations: Array<Record<string, unknown>> = [];

  private previewGlobalInvoices: Array<Record<string, unknown>> = [
    {
      id: 'ginv_01',
      tenantId: 'ten_opes_cm',
      tenantName: 'OpesFuel Cameroon Flagship',
      invoiceNumber: 'OPF-SAAS-2026-011',
      periodLabel: '2026-11',
      stationCount: 2,
      totalFcfa: 110000,
      paidFcfa: 110000,
      status: 'PAID',
      channel: 'ORANGE_MONEY',
      dueDate: new Date(Date.now() + 86400_000 * 10).toISOString(),
      createdAt: new Date(Date.now() - 86400_000 * 4).toISOString(),
    },
    {
      id: 'ginv_02',
      tenantId: 'ten_atlantic_oil',
      tenantName: 'Atlantic Petroleum Cameroon SA',
      invoiceNumber: 'OPF-SAAS-2026-012',
      periodLabel: '2026-11',
      stationCount: 4,
      totalFcfa: 480000,
      paidFcfa: 480000,
      status: 'PAID',
      channel: 'MTN_MOMO',
      dueDate: new Date(Date.now() + 86400_000 * 12).toISOString(),
      createdAt: new Date(Date.now() - 86400_000 * 3).toISOString(),
    },
    {
      id: 'ginv_03',
      tenantId: 'ten_sahel_energies',
      tenantName: 'Sahel Energies Nord',
      invoiceNumber: 'OPF-SAAS-2026-013',
      periodLabel: '2026-11',
      stationCount: 2,
      totalFcfa: 110000,
      paidFcfa: 0,
      status: 'OVERDUE',
      channel: 'UNSETTLED',
      dueDate: new Date(Date.now() - 86400_000 * 3).toISOString(),
      createdAt: new Date(Date.now() - 86400_000 * 17).toISOString(),
    },
  ];

  private previewMomoSettlements: Array<Record<string, unknown>> = [
    {
      id: 'momo_tx_01',
      tenantId: 'ten_atlantic_oil',
      tenantName: 'Atlantic Petroleum Cameroon SA',
      targetType: 'SAAS_INVOICE',
      targetId: 'ginv_02',
      provider: 'MTN_MOMO',
      environment: 'mtn_cameroon',
      msisdn: '237677112233',
      amountFcfa: 480000,
      referenceId: 'MOMO-CM-882011',
      providerTxId: 'FIN-MTN-9920144',
      status: 'SUCCESSFUL',
      createdAt: new Date(Date.now() - 86400_000 * 2).toISOString(),
      settledAt: new Date(Date.now() - 86400_000 * 2 + 12000).toISOString(),
    },
    {
      id: 'momo_tx_02',
      tenantId: 'ten_opes_cm',
      tenantName: 'OpesFuel Cameroon Flagship',
      targetType: 'SAAS_INVOICE',
      targetId: 'ginv_01',
      provider: 'ORANGE_MONEY',
      environment: 'orange_cm',
      msisdn: '237699445566',
      amountFcfa: 110000,
      referenceId: 'OM-CM-441098',
      providerTxId: 'OMWP-772190',
      status: 'SUCCESSFUL',
      createdAt: new Date(Date.now() - 86400_000 * 3).toISOString(),
      settledAt: new Date(Date.now() - 86400_000 * 3 + 18000).toISOString(),
    },
  ];

  private previewLicenses: Array<Record<string, unknown>> = [
    {
      id: 'lic_01',
      licenseKey: 'OPF-ENT-2026-8841-CMR',
      tenantId: 'ten_atlantic_oil',
      organizationName: 'Atlantic Petroleum Cameroon SA',
      tierName: 'Enterprise On-Premises Perpetual',
      maxStations: 25,
      annualFeeFcfa: 5000000,
      expiresAt: '2027-11-30',
      status: 'ACTIVE',
      issuedBy: 'superadmin@opesware.com',
      issuedAt: new Date(Date.now() - 86400_000 * 30).toISOString(),
    },
  ];

  private previewBroadcasts: Array<Record<string, unknown>> = [
    {
      id: 'bc_01',
      channel: 'IN_APP',
      audience: 'ALL_ACTIVE',
      title: 'SYSCOHADA 2026 Tax & Margin Compliance Update',
      message: 'All OpesFuel workspaces now include automated Cameroon MTN MoMo & Orange Money reconciliation and verifiable QR security documents.',
      recipientCount: 3,
      dispatchedCount: 3,
      sentBy: 'superadmin@opesware.com',
      sentAt: new Date(Date.now() - 86400_000 * 2).toISOString(),
    },
  ];

  private previewPlatformAuditLogs: Array<Record<string, unknown>> = [
    {
      id: 'paud_01',
      tenantId: 'PLATFORM',
      actorEmail: 'superadmin@opesware.com',
      actorRole: '[ROLE_PLATFORM_ADMIN]',
      action: 'PLATFORM_SETTINGS_UPDATED',
      entityType: 'PLATFORM_SETTINGS',
      entityId: 'global',
      summary: 'Verified Cameroon FX rate (605 XAF/USD) and 14-day default trial policy.',
      createdAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
    },
    {
      id: 'paud_02',
      tenantId: 'ten_atlantic_oil',
      actorEmail: 'superadmin@opesware.com',
      actorRole: '[ROLE_PLATFORM_ADMIN]',
      action: 'ENTERPRISE_LICENSE_ISSUED',
      entityType: 'ENTERPRISE_LICENSE',
      entityId: 'lic_01',
      summary: 'Issued sovereign license OPF-ENT-2026-8841-CMR (25 stations) to Atlantic Petroleum Cameroon SA.',
      createdAt: new Date(Date.now() - 86400_000 * 3).toISOString(),
    },
  ];

  private previewGovernanceSettings: Record<string, unknown> = {
    xafPerUsdRate: 605,
    defaultTrialDays: 14,
    gracePeriodDays: 7,
    selfSignupEnabled: true,
    maintenanceMode: false,
    maintenanceBanner: '',
    aiAddonMonthlyFcfa: 30000,
    perpetualLicenseAnnualFcfa: 5000000,
  };

  private previewGovernancePlans: Array<Record<string, unknown>> = [
    { plan_code: 'starter', plan_name: 'Starter Station', monthly_price_fcfa: 25000, monthly_price_usd: 41.32, max_stations: 1, max_pumps: 6, trial_days: 14, active: true },
    { plan_code: 'growth', plan_name: 'Multi-Pump Pro', monthly_price_fcfa: 55000, monthly_price_usd: 90.91, max_stations: 5, max_pumps: 18, trial_days: 14, active: true },
    { plan_code: 'enterprise', plan_name: 'Network Enterprise', monthly_price_fcfa: 120000, monthly_price_usd: 198.35, max_stations: 999, max_pumps: 999, trial_days: 30, active: true },
  ];

  private previewPlatformLeads: Array<{
    id: string;
    referenceId: string;
    fullName: string;
    stationName: string;
    email: string;
    phone: string;
    pumpCount: number;
    selectedPlan: string;
    status: string;
    createdAt: string;
  }> = [
    {
      id: 'lead_preview_1',
      referenceId: 'LEAD-DLA9021A',
      fullName: 'Hervé Njoya',
      stationName: 'Littoral Energies Akwa',
      email: 'direction@littoral-energies.cm',
      phone: '+237 699 41 22 08',
      pumpCount: 12,
      selectedPlan: 'Multi-Pump Pro (55 000 FCFA/mo)',
      status: 'RECEIVED',
      createdAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
    },
    {
      id: 'lead_preview_2',
      referenceId: 'LEAD-YDE4410C',
      fullName: 'Nadège Fouda',
      stationName: 'Centre Fuel Network (6 Stations)',
      email: 'finance@centrefuel.cm',
      phone: '+237 677 88 15 40',
      pumpCount: 28,
      selectedPlan: 'Network Enterprise (120 000 FCFA/mo)',
      status: 'QUALIFIED',
      createdAt: new Date(Date.now() - 86400_000 * 2).toISOString(),
    },
  ];

  private ensurePreviewPlatformTenants() {
    if (this.previewPlatformTenants !== null) return this.previewPlatformTenants;
    const currentMrr = this.state.stations.reduce((s, st) => s + st.monthlyFeeFcfa, 0);
    this.previewPlatformTenants = [
      {
        id: this.state.tenant.tenantId,
        name: this.state.tenant.organizationName,
        ownerEmail: this.state.tenant.ownerEmail,
        countryCode: 'CM',
        timezone: 'Africa/Douala',
        status: 'ACTIVE',
        planCode: 'growth',
        trialEndsAt: null,
        billingStatus: 'CURRENT',
        stationCount: this.state.stations.length,
        employeeCount: this.state.employees.length,
        monthlyMrrFcfa: currentMrr,
        openTicketsCount: 1,
        edgeDevicesOnline: 2,
        createdAt: this.state.tenant.createdAt,
      },
      {
        id: 'ten_atlantic_oil',
        name: 'Atlantic Petroleum Cameroon SA',
        ownerEmail: 'ceo@atlanticoil.cm',
        countryCode: 'CM',
        timezone: 'Africa/Douala',
        status: 'ACTIVE',
        planCode: 'enterprise',
        trialEndsAt: null,
        billingStatus: 'CURRENT',
        stationCount: 4,
        employeeCount: 26,
        monthlyMrrFcfa: 480000,
        openTicketsCount: 1,
        edgeDevicesOnline: 3,
        createdAt: new Date(Date.now() - 86400_000 * 42).toISOString(),
      },
      {
        id: 'ten_sahel_energies',
        name: 'Sahel Energies Nord',
        ownerEmail: 'ops@sahelenergies.cm',
        countryCode: 'CM',
        timezone: 'Africa/Douala',
        status: 'ACTIVE',
        planCode: 'starter',
        trialEndsAt: new Date(Date.now() + 86400_000 * 9).toISOString(),
        billingStatus: 'TRIAL',
        stationCount: 2,
        employeeCount: 11,
        monthlyMrrFcfa: 50000,
        openTicketsCount: 0,
        edgeDevicesOnline: 1,
        createdAt: new Date(Date.now() - 86400_000 * 19).toISOString(),
      },
    ];
    return this.previewPlatformTenants;
  }

  recordPreviewLead(input: {
    referenceId: string;
    fullName: string;
    stationName: string;
    email: string;
    phone: string;
    pumpCount: number;
    selectedPlan: string;
  }) {
    this.previewPlatformLeads.unshift({
      id: `lead_${Math.random().toString(36).slice(2, 8)}`,
      ...input,
      status: 'RECEIVED',
      createdAt: new Date().toISOString(),
    });
  }

  fetchPlatformAdminOverview(token?: string | null) {
    if (!this.springBootBaseUrl) {
      const tenants = this.ensurePreviewPlatformTenants();
      const stationMrrFcfa = tenants.reduce((s, t) => s + t.monthlyMrrFcfa, 0);
      const aiAddonMrrFcfa = this.state.tenant.aiSubscription.active ? this.state.tenant.aiSubscription.monthlyFeeFcfa : 0;
      const totalPlatformMrrFcfa = stationMrrFcfa + aiAddonMrrFcfa;
      const totalBilledFcfa = this.previewGlobalInvoices.reduce((s, i) => s + Number(i.totalFcfa ?? 0), 0);
      const totalCollectedFcfa = this.previewGlobalInvoices.reduce((s, i) => s + Number(i.paidFcfa ?? 0), 0);
      const activeTenants = tenants.filter((t) => t.status === 'ACTIVE').length;
      const suspendedTenants = tenants.filter((t) => t.status === 'SUSPENDED').length;
      const trialTenants = tenants.filter((t) => t.trialEndsAt && new Date(t.trialEndsAt).getTime() > Date.now()).length;
      const openTickets = this.previewPlatformTickets.filter((t) => ['OPEN', 'IN_PROGRESS', 'WAITING_TENANT', 'ESCALATED'].includes(String(t.status)));
      const urgentTickets = openTickets.filter((t) => ['HIGH', 'URGENT'].includes(String(t.priority)));
      const tierDefs = [
        { planCode: 'starter', planName: 'Starter Station' },
        { planCode: 'growth', planName: 'Multi-Pump Pro' },
        { planCode: 'enterprise', planName: 'Network Enterprise' },
      ];
      const planTierBreakdown = tierDefs.map((def) => {
        const group = tenants.filter((t) => (t.planCode || 'growth') === def.planCode);
        const mrr = group.reduce((s, t) => s + t.monthlyMrrFcfa, 0);
        return {
          planCode: def.planCode,
          planName: def.planName,
          tenantCount: group.length,
          stationCount: group.reduce((s, t) => s + t.stationCount, 0),
          mrrFcfa: mrr,
          sharePct: stationMrrFcfa > 0 ? Math.round((mrr * 1000) / stationMrrFcfa) / 10 : 0,
        };
      });
      return Promise.resolve({
        totalTenants: tenants.length,
        activeTenants,
        suspendedTenants,
        trialTenants,
        totalStations: tenants.reduce((s, t) => s + t.stationCount, 0),
        totalPlatformMrrFcfa,
        stationMrrFcfa,
        aiAddonMrrFcfa,
        activeAiAddons: this.state.tenant.aiSubscription.active ? 2 : 1,
        totalBilledFcfa,
        totalCollectedFcfa,
        outstandingReceivablesFcfa: Math.max(0, totalBilledFcfa - totalCollectedFcfa),
        collectionRatePct: totalBilledFcfa > 0 ? Math.round((totalCollectedFcfa * 1000) / totalBilledFcfa) / 10 : 100,
        arpuFcfa: activeTenants > 0 ? Math.round(totalPlatformMrrFcfa / activeTenants) : 0,
        churnRatePct: tenants.length > 0 ? Math.round((suspendedTenants * 1000) / tenants.length) / 10 : 0,
        openLeadsCount: this.previewPlatformLeads.filter((l) => ['RECEIVED', 'CONTACTED', 'QUALIFIED'].includes(l.status)).length,
        totalEmployees: tenants.reduce((s, t) => s + t.employeeCount, 0),
        openSupportTickets: openTickets.length,
        urgentSupportTickets: urgentTickets.length,
        edgeDevicesTotal: 7,
        edgeDevicesOnline: tenants.reduce((s, t) => s + t.edgeDevicesOnline, 0),
        failedWebhooks24h: 0,
        momoSettledVolumeFcfa: this.previewMomoSettlements
          .filter((m) => m.status === 'SUCCESSFUL')
          .reduce((s, m) => s + Number(m.amountFcfa ?? 0), 0),
        momoSettledCount: this.previewMomoSettlements.filter((m) => m.status === 'SUCCESSFUL').length,
        activeLicensesCount: this.previewLicenses.filter((l) => l.status === 'ACTIVE').length,
        planTierBreakdown,
        generatedAt: new Date().toISOString(),
      });
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform-admin/overview', { token });
  }

  listPlatformTenants(token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve([...this.ensurePreviewPlatformTenants()]);
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>('/platform-admin/tenants', { token });
  }

  createPlatformTenant(
    payload: { name: string; ownerEmail: string; countryCode?: string; city?: string; planCode?: string; initialStations: number; trialDays?: number },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const list = this.ensurePreviewPlatformTenants();
      const planCode = payload.planCode || 'growth';
      const fee = planCode === 'starter' ? 25000 : planCode === 'enterprise' ? 120000 : 55000;
      const created = {
        id: `ten_${Date.now().toString(36)}`,
        name: payload.name,
        ownerEmail: payload.ownerEmail,
        countryCode: payload.countryCode || 'CM',
        timezone: 'Africa/Douala',
        status: 'ACTIVE',
        planCode,
        trialEndsAt: (payload.trialDays ?? 14) > 0 ? new Date(Date.now() + 86400_000 * (payload.trialDays ?? 14)).toISOString() : null,
        billingStatus: (payload.trialDays ?? 14) > 0 ? 'TRIAL' : 'CURRENT',
        stationCount: Math.max(1, payload.initialStations),
        employeeCount: 1,
        monthlyMrrFcfa: Math.max(1, payload.initialStations) * fee,
        openTicketsCount: 0,
        edgeDevicesOnline: 0,
        createdAt: new Date().toISOString(),
      };
      list.unshift(created);
      this.previewPlatformAuditLogs.unshift({
        id: `paud_${Date.now().toString(36)}`,
        tenantId: created.id,
        actorEmail: 'superadmin@opesware.com',
        actorRole: '[ROLE_PLATFORM_ADMIN]',
        action: 'PLATFORM_TENANT_PROVISIONED',
        entityType: 'TENANT',
        entityId: created.id,
        summary: `Provisioned ${created.name} (${created.ownerEmail}) on ${planCode} with ${created.stationCount} station(s).`,
        createdAt: new Date().toISOString(),
      });
      return Promise.resolve(created);
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform-admin/tenants', {
      method: 'POST',
      body: payload,
      token,
    });
  }

  getPlatformTenantDetail(tenantId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const list = this.ensurePreviewPlatformTenants();
      const t = list.find((item) => item.id === tenantId) ?? list[0];
      const planName = t.planCode === 'starter' ? 'Starter Station' : t.planCode === 'enterprise' ? 'Network Enterprise' : 'Multi-Pump Pro';
      const stations =
        t.id === this.state.tenant.tenantId
          ? this.state.stations.map((s) => ({
              id: s.id,
              code: s.code,
              name: s.name,
              city: s.city,
              plan_name: s.planName,
              monthly_fee_fcfa: s.monthlyFeeFcfa,
              pump_count: this.state.pumps.filter((p) => p.stationId === s.id).length,
              tank_count: this.state.tanks.filter((tk) => tk.stationId === s.id).length,
            }))
          : Array.from({ length: Math.max(1, t.stationCount) }, (_, idx) => ({
              id: `${t.id}_st_${idx + 1}`,
              code: `ST-${idx + 1}`,
              name: `${t.name} Site #${idx + 1}`,
              city: idx % 2 === 0 ? 'Douala' : 'Yaoundé',
              plan_name: planName,
              monthly_fee_fcfa: Math.round(t.monthlyMrrFcfa / Math.max(1, t.stationCount)),
              pump_count: 6,
              tank_count: 3,
            }));
      return Promise.resolve({
        ...t,
        planName,
        branding: {
          legal_name: t.name,
          trading_name: t.name,
          tax_id_niu: 'M052614892011X',
          rccm_number: 'RC/DLA/2024/B/4192',
          city: 'Douala',
          phone: '+237 699 00 11 22',
          email: t.ownerEmail,
        },
        stations,
        users: [
          { id: `usr_${t.id}`, full_name: 'Primary Owner', email: t.ownerEmail, role: 'OWNER', phone: '+237 699 00 11 22' },
        ],
        invoices: this.previewGlobalInvoices.filter((inv) => inv.tenantId === t.id),
        momoTransactions: this.previewMomoSettlements.filter((m) => m.tenantId === t.id),
        edgeDevices: Array.from({ length: t.edgeDevicesOnline }, (_, idx) => ({
          id: `edge_${t.id}_${idx + 1}`,
          device_name: `Forecourt Pi Gateway #${idx + 1}`,
          agent_version: '1.2.0',
          status: 'ONLINE',
          outbox_depth: 0,
          last_heartbeat_at: new Date(Date.now() - 45_000).toISOString(),
        })),
        supportTickets: this.previewPlatformTickets.filter((tk) => tk.tenantId === t.id),
        recentAuditLogs: this.previewPlatformAuditLogs.filter((l) => l.tenantId === t.id || l.entityId === t.id),
      });
    }
    return this.requestBackendJson<Record<string, unknown>>(`/platform-admin/tenants/${encodeURIComponent(tenantId)}`, { token });
  }

  updatePlatformTenantStatus(tenantId: string, status: 'ACTIVE' | 'SUSPENDED', token?: string | null) {
    if (!this.springBootBaseUrl) {
      const list = this.ensurePreviewPlatformTenants();
      const target = list.find((t) => t.id === tenantId);
      if (target) target.status = status;
      this.previewPlatformAuditLogs.unshift({
        id: `paud_${Date.now().toString(36)}`,
        tenantId,
        actorEmail: 'superadmin@opesware.com',
        actorRole: '[ROLE_PLATFORM_ADMIN]',
        action: `TENANT_STATUS_${status}`,
        entityType: 'TENANT',
        entityId: tenantId,
        summary: `Changed tenant ${target?.name ?? tenantId} status to ${status}.`,
        createdAt: new Date().toISOString(),
      });
      return Promise.resolve(target ?? { id: tenantId, status });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/platform-admin/tenants/${encodeURIComponent(tenantId)}/status`,
      { method: 'PATCH', body: { status }, token }
    );
  }

  updatePlatformTenantPlan(tenantId: string, planCode: string, customMonthlyFeePerStationFcfa?: number | null, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const list = this.ensurePreviewPlatformTenants();
      const target = list.find((t) => t.id === tenantId);
      if (target) {
        const fee = customMonthlyFeePerStationFcfa && customMonthlyFeePerStationFcfa > 0
          ? customMonthlyFeePerStationFcfa
          : planCode === 'starter' ? 25000 : planCode === 'enterprise' ? 120000 : 55000;
        target.planCode = planCode;
        target.billingStatus = 'CURRENT';
        target.monthlyMrrFcfa = Math.max(1, target.stationCount) * fee;
        this.previewPlatformAuditLogs.unshift({
          id: `paud_${Date.now().toString(36)}`,
          tenantId,
          actorEmail: 'superadmin@opesware.com',
          actorRole: '[ROLE_PLATFORM_ADMIN]',
          action: 'TENANT_PLAN_CHANGED',
          entityType: 'TENANT',
          entityId: tenantId,
          summary: `Upgraded ${target.name} to ${planCode} (${fee} FCFA/station/mo).`,
          createdAt: new Date().toISOString(),
        });
      }
      return this.getPlatformTenantDetail(tenantId, token);
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/platform-admin/tenants/${encodeURIComponent(tenantId)}/plan`,
      { method: 'PATCH', body: { planCode, customMonthlyFeePerStationFcfa: customMonthlyFeePerStationFcfa ?? null }, token }
    );
  }

  extendPlatformTenantTrial(tenantId: string, days: number, reason?: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const list = this.ensurePreviewPlatformTenants();
      const target = list.find((t) => t.id === tenantId);
      if (target) {
        const base = target.trialEndsAt && new Date(target.trialEndsAt).getTime() > Date.now()
          ? new Date(target.trialEndsAt).getTime()
          : Date.now();
        target.trialEndsAt = new Date(base + 86400_000 * days).toISOString();
        target.billingStatus = 'TRIAL';
        this.previewPlatformAuditLogs.unshift({
          id: `paud_${Date.now().toString(36)}`,
          tenantId,
          actorEmail: 'superadmin@opesware.com',
          actorRole: '[ROLE_PLATFORM_ADMIN]',
          action: 'TENANT_TRIAL_EXTENDED',
          entityType: 'TENANT',
          entityId: tenantId,
          summary: `Extended trial for ${target.name} by +${days} days (${reason || 'Support grant'}).`,
          createdAt: new Date().toISOString(),
        });
      }
      return this.getPlatformTenantDetail(tenantId, token);
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/platform-admin/tenants/${encodeURIComponent(tenantId)}/trial`,
      { method: 'PATCH', body: { days, reason }, token }
    );
  }

  resendPlatformTenantAccess(tenantId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const list = this.ensurePreviewPlatformTenants();
      const target = list.find((t) => t.id === tenantId);
      this.previewPlatformAuditLogs.unshift({
        id: `paud_${Date.now().toString(36)}`,
        tenantId,
        actorEmail: 'superadmin@opesware.com',
        actorRole: '[ROLE_PLATFORM_ADMIN]',
        action: 'TENANT_ACCESS_RECOVERY_SENT',
        entityType: 'TENANT',
        entityId: tenantId,
        summary: `Dispatched owner access recovery email to ${target?.ownerEmail ?? 'owner'}.`,
        createdAt: new Date().toISOString(),
      });
      return Promise.resolve({
        tenantId,
        ownerEmail: target?.ownerEmail ?? 'owner@opesfuel.cm',
        deliveryStatus: 'DISPATCHED',
        sentAt: new Date().toISOString(),
      });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/platform-admin/tenants/${encodeURIComponent(tenantId)}/resend-access`,
      { method: 'POST', token }
    );
  }

  listPlatformLeads(token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve([...this.previewPlatformLeads]);
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>('/platform-admin/leads', { token });
  }

  updatePlatformLeadStatus(
    leadId: string,
    status: 'RECEIVED' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'ARCHIVED',
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const target = this.previewPlatformLeads.find((l) => l.id === leadId);
      if (target) target.status = status;
      return Promise.resolve(target ?? { id: leadId, status });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/platform-admin/leads/${encodeURIComponent(leadId)}/status`,
      { method: 'PATCH', body: { status }, token }
    );
  }

  // --- Support Desk & Impersonations ---

  listPlatformSupportTickets(filters?: { status?: string; tenantId?: string; priority?: string }, token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve(
        this.previewPlatformTickets.filter((t) => {
          if (filters?.status && filters.status !== 'ALL' && t.status !== filters.status) return false;
          if (filters?.tenantId && t.tenantId !== filters.tenantId) return false;
          if (filters?.priority && filters.priority !== 'ALL' && t.priority !== filters.priority) return false;
          return true;
        })
      );
    }
    const qs = new URLSearchParams();
    if (filters?.status && filters.status !== 'ALL') qs.set('status', filters.status);
    if (filters?.tenantId) qs.set('tenantId', filters.tenantId);
    if (filters?.priority && filters.priority !== 'ALL') qs.set('priority', filters.priority);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.requestBackendJson<Array<Record<string, unknown>>>(`/platform-admin/support/tickets${suffix}`, { token });
  }

  createPlatformSupportTicket(
    payload: { tenantId: string; tenantName?: string; requesterEmail?: string; subject: string; description: string; category: string; priority: string },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const id = `tkt_${Date.now().toString(36)}`;
      const tenant = this.ensurePreviewPlatformTenants().find((t) => t.id === payload.tenantId);
      const created = {
        id,
        ticketNumber: `SUP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        tenantId: payload.tenantId,
        tenantName: tenant?.name ?? payload.tenantName ?? payload.tenantId,
        requesterEmail: payload.requesterEmail || tenant?.ownerEmail || 'owner@opesfuel.cm',
        subject: payload.subject,
        category: payload.category,
        priority: payload.priority,
        status: 'OPEN',
        assignedTo: 'superadmin@opesware.com',
        slaDueAt: new Date(Date.now() + 3600_000 * (payload.priority === 'URGENT' ? 2 : 12)).toISOString(),
        messageCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.previewPlatformTickets.unshift(created);
      this.previewTicketMessages[id] = [
        {
          id: `tmsg_${Date.now().toString(36)}`,
          ticketId: id,
          senderEmail: created.requesterEmail,
          senderRole: 'OWNER',
          internalNote: false,
          body: payload.description,
          createdAt: new Date().toISOString(),
        },
      ];
      return Promise.resolve(created);
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform-admin/support/tickets', {
      method: 'POST',
      body: payload,
      token,
    });
  }

  updatePlatformSupportTicket(
    ticketId: string,
    payload: { status?: string; priority?: string; assignedTo?: string },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const t = this.previewPlatformTickets.find((item) => item.id === ticketId);
      if (t) {
        if (payload.status) t.status = payload.status;
        if (payload.priority) t.priority = payload.priority;
        if (payload.assignedTo) t.assignedTo = payload.assignedTo;
        t.updatedAt = new Date().toISOString();
      }
      return Promise.resolve(t ?? { id: ticketId, ...payload });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/platform-admin/support/tickets/${encodeURIComponent(ticketId)}`,
      { method: 'PATCH', body: payload, token }
    );
  }

  listPlatformTicketMessages(ticketId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve([...(this.previewTicketMessages[ticketId] ?? [])]);
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>(
      `/platform-admin/support/tickets/${encodeURIComponent(ticketId)}/messages`,
      { token }
    );
  }

  postPlatformTicketMessage(
    ticketId: string,
    payload: { body: string; internalNote: boolean; notifyRequester: boolean },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const msg = {
        id: `tmsg_${Date.now().toString(36)}`,
        ticketId,
        senderEmail: 'superadmin@opesware.com',
        senderRole: 'PLATFORM_ADMIN',
        internalNote: payload.internalNote,
        body: payload.body,
        createdAt: new Date().toISOString(),
      };
      this.previewTicketMessages[ticketId] = [...(this.previewTicketMessages[ticketId] ?? []), msg];
      const t = this.previewPlatformTickets.find((item) => item.id === ticketId);
      if (t) {
        t.messageCount = Number(t.messageCount ?? 0) + 1;
        t.updatedAt = msg.createdAt;
      }
      return Promise.resolve(msg);
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/platform-admin/support/tickets/${encodeURIComponent(ticketId)}/messages`,
      { method: 'POST', body: payload, token }
    );
  }

  listPlatformImpersonations(token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve([...this.previewImpersonations]);
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>('/platform-admin/support/impersonations', { token });
  }

  startPlatformImpersonation(
    payload: { tenantId: string; tenantName?: string; ticketId?: string; reason: string },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const session = {
        id: `imp_${Date.now().toString(36)}`,
        adminEmail: 'superadmin@opesware.com',
        tenantId: payload.tenantId,
        tenantName: payload.tenantName || this.ensurePreviewPlatformTenants().find((t) => t.id === payload.tenantId)?.name || payload.tenantId,
        ticketId: payload.ticketId ?? null,
        reason: payload.reason,
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        endedAt: null,
      };
      this.previewImpersonations.unshift(session);
      this.previewPlatformAuditLogs.unshift({
        id: `paud_${Date.now().toString(36)}`,
        tenantId: session.tenantId,
        actorEmail: session.adminEmail,
        actorRole: '[ROLE_PLATFORM_ADMIN]',
        action: 'PLATFORM_IMPERSONATION_STARTED',
        entityType: 'IMPERSONATION_SESSION',
        entityId: session.id,
        summary: `Entered audited support view for ${session.tenantName} — ${session.reason}`,
        createdAt: session.startedAt,
      });
      return Promise.resolve(session);
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform-admin/support/impersonations', {
      method: 'POST',
      body: payload,
      token,
    });
  }

  endPlatformImpersonation(sessionId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const found = this.previewImpersonations.find((s) => s.id === sessionId);
      const now = new Date().toISOString();
      if (found) {
        found.status = 'ENDED';
        found.endedAt = now;
      }
      this.previewPlatformAuditLogs.unshift({
        id: `paud_${Date.now().toString(36)}`,
        tenantId: 'PLATFORM',
        actorEmail: 'superadmin@opesware.com',
        actorRole: '[ROLE_PLATFORM_ADMIN]',
        action: 'PLATFORM_IMPERSONATION_ENDED',
        entityType: 'IMPERSONATION_SESSION',
        entityId: sessionId,
        summary: `Closed support impersonation session ${sessionId}.`,
        createdAt: now,
      });
      return Promise.resolve({ id: sessionId, status: 'ENDED', endedAt: now });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/platform-admin/support/impersonations/${encodeURIComponent(sessionId)}/end`,
      { method: 'POST', token }
    );
  }

  // --- Global Billing, MoMo Settlements, Licenses, Broadcasts, Health, Audit, Governance ---

  listPlatformGlobalInvoices(token?: string | null) {
    if (!this.springBootBaseUrl) return Promise.resolve([...this.previewGlobalInvoices]);
    return this.requestBackendJson<Array<Record<string, unknown>>>('/platform-admin/invoices', { token });
  }

  issuePlatformGlobalInvoice(
    payload: { tenantId: string; periodLabel: string; totalFcfa: number; channel: string },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const t = this.ensurePreviewPlatformTenants().find((x) => x.id === payload.tenantId);
      const created = {
        id: `ginv_${Date.now().toString(36)}`,
        tenantId: payload.tenantId,
        tenantName: t?.name ?? payload.tenantId,
        invoiceNumber: `OPF-SAAS-${payload.periodLabel}-${Math.floor(100 + Math.random() * 900)}`,
        periodLabel: payload.periodLabel,
        totalFcfa: payload.totalFcfa,
        paidFcfa: 0,
        status: 'ISSUED',
        channel: payload.channel,
        createdAt: new Date().toISOString(),
      };
      this.previewGlobalInvoices.unshift(created);
      return Promise.resolve(created);
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform-admin/invoices', {
      method: 'POST',
      body: payload,
      token,
    });
  }

  markPlatformGlobalInvoicePaid(invoiceId: string, paymentChannel = 'MTN_MOMO', token?: string | null) {
    if (!this.springBootBaseUrl) {
      const inv = this.previewGlobalInvoices.find((i) => i.id === invoiceId);
      if (inv) {
        inv.status = 'PAID';
        inv.paidFcfa = inv.totalFcfa;
        inv.channel = paymentChannel;
      }
      return Promise.resolve(inv ?? { id: invoiceId, status: 'PAID' });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/platform-admin/invoices/${encodeURIComponent(invoiceId)}/mark-paid`,
      { method: 'POST', body: { paymentChannel }, token }
    );
  }

  listPlatformMomoSettlements(token?: string | null) {
    if (!this.springBootBaseUrl) return Promise.resolve([...this.previewMomoSettlements]);
    return this.requestBackendJson<Array<Record<string, unknown>>>('/platform-admin/momo-settlements', { token });
  }

  listPlatformLicenses(token?: string | null) {
    if (!this.springBootBaseUrl) return Promise.resolve([...this.previewLicenses]);
    return this.requestBackendJson<Array<Record<string, unknown>>>('/platform-admin/licenses', { token });
  }

  issuePlatformLicense(
    payload: { tenantId?: string; organizationName: string; tierName: string; maxStations: number; annualFeeFcfa: number; expiresAt: string },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const created = {
        id: `lic_${Date.now().toString(36)}`,
        licenseKey: `OPF-ENT-2026-${Math.floor(1000 + Math.random() * 9000)}-CMR`,
        ...payload,
        status: 'ACTIVE',
        issuedBy: 'superadmin@opesware.com',
        issuedAt: new Date().toISOString(),
      };
      this.previewLicenses.unshift(created);
      return Promise.resolve(created);
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform-admin/licenses', {
      method: 'POST',
      body: payload,
      token,
    });
  }

  revokePlatformLicense(licenseId: string, reason: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const lic = this.previewLicenses.find((l) => l.id === licenseId);
      if (lic) {
        lic.status = 'REVOKED';
        lic.revokedReason = reason;
        lic.revokedAt = new Date().toISOString();
      }
      this.previewPlatformAuditLogs.unshift({
        id: `paud_${Date.now().toString(36)}`,
        tenantId: 'PLATFORM',
        actorEmail: 'superadmin@opesware.com',
        actorRole: '[ROLE_PLATFORM_ADMIN]',
        action: 'ENTERPRISE_LICENSE_REVOKED',
        entityType: 'ENTERPRISE_LICENSE',
        entityId: licenseId,
        summary: `Revoked license ${lic?.licenseKey ?? licenseId}: ${reason}`,
        createdAt: new Date().toISOString(),
      });
      return Promise.resolve(lic ?? { id: licenseId, status: 'REVOKED' });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/platform-admin/licenses/${encodeURIComponent(licenseId)}/revoke`,
      { method: 'POST', body: { reason }, token }
    );
  }

  listPlatformBroadcasts(token?: string | null) {
    if (!this.springBootBaseUrl) return Promise.resolve([...this.previewBroadcasts]);
    return this.requestBackendJson<Array<Record<string, unknown>>>('/platform-admin/broadcasts', { token });
  }

  sendPlatformBroadcast(
    payload: { channel: string; audience: string; title: string; message: string },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const count = this.ensurePreviewPlatformTenants().filter((t) => payload.audience !== 'ALL_ACTIVE' || t.status === 'ACTIVE').length;
      const created = {
        id: `bc_${Date.now().toString(36)}`,
        ...payload,
        recipientCount: count,
        dispatchedCount: count,
        sentBy: 'superadmin@opesware.com',
        sentAt: new Date().toISOString(),
      };
      this.previewBroadcasts.unshift(created);
      return Promise.resolve(created);
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform-admin/broadcasts', {
      method: 'POST',
      body: payload,
      token,
    });
  }

  getPlatformHealthTelemetry(token?: string | null) {
    if (!this.springBootBaseUrl) {
      const tenants = this.ensurePreviewPlatformTenants();
      return Promise.resolve({
        status: 'HEALTHY',
        databaseStatus: 'UP',
        databaseLatencyMs: 6,
        flywaySchemaVersion: 'V24',
        flywayMigrationsApplied: 24,
        javaVersion: '25.0.5 LTS',
        heapUsedMb: 184,
        heapMaxMb: 1024,
        uptimeSeconds: 86420,
        edgeDevicesTotal: 7,
        edgeDevicesOnline: tenants.reduce((s, t) => s + t.edgeDevicesOnline, 0),
        webhooksTotal: 142,
        webhooksFailed: 0,
        webhookSuccessRatePct: 100.0,
        connectorsConfigured: 4,
        connectorsVerified: 3,
        momoPendingCount: 0,
        momoFailedCount: 0,
        checkedAt: new Date().toISOString(),
      });
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform-admin/health-telemetry', { token });
  }

  listPlatformAuditLogs(filters?: { tenantId?: string; action?: string }, token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve(
        this.previewPlatformAuditLogs.filter((l) => {
          if (filters?.tenantId && filters.tenantId !== 'ALL' && l.tenantId !== filters.tenantId) return false;
          if (filters?.action && !String(l.action ?? '').toUpperCase().includes(filters.action.toUpperCase())) return false;
          return true;
        })
      );
    }
    const qs = new URLSearchParams();
    if (filters?.tenantId && filters.tenantId !== 'ALL') qs.set('tenantId', filters.tenantId);
    if (filters?.action) qs.set('action', filters.action);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.requestBackendJson<Array<Record<string, unknown>>>(`/platform-admin/audit-logs${suffix}`, { token });
  }

  getPlatformGovernanceSettings(token?: string | null) {
    if (!this.springBootBaseUrl) return Promise.resolve({ ...this.previewGovernanceSettings });
    return this.requestBackendJson<Record<string, unknown>>('/platform-admin/governance/settings', { token });
  }

  updatePlatformGovernanceSettings(payload: Record<string, unknown>, token?: string | null) {
    if (!this.springBootBaseUrl) {
      this.previewGovernanceSettings = { ...this.previewGovernanceSettings, ...payload };
      return Promise.resolve({ ...this.previewGovernanceSettings });
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform-admin/governance/settings', {
      method: 'PUT',
      body: payload,
      token,
    });
  }

  listPlatformGovernancePlans(token?: string | null) {
    if (!this.springBootBaseUrl) return Promise.resolve([...this.previewGovernancePlans]);
    return this.requestBackendJson<Array<Record<string, unknown>>>('/platform-admin/governance/plans', { token });
  }

  upsertPlatformGovernancePlan(payload: Record<string, unknown>, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const code = String(payload.planCode ?? '').toLowerCase();
      const idx = this.previewGovernancePlans.findIndex((p) => String(p.plan_code).toLowerCase() === code);
      const next = {
        plan_code: code,
        plan_name: payload.planName,
        monthly_price_fcfa: payload.monthlyPriceFcfa,
        monthly_price_usd: payload.monthlyPriceUsd,
        max_stations: payload.maxStations,
        max_pumps: payload.maxPumps,
        trial_days: payload.trialDays,
        active: payload.active ?? true,
      };
      if (idx >= 0) this.previewGovernancePlans[idx] = next;
      else this.previewGovernancePlans.push(next);
      return Promise.resolve(payload);
    }
    return this.requestBackendJson<Record<string, unknown>>('/platform-admin/governance/plans', {
      method: 'PUT',
      body: payload,
      token,
    });
  }

  getPlatformTenantFeatures(tenantId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve({
        tenantId,
        aiCopilotEnabled: true,
        hardwareBridgeEnabled: true,
        ocppEvEnabled: true,
        b2bWholesaleEnabled: true,
        franchiseModeEnabled: tenantId === 'ten_atlantic_oil',
        whiteLabelBrandingEnabled: true,
        customMonthlyOverrideFcfa: null,
      });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/platform-admin/governance/tenants/${encodeURIComponent(tenantId)}/features`,
      { token }
    );
  }

  // --- Multi-Subsidiary Holding Consolidation (/api/v1/consolidation/*) ---
  private previewHoldingGroups: Array<Record<string, unknown>> = [
    {
      id: 'hgrp_default',
      name: 'OpesEnergy Central & West Africa Holding SA',
      reporting_currency: 'XAF',
      parent_tenant_id: 'ten_opes_cm',
      created_by: 'group.cfo@opesfuel.com',
      created_at: new Date(Date.now() - 86400_000 * 60).toISOString(),
    },
  ];

  private previewHoldingMembers: Array<{
    id: string;
    groupId: string;
    tenantId: string;
    entityName: string;
    countryLabel: string;
    functionalCurrency: 'XAF' | 'XOF' | 'USD';
    ownershipPct: number;
  }> = [
    { id: 'hmem_cm_01', groupId: 'hgrp_default', tenantId: 'ten_opes_cm', entityName: 'OpesFuel Cameroun SA', countryLabel: 'CM (CEMAC)', functionalCurrency: 'XAF', ownershipPct: 100 },
    { id: 'hmem_sn_01', groupId: 'hgrp_default', tenantId: 'ten_opes_sn', entityName: 'OpesFuel Senegal SA', countryLabel: 'SN (UEMOA)', functionalCurrency: 'XOF', ownershipPct: 80 },
    { id: 'hmem_lr_01', groupId: 'hgrp_default', tenantId: 'ten_opes_lr', entityName: 'OpesFuel Liberia Corp', countryLabel: 'LR (USD)', functionalCurrency: 'USD', ownershipPct: 100 },
  ];

  private previewSubsidiaryFinancials: Array<{
    groupId: string;
    tenantId: string;
    periodLabel: string;
    revenue: number;
    costOfSales: number;
    operatingExpenses: number;
    totalAssets: number;
    totalLiabilities: number;
    equity: number;
    receivablesIntercompany: number;
    payablesIntercompany: number;
  }> = [
    { groupId: 'hgrp_default', tenantId: 'ten_opes_cm', periodLabel: '2026-11', revenue: 185_000_000, costOfSales: 148_000_000, operatingExpenses: 16_500_000, totalAssets: 420_000_000, totalLiabilities: 155_000_000, equity: 265_000_000, receivablesIntercompany: 14_500_000, payablesIntercompany: 0 },
    { groupId: 'hgrp_default', tenantId: 'ten_opes_sn', periodLabel: '2026-11', revenue: 94_000_000, costOfSales: 74_200_000, operatingExpenses: 9_800_000, totalAssets: 210_000_000, totalLiabilities: 82_000_000, equity: 128_000_000, receivablesIntercompany: 0, payablesIntercompany: 14_500_000 },
    { groupId: 'hgrp_default', tenantId: 'ten_opes_lr', periodLabel: '2026-11', revenue: 112_000, costOfSales: 86_000, operatingExpenses: 12_000, totalAssets: 340_000, totalLiabilities: 110_000, equity: 230_000, receivablesIntercompany: 0, payablesIntercompany: 0 },
  ];

  private previewIntercompanyTx: Array<Record<string, unknown>> = [
    {
      id: 'ictx_seed_01',
      group_id: 'hgrp_default',
      period_label: '2026-11',
      seller_tenant_id: 'ten_opes_cm',
      buyer_tenant_id: 'ten_opes_sn',
      currency: 'XAF',
      amount: 14_500_000,
      description: 'Bulk Gasoil Coastal Transfer (Douala Depot -> Dakar Terminal)',
      eliminated: false,
      created_by: 'group.cfo@opesfuel.com',
      created_at: new Date(Date.now() - 86400_000 * 3).toISOString(),
    },
  ];

  private previewEliminationEntries: Array<Record<string, unknown>> = [];

  private convertHoldingCcy(amount: number, from: string, to: string, fx: number): number {
    const f = from.toUpperCase() === 'FCFA' ? 'XAF' : from.toUpperCase();
    const t = to.toUpperCase() === 'FCFA' ? 'XAF' : to.toUpperCase();
    if (f === t) return amount;
    const inXaf = f === 'USD' ? amount * fx : amount;
    return t === 'USD' ? inXaf / fx : inXaf;
  }

  listHoldingGroups(token?: string | null) {
    if (!this.springBootBaseUrl) return Promise.resolve([...this.previewHoldingGroups]);
    return this.requestBackendJson<Array<Record<string, unknown>>>('/consolidation/groups', { token });
  }

  createHoldingGroup(payload: { name: string; reportingCurrency: string }, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const created = {
        id: `hgrp_${Date.now().toString(36)}`,
        name: payload.name,
        reporting_currency: payload.reportingCurrency,
        parent_tenant_id: this.state.tenant.tenantId,
        created_by: 'group.cfo@opesfuel.com',
        created_at: new Date().toISOString(),
      };
      this.previewHoldingGroups.unshift(created);
      return Promise.resolve(created);
    }
    return this.requestBackendJson<Record<string, unknown>>('/consolidation/groups', {
      method: 'POST',
      body: payload,
      token,
    });
  }

  updateHoldingGroup(groupId: string, payload: { name?: string; reportingCurrency?: string }, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const g = this.previewHoldingGroups.find((item) => item.id === groupId);
      if (g) {
        if (payload.name) g.name = payload.name;
        if (payload.reportingCurrency) g.reporting_currency = payload.reportingCurrency;
      }
      return Promise.resolve(g ?? { id: groupId, ...payload });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/consolidation/groups/${encodeURIComponent(groupId)}`,
      { method: 'PATCH', body: payload, token }
    );
  }

  addHoldingSubsidiary(
    groupId: string,
    payload: { tenantId: string; entityName: string; countryLabel: string; functionalCurrency: 'XAF' | 'XOF' | 'USD'; ownershipPct: number },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const member = {
        id: `hmem_${Date.now().toString(36)}`,
        groupId,
        tenantId: payload.tenantId,
        entityName: payload.entityName,
        countryLabel: payload.countryLabel,
        functionalCurrency: payload.functionalCurrency,
        ownershipPct: payload.ownershipPct,
      };
      this.previewHoldingMembers.push(member);
      return Promise.resolve(member);
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/consolidation/groups/${encodeURIComponent(groupId)}/members`,
      { method: 'POST', body: payload, token }
    );
  }

  removeHoldingSubsidiary(groupId: string, memberId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      this.previewHoldingMembers = this.previewHoldingMembers.filter(
        (m) => !(m.groupId === groupId && (m.id === memberId || m.tenantId === memberId))
      );
      return Promise.resolve({ groupId, removed: memberId, deleted: true });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/consolidation/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`,
      { method: 'DELETE', token }
    );
  }

  submitSubsidiaryFinancials(
    groupId: string,
    payload: {
      tenantId: string;
      periodLabel: string;
      revenue: number;
      costOfSales: number;
      operatingExpenses: number;
      totalAssets: number;
      totalLiabilities: number;
      equity: number;
      receivablesIntercompany: number;
      payablesIntercompany: number;
    },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const idx = this.previewSubsidiaryFinancials.findIndex(
        (f) => f.groupId === groupId && f.tenantId === payload.tenantId && f.periodLabel === payload.periodLabel
      );
      const record = { groupId, ...payload };
      if (idx >= 0) this.previewSubsidiaryFinancials[idx] = record;
      else this.previewSubsidiaryFinancials.push(record);
      return Promise.resolve(record);
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/consolidation/groups/${encodeURIComponent(groupId)}/financials`,
      { method: 'POST', body: payload, token }
    );
  }

  recordHoldingIntercompany(
    groupId: string,
    payload: { periodLabel: string; sellerTenantId: string; buyerTenantId: string; currency: string; amount: number; description: string },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const tx = {
        id: `ictx_${Date.now().toString(36)}`,
        group_id: groupId,
        period_label: payload.periodLabel,
        seller_tenant_id: payload.sellerTenantId,
        buyer_tenant_id: payload.buyerTenantId,
        currency: payload.currency,
        amount: payload.amount,
        description: payload.description,
        eliminated: false,
        created_by: 'group.cfo@opesfuel.com',
        created_at: new Date().toISOString(),
      };
      this.previewIntercompanyTx.unshift(tx);
      return Promise.resolve(tx);
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/consolidation/groups/${encodeURIComponent(groupId)}/intercompany`,
      { method: 'POST', body: payload, token }
    );
  }

  runHoldingEliminations(groupId: string, period: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const g = this.previewHoldingGroups.find((x) => x.id === groupId) ?? this.previewHoldingGroups[0];
      const reportingCcy = String(g?.reporting_currency ?? 'XAF');
      const fx = Number(this.previewGovernanceSettings.xafPerUsdRate ?? 605);
      const pending = this.previewIntercompanyTx.filter(
        (t) => t.group_id === groupId && t.period_label === period && !t.eliminated
      );
      let totalElim = 0;
      for (const tx of pending) {
        const amtRep = this.convertHoldingCcy(Number(tx.amount ?? 0), String(tx.currency ?? 'XAF'), reportingCcy, fx);
        this.previewEliminationEntries.unshift({
          id: `elim_${Date.now().toString(36)}_${Math.floor(Math.random() * 999)}`,
          group_id: groupId,
          period_label: period,
          intercompany_tx_id: tx.id,
          debit_account: '701_INTERCO_REVENUE',
          credit_account: '601_INTERCO_COGS',
          amount_reporting: Math.round(amtRep * 100) / 100,
          created_at: new Date().toISOString(),
        });
        tx.eliminated = true;
        totalElim += amtRep;
      }
      return Promise.resolve({
        groupId,
        period,
        reportingCurrency: reportingCcy,
        fxXafPerUsd: fx,
        eliminatedTransactions: pending.length,
        totalEliminatedReporting: Math.round(totalElim * 100) / 100,
      });
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/consolidation/groups/${encodeURIComponent(groupId)}/eliminate?period=${encodeURIComponent(period)}`,
      { method: 'POST', token }
    );
  }

  getHoldingConsolidatedReport(
    groupId: string,
    period: string,
    reportingCurrency?: string,
    fxOverride?: number,
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const g = this.previewHoldingGroups.find((x) => x.id === groupId) ?? this.previewHoldingGroups[0];
      const baseCcy = String(g?.reporting_currency ?? 'XAF');
      const repCcy = reportingCurrency || baseCcy;
      const fx = fxOverride && fxOverride > 0 ? fxOverride : Number(this.previewGovernanceSettings.xafPerUsdRate ?? 605);
      const members = this.previewHoldingMembers.filter((m) => m.groupId === groupId);
      const elims = this.previewEliminationEntries.filter((e) => e.group_id === groupId && e.period_label === period);
      const txs = this.previewIntercompanyTx.filter((t) => t.group_id === groupId && t.period_label === period);
      const totalElimPnl = elims.reduce(
        (s, e) => s + this.convertHoldingCcy(Number(e.amount_reporting ?? 0), baseCcy, repCcy, fx),
        0
      );
      const pendingTxs = txs.filter((t) => !t.eliminated);
      const pendingReporting = pendingTxs.reduce(
        (s, t) => s + this.convertHoldingCcy(Number(t.amount ?? 0), String(t.currency ?? 'XAF'), repCcy, fx),
        0
      );

      let sumRev = 0, sumCogs = 0, sumOpex = 0, sumAssets = 0, sumLiab = 0, sumEq = 0, sumIcRec = 0, sumIcPay = 0;
      let ctrlNi = 0, minNi = 0, ctrlEq = 0, minEq = 0;

      const subsidiaries = members.map((m) => {
        const fin =
          this.previewSubsidiaryFinancials.find((f) => f.groupId === groupId && f.tenantId === m.tenantId && f.periodLabel === period) ??
          this.previewSubsidiaryFinancials.find((f) => f.groupId === groupId && f.tenantId === m.tenantId);
        const revF = fin?.revenue ?? 0;
        const cogsF = fin?.costOfSales ?? 0;
        const opexF = fin?.operatingExpenses ?? 0;
        const assetsF = fin?.totalAssets ?? 0;
        const liabF = fin?.totalLiabilities ?? 0;
        const eqF = fin?.equity ?? 0;
        const icRecF = fin?.receivablesIntercompany ?? 0;
        const icPayF = fin?.payablesIntercompany ?? 0;

        const rev = this.convertHoldingCcy(revF, m.functionalCurrency, repCcy, fx);
        const cogs = this.convertHoldingCcy(cogsF, m.functionalCurrency, repCcy, fx);
        const opex = this.convertHoldingCcy(opexF, m.functionalCurrency, repCcy, fx);
        const assets = this.convertHoldingCcy(assetsF, m.functionalCurrency, repCcy, fx);
        const liab = this.convertHoldingCcy(liabF, m.functionalCurrency, repCcy, fx);
        const eq = this.convertHoldingCcy(eqF, m.functionalCurrency, repCcy, fx);
        const icRec = this.convertHoldingCcy(icRecF, m.functionalCurrency, repCcy, fx);
        const icPay = this.convertHoldingCcy(icPayF, m.functionalCurrency, repCcy, fx);
        const ni = rev - cogs - opex;
        const nciPct = Math.max(0, 100 - m.ownershipPct);

        sumRev += rev; sumCogs += cogs; sumOpex += opex; sumAssets += assets; sumLiab += liab; sumEq += eq; sumIcRec += icRec; sumIcPay += icPay;
        ctrlNi += ni * (m.ownershipPct / 100);
        minNi += ni * (nciPct / 100);
        ctrlEq += eq * (m.ownershipPct / 100);
        minEq += eq * (nciPct / 100);

        return {
          memberId: m.id,
          tenantId: m.tenantId,
          entityName: m.entityName,
          countryLabel: m.countryLabel,
          functionalCurrency: m.functionalCurrency,
          ownershipPct: m.ownershipPct,
          minorityInterestPct: nciPct,
          revenueFunctional: revF,
          cogsFunctional: cogsF,
          opexFunctional: opexF,
          assetsFunctional: assetsF,
          liabilitiesFunctional: liabF,
          equityFunctional: eqF,
          intercoReceivablesFunctional: icRecF,
          intercoPayablesFunctional: icPayF,
          revenueReporting: Math.round(rev * 100) / 100,
          cogsReporting: Math.round(cogs * 100) / 100,
          opexReporting: Math.round(opex * 100) / 100,
          netIncomeReporting: Math.round(ni * 100) / 100,
          assetsReporting: Math.round(assets * 100) / 100,
          liabilitiesReporting: Math.round(liab * 100) / 100,
          equityReporting: Math.round(eq * 100) / 100,
          grossMarginPct: rev > 0 ? Math.round(((rev - cogs) / rev) * 1000) / 10 : 0,
          netMarginPct: rev > 0 ? Math.round((ni / rev) * 1000) / 10 : 0,
          debtToEquityRatio: eq > 0 ? Math.round((liab / eq) * 100) / 100 : 0,
          roaPct: assets > 0 ? Math.round((ni / assets) * 1000) / 10 : 0,
        };
      });

      const intercoBsElim = Math.min(sumIcRec, sumIcPay);
      const consolidatedRev = Math.max(0, sumRev - totalElimPnl);
      const consolidatedCogs = Math.max(0, sumCogs - totalElimPnl);
      const consolidatedNi = consolidatedRev - consolidatedCogs - sumOpex;

      return Promise.resolve({
        groupId,
        groupName: g?.name ?? 'Holding Group',
        period,
        reportingCurrency: repCcy,
        fxXafPerUsd: fx,
        fxNote: 'XAF and XOF are pegged 1:1 (CFA parity); USD converted via platform FX rate.',
        pendingIntercompanyCount: pendingTxs.length,
        pendingIntercompanyReporting: Math.round(pendingReporting * 100) / 100,
        consolidatedPnl: {
          grossRevenue: Math.round(sumRev * 100) / 100,
          intercompanyRevenueElimination: Math.round(totalElimPnl * 100) / 100,
          consolidatedRevenue: Math.round(consolidatedRev * 100) / 100,
          consolidatedCogs: Math.round(consolidatedCogs * 100) / 100,
          grossProfit: Math.round((consolidatedRev - consolidatedCogs) * 100) / 100,
          operatingExpenses: Math.round(sumOpex * 100) / 100,
          consolidatedNetIncome: Math.round(consolidatedNi * 100) / 100,
          controllingShareNetIncome: Math.round(ctrlNi * 100) / 100,
          minorityInterestNetIncome: Math.round(minNi * 100) / 100,
        },
        consolidatedBalanceSheet: {
          grossAssets: Math.round(sumAssets * 100) / 100,
          intercompanyBalanceElimination: Math.round(intercoBsElim * 100) / 100,
          consolidatedAssets: Math.round((sumAssets - intercoBsElim) * 100) / 100,
          consolidatedLiabilities: Math.round((sumLiab - intercoBsElim) * 100) / 100,
          totalEquity: Math.round(sumEq * 100) / 100,
          controllingEquity: Math.round(ctrlEq * 100) / 100,
          minorityInterestEquity: Math.round(minEq * 100) / 100,
        },
        subsidiaries,
        intercompanyTransactions: txs,
        eliminations: elims,
        generatedAt: new Date().toISOString(),
      });
    }
    const qs = new URLSearchParams({ period });
    if (reportingCurrency) qs.set('reportingCurrency', reportingCurrency);
    if (fxOverride && fxOverride > 0) qs.set('fxXafPerUsdOverride', String(fxOverride));
    return this.requestBackendJson<Record<string, unknown>>(
      `/consolidation/groups/${encodeURIComponent(groupId)}/report?${qs.toString()}`,
      { token }
    );
  }

  // --- Tenant Support Helpdesk & Authenticated Billing/MoMo Helpers ---

  listMyTenantSupportTickets(token?: string | null) {
    if (!this.springBootBaseUrl) {
      const tid = this.state.tenant.tenantId;
      return Promise.resolve(this.previewPlatformTickets.filter((t) => String(t.tenantId) === tid));
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>('/support/tickets', { token });
  }

  submitMyTenantSupportTicket(
    payload: { stationId?: string; requesterEmail?: string; subject: string; description: string; category: string; priority: string },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      return this.createPlatformSupportTicket({
        tenantId: this.state.tenant.tenantId,
        tenantName: this.state.tenant.organizationName,
        requesterEmail: payload.requesterEmail || this.state.tenant.ownerEmail,
        subject: payload.subject,
        description: payload.description,
        category: payload.category,
        priority: payload.priority,
      });
    }
    return this.requestBackendJson<Record<string, unknown>>('/support/tickets', {
      method: 'POST',
      body: payload,
      token,
    });
  }

  listMyTenantTicketMessages(ticketId: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      return Promise.resolve(
        (this.previewTicketMessages[ticketId] ?? []).filter((m) => !Boolean(m.internalNote))
      );
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>(
      `/support/tickets/${encodeURIComponent(ticketId)}/messages`,
      { token }
    );
  }

  postMyTenantTicketReply(ticketId: string, body: string, token?: string | null) {
    if (!this.springBootBaseUrl) {
      const msg = {
        id: `tmsg_${Date.now().toString(36)}`,
        ticketId,
        senderEmail: this.state.tenant.ownerEmail,
        senderRole: 'OWNER',
        internalNote: false,
        body,
        createdAt: new Date().toISOString(),
      };
      this.previewTicketMessages[ticketId] = [...(this.previewTicketMessages[ticketId] ?? []), msg];
      const t = this.previewPlatformTickets.find((item) => item.id === ticketId);
      if (t) {
        t.messageCount = Number(t.messageCount ?? 0) + 1;
        t.updatedAt = msg.createdAt;
      }
      return Promise.resolve(msg);
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/support/tickets/${encodeURIComponent(ticketId)}/messages`,
      { method: 'POST', body: { body }, token }
    );
  }

  listTenantMomoTransactions(token?: string | null) {
    if (!this.springBootBaseUrl) {
      const tid = this.state.tenant.tenantId;
      return Promise.resolve(this.previewMomoSettlements.filter((m) => String(m.tenantId) === tid));
    }
    return this.requestBackendJson<Array<Record<string, unknown>>>('/payments/momo', { token });
  }

  initiateBillingInvoiceCheckout(
    invoiceId: string,
    payload: { provider: string; payerPhone: string; amountFcfa: number },
    token?: string | null
  ) {
    if (!this.springBootBaseUrl) {
      const mappedChannel =
        payload.provider === 'MTN_MOMO'
          ? 'MTN_MOMO'
          : payload.provider === 'STRIPE' || payload.provider === 'CINETPAY'
          ? 'CARD'
          : 'ORANGE_MONEY';
      const ref = `${payload.provider}-${Date.now().toString().slice(-6)}`;
      return this.payBillingInvoice(invoiceId, {
        amountFcfa: payload.amountFcfa,
        paymentChannel: mappedChannel,
        providerReference: ref,
      }).then(() => ({ checkoutReference: ref, status: 'SETTLED' }));
    }
    return this.requestBackendJson<Record<string, unknown>>(
      `/billing/invoices/${encodeURIComponent(invoiceId)}/checkout`,
      { method: 'POST', body: payload, token }
    );
  }
}





