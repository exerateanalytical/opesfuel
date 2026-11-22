import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Phone, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react';
import { FormModal } from '../shared/FormModal';
import { formatFcfa } from '../../domain/formatters';

interface MomoPaymentModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  amountFcfa: number;
  targetType: 'SAAS_INVOICE' | 'FLEET_BALANCE' | 'STATION_SALE';
  targetId: string;
  description?: string;
  authHeader?: Record<string, string>;
  endpointPath?: string;
  onSettled?: (tx: Record<string, unknown>) => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

function detectCameroonOperator(raw: string): { normalized: string | null; operator: 'MTN' | 'ORANGE' | 'UNKNOWN' } {
  const digits = raw.replace(/[^0-9]/g, '');
  let d = digits.startsWith('00237') ? digits.slice(2) : digits;
  if (d.length === 9) d = `237${d}`;
  if (d.length !== 12 || !d.startsWith('2376')) return { normalized: null, operator: 'UNKNOWN' };
  const local = d.slice(3);
  const p2 = Number(local.slice(0, 2));
  const p3 = Number(local.slice(0, 3));
  if (p2 === 67 || (p3 >= 650 && p3 <= 654) || (p3 >= 680 && p3 <= 684)) return { normalized: `+${d}`, operator: 'MTN' };
  if (p2 === 69 || (p3 >= 655 && p3 <= 659) || (p3 >= 686 && p3 <= 689)) return { normalized: `+${d}`, operator: 'ORANGE' };
  return { normalized: `+${d}`, operator: 'UNKNOWN' };
}

