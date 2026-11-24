/** Thin client for the OpesFuel platform-admin REST API. The backend remains the authority on RBAC and audit. */
export class BackendError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface BackendClient {
  get(path: string, query?: Record<string, string | undefined>): Promise<any>;
  send(method: 'POST' | 'PATCH', path: string, body?: unknown): Promise<any>;
}

export function createBackend(baseUrl: string, bearerToken: string, timeoutMs = 15000): BackendClient {
  const base = baseUrl.replace(/\/+$/, '');
  async function call(method: string, path: string, body?: unknown, query?: Record<string, string | undefined>) {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(query ?? {})) if (v) url.searchParams.set(k, v);
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) {
      const hint =
        res.status === 401 ? 'Platform login expired or invalid.' :
        res.status === 403 ? 'This account is not a PLATFORM_ADMIN.' :
        text.slice(0, 200);
      throw new BackendError(res.status, `Platform API ${res.status}: ${hint}`);
    }
    return text ? JSON.parse(text) : {};
  }
  return {
    get: (path, query) => call('GET', path, undefined, query),
    send: (method, path, body) => call(method, path, body ?? {}),
  };
}

/** Visitor/customer-authored text is untrusted: strip control chars and cap length. */
export function clean(value: unknown, max = 600): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').slice(0, max);
}
