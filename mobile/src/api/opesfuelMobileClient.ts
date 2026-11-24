import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const QUEUE_KEY = 'opesfuel_offline_command_queue_v1';
const FAILED_KEY = 'opesfuel_offline_failed_v1';
const CACHE_PREFIX = 'opesfuel_cache_v1:';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export type MobileRole = 'OWNER' | 'MANAGER' | 'ATTENDANT' | 'ACCOUNTANT';
export type MobileFuelGrade = 'SUPER' | 'GASOIL' | 'KEROSENE' | 'LPG_BULK' | 'HEAVY_FUEL';

// ---- Shapes returned by the backend (see backend controllers) ----
export interface PumpDto { id: string; stationId: string; tankId: string; code: string; grade: MobileFuelGrade; totalizerLitres: number; unitPriceFcfa: number; status: 'IDLE' | 'ACTIVE_SHIFT' | string }
export interface ShiftDto { id: string; stationId: string; pumpId: string; pumpCode: string; grade: string; attendantId: string; attendantName: string; openingMeterLitres: number; closingMeterLitres: number | null; litresSold: number | null; unitPriceFcfa: number; expectedRevenueFcfa: number; cashFcfa: number; mobileMoneyFcfa: number; cardFcfa: number; fleetCreditFcfa: number; varianceFcfa: number; status: 'OPEN' | 'CLOSED' | string; openedAt: string; closedAt: string | null }
export interface TankDto { id: string; stationId: string; name: string; grade: MobileFuelGrade; capacityLitres: number; bookVolumeLitres: number; lastDipLitres: number; varianceLitres: number; unitCostFcfa: number; status: string }
export interface FleetAccountDto { id: string; companyName: string; creditLimitFcfa: number; balanceOwedFcfa: number; status: string }
export interface ShopItemDto { id: string; stationId: string; sku: string; name: string; category: string; stockQty: number; reorderLevel: number; unitPriceFcfa: number }
export interface EmployeeDto { id: string; stationId: string; fullName: string; role: string; clockedIn: boolean; shiftWindow?: string }
export interface StationDto { id: string; name: string; city?: string }
export interface FinancialReportDto { currency: string; totalRevenueFcfa: number; cogsFcfa: number; grossProfitFcfa: number; operatingExpensesFcfa: number; netIncomeFcfa: number; vatPayableFcfa: number; trialBalanceBalanced: boolean }

export interface MobileInstitutionalFuelTemplate {
  code: MobileFuelGrade;
  label: string;
  tankName: string;
  category: string;
  unitLabel: string;
  defaultCapacityLitres: number;
  defaultOpeningLitres: number;
  defaultUnitCostFcfa: number;
  defaultSellingPriceFcfa: number;
  defaultNozzleCount: number;
  description: string;
}

export interface MobileInstitutionalSelection {
  grade: MobileFuelGrade;
  tankName: string;
  capacityLitres: number;
  openingLitres: number;
  unitCostFcfa: number;
  sellingPriceFcfa: number;
  nozzleCount: number;
}

export interface MobileTankDto {
  id: string;
  name: string;
  grade: MobileFuelGrade;
  capacityLitres: number;
  bookVolumeLitres: number;
  lastDipLitres: number;
  status: string;
}

export interface MobileAiSubscription {
  stationId: string;
  active: boolean;
  planCode: 'AI_COPILOT_ADDON' | 'INCLUDED_ENTERPRISE';
  monthlyFeeFcfa: number;
  activatedAt: string | null;
}

export interface QueuedCommand {
  idempotencyKey: string;
  path: string;
  method: 'POST';
  body: Record<string, unknown>;
  createdAt: string;
  label: string;
}

export interface FailedCommand extends QueuedCommand {
  reason: string;
  failedAt: string;
}

export type MobileSyncConnectionState = 'LIVE_CONNECTED' | 'OFFLINE_QUEUED' | 'CHECKING';

export interface MobileSyncHealth {
  state: MobileSyncConnectionState;
  connected: boolean;
  latencyMs: number | null;
  pendingQueueCount: number;
  lastSyncedAt: string | null;
  endpoint: string;
}

export const DEFAULT_INSTITUTIONAL_FUELS: MobileInstitutionalFuelTemplate[] = [
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
    description: 'High-octane unleaded petrol for passenger cars & urban fleets.',
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
    description: 'Commercial diesel for logistics trucks, buses, and heavy transport.',
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
    description: 'Household kerosene reserve and domestic lighting supply.',
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
    description: 'Bulk industrial generator fuel oil and depot power reserves.',
  },
];


