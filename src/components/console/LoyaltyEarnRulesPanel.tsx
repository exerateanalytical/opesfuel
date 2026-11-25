import React, { useState } from 'react';
import { Award } from 'lucide-react';
import { useLiveApi, useLiveList } from '../../api/liveApi';
import type { UserRole } from '../../domain/types';

interface Rule { id: string; fuelGrade: string; pointsPerLitre: number; pointsPer1000Xaf: number; active: boolean }
const demo: Rule[] = [{ id: 'r1', fuelGrade: 'SUPER', pointsPerLitre: 1, pointsPer1000Xaf: 2, active: true }];
const fieldCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

/** How many loyalty points a customer earns per fuel grade. */
export const LoyaltyEarnRulesPanel: React.FC<{ role: UserRole; onNotify: (t: 'success' | 'error', m: string) => void }> = ({ role, onNotify }) => {
  const api = useLiveApi();
  const { items, loading, error, reload } = useLiveList<Record<string, unknown>, Rule>('/loyalty/rules', demo, (r) => ({
    id: String(r.id), fuelGrade: String(r.fuel_grade ?? r.fuelGrade ?? ''),
    pointsPerLitre: Number(r.points_per_litre ?? r.pointsPerLitre ?? 0), pointsPer1000Xaf: Number(r.points_per_1000_xaf ?? r.pointsPer1000Xaf ?? 0), active: Boolean(r.active),
  }));
  const canEdit = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN';
  const [grade, setGrade] = useState('SUPER');
  const [perL, setPerL] = useState('1');
  const [per1000, setPer1000] = useState('0');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api.live) { onNotify('error', 'Sign in to a real workspace to save rules.'); return; }
    try { await api.send('POST', '/loyalty/rules', { fuelGrade: grade, pointsPerLitre: Number(perL), pointsPer1000Xaf: Number(per1000) }); onNotify('success', 'Earning rule saved.'); await reload(); }
    catch (er) { onNotify('error', er instanceof Error ? er.message : 'Failed'); }
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2"><Award className="w-5 h-5" /> Loyalty earning rules</h3>
        <p className="text-xs text-slate-500">Points a customer earns per litre and per 1,000 FCFA spent, by fuel grade. Saving a grade again updates it.</p>
      </div>
      {canEdit && (
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-4 items-end rounded-xl border border-slate-200 p-4 bg-slate-50">
          <label className="text-xs font-semibold text-slate-600">Fuel grade<select className={fieldCls} value={grade} onChange={(e) => setGrade(e.target.value)}>{['SUPER', 'GASOIL', 'KEROSENE', 'LPG'].map((g) => <option key={g}>{g}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Points per litre<input className={fieldCls} type="number" step="0.1" min="0" value={perL} onChange={(e) => setPerL(e.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-600">Points per 1,000 FCFA<input className={fieldCls} type="number" step="0.1" min="0" value={per1000} onChange={(e) => setPer1000(e.target.value)} /></label>
          <button className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Save rule</button>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-900 text-white text-left"><tr><th className="px-4 py-3">Fuel</th><th className="px-4 py-3 text-right">Points / litre</th><th className="px-4 py-3 text-right">Points / 1,000 FCFA</th><th className="px-4 py-3">Active</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((r) => <tr key={r.id}><td className="px-4 py-3 font-semibold">{r.fuelGrade}</td><td className="px-4 py-3 text-right font-mono">{r.pointsPerLitre}</td><td className="px-4 py-3 text-right font-mono">{r.pointsPer1000Xaf}</td><td className="px-4 py-3">{r.active ? 'Yes' : 'No'}</td></tr>)}
            {items.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">{loading ? 'Loading...' : 'No rules yet. Customers earn points only once a rule exists.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
