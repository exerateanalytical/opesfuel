import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAlerts, dipGap, groupDigits, parseNumber, shiftMath, tankIsLow, tankPct, todaySummary, TABS_BY_ROLE } from '../src/logic';
import { sessionFromTokens, decodeJwt } from '../src/session';
import { format, DICTS } from '../src/i18n.shared';

const tank = (o: Partial<any> = {}) => ({ id: 't1', stationId: 's', name: 'T-01', grade: 'SUPER', capacityLitres: 10000, bookVolumeLitres: 5000, lastDipLitres: 5000, varianceLitres: 0, unitCostFcfa: 700, status: 'NOMINAL', ...o });
const shift = (o: Partial<any> = {}) => ({ id: 'sh1', stationId: 's', pumpId: 'p1', pumpCode: 'P-01', grade: 'SUPER', attendantId: 'e1', attendantName: 'Koffi', openingMeterLitres: 1000, closingMeterLitres: 1100, litresSold: 100, unitPriceFcfa: 840, expectedRevenueFcfa: 84000, cashFcfa: 84000, mobileMoneyFcfa: 0, cardFcfa: 0, fleetCreditFcfa: 0, varianceFcfa: 0, status: 'CLOSED', openedAt: '2026-11-24T06:00:00Z', closedAt: '2026-11-24T14:00:00Z', ...o });

test('shiftMath: exact, short and over; invalid meter', () => {
  assert.deepEqual(shiftMath(1000, 1100, 840, 84000), { sold: 100, expected: 84000, collected: 84000, variance: 0, valid: true });
  assert.equal(shiftMath(1000, 1100, 840, 80000).variance, -4000);
  assert.equal(shiftMath(1000, 1100, 840, 90000).variance, 6000);
  assert.equal(shiftMath(1000, 1000, 840, 0).valid, false);
  assert.equal(shiftMath(1000, 900, 840, 0).valid, false);
  assert.equal(shiftMath(1000, null, 840, 0).valid, false);
  assert.equal(shiftMath(1000, 1000.5, 840, 420).variance, 0);
});

test('number formatting and parsing (French style input)', () => {
  assert.equal(groupDigits(1234567), '1 234 567');
  assert.equal(groupDigits(-4000), '-4 000');
  assert.equal(parseNumber('1 250,5'), 1250.5);
  assert.equal(parseNumber('420'), 420);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('12abc'), null);
});

test('tank helpers', () => {
  assert.equal(tankPct(tank()), 50);
  assert.equal(tankIsLow(tank({ bookVolumeLitres: 1500 })), true);
  assert.equal(tankIsLow(tank({ bookVolumeLitres: 2001 })), false);
  assert.equal(dipGap(tank({ lastDipLitres: 4900 })), -100);
});

test('alerts: low stock, dip gap, long shift, credit, unsent/failed ordered by severity', () => {
  const now = new Date('2026-11-24T20:00:00Z');
  const a = buildAlerts({
    tanks: [tank({ id: 'low', bookVolumeLitres: 1000 }), tank({ id: 'dip', bookVolumeLitres: 6000, lastDipLitres: 5800 }), tank({ id: 'ok' })],
    shifts: [shift({ id: 'open', status: 'OPEN', closedAt: null, openedAt: '2026-11-24T02:00:00Z' }), shift({ id: 'short', varianceFcfa: -2500 })],
    pumps: [], fleets: [{ id: 'f', companyName: 'Camrail', creditLimitFcfa: 1000, balanceOwedFcfa: 950, status: 'ACTIVE' }],
    pendingCount: 2, failedCount: 1, now,
  });
  assert.deepEqual(a.map((x) => x.id), ['failed', 'low-low', 'dip-dip', 'long-open', 'short-short', 'credit-f', 'pending']);
  assert.equal(a[0].level, 'red'); assert.equal(a.at(-1)!.level, 'blue');
  assert.equal(buildAlerts({ tanks: [tank()], shifts: [], pumps: [], fleets: [], pendingCount: 0, failedCount: 0, now }).length, 0);
});

test('todaySummary only counts shifts closed today and groups by attendant', () => {
  const now = new Date('2026-11-24T20:00:00Z');
  const s = todaySummary([
    shift({ id: 'a' }), shift({ id: 'b', attendantId: 'e2', attendantName: 'Awa', expectedRevenueFcfa: 40000, cashFcfa: 39000, varianceFcfa: -1000, litresSold: 50 }),
    shift({ id: 'old', closedAt: '2026-11-20T14:00:00Z' }), shift({ id: 'open', status: 'OPEN', closedAt: null }),
  ], now);
  assert.equal(s.count, 2); assert.equal(s.revenue, 124000); assert.equal(s.collected, 123000); assert.equal(s.variance, -1000); assert.equal(s.litresSold, 150);
  assert.deepEqual(s.byAttendant.map((r) => r.name), ['Koffi', 'Awa']);
});

