export type UserRole = 'PLATFORM_ADMIN' | 'GROUP_CFO' | 'OWNER' | 'MANAGER' | 'ATTENDANT' | 'ACCOUNTANT';

export type FuelGrade = 'SUPER' | 'GASOIL' | 'KEROSENE' | 'LPG_BULK' | 'HEAVY_FUEL';

export type PublicPage =
  | 'home'
  | 'platform'
  | 'solutions'
  | 'integrations'
  | 'pricing'
  | 'licensing'
  | 'mobile'
  | 'docs'
  | 'faq'
  | 'api'
  | 'security'
  | 'customers'
  | 'about'
  | 'resources'
  | 'status'
  | 'contact'
  | 'legal';

export type ConsoleSection =
  | 'overview'
  | 'forecourt'
  | 'inventory'
  | 'fleet'
  | 'workforce'
  | 'accounting'
  | 'hse-fraud'
  | 'enterprise-ops'
  | 'ai-assistant'
  | 'mobile-app'
  | 'api-platform'
  | 'admin'
  | 'platform-admin';

export interface InstitutionalFuelTemplate {
  code: FuelGrade;
  label: string;
  tankName: string;
  category: 'LIQUID_FUEL' | 'GASEOUS_FUEL' | 'INDUSTRIAL_FUEL';
  unitLabel: string;
  defaultCapacityLitres: number;
  defaultOpeningLitres: number;
  defaultUnitCostFcfa: number;
  defaultSellingPriceFcfa: number;
  defaultNozzleCount: number;
  description: string;
}

export interface InstitutionalSetupSelection {
  grade: FuelGrade;
  tankName: string;
  capacityLitres: number;
  openingLitres: number;
  unitCostFcfa: number;
  sellingPriceFcfa: number;
  nozzleCount: number;
}

export interface AiSubscriptionState {
  active: boolean;
  planCode: 'AI_COPILOT_ADDON' | 'INCLUDED_ENTERPRISE';
  monthlyFeeFcfa: number;
  activatedAt: string | null;
}

export interface AiAnalysisReport {
  executiveSummary: string;
  healthScore: number;
  revenueForecast30dFcfa: number;
  stockoutPredictions: Array<{
    tankId: string;
    tankName: string;
    grade: string;
    daysRemaining: number;
    recommendedOrderLitres: number;
    urgency: string;
  }>;
  marginSuggestions: Array<{
    title: string;
    impactFcfa: string;
    recommendation: string;
  }>;
  anomalyAlerts: Array<{
    severity: string;
    module: string;
    detail: string;
  }>;
  prioritizedActions: Array<{
    action: string;
    targetSection: string;
    rationale: string;
  }>;
  generatedAt: string;
}

export interface Station {
  id: string;
  code: string;
  name: string;
  city: string;
  currency: 'FCFA';
  planName: string;
  monthlyFeeFcfa: number;
  prices: Record<FuelGrade, number>;
}

export interface FuelTank {
  id: string;
  stationId: string;
  name: string;
  grade: FuelGrade;
  capacityLitres: number;
  bookVolumeLitres: number;
  lastDipLitres: number;
  varianceLitres: number;
  unitCostFcfa: number;
  status: 'NOMINAL' | 'LOW_STOCK' | 'VARIANCE_ALERT';
}

export interface Pump {
  id: string;
  stationId: string;
  tankId: string;
  code: string;
  grade: FuelGrade;
  totalizerLitres: number;
  unitPriceFcfa: number;
  status: 'IDLE' | 'ACTIVE_SHIFT' | 'MAINTENANCE';
}

export interface ShiftRecord {
  id: string;
  stationId: string;
  pumpId: string;
  pumpCode: string;
  grade: FuelGrade;
  attendantId: string;
  attendantName: string;
  openingMeterLitres: number;
  closingMeterLitres: number | null;
  litresSold: number;
  unitPriceFcfa: number;
  expectedRevenueFcfa: number;
  cashFcfa: number;
  mobileMoneyFcfa: number;
  cardFcfa: number;
  fleetCreditFcfa: number;
  varianceFcfa: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
}