export const MomoPaymentModal: React.FC<MomoPaymentModalProps> = ({
  open,
  onClose,
  title,
  amountFcfa,
  targetType,
  targetId,
  description,
  authHeader,
  endpointPath = '/api/v1/payments/momo/initiate',
  onSettled,
  onNotify,
}) => {
  const [phone, setPhone] = useState('+237 6');
  const [providerOverride, setProviderOverride] = useState<'AUTO' | 'MTN_MOMO' | 'ORANGE_MONEY'>('AUTO');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tx, setTx] = useState<Record<string, unknown> | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const pollRef = useRef<number | null>(null);

  const detected = useMemo(() => detectCameroonOperator(phone), [phone]);
  const apiBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/+$/, '');

  useEffect(() => {
    if (!open) {
      if (pollRef.current) window.clearInterval(pollRef.current);
      setTx(null);
      setErrorMsg(null);
      setSubmitting(false);
      setSecondsLeft(300);
    }
  }, [open]);

  // Countdown + status polling while PENDING
  useEffect(() => {
    if (!tx || String(tx.status) !== 'PENDING' || !apiBase) return;
    const txId = String(tx.id || '');
    if (!txId) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    pollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/v1/payments/momo/${encodeURIComponent(txId)}/status`, {
          headers: { ...(authHeader ?? {}) },
        });
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, unknown>;
        setTx(data);
        if (String(data.status) === 'SUCCESSFUL') {
          if (pollRef.current) window.clearInterval(pollRef.current);
          onNotify?.('success', `Mobile Money payment confirmed (${formatFcfa(amountFcfa)}).`);
          onSettled?.(data);
        } else if (String(data.status) === 'FAILED' || String(data.status) === 'EXPIRED') {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setErrorMsg(String(data.failureReason || `Payment ${String(data.status).toLowerCase()}.`));
        }
      } catch {
        // transient network error while polling
      }
    }, 5000);

    return () => {
      window.clearInterval(timer);
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [tx, apiBase, authHeader, amountFcfa, onNotify, onSettled]);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!detected.normalized) {
      setErrorMsg('Enter a valid Cameroon mobile number (+237 6XX XX XX XX).');
      return;
    }
    const chosenProvider =
      providerOverride !== 'AUTO'
        ? providerOverride
        : detected.operator === 'MTN'
        ? 'MTN_MOMO'
        : detected.operator === 'ORANGE'
        ? 'ORANGE_MONEY'
        : null;
    if (!chosenProvider) {
      setErrorMsg('Unable to detect MTN or Orange from this prefix. Select an operator manually.');
      return;
    }

    if (!apiBase) {
      setErrorMsg(
        'Backend API URL (VITE_API_BASE_URL) is not configured in preview mode. Connect the Spring Boot API with MTN/Orange Cameroon credentials to initiate live Mobile Money requests.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const idemKey = `momo-${targetType}-${targetId}-${Date.now()}`;
      const res = await fetch(`${apiBase}${endpointPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
          ...(authHeader ?? {}),
        },
        body: JSON.stringify({
          provider: chosenProvider,
          phoneNumber: detected.normalized,
          amountFcfa,
          targetType,
          targetId,
          description: description || `${title} (${targetId})`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(String(data.detail || data.message || `Payment gateway error (HTTP ${res.status})`));
      }
      setTx(data);
      setSecondsLeft(300);
      onNotify?.('success', `Initiated ${chosenProvider.replace('_', ' ')} payment request.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to initiate Mobile Money payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualPoll = async () => {
    if (!tx?.id || !apiBase) return;
    try {
      const res = await fetch(`${apiBase}/api/v1/payments/momo/${encodeURIComponent(String(tx.id))}/status`, {
        headers: { ...(authHeader ?? {}) },
      });
      if (!res.ok) return;
      const data = (await res.json()) as Record<string, unknown>;
      setTx(data);
      if (String(data.status) === 'SUCCESSFUL') {
        onNotify?.('success', `Payment settled via ${String(data.provider)}.`);
        onSettled?.(data);
      }
    } catch {
      // ignore
    }
  };

  return (
    <FormModal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount Due (Cameroon XAF)</div>
            <div className="font-mono tabular-nums text-2xl font-bold text-slate-900">{formatFcfa(amountFcfa)}</div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Ref: <span className="font-mono font-semibold text-slate-800">{targetId}</span></div>
            <div className="text-[11px]">MTN MoMo · Orange Money CM</div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!tx ? (
          <form onSubmit={(e) => void handleInitiate(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Cameroon Mobile Money Number (+237)</span>
                {detected.operator === 'MTN' && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                    MTN MoMo Detected
                  </span>
                )}
                {detected.operator === 'ORANGE' && (
                  <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-900 font-bold text-[10px]">
                    Orange Money CM Detected
                  </span>
                )}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+237 677 11 22 33 or +237 699 44 55 66"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono focus:outline-none focus:border-amber-600"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                MTN prefixes: 67x, 650–654, 680–684 · Orange prefixes: 69x, 655–659, 686–689
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Payment Rail</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'AUTO', label: 'Auto-Detect' },
                    { id: 'MTN_MOMO', label: 'MTN MoMo' },
                    { id: 'ORANGE_MONEY', label: 'Orange Money' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setProviderOverride(opt.id)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      providerOverride === opt.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                Send Mobile Money Request
              </button>
            </div>
          </form>
        ) : String(tx.status) === 'SUCCESSFUL' ? (
          <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div className="font-display text-base font-bold text-emerald-950">Payment Confirmed</div>
            <div className="text-xs text-emerald-800 font-mono">
              Ref: {String(tx.referenceId)} · Provider Tx: {String(tx.providerTxId || 'SETTLED')}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-amber-600 animate-spin shrink-0" />
              <div>
                <div className="font-semibold text-sm text-slate-900">
                  {String(tx.provider) === 'MTN_MOMO'
                    ? 'Awaiting MTN MoMo PIN Confirmation on Phone'
                    : 'Complete Payment on Orange Money WebPay'}
                </div>
                <div className="text-xs text-slate-500">
                  {String(tx.provider) === 'MTN_MOMO'
                    ? `Dial *126# or approve the USSD prompt sent to ${String(tx.msisdn)}.`
                    : 'Click the button below to authorize with your Orange Money secret code.'}
                </div>
              </div>
            </div>

            {Boolean(tx.paymentUrl) && (
              <a
                href={String(tx.paymentUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
              >
                Open Orange Money WebPay Checkout <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span className="font-mono">
                Status: <strong className="text-slate-900">{String(tx.status)}</strong> · {Math.floor(secondsLeft / 60)}:
                {String(secondsLeft % 60).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => void handleManualPoll()}
                className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Check Status Now
              </button>
            </div>
          </div>
        )}
      </div>
    </FormModal>
  );
};
