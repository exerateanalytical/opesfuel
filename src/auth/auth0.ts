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

const SESSION_STORAGE_KEY = 'opesfuel.auth0.session.v1';
const PKCE_VERIFIER_KEY = 'opesfuel.auth0.pkce_verifier';
const PKCE_STATE_KEY = 'opesfuel.auth0.pkce_state';
const PKCE_RETURN_HASH_KEY = 'opesfuel.auth0.return_hash';

export const isAuth0Configured = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

export const ROLE_PROFILES: Record<UserRole, { name: string; email: string; title: string; summary: string }> = {
  PLATFORM_ADMIN: {
    name: 'Opesware SaaS Admin',
    email: 'superadmin@opesware.com',
    title: 'SaaS Platform Super-Admin',
    summary: 'Manages all customer station tenants, global SaaS MRR, enterprise licensing, tenant suspension, and inbound onboarding leads.',
  },
  OWNER: {
    name: 'Jean-Paul Mbarga',
    email: 'owner@opesfuel.com',
    title: 'Station Network Owner',
    summary: 'Full access across stations, pricing, accounting statements, payroll, billing invoices, and API keys.',
  },
  MANAGER: {
    name: 'Amina Diallo',
    email: 'manager@opesfuel.com',
    title: 'Forecourt Station Manager',
    summary: 'Manages pump shifts, tanker deliveries, dipstick checks, staff roster, and station expenses.',
  },
  ATTENDANT: {
    name: 'Koffi Mensah',
    email: 'attendant@opesfuel.com',
    title: 'Pump Island Attendant',
    summary: 'Opens/closes assigned pump shifts, records cash/MoMo tenders, fleet vouchers, and shop sales.',
  },
  ACCOUNTANT: {
    name: 'Clarisse Ndiaye',
    email: 'finance@opesfuel.com',
    title: 'Chief Accountant',
    summary: 'Audits double-entry journals, settles fleet AR, locks fiscal periods, remits VAT, and exports SYSCOHADA reports.',
  },
};

export function canAccessSection(role: UserRole, section: ConsoleSection): boolean {
  if (section === 'platform-admin') return role === 'PLATFORM_ADMIN';
  if (section === 'mobile-app') return true;
  switch (role) {
    case 'PLATFORM_ADMIN':
    case 'OWNER':
      return true;
    case 'MANAGER':
      return section !== 'api-platform' && section !== 'admin';
    case 'ATTENDANT':
      return section === 'overview' || section === 'forecourt' || section === 'fleet';
    case 'ACCOUNTANT':
      return (
        section === 'overview' ||
        section === 'fleet' ||
        section === 'accounting' ||
        section === 'workforce' ||
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
    | 'SETTLE_FLEET'
    | 'RECORD_EXPENSE_DEPOSIT'
    | 'MANAGE_API_PLATFORM'
    | 'MANAGE_AI_ADDON'
    | 'MANAGE_PLATFORM_SAAS'
): boolean {
  if (role === 'PLATFORM_ADMIN') return true;
  switch (action) {
    case 'MANAGE_PLATFORM_SAAS':
      return false;
    case 'MANAGE_STATIONS_PRICES':
    case 'MANAGE_API_PLATFORM':
      return role === 'OWNER';
    case 'MANAGE_AI_ADDON':
      return role === 'OWNER' || role === 'MANAGER';
    case 'OPEN_CLOSE_SHIFT':
      return role === 'OWNER' || role === 'MANAGER' || role === 'ATTENDANT';
    case 'RECORD_DELIVERY':
    case 'MANAGE_EMPLOYEES':
      return role === 'OWNER' || role === 'MANAGER';
    case 'RECORD_DIPSTICK':
      return role === 'OWNER' || role === 'MANAGER' || role === 'ATTENDANT';
    case 'SETTLE_FLEET':
    case 'RECORD_EXPENSE_DEPOSIT':
      return role === 'OWNER' || role === 'MANAGER' || role === 'ACCOUNTANT';
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
    client_id: AUTH0_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    scope: 'openid profile email offline_access',
    audience: AUTH0_AUDIENCE,
  });
  return `https://${AUTH0_DOMAIN}/authorize?${params.toString()}`;
}

export async function startAuth0Login(options?: {
  screenHint?: 'login' | 'signup';
  returnHash?: string;
}): Promise<void> {
  if (!isAuth0Configured) {
    throw new Error('Auth0 is not configured. Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.');
  }
  const verifier = generateRandomUrlSafe(48);
  const challenge = await sha256Base64Url(verifier);
  const state = generateRandomUrlSafe(24);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);
  sessionStorage.setItem(PKCE_RETURN_HASH_KEY, options?.returnHash || window.location.hash || '#/app/overview');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: AUTH0_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    scope: 'openid profile email offline_access',
    audience: AUTH0_AUDIENCE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    ...(options?.screenHint ? { screen_hint: options.screenHint } : {}),
  });
  window.location.assign(`https://${AUTH0_DOMAIN}/authorize?${params.toString()}`);
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
    sessionStorage.removeItem(PKCE_RETURN_HASH_KEY);
  } catch {
    // ignore
  }
}

export function buildAuth0LogoutUrl(): string | null {
  if (!isAuth0Configured) return null;
  const params = new URLSearchParams({
    client_id: AUTH0_CLIENT_ID,
    returnTo: getRedirectUri(),
  });
  return `https://${AUTH0_DOMAIN}/v2/logout?${params.toString()}`;
}

export async function handleAuth0CallbackIfPresent(): Promise<{
  session: AuthSession | null;
  returnHash: string | null;
  error: string | null;
}> {
  if (!isAuth0Configured) {
    return { session: null, returnHash: null, error: null };
  }
  const url = new URL(window.location.href);
  const authError = url.searchParams.get('error');
  const authErrorDesc = url.searchParams.get('error_description');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (authError) {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash || '#/login'}`);
    return { session: null, returnHash: null, error: authErrorDesc || authError };
  }

  if (!code) {
    return { session: null, returnHash: null, error: null };
  }

  const expectedState = sessionStorage.getItem(PKCE_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  const returnHash = sessionStorage.getItem(PKCE_RETURN_HASH_KEY) || '#/app/overview';

  sessionStorage.removeItem(PKCE_STATE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_RETURN_HASH_KEY);

  // Strip OAuth query parameters immediately so reloading does not re-submit the single-use code
  window.history.replaceState({}, document.title, `${window.location.pathname}${returnHash}`);

  if (!verifier || !expectedState || state !== expectedState) {
    return { session: null, returnHash, error: 'Auth0 OIDC state/PKCE verification failed. Please sign in again.' };
  }

  const tokenRes = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: AUTH0_CLIENT_ID,
      code_verifier: verifier,
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return {
      session: null,
      returnHash,
      error: `Auth0 token exchange failed (${tokenRes.status}): ${errText.slice(0, 180)}`,
    };
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const session = buildSessionFromTokenResponse(tokenData);
  saveAuthSession(session);
  return { session, returnHash, error: null };
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
    const res = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: AUTH0_CLIENT_ID,
        refresh_token: session.refreshToken,
      }),
    });
    if (!res.ok) return session;
    const tokenData = (await res.json()) as {
      access_token: string;
      id_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const refreshed = buildSessionFromTokenResponse(tokenData, session.refreshToken);
    saveAuthSession(refreshed);
    return refreshed;
  } catch {
    return session;
  }
}