export interface FleetAccount {
  id: string;
  companyName: string;
  taxId: string;
  creditLimitFcfa: number;
  balanceOwedFcfa: number;
  status: 'ACTIVE' | 'HOLD';
}

export interface FleetTransaction {
  id: string;
  accountId: string;
  companyName: string;
  stationId: string;
  vehiclePlate: string;
  driverName: string;
  grade: FuelGrade;
  litres: number;
  amountFcfa: number;
  createdAt: string;
}

export interface ShopItem {
  id: string;
  stationId: string;
  sku: string;
  name: string;
  category: 'LUBRICANT' | 'LPG' | 'SHOP';
  stockQty: number;
  reorderLevel: number;
  unitPriceFcfa: number;
  unitCostFcfa: number;
}

export interface PurchaseOrder {
  id: string;
  stationId: string;
  supplierName: string;
  grade: FuelGrade;
  orderedLitres: number;
  unitCostFcfa: number;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  createdAt: string;
}

export interface TankDeliveryRecord {
  id: string;
  tankId: string;
  tankName: string;
  supplierName: string;
  bolLitres: number;
  actualReceivedLitres: number;
  unitCostFcfa: number;
  totalInvoiceFcfa: number;
  receivedAt: string;
}

export interface DipstickReadingRecord {
  id: string;
  tankId: string;
  tankName: string;
  bookLitres: number;
  measuredLitres: number;
  varianceLitres: number;
  recordedAt: string;
}

export interface Employee {
  id: string;
  stationId: string;
  fullName: string;
  role: UserRole;
  phone: string;
  shiftWindow: string;
  clockedIn: boolean;
  baseSalaryFcfa: number;
  cumulativeVarianceFcfa: number;
}

export interface AccountDefinition {
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debitFcfa: number;
  creditFcfa: number;
}

export interface JournalEntry {
  id: string;
  stationId: string;
  reference: string;
  sourceEvent: string;
  description: string;
  postedAt: string;
  lines: JournalLine[];
}

export interface StationExpense {
  id: string;
  stationId: string;
  category: 'UTILITIES' | 'MAINTENANCE' | 'GENERATOR_FUEL' | 'SECURITY' | 'SUPPLIES';
  description: string;
  amountFcfa: number;
  paymentSource: 'CASH_SAFE' | 'BANK';
  status: 'POSTED';
  createdAt: string;
}

export interface TreasuryDeposit {
  id: string;
  stationId: string;
  sourceAccount: 'CASH_ON_HAND' | 'MOBILE_MONEY_CLEARING';
  bankName: string;
  slipReference: string;
  amountFcfa: number;
  depositedAt: string;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: AccountDefinition['accountType'];
  debitTotalFcfa: number;
  creditTotalFcfa: number;
  netBalanceFcfa: number;
}

export interface FinancialReportBundle {
  currency: 'FCFA';
  totalRevenueFcfa: number;
  nonFuelRevenueFcfa: number;
  cogsFcfa: number;
  grossProfitFcfa: number;
  operatingExpensesFcfa: number;
  cashVarianceFcfa: number;
  netIncomeFcfa: number;
  vatPayableFcfa: number;
  cashOnHandFcfa: number;
  mobileMoneyClearingFcfa: number;
  bankBalanceFcfa: number;
  fleetReceivablesFcfa: number;
  inventoryAssetFcfa: number;
  accountsPayableFcfa: number;
  trialBalanceBalanced: boolean;
  trialBalance: TrialBalanceRow[];
}

export interface DomainEventLog {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  stationId: string;
  summary: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface ApiKeyRecord {
  id: string;
  label: string;
  maskedKey: string;
  scopes: string[];
  createdAt: string;
}

export interface WebhookSubscription {
  id: string;
  targetUrl: string;
  subscribedEvents: string[];
  active: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  audience: string;
  monthlyPriceFcfa: number;
  pumpLimit: string;
  apiQuotaPerMonth: string;
  features: string[];
  recommended?: boolean;
}

export interface TenantWorkspace {
  tenantId: string;
  organizationName: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  isSampleData: boolean;
  aiSubscription: AiSubscriptionState;
  onboardingCompletedSteps: string[];
}
