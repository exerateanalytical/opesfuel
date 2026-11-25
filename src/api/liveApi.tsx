import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

interface LiveApi {
  /** True when a signed-in session is connected to the real server (never in the browser-only demo). */
  live: boolean;
  get: <T = unknown>(path: string) => Promise<T>;
  send: <T = unknown>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown) => Promise<T>;
}

const Ctx = createContext<LiveApi>({
  live: false,
  get: async () => { throw new Error('Not connected'); },
  send: async () => { throw new Error('Not connected'); },
});

export const useLiveApi = () => useContext(Ctx);

async function errorOf(res: Response): Promise<string> {
  try {
    const j = JSON.parse(await res.text()) as { detail?: string; message?: string; title?: string };
    return j.detail || j.message || j.title || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export const LiveApiProvider: React.FC<{ baseUrl: string; token: string | null | undefined; children: React.ReactNode }> = ({ baseUrl, token, children }) => {
  const base = baseUrl.replace(/\/+$/, '');
  const live = Boolean(base && token);
  const get = useCallback(async <T,>(path: string): Promise<T> => {
    const res = await fetch(`${base}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(await errorOf(res));
    return (await res.json()) as T;
  }, [base, token]);
  const send = useCallback(async <T,>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${base}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await errorOf(res));
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }, [base, token]);
  const value = useMemo(() => ({ live, get, send }), [live, get, send]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/**
 * A list that is real data when connected and the built-in sample only in the browser-only demo.
 * Customers never see sample rows presented as their own records.
 */
export function useLiveList<TRow, TItem>(path: string, seed: TItem[], map: (row: TRow) => TItem, enabled = true) {
  const api = useLiveApi();
  const [items, setItems] = useState<TItem[]>(api.live ? [] : seed);
  const [loading, setLoading] = useState(api.live && enabled);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef(map);
  mapRef.current = map;

  const reload = useCallback(async () => {
    if (!api.live || !enabled) return;
    setLoading(true);
    try {
      const rows = await api.get<TRow[]>(path);
      setItems((Array.isArray(rows) ? rows : []).map((r) => mapRef.current(r)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [api.live, api.get, path, enabled]);

  useEffect(() => { void reload(); }, [reload]);
  return { items, setItems, loading, error, reload, live: api.live };
}
