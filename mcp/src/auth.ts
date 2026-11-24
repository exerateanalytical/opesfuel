import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AuthConfig {
  issuer: string;       // e.g. https://opesfuel.auth0.com/
  audience: string;     // must equal the backend API audience so the token can be passed straight through
  publicUrl: string;    // https://mcp.opesfuel.com
  devToken?: string;    // local development only
}

const ROLE_CLAIM = 'https://opesfuel.com/roles';

export function protectedResourceMetadata(cfg: AuthConfig) {
  return { resource: cfg.publicUrl, authorization_servers: [cfg.issuer.replace(/\/?$/, '/')], bearer_methods_supported: ['header'] };
}

function unauthorized(res: Response, cfg: AuthConfig, msg: string, status = 401) {
  res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${cfg.publicUrl}/.well-known/oauth-protected-resource"`);
  res.status(status).json({ error: status === 403 ? 'forbidden' : 'unauthorized', message: msg });
}

export function authMiddleware(cfg: AuthConfig) {
  const jwks = cfg.devToken ? null : createRemoteJWKSet(new URL(`${cfg.issuer.replace(/\/?$/, '/')}.well-known/jwks.json`));
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return unauthorized(res, cfg, 'Sign in required.');
    if (cfg.devToken) { // never enabled in production (see index.ts)
      if (token !== cfg.devToken) return unauthorized(res, cfg, 'Bad dev token.');
      res.locals.token = token;
      return next();
    }
    try {
      const { payload } = await jwtVerify(token, jwks!, { issuer: cfg.issuer.replace(/\/?$/, '/'), audience: cfg.audience });
      const roles = (payload[ROLE_CLAIM] as string[] | undefined) ?? [];
      if (!roles.map((r) => r.toUpperCase()).includes('PLATFORM_ADMIN')) {
        return unauthorized(res, cfg, 'Only platform administrators may use this connector.', 403);
      }
      res.locals.token = token;
      next();
    } catch {
      unauthorized(res, cfg, 'Invalid or expired token.');
    }
  };
}
