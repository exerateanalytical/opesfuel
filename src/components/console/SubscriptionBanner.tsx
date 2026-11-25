import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { UserRole } from '../../domain/types';

interface SubscriptionStatus {
  tenantStatus: string;
  billingStatus: string;
  trialActive: boolean;
  trialDaysRemaining: number;
  readOnly: boolean;
}

/**
 * Tells the customer where they stand: days left in the free trial, or that the workspace is read-only until they
 * subscribe (the server enforces this: edits return HTTP 402). Hidden for the platform admin and for non-live sessions.
 */
export const SubscriptionBanner: React.FC<{ accessToken: string | null | undefined; role: UserRole; onOpenBilling: () => void }> = ({ accessToken, role, onOpenBilling }) => {
  const { lang } = useLanguage();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    const base = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '');
    if (!base || !accessToken || role === 'PLATFORM_ADMIN') return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${base}/api/v1/billing/subscription-status`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (res.ok && !cancelled) setStatus((await res.json()) as SubscriptionStatus);
      } catch { /* banner is optional: never block the console */ }
    };
    void load();
    const timer = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [accessToken, role]);

  if (!status) return null;
  const fr = lang === 'fr';
  const canPay = role === 'OWNER' || role === 'ACCOUNTANT';

  let tone: 'red' | 'amber' | null = null;
  let text = '';
  if (status.tenantStatus === 'SUSPENDED') {
    tone = 'red';
    text = fr ? 'Cet espace est suspendu. Contactez le support OpesFuel ou régularisez votre abonnement.' : 'This workspace is suspended. Contact OpesFuel support or settle your subscription.';
  } else if (status.readOnly) {
    tone = 'red';
    text = fr
      ? 'Votre essai ou abonnement est terminé : l’espace est en lecture seule. Vos données sont conservées. Abonnez-vous pour modifier à nouveau.'
      : 'Your trial or subscription has ended: the workspace is read-only. Your data is safe. Subscribe to edit again.';
  } else if (status.trialActive && status.trialDaysRemaining <= 7) {
    tone = 'amber';
    const d = status.trialDaysRemaining;
    text = fr
      ? `Essai gratuit : ${d <= 0 ? 'se termine aujourd’hui' : `${d} jour${d > 1 ? 's' : ''} restant${d > 1 ? 's' : ''}`}. Abonnez-vous pour continuer sans interruption.`
      : `Free trial: ${d <= 0 ? 'ends today' : `${d} day${d > 1 ? 's' : ''} left`}. Subscribe to continue without interruption.`;
  }
  if (!tone) return null;

  const cls = tone === 'red' ? 'border-red-300 border-l-red-600 text-red-900 bg-red-50' : 'border-amber-300 border-l-amber-500 text-amber-900 bg-amber-50';
  return (
    <div role="status" className={`px-4 py-3 rounded-lg border border-l-4 flex flex-wrap items-center justify-between gap-3 text-sm no-print ${cls}`}>
      <span className="font-medium">{text}</span>
      {canPay ? (
        <button type="button" onClick={onOpenBilling} className="shrink-0 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold">
          {fr ? 'Voir l’abonnement' : 'View subscription'}
        </button>
      ) : null}
    </div>
  );
};
