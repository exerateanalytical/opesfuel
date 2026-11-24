import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { buildApp } from '../src/index.js';

const listen = (app: express.Express) => new Promise<{ url: string; close: () => void }>((res) => {
  const s = app.listen(0, () => res({ url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, close: () => s.close() }));
});

test('Auth0 JWT path: only PLATFORM_ADMIN tokens with the right issuer and audience get in', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const idp = express();
  idp.get('/.well-known/jwks.json', (_q, r) => r.json({ keys: [jwk] }));
  const idpSrv = await listen(idp);
  const issuer = idpSrv.url + '/';
  const api = express();
  api.get('/api/v1/platform-admin/overview', (_q, r) => r.json({ companies: 3 }));
  const apiSrv = await listen(api);
  const mcp = await listen(buildApp({ OPESFUEL_API_BASE: apiSrv.url, AUTH0_ISSUER_URI: issuer, AUTH0_AUDIENCE: 'https://api.opesfuel.com/v1', NODE_ENV: 'production' } as any));

  const mint = (opts: { roles: string[]; aud?: string; iss?: string; exp?: string }) =>
    new SignJWT({ 'https://opesfuel.com/roles': opts.roles })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setSubject('auth0|me')
      .setIssuer(opts.iss ?? issuer).setAudience(opts.aud ?? 'https://api.opesfuel.com/v1')
      .setExpirationTime(opts.exp ?? '5m').sign(privateKey);
  const call = async (token: string) => (await fetch(mcp.url + '/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  })).status;

  assert.equal(await call(await mint({ roles: ['PLATFORM_ADMIN'] })), 200);
  assert.equal(await call(await mint({ roles: ['OWNER'] })), 403);
  assert.equal(await call(await mint({ roles: ['PLATFORM_ADMIN'], aud: 'https://other' })), 401);
  assert.equal(await call(await mint({ roles: ['PLATFORM_ADMIN'], iss: 'https://evil.example/' })), 401);
  assert.equal(await call(await mint({ roles: ['PLATFORM_ADMIN'], exp: '-1m' })), 401);
  assert.equal(await call('garbage'), 401);
  mcp.close(); idpSrv.close(); apiSrv.close();
});
