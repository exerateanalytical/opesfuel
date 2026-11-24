import type { FleetAccountDto, PumpDto, ShiftDto, TankDto } from './api/opesfuelMobileClient';

export const LOW_STOCK_PCT = 20;       // tank is "low" at or below this share of capacity
export const DIP_GAP_PCT = 0.5;        // dip vs book gap that deserves attention (share of capacity)
export const LONG_SHIFT_HOURS = 12;
export const CREDIT_WARN_PCT = 90;

/** 12 345 678 style grouping with a narrow no-break space (no dependency on device Intl support). */
export function groupDigits(n: number): string {
  const sign = n < 0 ? '-' : '';
  const s = String(Math.round(Math.abs(n)));
  return sign + s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
export const fcfa = (n: number) => `${groupDigits(n)} FCFA`;
export const litres = (n: number) => `${groupDigits(n)} L`;

export function parseNumber(input: string): number | null {
  const cleaned = input.replace(/[\s  ]/g, '').replace(',', '.');
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface ShiftMath { sold: number; expected: number; collected: number; variance: number; valid: boolean }

/** What should have been collected for the litres pumped, and how far the cash counted is from that. */
export function shiftMath(opening: number, closing: number | null, unitPriceFcfa: number, collectedFcfa: number): ShiftMath {
  if (closing === null || !Number.isFinite(closing) || closing <= opening) {
    return { sold: 0, expected: 0, collected: collectedFcfa, variance: 0, valid: false };
  }
  const sold = Math.round((closing - opening) * 1000) / 1000;
  const expected = Math.round(sold * unitPriceFcfa);
  return { sold, expected, collected: collectedFcfa, variance: Math.round(collectedFcfa - expected), valid: true };
}

export const tankPct = (t: Pick<TankDto, 'capacityLitres' | 'bookVolumeLitres'>) =>
  t.capacityLitres > 0 ? Math.max(0, Math.min(100, (t.bookVolumeLitres / t.capacityLitres) * 100)) : 0;
export const tankIsLow = (t: Pick<TankDto, 'capacityLitres' | 'bookVolumeLitres'>) => tankPct(t) <= LOW_STOCK_PCT;
export const dipGap = (t: Pick<TankDto, 'bookVolumeLitres' | 'lastDipLitres'>) => Math.round((t.lastDipLitres - t.bookVolumeLitres) * 10) / 10;
export const dipGapIsLarge = (t: Pick<TankDto, 'capacityLitres' | 'bookVolumeLitres' | 'lastDipLitres'>) =>
  t.capacityLitres > 0 && (Math.abs(dipGap(t)) / t.capacityLitres) * 100 > DIP_GAP_PCT;

export type AlertLevel = 'red' | 'amber' | 'blue';
export interface Alert { id: string; level: AlertLevel; key: string; vars: Record<string, string | number>; go?: 'tanks' | 'pumps' | 'send' | 'sell' | 'fleet' }

export function sameLocalDay(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export interface AlertInput {
  tanks: TankDto[]; shifts: ShiftDto[]; pumps: PumpDto[]; fleets: FleetAccountDto[]; pendingCount: number; failedCount: number; now: Date;
}

export function buildAlerts(i: AlertInput): Alert[] {
  const out: Alert[] = [];
  if (i.failedCount > 0) out.push({ id: 'failed', level: 'red', key: 'alertFailed', vars: { n: i.failedCount }, go: 'send' });
  for (const t of i.tanks) {
    if (tankIsLow(t)) out.push({ id: `low-${t.id}`, level: 'red', key: 'alertLowStock', vars: { name: t.name, pct: Math.round(tankPct(t)) }, go: 'tanks' });
    else if (dipGapIsLarge(t)) out.push({ id: `dip-${t.id}`, level: 'amber', key: 'alertDip', vars: { name: t.name, litres: groupDigits(Math.abs(dipGap(t))) }, go: 'tanks' });
  }
  for (const s of i.shifts) {
    if (s.status === 'OPEN') {
      const hours = Math.floor((i.now.getTime() - new Date(s.openedAt).getTime()) / 3_600_000);
      if (hours >= LONG_SHIFT_HOURS) out.push({ id: `long-${s.id}`, level: 'amber', key: 'alertLongShift', vars: { h: hours, pump: s.pumpCode }, go: 'pumps' });
    } else if (s.status === 'CLOSED' && sameLocalDay(s.closedAt, i.now) && s.varianceFcfa < 0) {
      out.push({ id: `short-${s.id}`, level: 'amber', key: 'alertShortage', vars: { amount: fcfa(Math.abs(s.varianceFcfa)), pump: s.pumpCode }, go: 'pumps' });
    }
  }
  for (const f of i.fleets) {
    if (f.creditLimitFcfa > 0 && (f.balanceOwedFcfa / f.creditLimitFcfa) * 100 >= CREDIT_WARN_PCT) {
      out.push({ id: `credit-${f.id}`, level: 'amber', key: 'alertCredit', vars: { name: f.companyName }, go: 'fleet' });
    }
  }
  if (i.pendingCount > 0) out.push({ id: 'pending', level: 'blue', key: 'alertUnsent', vars: { n: i.pendingCount }, go: 'send' });
  const rank: Record<AlertLevel, number> = { red: 0, amber: 1, blue: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

export interface DaySummary { revenue: number; collected: number; variance: number; count: number; litresSold: number; byAttendant: { name: string; count: number; revenue: number; variance: number }[] }

export function todaySummary(shifts: ShiftDto[], now: Date): DaySummary {
  const closed = shifts.filter((s) => s.status === 'CLOSED' && sameLocalDay(s.closedAt, now));
  const by = new Map<string, { name: string; count: number; revenue: number; variance: number }>();
  let revenue = 0, collected = 0, variance = 0, litresSold = 0;
  for (const s of closed) {
    const got = s.cashFcfa + s.mobileMoneyFcfa + s.cardFcfa + s.fleetCreditFcfa;
    revenue += s.expectedRevenueFcfa; collected += got; variance += s.varianceFcfa; litresSold += s.litresSold ?? 0;
    const row = by.get(s.attendantId) ?? { name: s.attendantName, count: 0, revenue: 0, variance: 0 };
    row.count += 1; row.revenue += s.expectedRevenueFcfa; row.variance += s.varianceFcfa;
    by.set(s.attendantId, row);
  }
  return { revenue, collected, variance, count: closed.length, litresSold: Math.round(litresSold * 10) / 10, byAttendant: [...by.values()].sort((a, b) => b.revenue - a.revenue) };
}

export type Role = 'OWNER' | 'MANAGER' | 'ATTENDANT' | 'ACCOUNTANT';
export type TabId = 'home' | 'pumps' | 'tanks' | 'sell' | 'reports' | 'send' | 'more' | 'fleet' | 'myshift';

/** Which bottom tabs each role sees. UI convenience only; the backend enforces permissions. */
export const TABS_BY_ROLE: Record<Role, TabId[]> = {
  ATTENDANT: ['myshift', 'sell', 'send', 'more'],
  MANAGER: ['home', 'pumps', 'tanks', 'sell', 'more'],
  OWNER: ['home', 'pumps', 'tanks', 'reports', 'more'],
  ACCOUNTANT: ['home', 'reports', 'fleet', 'more'],
};
