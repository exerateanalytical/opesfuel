import { ConsoleSection, UserRole } from '../domain/types';

export interface AuthSession {
  mode: 'DEMO_RBAC' | 'AUTH0_OIDC';
  userName: string;
  email: string;
  role: UserRole;
  accessToken: string | null;
  idToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  auth0Sub?: string | null;
  tenantId?: string | null;
  allowedStationIds?: string[];
  auth0Configured: boolean;
}

const AUTH0_DOMAIN = (import.meta.env.VITE_AUTH0_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID || '';
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE || 'https://api.opesfuel.com/v1';

// Self-hosted OpenID Connect provider (Keycloak), e.g. https://auth.opesmaintain.com/realms/opesfuel.
// When set it takes precedence over Auth0; OpesFuel identity (tenant/role/stations) then comes from the backend.
const OIDC_ISSUER = (import.meta.env.VITE_OIDC_ISSUER || '').replace(/\/$/, '');
const OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID || AUTH0_CLIENT_ID;
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const isOidc = Boolean(OIDC_ISSUER);
const CLIENT_ID = isOidc ? OIDC_CLIENT_ID : AUTH0_CLIENT_ID;
const AUTHORIZE_URL = isOidc ? `${OIDC_ISSUER}/protocol/openid-connect/auth` : `https://${AUTH0_DOMAIN}/authorize`;
const TOKEN_URL = isOidc ? `${OIDC_ISSUER}/protocol/openid-connect/token` : `https://${AUTH0_DOMAIN}/oauth/token`;

function tokenRequest(body: Record<string, string>): Promise<Response> {
  if (isOidc) {
    return fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });
  }
  return fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

