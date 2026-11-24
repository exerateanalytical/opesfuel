import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { EmployeeDto, FinancialReportDto, FleetAccountDto, MobileSyncHealth, OpesFuelMobileClient, PumpDto, ShiftDto, ShopItemDto, StationDto, TankDto } from './api/opesfuelMobileClient';
import { ApiError } from './api/opesfuelMobileClient';
import { Alert, buildAlerts, DaySummary, todaySummary } from './logic';
import type { Session } from './session';

export interface DataState {
  client: OpesFuelMobileClient;
  session: Session;
  stationId: string | null;
  stationName: string;
  stations: StationDto[];
  setStationId: (id: string) => void;
  pumps: PumpDto[]; tanks: TankDto[]; shifts: ShiftDto[]; fleets: FleetAccountDto[]; items: ShopItemDto[]; employees: EmployeeDto[];
  me: EmployeeDto | null; meMissing: boolean;
  report: FinancialReportDto | null; reportDenied: boolean;
  queueCount: number; failedCount: number; health: MobileSyncHealth | null;
  lastUpdated: string | null; stale: boolean; loading: boolean;
  alerts: Alert[]; summary: DaySummary;
  refresh: () => Promise<void>; refreshQueue: () => Promise<void>; flush: () => Promise<{ sent: number; remaining: number; failed: number }>;
}

const Ctx = createContext<DataState | null>(null);
export const useData = () => { const v = useContext(Ctx); if (!v) throw new Error('DataProvider missing'); return v; };

const EMPTY_SUMMARY: DaySummary = { revenue: 0, collected: 0, variance: 0, count: 0, litresSold: 0, byAttendant: [] };
const REFRESH_MS = 60_000;

