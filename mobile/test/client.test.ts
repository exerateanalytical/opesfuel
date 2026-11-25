import test from 'node:test';
import assert from 'node:assert/strict';
import storage from '@react-native-async-storage/async-storage';
import { ApiError, OpesFuelMobileClient } from '../src/api/opesfuelMobileClient';

type Call = { url: string; method: string; headers: Record<string, string>; body: any };
const calls: Call[] = [];
let behaviour: (c: Call) => Response | 'NETWORK' = () => new Response('{}', { status: 200 });
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const call: Call = { url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : undefined };
  calls.push(call);
  const r = behaviour(call);
  if (r === 'NETWORK') throw new TypeError('Network request failed');
  return r;
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const fresh = () => { (storage as any).__reset(); calls.length = 0; const c = new OpesFuelMobileClient(); c.baseUrl = 'http://api.test/api/v1'; c.setAccessToken('tok'); return c; };

test('requests match the backend contract (paths, bodies, auth header)', async () => {
  const c = fresh();
  behaviour = () => json(200, { id: 'x' });
  await c.openShift('st1', 'pmp1', 'emp1', 'open');
  await c.closeShift('sh1', { closingMeterLitres: 1100, cashFcfa: 1, mobileMoneyFcfa: 2, cardFcfa: 0, fleetCreditFcfa: 0 }, 'close');
  await c.recordDipstick('tk1', 2450, 'dip');
  await c.recordFleetVoucher({ accountId: 'a', stationId: 'st1', vehiclePlate: 'LT-1', driverName: 'D', grade: 'GASOIL', litres: 30 }, 'v');
  await c.recordShopSale('it1', 2, 'MOBILE_MONEY', 's');
  await c.toggleAttendance('emp1', 'clock');
  const seen = calls.map((x) => `${x.method} ${x.url.replace('http://api.test/api/v1', '')}`);
  assert.deepEqual(seen, [
    'POST /forecourt/shifts/open', 'POST /forecourt/shifts/sh1/close', 'POST /inventory/dipsticks',
    'POST /fleet/vouchers', 'POST /shop/sales', 'POST /workforce/employees/emp1/attendance',
  ]);
  assert.deepEqual(calls[0].body, { stationId: 'st1', pumpId: 'pmp1', attendantId: 'emp1' });
  assert.deepEqual(calls[2].body, { tankId: 'tk1', measuredLitres: 2450 });
  assert.deepEqual(calls[4].body, { itemId: 'it1', quantity: 2, paymentMethod: 'MOBILE_MONEY' });
  assert.ok(calls.every((x) => x.headers.Authorization === 'Bearer tok' && x.headers['Idempotency-Key']));
});

test('offline: saved once with the same Idempotency-Key, sent later exactly once', async () => {
  const c = fresh();
  behaviour = () => 'NETWORK';
  const r = await c.recordDipstick('tk1', 100, 'dip');
  assert.equal(r.status, 'QUEUED');
  const queued = await c.getOfflineQueue();
  assert.equal(queued.length, 1);
  behaviour = () => json(200, {});
  const out = await c.flushOfflineQueue();
  assert.deepEqual(out, { sent: 1, remaining: 0, failed: 0 });
  assert.equal(calls.at(-1)!.headers['Idempotency-Key'], queued[0].idempotencyKey);
  assert.equal((await c.getOfflineQueue()).length, 0);
});

test('server refusal is shown to the user and never queued (no silent data pile-up)', async () => {
  const c = fresh();
  behaviour = () => json(409, { detail: 'Daily litre limit (100.0 L) exceeded for vehicle LT-1.' });
  await assert.rejects(c.recordFleetVoucher({ accountId: 'a', stationId: 's', vehiclePlate: 'LT-1', driverName: 'D', grade: 'GASOIL', litres: 50 }, 'v'),
    (e: any) => e instanceof ApiError && e.status === 409 && /Daily litre limit/.test(e.detail));
  assert.equal((await c.getOfflineQueue()).length, 0);
});

test('flush: offline items stay, server-refused items move to the failed list with the reason', async () => {
  const c = fresh();
  behaviour = () => 'NETWORK';
  await c.recordDipstick('tk1', 1, 'one');
  await c.recordDipstick('tk2', 2, 'two');
  await c.recordDipstick('tk3', 3, 'three');
  behaviour = (call) => (call.body?.tankId === 'tk2' ? json(403, { detail: 'Forbidden here' }) : call.body?.tankId === 'tk3' ? 'NETWORK' : json(200, {}));
  const out = await c.flushOfflineQueue();
  assert.deepEqual(out, { sent: 1, remaining: 1, failed: 1 });
  const failed = await c.getFailedQueue();
  assert.equal(failed[0].reason, 'Forbidden here');
  assert.equal((await c.getOfflineQueue())[0].body.tankId, 'tk3');
  await c.discardFailed(failed[0].idempotencyKey);
  assert.equal((await c.getFailedQueue()).length, 0);
});

test('5xx keeps the item queued for retry; 401 triggers the sign-out handler', async () => {
  const c = fresh();
  behaviour = () => 'NETWORK';
  await c.recordShopSale('it', 1, 'CASH', 'sale');
  behaviour = () => json(503, { detail: 'down' });
  assert.deepEqual(await c.flushOfflineQueue(), { sent: 0, remaining: 1, failed: 0 });
  let signedOut = 0; c.setUnauthorizedHandler(() => { signedOut++; });
  behaviour = () => json(401, { detail: 'expired' });
  await assert.rejects(c.getPumps('s'));
  assert.equal(signedOut, 1);
});

test('cache keeps last known data', async () => {
  const c = fresh();
  await c.cacheSet('pumps:s1', [{ id: 'p' }]);
  const got = await c.cacheGet<any[]>('pumps:s1');
  assert.equal(got!.value[0].id, 'p');
  assert.equal(await c.cacheGet('nope'), null);
});

test('identity lookup for Keycloak logins uses the backend identity endpoint with the bearer token', async () => {
  const c = fresh();
  behaviour = () => json(200, { tenantId: 'ten_x', roles: ['MANAGER'], allowedStationIds: ['st1'] });
  const me = await c.getIdentityMe();
  assert.deepEqual(me.roles, ['MANAGER']);
  assert.equal(calls.at(-1)!.url, 'http://api.test/api/v1/identity/me'); assert.equal(calls.at(-1)!.headers.Authorization, 'Bearer tok');
  behaviour = () => json(403, { detail: 'Token carries no tenant_id claim; access denied.' });
  await assert.rejects(c.getIdentityMe(), (e: any) => e instanceof ApiError && e.status === 403);
});
