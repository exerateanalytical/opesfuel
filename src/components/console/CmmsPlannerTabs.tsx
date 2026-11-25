import React, { useState } from 'react';
import { CalendarClock, PlayCircle } from 'lucide-react';
import { useLiveApi, useLiveList } from '../../api/liveApi';
import { formatFcfa } from '../../domain/formatters';

interface PmSchedule { id: string; assetName: string; title: string; intervalDays: number | null; nextDueDate: string; lastRunAt: string; active: boolean }
interface CostRow { assetName: string; workOrderCount: number; totalLaborFcfa: number; totalPartsFcfa: number; totalMaintenanceFcfa: number }

type Notify = (type: 'success' | 'error', message: string) => void;
const today = () => new Date().toISOString().slice(0, 10);
const fieldCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

const demoSchedules: PmSchedule[] = [
  { id: 'pm_demo1', assetName: 'Perkins 250kVA Standby Generator', title: '250-hour oil and filter service', intervalDays: 60, nextDueDate: today(), lastRunAt: '', active: true },
];
const demoCosts: CostRow[] = [
  { assetName: 'Perkins 250kVA Standby Generator', workOrderCount: 3, totalLaborFcfa: 135000, totalPartsFcfa: 204000, totalMaintenanceFcfa: 339000 },
];

/** Preventive-maintenance planner: recurring schedules that open work orders automatically when due. */
export const PmSchedulesTab: React.FC<{ stationId: string; canEdit: boolean; onNotify: Notify; onChanged: () => void }> = ({ stationId, canEdit, onNotify, onChanged }) => {
  const api = useLiveApi();
  const { items, reload, loading, error } = useLiveList<Record<string, unknown>, PmSchedule>('/cmms/pm-schedules', demoSchedules, (r) => ({
    id: String(r.id ?? ''), assetName: String(r.asset_name ?? r.assetName ?? ''), title: String(r.title ?? ''),
    intervalDays: (r.interval_days ?? r.intervalDays ?? null) as number | null,
    nextDueDate: String(r.next_due_date ?? r.nextDueDate ?? ''), lastRunAt: String(r.last_run_at ?? r.lastRunAt ?? ''),
    active: Boolean(r.active),
  }));
  const [asset, setAsset] = useState('');
  const [title, setTitle] = useState('');
  const [days, setDays] = useState('30');
  const [next, setNext] = useState(today());
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); onNotify('success', ok); await reload(); onChanged(); }
    catch (e) { onNotify('error', e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!api.live) { onNotify('error', 'Sign in to a real workspace to save schedules.'); return; }
    if (!stationId || stationId === 'ALL') { onNotify('error', 'Pick one station first.'); return; }
    if (!asset.trim() || !title.trim()) { onNotify('error', 'Enter the asset and the task.'); return; }
    void run(async () => {
      await api.send('POST', '/cmms/pm-schedules', { stationId, assetName: asset.trim(), title: title.trim(), intervalDays: Number(days) || 30, nextDueDate: next });
      setAsset(''); setTitle('');
    }, 'Maintenance schedule saved.');
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end rounded-xl border border-slate-200 p-4 bg-slate-50">
          <label className="text-xs font-semibold text-slate-600">Asset<input className={fieldCls} value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="Dispenser bay 2" /></label>
          <label className="text-xs font-semibold text-slate-600">Task<input className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Filter change" /></label>
          <label className="text-xs font-semibold text-slate-600">Repeat every (days)<input className={fieldCls} type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-600">First due<input className={fieldCls} type="date" value={next} onChange={(e) => setNext(e.target.value)} /></label>
          <button disabled={busy} className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-60">Add schedule</button>
        </form>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Work orders are opened automatically every night for schedules that are due.</p>
        {canEdit && (
          <button type="button" disabled={busy} onClick={() => void run(async () => {
            const r = await api.send<{ generatedWorkOrders?: number }>('POST', '/cmms/pm-schedules/generate-due');
            onNotify('success', `${r?.generatedWorkOrders ?? 0} work order(s) opened.`);
          }, 'Due schedules checked.')} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-60">
            <PlayCircle className="w-3.5 h-3.5" /> Open due work orders now
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-900 text-white text-left"><tr><th className="px-4 py-3">Asset</th><th className="px-4 py-3">Task</th><th className="px-4 py-3">Every</th><th className="px-4 py-3">Next due</th><th className="px-4 py-3">Last run</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{s.assetName}</td><td className="px-4 py-3">{s.title}</td>
                <td className="px-4 py-3 font-mono">{s.intervalDays ?? '-'} d</td><td className="px-4 py-3 font-mono">{s.nextDueDate.slice(0, 10)}</td>
                <td className="px-4 py-3 font-mono">{s.lastRunAt ? s.lastRunAt.slice(0, 10) : '-'}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">{loading ? 'Loading...' : 'No schedules yet. Add one above.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** What each asset has cost to keep running: labour plus spare parts, worst offenders first. */
export const CostRollupTab: React.FC = () => {
  const { items, loading, error } = useLiveList<Record<string, unknown>, CostRow>('/cmms/cost-rollup', demoCosts, (r) => ({
    assetName: String(r.asset_name ?? r.assetName ?? ''),
    workOrderCount: Number(r.work_order_count ?? r.workOrderCount ?? 0),
    totalLaborFcfa: Number(r.total_labor_fcfa ?? r.totalLaborFcfa ?? 0),
    totalPartsFcfa: Number(r.total_parts_fcfa ?? r.totalPartsFcfa ?? 0),
    totalMaintenanceFcfa: Number(r.total_maintenance_fcfa ?? r.totalMaintenanceFcfa ?? 0),
  }));
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 inline-flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Maintenance spend per asset across all stations.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-900 text-white text-left"><tr><th className="px-4 py-3">Asset</th><th className="px-4 py-3 text-right">Work orders</th><th className="px-4 py-3 text-right">Labour</th><th className="px-4 py-3 text-right">Parts</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((c) => (
              <tr key={c.assetName} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{c.assetName}</td><td className="px-4 py-3 text-right font-mono">{c.workOrderCount}</td>
                <td className="px-4 py-3 text-right font-mono">{formatFcfa(c.totalLaborFcfa)}</td><td className="px-4 py-3 text-right font-mono">{formatFcfa(c.totalPartsFcfa)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{formatFcfa(c.totalMaintenanceFcfa)}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">{loading ? 'Loading...' : 'No maintenance costs recorded yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
