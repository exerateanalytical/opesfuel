import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const QUEUE_KEY = 'opesfuel_offline_command_queue_v1';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export type MobileRole = 'OWNER' | 'MANAGER' | 'ATTENDANT' | 'ACCOUNTANT';
export type MobileFuelGrade = 'SUPER' | 'GASOIL' | 'KEROSENE' | 'LPG_BULK' | 'HEAVY_FUEL';

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

export class OpesFuelMobileClient {
  private accessToken: string | null = null;
  private lastSyncedAt: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API ${res.status}: ${errText}`);
    }
    this.lastSyncedAt = new Date().toISOString();
    return (await res.json()) as T;
  }

  async checkConnectivity(forceOffline = false): Promise<MobileSyncHealth> {
    const queue = await this.getOfflineQueue();
    if (forceOffline) {
      return {
        state: 'OFFLINE_QUEUED',
        connected: false,
        latencyMs: null,
        pendingQueueCount: queue.length,
        lastSyncedAt: this.lastSyncedAt,
        endpoint: API_BASE_URL,
      };
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(`${API_BASE_URL}/catalog/institutional-fuels`, {
        method: 'GET',
        signal: controller.signal,
      });
      const latencyMs = Math.max(1, Date.now() - startedAt);
      if (res.ok) {
        this.lastSyncedAt = new Date().toISOString();
        return {
          state: queue.length > 0 ? 'OFFLINE_QUEUED' : 'LIVE_CONNECTED',
          connected: true,
          latencyMs,
          pendingQueueCount: queue.length,
          lastSyncedAt: this.lastSyncedAt,
          endpoint: API_BASE_URL,
        };
      }
      return {
        state: 'OFFLINE_QUEUED',
        connected: false,
        latencyMs: null,
        pendingQueueCount: queue.length,
        lastSyncedAt: this.lastSyncedAt,
        endpoint: API_BASE_URL,
      };
    } catch {
      return {
        state: 'OFFLINE_QUEUED',
        connected: false,
        latencyMs: null,
        pendingQueueCount: queue.length,
        lastSyncedAt: this.lastSyncedAt,
        endpoint: API_BASE_URL,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchPumps(stationId: string) {
    return this.request<Array<{ id: string; code: string; grade: MobileFuelGrade; totalizerLitres: number; unitPriceFcfa: number; status: string }>>(
      `/forecourt/pumps?stationId=${encodeURIComponent(stationId)}`
    );
  }

  async fetchTanks(stationId: string) {
    return this.request<MobileTankDto[]>(
      `/inventory/tanks?stationId=${encodeURIComponent(stationId)}`
    );
  }

  async fetchInstitutionalFuels(): Promise<MobileInstitutionalFuelTemplate[]> {
    try {
      const remote = await this.request<MobileInstitutionalFuelTemplate[]>('/catalog/institutional-fuels');
      return Array.isArray(remote) && remote.length > 0 ? remote : DEFAULT_INSTITUTIONAL_FUELS;
    } catch {
      return DEFAULT_INSTITUTIONAL_FUELS;
    }
  }

  async applyInstitutionalSetup(
    stationId: string,
    items: MobileInstitutionalSelection[],
    lubricantsPack: { includeLubricants: boolean; oilBottlesQty: number; lpgCylindersQty: number }
  ) {
    return this.submitOrQueueCommand(
      `Institutional Fuel Setup (${items.length} grades)`,
      `/stations/${encodeURIComponent(stationId)}/onboarding-setup`,
      { items, lubricantsPack }
    );
  }

  async fetchAiSubscription(stationId: string): Promise<MobileAiSubscription> {
    return this.request<MobileAiSubscription>(`/ai/subscription?stationId=${encodeURIComponent(stationId)}`);
  }

  async toggleAiSubscription(stationId: string, active: boolean, planCode = 'AI_COPILOT_ADDON') {
    return this.submitOrQueueCommand(
      active ? 'Activate Paid AI Copilot' : 'Pause Paid AI Copilot',
      '/ai/subscription/activate',
      { stationId, active, planCode }
    );
  }

  async runAiAnalysis(stationId: string, metricsSnapshot: Record<string, unknown>) {
    return this.request<{ stationId: string; model: string; analysis: string; generatedAt: string }>(
      '/ai/analyze',
      {
        method: 'POST',
        body: JSON.stringify({ stationId, metricsSnapshot }),
      }
    );
  }

  async askAiAdvisor(stationId: string, question: string, metricsSnapshot: Record<string, unknown>) {
    return this.request<{ stationId: string; answer: string; answeredAt: string }>(
      '/ai/chat',
      {
        method: 'POST',
        body: JSON.stringify({ stationId, question, metricsSnapshot }),
      }
    );
  }

  async fetchFinancialReport(stationId: string) {
    return this.request<{
      currency: string;
      totalRevenueFcfa: number;
      cogsFcfa: number;
      grossProfitFcfa: number;
      operatingExpensesFcfa: number;
      netIncomeFcfa: number;
      vatPayableFcfa: number;
      trialBalanceBalanced: boolean;
    }>(`/accounting/reports?stationId=${encodeURIComponent(stationId)}`);
  }

  async submitOrQueueCommand(label: string, path: string, body: Record<string, unknown>): Promise<{ synced: boolean; idempotencyKey: string }> {
    const idempotencyKey = Crypto.randomUUID();
    try {
      await this.request(path, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      });
      return { synced: true, idempotencyKey };
    } catch {
      const existing = await this.getOfflineQueue();
      existing.push({
        idempotencyKey,
        path,
        method: 'POST',
        body,
        createdAt: new Date().toISOString(),
        label,
      });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
      return { synced: false, idempotencyKey };
    }
  }

  async getOfflineQueue(): Promise<QueuedCommand[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedCommand[]) : [];
  }

  async flushOfflineQueue(): Promise<number> {
    const queue = await this.getOfflineQueue();
    if (queue.length === 0) return 0;
    const remaining: QueuedCommand[] = [];
    let syncedCount = 0;
    for (const cmd of queue) {
      try {
        await this.request(cmd.path, {
          method: cmd.method,
          headers: { 'Idempotency-Key': cmd.idempotencyKey },
          body: JSON.stringify(cmd.body),
        });
        syncedCount += 1;
      } catch {
        remaining.push(cmd);
      }
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    return syncedCount;
  }
}
