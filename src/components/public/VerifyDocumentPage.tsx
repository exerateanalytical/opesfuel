import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileCheck2, Search, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { OpesFuelLogo } from '../brand/OpesFuelLogo';

interface VerifyDocumentPageProps {
  initialCode?: string | null;
  onBackHome: () => void;
}

interface VerificationResult {
  fingerprint: string;
  status: 'VALID' | 'REVOKED' | 'EXPIRED' | 'NOT_FOUND';
  verified: boolean;
  docType?: string;
  docSerial?: string;
  organizationName?: string;
  subjectName?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  checkedAt?: string;
}

const LOCAL_DOC_REGISTRY_KEY = 'opesfuel.issued_documents.v1';

export function cacheIssuedDocumentLocally(doc: {
  fingerprint: string;
  docType: string;
  docSerial?: string;
  organizationName: string;
  subjectName: string;
  issuedAt: string;
  expiresAt?: string | null;
}): void {
  try {
    const raw = localStorage.getItem(LOCAL_DOC_REGISTRY_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    map[doc.fingerprint.toUpperCase()] = { ...doc, revoked: false };
    localStorage.setItem(LOCAL_DOC_REGISTRY_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export const VerifyDocumentPage: React.FC<VerifyDocumentPageProps> = ({ initialCode, onBackHome }) => {
  const [code, setCode] = useState(initialCode || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/+$/, '');

  const runVerify = useCallback(
    async (rawCode: string) => {
      const fp = rawCode.trim().toUpperCase();
      if (!fp) return;
      setLoading(true);
      setError(null);
      try {
        if (apiBase) {
          const res = await fetch(`${apiBase}/api/v1/public/verify/${encodeURIComponent(fp)}`);
          if (res.status === 429) {
            throw new Error('Verification rate limit reached. Wait 60 seconds and try again.');
          }
          if (!res.ok) {
            throw new Error(`Verification service returned HTTP ${res.status}`);
          }
          const data = (await res.json()) as VerificationResult;
          setResult(data);
          return;
        }
        // Fallback when running static preview without backend URL: check local browser registry
        const raw = localStorage.getItem(LOCAL_DOC_REGISTRY_KEY);
        const map = raw ? (JSON.parse(raw) as Record<string, Record<string, unknown>>) : {};
        const hit = map[fp];
        if (!hit) {
          setResult({ fingerprint: fp, status: 'NOT_FOUND', verified: false, checkedAt: new Date().toISOString() });
        } else {
          const exp = hit.expiresAt ? new Date(String(hit.expiresAt)) : null;
          const isExpired = Boolean(exp && !Number.isNaN(exp.getTime()) && Date.now() > exp.getTime());
          const status = hit.revoked ? 'REVOKED' : isExpired ? 'EXPIRED' : 'VALID';
          setResult({
            fingerprint: fp,
            status,
            verified: status === 'VALID',
            docType: String(hit.docType || 'DOCUMENT'),
            docSerial: hit.docSerial ? String(hit.docSerial) : undefined,
            organizationName: String(hit.organizationName || 'OpesFuel'),
            subjectName: String(hit.subjectName || ''),
            issuedAt: String(hit.issuedAt || ''),
            expiresAt: hit.expiresAt ? String(hit.expiresAt) : null,
            checkedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to verify document fingerprint.');
      } finally {
        setLoading(false);
      }
    },
    [apiBase]
  );

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      void runVerify(initialCode);
    }
  }, [initialCode, runVerify]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    window.history.replaceState(null, '', `#/verify/${encodeURIComponent(code.trim().toUpperCase())}`);
    void runVerify(code);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between max-w-5xl w-full mx-auto">
        <OpesFuelLogo variant="dark" size="md" />
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to OpesFuel
        </button>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            Official Document Authenticity Registry
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-900">Verify OpesFuel License or Letterhead</h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Enter the security fingerprint printed under the QR seal on any OpesFuel license certificate, station compliance certificate, dealer authorization, or official company letterhead.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="OPF-XXXX-XXXX-XXXX-XXXX"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 bg-white font-mono text-sm uppercase focus:outline-none focus:border-amber-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? 'Checking…' : 'Verify Authenticity'}
          </button>
        </form>

        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs font-medium">
            {error}
          </div>
        )}

        {result && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <div
              className={`px-6 py-5 flex items-center gap-4 border-b ${
                result.status === 'VALID'
                  ? 'bg-emerald-50 border-emerald-200'
                  : result.status === 'REVOKED'
                  ? 'bg-red-50 border-red-200'
                  : result.status === 'EXPIRED'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              {result.status === 'VALID' ? (
                <CheckCircle2 className="w-9 h-9 text-emerald-600 shrink-0" />
              ) : result.status === 'REVOKED' ? (
                <XCircle className="w-9 h-9 text-red-600 shrink-0" />
              ) : result.status === 'EXPIRED' ? (
                <ShieldAlert className="w-9 h-9 text-amber-600 shrink-0" />
              ) : (
                <FileCheck2 className="w-9 h-9 text-slate-500 shrink-0" />
              )}
              <div>
                <div className="font-mono text-xs uppercase tracking-wider font-bold text-slate-600">
                  Verification Result
                </div>
                <div className="font-display text-xl font-bold text-slate-900">
                  {result.status === 'VALID'
                    ? 'AUTHENTIC & ACTIVE DOCUMENT'
                    : result.status === 'REVOKED'
                    ? 'DOCUMENT REVOKED — DO NOT ACCEPT'
                    : result.status === 'EXPIRED'
                    ? 'DOCUMENT EXPIRED'
                    : 'FINGERPRINT NOT FOUND IN REGISTRY'}
                </div>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">Security Fingerprint</div>
                <div className="font-mono font-bold text-slate-900">{result.fingerprint}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Status</div>
                <div className="font-mono font-bold text-slate-900">{result.status}</div>
              </div>
              {result.organizationName && (
                <div>
                  <div className="text-xs text-slate-500">Issuing Organization</div>
                  <div className="font-semibold text-slate-900">{result.organizationName}</div>
                </div>
              )}
              {result.subjectName && (
                <div>
                  <div className="text-xs text-slate-500">Holder / Subject</div>
                  <div className="font-semibold text-slate-900">{result.subjectName}</div>
                </div>
              )}
              {result.docType && (
                <div>
                  <div className="text-xs text-slate-500">Document Class</div>
                  <div className="font-mono text-xs text-slate-800">{result.docType}</div>
                </div>
              )}
              {result.docSerial && (
                <div>
                  <div className="text-xs text-slate-500">Serial / Reference No.</div>
                  <div className="font-mono text-xs text-slate-800">{result.docSerial}</div>
                </div>
              )}
              {result.issuedAt && (
                <div>
                  <div className="text-xs text-slate-500">Issued At</div>
                  <div className="font-mono text-xs text-slate-700">{result.issuedAt.slice(0, 19).replace('T', ' ')} UTC</div>
                </div>
              )}
              {result.expiresAt && (
                <div>
                  <div className="text-xs text-slate-500">Valid Until</div>
                  <div className="font-mono text-xs text-slate-700">{result.expiresAt.slice(0, 10)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
