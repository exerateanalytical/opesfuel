import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AuthConfig {
  issuer: string;        // OpenID Connect issuer exactly as the provider reports it (Keycloak: https://host/realms/x, Auth0: https://x.auth0.com/)
  audience: string;      // must equal the backend API audience so the token can be passed straight through
  publicUrl: string;     // https://mcp.opesfuel.com
  backendBaseUrl: string;// used to ask the backend who the caller is when the token carries no OpesFuel roles (Keycloak)
  devToken?: string;     // local development only
}

const ROLE_CLAIM = 'https://opesfuel.com/roles';
const DISCOVERY_TTL_MS = 10 * 60_000;

export function protectedResourceMetadata(cfg: AuthConfig) {
  return { resource: cfg.publicUrl, authorization_servers: [cfg.issuer], bearer_methods_supported: ['header'] };
}

function unauthorized(res: Response, cfg: AuthConfig, msg: string, status = 401) {
  res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${cfg.publicUrl}/.well-known/oauth-protected-resource"`);
  res.status(status).json({ error: status === 403 ? 'forbidden' : 'unauthorized', message: msg });
}

/** Provider settings come from OpenID discovery, so any compliant provider (Keycloak, Auth0, ...) works without special cases. */
function makeDiscovery(issuer: string) {
  let cached: { issuer: string; jwks: ReturnType<typeof createRemoteJWKSet>; at: number } | null = null;
  return async () => {
    if (cached && Date.now() - cached.at < DISCOVERY_TTL_MS) return cached;
    const res = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`discovery ${res.status}`);
    const doc = (await res.json()) as { issuer: string; jwks_uri: string };
    cached = { issuer: doc.issuer, jwks: createRemoteJWKSet(new URL(doc.jwks_uri)), at: Date.now() };
    return cached;
  };
}

/** Roles from the token when present (Auth0 stamps them); otherwise from the backend, which resolves them from the verified email. */
async function rolesFor(token: string, claims: Record<string, unknown>, cfg: AuthConfig): Promise<string[]> {
  const fromToken = claims[ROLE_CLAIM];
  if (Array.isArray(fromToken)) return fromToken.map((r) => String(r).toUpperCase());
  try {
    const res = await fetch(`${cfg.backendBaseUrl.replace(/\/$/, '')}/api/v1/identity/me`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const me = (await res.json()) as { roles?: string[] };
    return (me.roles ?? []).map((r) => String(r).toUpperCase());
  } catch {
    return [];
  }
}

export function authMiddleware(cfg: AuthConfig) {
  const discover = cfg.devToken ? null : makeDiscovery(cfg.issuer);
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return unauthorized(res, cfg, 'Sign in required.');
    if (cfg.devToken) { // never enabled in production (see index.ts)
      if (token !== cfg.devToken) return unauthorized(res, cfg, 'Bad dev token.');
      res.locals.token = token;
      return next();
    }
    let claims: Record<string, unknown>;
    try {
      const idp = await discover!();
      claims = (await jwtVerify(token, idp.jwks, { issuer: idp.issuer, audience: cfg.audience })).payload as Record<string, unknown>;
    } catch {
      return unauthorized(res, cfg, 'Invalid or expired token.');
    }
    const roles = await rolesFor(token, claims, cfg);
    if (!roles.includes('PLATFORM_ADMIN')) return unauthorized(res, cfg, 'Only platform administrators may use this connector.', 403);
    res.locals.token = token;
    next();
  };
}
