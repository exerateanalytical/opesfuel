import React, { useEffect, useState } from 'react';
import { ArrowLeft, Award, Gift, Sparkles } from 'lucide-react';
import { OpesFuelLogo } from '../brand/OpesFuelLogo';
import { formatFcfa } from '../../domain/formatters';

interface PublicLoyaltyPassPageProps {
  passToken: string;
  onBackHome: () => void;
}

export const PublicLoyaltyPassPage: React.FC<PublicLoyaltyPassPageProps> = ({ passToken, onBackHome }) => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/+$/, '');
    if (!apiBase) {
      setData({
        passToken,
        memberName: 'OpesFuel Driver Member',
        pointsBalance: 420,
        lifetimePoints: 1650,
        redemptionValueFcfa: 4200,
        tier: 'GOLD',
        recentActivity: [
          { entry_type: 'EARN', points: 65, fuel_grade: 'SUPER', litres: 45, amount_xaf: 37800, created_at: new Date().toISOString() },
        ],
        activePromotions: [
          { name: 'Morning Happy Hour (06:00–09:00)', campaign_type: 'HAPPY_HOUR', discount_pct: 3, fuel_grade: 'SUPER' },
        ],
      });
      setLoading(false);
      return;
    }
    fetch(`${apiBase}/api/v1/public/loyalty/pass/${encodeURIComponent(passToken)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Loyalty pass not found.');
        setData((await res.json()) as Record<string, unknown>);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load loyalty pass.'))
      .finally(() => setLoading(false));
  }, [passToken]);

  const activity = Array.isArray(data?.recentActivity) ? (data.recentActivity as Array<Record<string, unknown>>) : [];
  const promos = Array.isArray(data?.activePromotions) ? (data.activePromotions as Array<Record<string, unknown>>) : [];

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between max-w-4xl w-full mx-auto">
        <OpesFuelLogo variant="dark" size="md" />
        <button type="button" onClick={onBackHome} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
      </header>
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10 space-y-6">
        {loading && <div className="text-center text-sm text-slate-500">Loading digital loyalty pass…</div>}
        {error && <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>}
        {data && (
          <>
            <div className="rounded-2xl bg-slate-900 text-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <Award className="w-4 h-4" /> {String(data.tier || 'BRONZE')} MEMBER PASS
                </div>
                <span className="font-mono text-xs text-slate-400">{String(data.passToken)}</span>
              </div>
              <div>
                <div className="text-sm text-slate-300">{String(data.memberName)}</div>
                <div className="font-mono text-4xl font-bold mt-1">{Number(data.pointsBalance || 0).toLocaleString()} pts</div>
                <div className="text-xs text-amber-300 mt-1">
                  Redeemable Fuel Value: {formatFcfa(Number(data.redemptionValueFcfa || 0))} · Lifetime {Number(data.lifetimePoints || 0).toLocaleString()} pts
                </div>
              </div>
            </div>

            {promos.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" /> Active Forecourt Promotions
                </div>
                {promos.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-900">{String(p.name)}</span>
                    <span className="font-mono font-bold text-amber-700">{String(p.discount_pct)}% OFF</span>
                  </div>
                ))}
              </div>
            )}

            <div className="border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Gift className="w-4 h-4 text-slate-900" /> Recent Fuel Points Activity
              </div>
              <div className="divide-y divide-slate-100">
                {activity.map((a, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{String(a.entry_type)}</span>
                      {Boolean(a.fuel_grade) && <span className="text-slate-500"> · {String(a.fuel_grade)} ({String(a.litres)} L)</span>}
                    </div>
                    <span className={`font-mono font-bold ${Number(a.points) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {Number(a.points) >= 0 ? '+' : ''}{String(a.points)} pts
                    </span>
                  </div>
                ))}
                {activity.length === 0 && <div className="text-xs text-slate-400 py-3">No transactions recorded yet.</div>}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