/** Server answered with an error (4xx/5xx). Carries the human-readable reason from the backend. */
export class ApiError extends Error {
  constructor(public status: number, public detail: string) { super(`API ${status}: ${detail}`); }
}
/** The phone could not reach the server (no signal, timeout). Only these errors are queued for later. */
export class NetworkError extends Error {}

export type SubmitResult<T = unknown> = { status: 'SYNCED'; idempotencyKey: string; data: T } | { status: 'QUEUED'; idempotencyKey: string };

const TIMEOUT_MS = 15000;

function problemDetail(text: string): string {
  try {
    const j = JSON.parse(text);
    return String(j.detail ?? j.message ?? j.title ?? text).slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

export class OpesFuelMobileClient {
  private accessToken: string | null = null;
  private lastSyncedAt: string | null = null;
  private onUnauthorized: (() => void) | null = null;
  baseUrl = API_BASE_URL;

  setAccessToken(token: string | null) { this.accessToken = token; }
  setUnauthorizedHandler(fn: (() => void) | null) { this.onUnauthorized = fn; }
  getLastSyncedAt() { return this.lastSyncedAt; }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, { ...options, headers, signal: controller.signal });
    } catch {
      throw new NetworkError('network');
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401) { this.onUnauthorized?.(); }
    if (!res.ok) throw new ApiError(res.status, problemDetail(await res.text()));
    this.lastSyncedAt = new Date().toISOString();
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  // ---------- connectivity ----------
  async checkConnectivity(): Promise<MobileSyncHealth> {
    const queue = await this.getOfflineQueue();
    const base = { pendingQueueCount: queue.length, lastSyncedAt: this.lastSyncedAt, endpoint: this.baseUrl };
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(`${this.baseUrl}/catalog/institutional-fuels`, { method: 'GET', signal: controller.signal });
      if (res.ok) {
        this.lastSyncedAt = new Date().toISOString();
        return { ...base, lastSyncedAt: this.lastSyncedAt, state: queue.length > 0 ? 'OFFLINE_QUEUED' : 'LIVE_CONNECTED', connected: true, latencyMs: Math.max(1, Date.now() - startedAt) };
      }
    } catch { /* offline */ } finally { clearTimeout(timer); }
    return { ...base, state: 'OFFLINE_QUEUED', connected: false, latencyMs: null };
  }

  // ---------- reads (all return fresh data; callers cache) ----------
  getMyProfile() { return this.request<EmployeeDto>('/workforce/me'); }
  getStations() { return this.request<StationDto[]>('/stations'); }
  getPumps(stationId: string) { return this.request<PumpDto[]>(`/forecourt/pumps?stationId=${encodeURIComponent(stationId)}`); }
  getShifts(stationId: string, limit = 100) { return this.request<ShiftDto[]>(`/forecourt/shifts?stationId=${encodeURIComponent(stationId)}&limit=${limit}`); }
  getTanks(stationId: string) { return this.request<TankDto[]>(`/inventory/tanks?stationId=${encodeURIComponent(stationId)}`); }
  getEmployees(stationId: string) { return this.request<EmployeeDto[]>(`/workforce/employees?stationId=${encodeURIComponent(stationId)}`); }
  getFleetAccounts() { return this.request<FleetAccountDto[]>('/fleet/accounts'); }
  getShopItems(stationId: string) { return this.request<ShopItemDto[]>(`/shop/items?stationId=${encodeURIComponent(stationId)}`); }
  getFinancialReport(stationId: string) { return this.request<FinancialReportDto>(`/accounting/reports?stationId=${encodeURIComponent(stationId)}`); }

  async fetchInstitutionalFuels(): Promise<MobileInstitutionalFuelTemplate[]> {
    try {
      const remote = await this.request<MobileInstitutionalFuelTemplate[]>('/catalog/institutional-fuels');
      return Array.isArray(remote) && remote.length > 0 ? remote : DEFAULT_INSTITUTIONAL_FUELS;
    } catch {
      return DEFAULT_INSTITUTIONAL_FUELS;
    }
  }

  askAiAdvisor(stationId: string, question: string, metricsSnapshot: Record<string, unknown>) {
    return this.request<{ stationId: string; answer: string; answeredAt: string }>('/ai/chat', { method: 'POST', body: JSON.stringify({ stationId, question, metricsSnapshot }) });
  }

  // ---------- writes (queued only when the phone is offline) ----------
  openShift(stationId: string, pumpId: string, attendantId: string, label: string) {
    return this.submit<ShiftDto>(label, '/forecourt/shifts/open', { stationId, pumpId, attendantId });
  }
  closeShift(shiftId: string, body: { closingMeterLitres: number; cashFcfa: number; mobileMoneyFcfa: number; cardFcfa: number; fleetCreditFcfa: number; varianceReason?: string }, label: string) {
    return this.submit<ShiftDto>(label, `/forecourt/shifts/${encodeURIComponent(shiftId)}/close`, body);
  }
  recordDipstick(tankId: string, measuredLitres: number, label: string) {
    return this.submit<TankDto>(label, '/inventory/dipsticks', { tankId, measuredLitres });
  }
  recordFleetVoucher(body: { accountId: string; stationId: string; vehiclePlate: string; driverName: string; grade: string; litres: number }, label: string) {
    return this.submit(label, '/fleet/vouchers', body);
  }
  recordShopSale(itemId: string, quantity: number, paymentMethod: string, label: string) {
    return this.submit(label, '/shop/sales', { itemId, quantity, paymentMethod });
  }
  toggleAttendance(employeeId: string, label: string) {
    return this.submit<EmployeeDto>(label, `/workforce/employees/${encodeURIComponent(employeeId)}/attendance`, {});
  }
  applyInstitutionalSetup(stationId: string, items: MobileInstitutionalSelection[], lubricantsPack: { includeLubricants: boolean; oilBottlesQty: number; lpgCylindersQty: number }) {
    return this.submit(`Fuel setup (${items.length})`, `/stations/${encodeURIComponent(stationId)}/onboarding-setup`, { items, lubricantsPack });
  }

  /**
   * Sends now. Network failure -> saved on the phone and retried later (same Idempotency-Key, so no double posting).
   * A server rejection (validation, permission, business rule) is NOT queued: it throws ApiError so the user sees why.
   */
  async submit<T = unknown>(label: string, path: string, body: Record<string, unknown>): Promise<SubmitResult<T>> {
    const idempotencyKey = randomId();
    try {
      const data = await this.request<T>(path, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(body) });
      return { status: 'SYNCED', idempotencyKey, data };
    } catch (e) {
      if (!(e instanceof NetworkError)) throw e;
      const queue = await this.getOfflineQueue();
      queue.push({ idempotencyKey, path, method: 'POST', body, createdAt: new Date().toISOString(), label });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      return { status: 'QUEUED', idempotencyKey };
    }
  }

  async getOfflineQueue(): Promise<QueuedCommand[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedCommand[]) : [];
  }

  async getFailedQueue(): Promise<FailedCommand[]> {
    const raw = await AsyncStorage.getItem(FAILED_KEY);
    return raw ? (JSON.parse(raw) as FailedCommand[]) : [];
  }

  async discardFailed(idempotencyKey: string): Promise<void> {
    const list = (await this.getFailedQueue()).filter((c) => c.idempotencyKey !== idempotencyKey);
    await AsyncStorage.setItem(FAILED_KEY, JSON.stringify(list));
  }

  /** Retries everything saved offline. Returns how many were sent; permanently refused items move to the failed list. */
  async flushOfflineQueue(): Promise<{ sent: number; remaining: number; failed: number }> {
    const queue = await this.getOfflineQueue();
    const remaining: QueuedCommand[] = [];
    const failed = await this.getFailedQueue();
    let sent = 0;
    for (const cmd of queue) {
      try {
        await this.request(cmd.path, { method: cmd.method, headers: { 'Idempotency-Key': cmd.idempotencyKey }, body: JSON.stringify(cmd.body) });
        sent += 1;
      } catch (e) {
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
          failed.push({ ...cmd, reason: e.detail, failedAt: new Date().toISOString() });
        } else {
          remaining.push(cmd); // offline or server trouble: keep for the next try
        }
      }
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    await AsyncStorage.setItem(FAILED_KEY, JSON.stringify(failed));
    return { sent, remaining: remaining.length, failed: failed.length };
  }

  // ---------- last-known data so the app opens without network ----------
  async cacheSet(key: string, value: unknown) {
    try { await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: new Date().toISOString(), value })); } catch { /* ignore */ }
  }
  async cacheGet<T>(key: string): Promise<{ at: string; value: T } | null> {
    try { const raw = await AsyncStorage.getItem(CACHE_PREFIX + key); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
}

function randomId(): string {
  try { return Crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
}
