import type { MobileRole } from './api/opesfuelMobileClient';

export interface Session {
  mode: 'AUTH0' | 'DEMO';
  role: MobileRole;
  name: string;
  email: string;
  sub: string;
  tenantId: string | null;
  stationIds: string[];
  exp: number | null; // seconds since epoch
}

const NS = 'https://opesfuel.com/';
const SUPPORTED: MobileRole[] = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'ATTENDANT'];
// highest authority first
const PRIORITY: MobileRole[] = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'ATTENDANT'];

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64decode(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let bits = 0, acc = 0, out = '';
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) continue;
    acc = (acc << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out += String.fromCharCode((acc >> bits) & 0xff); }
  }
  // decode UTF-8
  try { return decodeURIComponent(out.split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')); } catch { return out; }
}

export function decodeJwt(token: string): Record<string, any> | null {
  try {
    const part = token.split('.')[1];
    return part ? JSON.parse(b64decode(part)) : null;
  } catch {
    return null;
  }
}

export type SessionResult = { ok: true; session: Session } | { ok: false; reason: 'INVALID' | 'EXPIRED' | 'UNSUPPORTED_ROLE' };

/** UI-only role detection. The backend remains the authority and re-checks every request. */
export function sessionFromTokens(accessToken: string, idToken?: string | null, nowSec = Math.floor(Date.now() / 1000)): SessionResult {
  const access = decodeJwt(accessToken);
  if (!access) return { ok: false, reason: 'INVALID' };
  const exp = typeof access.exp === 'number' ? access.exp : null;
  if (exp !== null && exp <= nowSec) return { ok: false, reason: 'EXPIRED' };
  const id = idToken ? decodeJwt(idToken) : null;
  const claim = (k: string) => access[NS + k] ?? id?.[NS + k];
  const roles: string[] = ((claim('roles') as string[] | undefined) ?? []).map((r) => String(r).toUpperCase());
  const role = PRIORITY.find((r) => roles.includes(r));
  if (!role || !SUPPORTED.includes(role)) return { ok: false, reason: 'UNSUPPORTED_ROLE' };
  const stations = (claim('station_ids') as string[] | undefined) ?? [];
  return {
    ok: true,
    session: {
      mode: 'AUTH0',
      role,
      name: String(id?.name ?? access.name ?? id?.email ?? access.email ?? ''),
      email: String(id?.email ?? access.email ?? ''),
      sub: String(access.sub ?? ''),
      tenantId: (claim('tenant_id') as string | undefined) ?? null,
      stationIds: stations,
      exp,
    },
  };
}

export function demoSession(role: MobileRole): Session {
  const names: Record<MobileRole, string> = { OWNER: 'Jean-Paul', MANAGER: 'Clarisse', ATTENDANT: 'Samuel', ACCOUNTANT: 'Mireille' };
  return { mode: 'DEMO', role, name: names[role], email: '', sub: 'demo', tenantId: 'demo', stationIds: ['st_demo'], exp: null };
}