/** Keycloak tokens carry no OpesFuel claims: ask the backend who this person is (it resolves by verified e-mail). */
async function completeFromBackend(session: AuthSession): Promise<AuthSession> {
  if (!isOidc || session.tenantId) return session;
  try {
    const res = await fetch(`${API_BASE}/api/v1/identity/me`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
    if (!res.ok) return session;
    const me = (await res.json()) as { tenantId?: string; roles?: string[]; allowedStationIds?: string[] };
    return {
      ...session,
      role: resolveRoleFromClaims({ 'https://opesfuel.com/roles': me.roles || [] }),
      tenantId: me.tenantId ?? null,
      allowedStationIds: me.allowedStationIds || [],
    };
  } catch {
    return session;
  }
}

const SESSION_STORAGE_KEY = 'opesfuel.auth0.session.v1';
const PKCE_VERIFIER_KEY = 'opesfuel.auth0.pkce_verifier';
const PKCE_STATE_KEY = 'opesfuel.auth0.pkce_state';
const PKCE_RETURN_PATH_KEY = 'opesfuel.auth0.return_path';

/** Normalises a post-login return target to a same-origin clean path (accepts legacy `#/x` values). */
function toReturnPath(value: string | null | undefined, fallback = '/app/overview'): string {
  if (!value) return fallback;
  let v = value.trim();
  if (v.startsWith('#')) v = v.slice(1);
  if (!v.startsWith('/')) v = `/${v}`;
  if (v.startsWith('//') || v === '/') return fallback;
  return v;
}

export const isAuth0Configured = isOidc ? Boolean(OIDC_CLIENT_ID) : Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

export const ROLE_PROFILES: Record<
  UserRole,
  { name: string; email: string; phone: string; memberId: string; title: string; summary: string }
> = {
  PLATFORM_ADMIN: {
    name: 'Opesware SaaS Admin',
    email: 'superadmin@opesware.com',
    phone: '+237690000001',
    memberId: 'OPF-ADM-001',
    title: 'SaaS Platform Super-Admin',
    summary:
      'Controls every aspect of the OpesFuel SaaS platform: all customer tenants, global FCFA/USD plan pricing, FX rates, feature flags, suspension, enterprise licenses, and broadcasts.',
  },
  GROUP_CFO: {
    name: 'Dr. Olivier Nkomo',
    email: 'group.cfo@opesfuel.com',
    phone: '+237690000006',
    memberId: 'OPF-CFO-001',
    title: 'Holding Group Chief Financial Officer',
    summary:
      'Consolidates multi-subsidiary P&L and Balance Sheets across XAF/XOF/USD entities, runs inter-company eliminations, and tracks controlling vs. minority interest.',
  },
  OWNER: {
    name: 'Jean-Paul Mbarga',
    email: 'owner@opesfuel.com',
    phone: '+237690000002',
    memberId: 'OPF-OWN-001',
    title: 'Fuel Station Network Owner',
    summary:
      'Full business authority across owned stations: company logo & letterhead, fuel price approval, payroll approval, SYSCOHADA accounting, staff invites, billing, and API keys.',
  },
  MANAGER: {
    name: 'Amina Diallo',
    email: 'manager@opesfuel.com',
    phone: '+237690000003',
    memberId: 'OPF-MGR-002',
    title: 'Forecourt Station Manager',
    summary:
      'Supervises daily pump shifts, wet-stock deliveries, dipsticks, fleet & shop POS, HSE/QC quarantine, and staff rosters (blocked from SaaS billing & payroll approvals).',
  },
  ATTENDANT: {
    name: 'Koffi Mensah',
    email: 'attendant@opesfuel.com',
    phone: '+237690000004',
    memberId: 'OPF-ATT-004',
    title: 'Pump Island Attendant',
    summary:
      'Operates assigned pump shifts, records cash/MoMo/card tenders, issues fleet vouchers, and rings up shop sales (zero access to payroll, GL, audit logs, or admin settings).',
  },
  ACCOUNTANT: {
    name: 'Clarisse Ndiaye',
    email: 'finance@opesfuel.com',
    phone: '+237690000005',
    memberId: 'OPF-ACC-003',
    title: 'Chief Accountant',
    summary:
      'Audits double-entry SYSCOHADA journals, manages cash vault & fixed assets, prepares payroll workflows, settles fleet AR, and exports statutory tax packs.',
  },
};

export function canAccessSection(role: UserRole, section: ConsoleSection): boolean {
  if (section === 'platform-admin') return role === 'PLATFORM_ADMIN';
  if (section === 'group-consolidation') {
    return role === 'PLATFORM_ADMIN' || role === 'GROUP_CFO' || role === 'OWNER' || role === 'ACCOUNTANT';
  }
  switch (role) {
    case 'PLATFORM_ADMIN':
      return true;
    case 'GROUP_CFO':
      return (
        section === 'overview' ||
        section === 'accounting' ||
        section === 'fleet' ||
        section === 'inventory' ||
        section === 'ai-assistant'
      );
    case 'OWNER':
      return true;
    case 'MANAGER':
      return (
        section !== 'api-platform' &&
        section !== 'admin' &&
        section !== 'accounting'
      );
    case 'ATTENDANT':
      return (
        section === 'overview' ||
        section === 'forecourt' ||
        section === 'fleet' ||
        section === 'mobile-app'
      );
    case 'ACCOUNTANT':
      return (
        section === 'overview' ||
        section === 'accounting' ||
        section === 'workforce' ||
        section === 'fleet' ||
        section === 'inventory' ||
        section === 'ai-assistant'
      );
  }
}

export function canPerformAction(
  role: UserRole,
  action:
    | 'MANAGE_STATIONS_PRICES'
    | 'OPEN_CLOSE_SHIFT'
    | 'RECORD_DELIVERY'
    | 'RECORD_DIPSTICK'
    | 'MANAGE_EMPLOYEES'
    | 'RUN_PAYROLL'
    | 'VIEW_FINANCIALS'
    | 'SETTLE_FLEET'
    | 'RECORD_EXPENSE_DEPOSIT'
    | 'MANAGE_API_PLATFORM'
    | 'MANAGE_AI_ADDON'
    | 'MANAGE_PLATFORM_SAAS'
    | 'MANAGE_COMPANY_BRANDING'
    | 'VOID_FINANCIAL_RECORDS'
): boolean {
  if (role === 'PLATFORM_ADMIN') return true;
  switch (action) {
    case 'MANAGE_PLATFORM_SAAS':
      return false;
    case 'MANAGE_STATIONS_PRICES':
    case 'MANAGE_API_PLATFORM':
    case 'MANAGE_COMPANY_BRANDING':
    case 'MANAGE_AI_ADDON':
    case 'VOID_FINANCIAL_RECORDS':
      return role === 'OWNER';
    case 'RUN_PAYROLL':
      return role === 'OWNER' || role === 'ACCOUNTANT';
    case 'VIEW_FINANCIALS':
      return role === 'OWNER' || role === 'ACCOUNTANT' || role === 'GROUP_CFO';
    case 'RECORD_DELIVERY':
    case 'MANAGE_EMPLOYEES':
      return role === 'OWNER' || role === 'MANAGER';
    case 'OPEN_CLOSE_SHIFT':
    case 'RECORD_DIPSTICK':
      return role === 'OWNER' || role === 'MANAGER' || role === 'ATTENDANT';
    case 'SETTLE_FLEET':
    case 'RECORD_EXPENSE_DEPOSIT':
      return role === 'OWNER' || role === 'MANAGER' || role === 'ACCOUNTANT' || role === 'GROUP_CFO';
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateRandomUrlSafe(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

export function decodeJwtPayload(token: string | null | undefined): Record<string, unknown> {
  if (!token) return {};
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function resolveRoleFromClaims(claims: Record<string, unknown>): UserRole {
  const rawRoles = claims['https://opesfuel.com/roles'];
  if (Array.isArray(rawRoles)) {
    const normalized = rawRoles.map((r) => String(r).trim().toUpperCase());
    if (normalized.includes('PLATFORM_ADMIN')) return 'PLATFORM_ADMIN';
    if (normalized.includes('GROUP_CFO')) return 'GROUP_CFO';
    if (normalized.includes('OWNER')) return 'OWNER';
    if (normalized.includes('MANAGER')) return 'MANAGER';
    if (normalized.includes('ACCOUNTANT')) return 'ACCOUNTANT';
    if (normalized.includes('ATTENDANT')) return 'ATTENDANT';
  }
  return 'OWNER';
}

function getRedirectUri(): string {
  return `${window.location.origin}/`;
}

export function buildAuth0AuthorizeUrl(): string | null {
  if (!isAuth0Configured) return null;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    scope: 'openid profile email offline_access',
    ...(isOidc ? {} : { audience: AUTH0_AUDIENCE }),
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function startAuth0Login(options?: {
  screenHint?: 'login' | 'signup';
  returnPath?: string;
}): Promise<void> {
  if (!isAuth0Configured) {
    throw new Error('Auth0 is not configured. Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.');
  }
  const verifier = generateRandomUrlSafe(48);
  const challenge = await sha256Base64Url(verifier);
  const state = generateRandomUrlSafe(24);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);
  sessionStorage.setItem(PKCE_RETURN_PATH_KEY, toReturnPath(options?.returnPath || window.location.pathname));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    scope: 'openid profile email offline_access',
    ...(isOidc ? {} : { audience: AUTH0_AUDIENCE }),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    ...(options?.screenHint === 'signup' && isOidc ? { prompt: 'create' } : {}),
    ...(options?.screenHint && !isOidc ? { screen_hint: options.screenHint } : {}),
  });
  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`);
}

function buildSessionFromTokenResponse(
  tokenData: {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in?: number;
  },
  fallbackRefreshToken?: string | null
): AuthSession {
  const accessClaims = decodeJwtPayload(tokenData.access_token);
  const idClaims = decodeJwtPayload(tokenData.id_token);
  const merged = { ...idClaims, ...accessClaims };
  const role = resolveRoleFromClaims(merged);
  const email = String(merged.email || idClaims.email || ROLE_PROFILES[role].email);
  const userName = String(merged.name || idClaims.name || email.split('@')[0] || ROLE_PROFILES[role].name);
  const allowedStationIds = Array.isArray(merged['https://opesfuel.com/station_ids'])
    ? (merged['https://opesfuel.com/station_ids'] as unknown[]).map(String)
    : [];
  const expiresInMs = (Number(tokenData.expires_in) || 3600) * 1000;

  return {
    mode: 'AUTH0_OIDC',
    userName,
    email,
    role,
    accessToken: tokenData.access_token,
    idToken: tokenData.id_token ?? null,
    refreshToken: tokenData.refresh_token ?? fallbackRefreshToken ?? null,
    expiresAt: Date.now() + expiresInMs,
    auth0Sub: typeof merged.sub === 'string' ? merged.sub : null,
    tenantId: typeof merged['https://opesfuel.com/tenant_id'] === 'string'
      ? String(merged['https://opesfuel.com/tenant_id'])
      : null,
    allowedStationIds,
    auth0Configured: true,
  };
}

export function saveAuthSession(session: AuthSession): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage quota failures
  }
}

export function getStoredAuthSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed || !parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(PKCE_STATE_KEY);
    sessionStorage.removeItem(PKCE_RETURN_PATH_KEY);
  } catch {
    // ignore
  }
}

export function buildAuth0LogoutUrl(): string | null {
  if (!isAuth0Configured) return null;
  if (isOidc) {
    const session = getStoredAuthSession();
    const p = new URLSearchParams({ client_id: CLIENT_ID, post_logout_redirect_uri: getRedirectUri() });
    if (session?.idToken) p.set('id_token_hint', session.idToken);
    return `${OIDC_ISSUER}/protocol/openid-connect/logout?${p.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    returnTo: getRedirectUri(),
  });
  return `https://${AUTH0_DOMAIN}/v2/logout?${params.toString()}`;
}

export async function handleAuth0CallbackIfPresent(): Promise<{
  session: AuthSession | null;
  returnPath: string | null;
  error: string | null;
}> {
  if (!isAuth0Configured) {
    return { session: null, returnPath: null, error: null };
  }
  const url = new URL(window.location.href);
  const authError = url.searchParams.get('error');
  const authErrorDesc = url.searchParams.get('error_description');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (authError) {
    window.history.replaceState({}, document.title, '/login');
    return { session: null, returnPath: null, error: authErrorDesc || authError };
  }

  if (!code) {
    return { session: null, returnPath: null, error: null };
  }

  const expectedState = sessionStorage.getItem(PKCE_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  const returnPath = toReturnPath(sessionStorage.getItem(PKCE_RETURN_PATH_KEY));

  sessionStorage.removeItem(PKCE_STATE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_RETURN_PATH_KEY);

  // Strip OAuth query parameters immediately so reloading does not re-submit the single-use code
  window.history.replaceState({}, document.title, returnPath);

  if (!verifier || !expectedState || state !== expectedState) {
    return { session: null, returnPath, error: 'Auth0 OIDC state/PKCE verification failed. Please sign in again.' };
  }

  const tokenRes = await tokenRequest({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code_verifier: verifier,
    code,
    redirect_uri: getRedirectUri(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return {
      session: null,
      returnPath,
      error: `Auth0 token exchange failed (${tokenRes.status}): ${errText.slice(0, 180)}`,
    };
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const session = await completeFromBackend(buildSessionFromTokenResponse(tokenData));
  saveAuthSession(session);
  return { session, returnPath, error: null };
}

export async function refreshAuth0SessionIfNeeded(session: AuthSession | null): Promise<AuthSession | null> {
  if (!session || session.mode !== 'AUTH0_OIDC' || !isAuth0Configured) return session;
  const expiresAt = session.expiresAt ?? 0;
  if (expiresAt - Date.now() > 60_000) {
    return session;
  }
  if (!session.refreshToken) {
    return session;
  }
  try {
    const res = await tokenRequest({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: session.refreshToken,
    });
    if (!res.ok) return session;
    const tokenData = (await res.json()) as {
      access_token: string;
      id_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const refreshed = await completeFromBackend(buildSessionFromTokenResponse(tokenData, session.refreshToken));
    saveAuthSession(refreshed);
    return refreshed;
  } catch {
    return session;
  }
}
