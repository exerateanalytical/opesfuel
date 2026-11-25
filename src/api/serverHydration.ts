import type { EnterpriseModulesDataset } from './enterpriseModulesData';
import type { ExtendedOperationsBundle } from './demoDataset1000';

/** Server rows come back as snake_case database columns in some modules and camelCase in others; normalise both. */
const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

export function camelRow<T = Record<string, unknown>>(row: unknown): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries((row ?? {}) as Record<string, unknown>)) {
    out[camel(k)] = v === null ? (undefined as unknown) : v;
  }
  return out as T;
}

const rows = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? x.map((r) => camelRow(r)) : []);
const iso = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return new Date(v).toISOString();
  return '';
};

export type FetchJson = (path: string) => Promise<unknown>;
export interface PumpRef { id: string; code?: string; name?: string }

type ExtPatch = Partial<Pick<ExtendedOperationsBundle, 'hrContracts' | 'hrLeaves' | 'hrCerts' | 'hrDisciplinary' | 'calibrations' | 'maintenance' | 'vaultEntries'>>;
type EntPatch = Partial<EnterpriseModulesDataset>;

/**
 * Pull every enterprise list from the server. Each list is independent: one that fails (for example the role may not read it)
 * simply stays empty instead of blocking the others.
 */
export async function fetchServerLists(get: FetchJson, pumps: PumpRef[]): Promise<{ ext: ExtPatch; ent: EntPatch; failed: string[] }> {
  const ext: Record<string, unknown> = {};
  const ent: Record<string, unknown> = {};
  const failed: string[] = [];
  const pumpCode = (id: unknown) => {
    const p = pumps.find((x) => x.id === id);
    return p?.code ?? p?.name ?? String(id ?? '');
  };

  const jobs: Array<[string, () => Promise<void>]> = [
    ['hr/contracts', async () => { ext.hrContracts = rows(await get('/hr/contracts')); }],
    ['hr/leaves', async () => { ext.hrLeaves = rows(await get('/hr/leaves')); }],
    ['hr/certifications', async () => { ext.hrCerts = rows(await get('/hr/certifications')); }],
    ['hr/disciplinary', async () => { ext.hrDisciplinary = rows(await get('/hr/disciplinary')); }],
    ['vault', async () => {
      const r = (await get('/accounting/vault')) as { entries?: unknown } | null;
      ext.vaultEntries = rows(r?.entries);
    }],
    ['calibrations', async () => {
      ext.calibrations = rows(await get('/forecourt/calibrations')).map((c) => ({ ...c, pumpCode: pumpCode(c.pumpId), testedAt: iso(c.testedAt) }));
    }],
    ['maintenance', async () => {
      ext.maintenance = rows(await get('/forecourt/maintenance')).map((m) => ({ ...m, pumpCode: pumpCode(m.pumpId), loggedAt: iso(m.loggedAt) }));
    }],
    ['hse', async () => { ent.hseRecords = rows(await get('/enterprise/hse-records')).map((r) => ({ ...r, recordedAt: iso(r.recordedAt) })); }],
    ['fraud', async () => { ent.fraudCases = rows(await get('/enterprise/fraud-cases')).map((r) => ({ ...r, openedAt: iso(r.openedAt) })); }],
    ['quality', async () => { ent.qualitySamples = rows(await get('/enterprise/quality-samples')).map((r) => ({ ...r, testedAt: iso(r.testedAt) })); }],
    ['transfers', async () => { ent.transfers = rows(await get('/enterprise/transfers')).map((r) => ({ ...r, dispatchedAt: iso(r.dispatchedAt), receivedLitres: r.receivedLitres ?? null })); }],
    ['service-bay', async () => { ent.serviceBayTickets = rows(await get('/enterprise/service-bay')).map((r) => ({ ...r, createdAt: iso(r.createdAt) })); }],
    ['vouchers', async () => { ent.loyaltyVouchers = rows(await get('/enterprise/loyalty-vouchers')).map((r) => ({ ...r, issuedAt: iso(r.issuedAt) })); }],
    ['bulk-orders', async () => { ent.bulkOrders = rows(await get('/enterprise/bulk-orders')).map((r) => ({ ...r, createdAt: iso(r.createdAt) })); }],
    ['fixed-assets', async () => { ent.fixedAssets = rows(await get('/enterprise/fixed-assets')); }],
    ['budgets', async () => { ent.budgets = rows(await get('/enterprise/budgets')); }],
    ['approvals', async () => { ent.approvals = rows(await get('/enterprise/approvals')).map((r) => ({ ...r, createdAt: iso(r.createdAt) })); }],
    ['ev-utility', async () => { ent.evUtility = rows(await get('/enterprise/ev-utility')).map((r) => ({ ...r, recordedAt: iso(r.recordedAt) })); }],
    ['franchises', async () => { ent.franchises = rows(await get('/enterprise/franchises')); }],
  ];
  await Promise.all(jobs.map(async ([name, run]) => { try { await run(); } catch { failed.push(name); } }));
  return { ext: ext as ExtPatch, ent: ent as EntPatch, failed };
}