test('role tabs: attendants never see money or tank admin tabs; everyone can reach More', () => {
  assert.ok(!TABS_BY_ROLE.ATTENDANT.includes('reports' as any) && !TABS_BY_ROLE.ATTENDANT.includes('tanks' as any));
  for (const r of Object.values(TABS_BY_ROLE)) assert.ok(r.includes('more'));
  assert.ok(TABS_BY_ROLE.OWNER.includes('reports'));
});

const NS = 'https://opesfuel.com/';
const jwt = (claims: object) => ['x', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'y'].join('.');

test('session from token: role comes from claims, highest authority wins, UTF-8 names survive', () => {
  const t = jwt({ sub: 'auth0|1', exp: 2000000000, [NS + 'roles']: ['ATTENDANT', 'MANAGER'], [NS + 'tenant_id']: 'ten_x', [NS + 'station_ids']: ['st_1'] });
  const id = jwt({ name: 'Séraphin Ndzié', email: 's@x.cm' });
  const r = sessionFromTokens(t, id, 1700000000);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.session.role, 'MANAGER'); assert.equal(r.session.name, 'Séraphin Ndzié'); assert.deepEqual(r.session.stationIds, ['st_1']); assert.equal(r.session.tenantId, 'ten_x'); }
});

test('session from token: expired, garbage and unsupported roles are refused', () => {
  assert.deepEqual(sessionFromTokens(jwt({ exp: 100, [NS + 'roles']: ['OWNER'] }), null, 200), { ok: false, reason: 'EXPIRED' });
  assert.deepEqual(sessionFromTokens('garbage', null), { ok: false, reason: 'INVALID' });
  assert.deepEqual(sessionFromTokens(jwt({ exp: 2000000000, [NS + 'roles']: ['PLATFORM_ADMIN'] }), null, 1), { ok: false, reason: 'UNSUPPORTED_ROLE' });
  assert.deepEqual(sessionFromTokens(jwt({ exp: 2000000000 }), null, 1), { ok: false, reason: 'UNSUPPORTED_ROLE' });
  assert.equal(decodeJwt('a.b'), null);
});

test('translations: French and English have exactly the same keys and no empty text', () => {
  const frKeys = Object.keys(DICTS.fr).sort(), enKeys = Object.keys(DICTS.en).sort();
  assert.deepEqual(frKeys, enKeys);
  for (const [k, v] of [...Object.entries(DICTS.fr), ...Object.entries(DICTS.en)]) assert.ok(v.trim().length > 0, k);
  // placeholders must match between languages
  for (const k of frKeys) assert.deepEqual((DICTS.fr[k].match(/\{\w+\}/g) ?? []).sort(), (DICTS.en[k].match(/\{\w+\}/g) ?? []).sort(), k);
  assert.equal(format('Bonjour, {name}', { name: 'Awa' }), 'Bonjour, Awa');
});

test('Keycloak-style token (no OpesFuel claims): identity from the backend decides role, company and stations', () => {
  const kc = jwt({ sub: 'kc|1', exp: 2000000000, email: 'awa@x.cm', name: 'Awa Ngo' });
  assert.deepEqual(sessionFromTokens(kc, null, 1), { ok: false, reason: 'UNSUPPORTED_ROLE' }); // nothing in the token, no lookup yet
  const r = sessionFromTokens(kc, null, 1, { roles: ['attendant'], tenantId: 'ten_x', stationIds: ['st_1'] });
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.session.role, 'ATTENDANT'); assert.equal(r.session.tenantId, 'ten_x'); assert.deepEqual(r.session.stationIds, ['st_1']); assert.equal(r.session.email, 'awa@x.cm'); }
  // a backend answer that is only a platform role is still refused for the mobile app
  assert.deepEqual(sessionFromTokens(kc, null, 1, { roles: ['PLATFORM_ADMIN'] }), { ok: false, reason: 'UNSUPPORTED_ROLE' });
  // claims in the token (Auth0) win over a lookup
  const auth0 = jwt({ sub: 'a|1', exp: 2000000000, [NS + 'roles']: ['MANAGER'] });
  const m = sessionFromTokens(auth0, null, 1, { roles: ['ATTENDANT'] });
  assert.ok(m.ok && m.session.role === 'MANAGER');
});