export function DataProvider({ client, session, children }: { client: OpesFuelMobileClient; session: Session; children: React.ReactNode }) {
  const [stations, setStations] = useState<StationDto[]>([]);
  const [stationId, setStationIdState] = useState<string | null>(session.stationIds[0] ?? null);
  const [pumps, setPumps] = useState<PumpDto[]>([]);
  const [tanks, setTanks] = useState<TankDto[]>([]);
  const [shifts, setShifts] = useState<ShiftDto[]>([]);
  const [fleets, setFleets] = useState<FleetAccountDto[]>([]);
  const [items, setItems] = useState<ShopItemDto[]>([]);
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [me, setMe] = useState<EmployeeDto | null>(null);
  const [meMissing, setMeMissing] = useState(false);
  const [report, setReport] = useState<FinancialReportDto | null>(null);
  const [reportDenied, setReportDenied] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [health, setHealth] = useState<MobileSyncHealth | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);

  const refreshQueue = useCallback(async () => {
    const [q, f] = await Promise.all([client.getOfflineQueue(), client.getFailedQueue()]);
    setQueueCount(q.length); setFailedCount(f.length);
  }, [client]);

  const applyCached = useCallback(async (sid: string) => {
    const get = async <T,>(k: string, set: (v: T) => void) => { const c = await client.cacheGet<T>(`${k}:${sid}`); if (c) { set(c.value); return c.at; } return null; };
    const times = await Promise.all([get<PumpDto[]>('pumps', setPumps), get<TankDto[]>('tanks', setTanks), get<ShiftDto[]>('shifts', setShifts), get<FleetAccountDto[]>('fleets', setFleets), get<ShopItemDto[]>('items', setItems)]);
    const t = times.filter(Boolean).sort().at(-1) ?? null;
    if (t) setLastUpdated(t);
  }, [client]);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      let sid = stationId;
      let list = stations;
      if (list.length === 0) {
        try { list = await client.getStations(); setStations(list); } catch { /* cached/unknown */ }
      }
      if (!sid) { sid = list[0]?.id ?? null; if (sid) setStationIdState(sid); }
      void refreshQueue();
      client.checkConnectivity().then(setHealth).catch(() => {});
      if (!sid) { setLoading(false); return; }
      const station = sid;
      const cacheAndSet = <T,>(key: string, value: T, set: (v: T) => void) => { set(value); void client.cacheSet(`${key}:${station}`, value); };
      const results = await Promise.allSettled([
        client.getPumps(station), client.getTanks(station), client.getShifts(station), client.getFleetAccounts(), client.getShopItems(station),
        session.role === 'ATTENDANT' || session.role === 'MANAGER' || session.role === 'OWNER' ? client.getMyProfile() : Promise.reject(new ApiError(404, 'n/a')),
        session.role === 'OWNER' || session.role === 'MANAGER' ? client.getEmployees(station) : Promise.resolve([] as EmployeeDto[]),
        session.role !== 'ATTENDANT' ? client.getFinancialReport(station) : Promise.reject(new ApiError(403, 'n/a')),
      ]);
      const [rp, rt, rs, rf, ri, rme, remp, rrep] = results;
      let anyOk = false;
      if (rp.status === 'fulfilled') { cacheAndSet('pumps', rp.value, setPumps); anyOk = true; }
      if (rt.status === 'fulfilled') { cacheAndSet('tanks', rt.value, setTanks); anyOk = true; }
      if (rs.status === 'fulfilled') { cacheAndSet('shifts', rs.value, setShifts); anyOk = true; }
      if (rf.status === 'fulfilled') cacheAndSet('fleets', rf.value, setFleets);
      if (ri.status === 'fulfilled') cacheAndSet('items', ri.value, setItems);
      if (rme.status === 'fulfilled') { setMe(rme.value); setMeMissing(false); } else { setMe(null); setMeMissing(rme.reason instanceof ApiError && rme.reason.status === 404); }
      if (remp.status === 'fulfilled') setEmployees(remp.value);
      if (rrep.status === 'fulfilled') { setReport(rrep.value); setReportDenied(false); } else { setReport(null); setReportDenied(rrep.reason instanceof ApiError && (rrep.reason as ApiError).status === 403); }
      if (anyOk) { setLastUpdated(new Date().toISOString()); setStale(false); } else { setStale(true); await applyCached(station); }
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [client, stationId, stations, session.role, refreshQueue, applyCached]);

  const flush = useCallback(async () => {
    const r = await client.flushOfflineQueue();
    await refreshQueue();
    if (r.sent > 0) await refresh();
    return r;
  }, [client, refresh, refreshQueue]);

  const setStationId = useCallback((id: string) => { setStationIdState(id); setLoading(true); }, []);

  // initial + station change + periodic + when the app returns to the foreground
  useEffect(() => { void refresh(); }, [stationId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = setInterval(() => { void flush().catch(() => {}); void refresh(); }, REFRESH_MS);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { void flush().catch(() => {}); void refresh(); } });
    return () => { clearInterval(timer); sub.remove(); };
  }, [refresh, flush]);

  const now = new Date();
  const alerts = useMemo(() => buildAlerts({ tanks, shifts, pumps, fleets, pendingCount: queueCount, failedCount, now: new Date() }), [tanks, shifts, pumps, fleets, queueCount, failedCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => (shifts.length ? todaySummary(shifts, new Date()) : EMPTY_SUMMARY), [shifts]); // eslint-disable-line react-hooks/exhaustive-deps
  void now;
  const stationName = stations.find((x) => x.id === stationId)?.name ?? '';

  const value: DataState = { client, session, stationId, stationName, stations, setStationId, pumps, tanks, shifts, fleets, items, employees, me, meMissing, report, reportDenied, queueCount, failedCount, health, lastUpdated, stale, loading, alerts, summary, refresh, refreshQueue, flush };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Turns any thrown error into a short, user-facing sentence (French or English via t). */
export function errorText(e: unknown, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (e instanceof ApiError) {
    if (e.status === 403) return t('errForbidden');
    if (e.status === 409 || e.status === 422 || e.status === 400) return t('errConflict', { detail: e.detail });
    if (e.status === 402) return e.detail;
  }
  return t('errGeneric');
}
