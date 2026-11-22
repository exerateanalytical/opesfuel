import React, { useState } from 'react';
import { Check, Code2, Monitor, Server, ShieldCheck, Smartphone } from 'lucide-react';
import { useCurrency } from '../../i18n/CurrencyContext';
import enterpriseImgUrl from '../../assets/images/opesfuel_team_operations_black_1795293395675.jpg';

interface LicensingViewProps {
  onOpenConsole: () => void;
  onLeadSubmitted?: (lead: {
    referenceId: string;
    fullName: string;
    stationName: string;
    email: string;
    phone: string;
    pumpCount: number;
    selectedPlan: string;
  }) => void;
}

const ENTERPRISE_IMG = enterpriseImgUrl;

const DELIVERABLES = [
  'Web Operations & Accounting Portal (TypeScript + React)',
  'Mobile Apps for Android & iPhone (Offline-Capable)',
  'Desktop Forecourt & Back-Office App (Windows / macOS / Linux)',
  'Java 25 Spring Boot Modular Monolith + PostgreSQL 17 Source',
  'Full Intellectual Property (IP) & White-Label Assignment',
];

export const LicensingView: React.FC<LicensingViewProps> = ({ onOpenConsole, onLeadSubmitted }) => {
  const { currency, formatFromXaf, formatUsdFromXaf } = useCurrency();
  const [imgFailed, setImgFailed] = useState(false);
  const [licenseTrack, setLicenseTrack] = useState<'PERPETUAL_5M' | 'CUSTOM_IP_BUYOUT' | 'HYBRID'>('PERPETUAL_5M');
  const [selectedDeliverables, setSelectedDeliverables] = useState<string[]>([
    DELIVERABLES[0],
    DELIVERABLES[1],
    DELIVERABLES[2],
    DELIVERABLES[3],
  ]);
  const [form, setForm] = useState({
    fullName: '',
    organization: '',
    email: '',
    phone: '',
    stationCount: '5',
    targetBudget: 'Negotiable (Web + Mobile + Desktop IP)',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  const scrollToProposal = (track?: 'PERPETUAL_5M' | 'CUSTOM_IP_BUYOUT' | 'HYBRID') => {
    if (track) setLicenseTrack(track);
    document.getElementById('license-proposal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleDeliverable = (item: string) => {
    setSelectedDeliverables((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.fullName.trim() || !form.organization.trim()) {
      setError('Please enter your full name and company or station group name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Please enter a valid corporate email address.');
      return;
    }
    if (form.phone.trim().length < 7) {
      setError('Please provide a valid direct phone number.');
      return;
    }

    setSubmitting(true);
    let refId = `LIC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const selectedPlan =
      licenseTrack === 'PERPETUAL_5M'
        ? 'Perpetual Managed License (5 000 000 FCFA/year)'
        : licenseTrack === 'CUSTOM_IP_BUYOUT'
        ? `Custom Source Code & IP Buyout [${selectedDeliverables.join(', ')}]`
        : 'Hybrid Perpetual + Custom IP Transition';
    const payload = {
      fullName: form.fullName.trim(),
      stationName: form.organization.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      pumpCount: (Number(form.stationCount) || 1) * 6,
      selectedPlan,
    };

    try {
      if (apiBase) {
        const res = await fetch(`${apiBase}/api/v1/public/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(
            res.status === 429
              ? 'Too many requests from this network. Please wait a minute and try again.'
              : `Unable to submit licensing proposal (${res.status}): ${errText.slice(0, 140)}`
          );
        }
        const data = (await res.json()) as { referenceId?: string };
        if (data.referenceId) refId = data.referenceId;
      }
      onLeadSubmitted?.({ referenceId: refId, ...payload });
      setReceipt(refId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit licensing request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      {/* Hero Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
          <div className="text-sm font-medium text-amber-700">
            Enterprise Sovereignty · Perpetual Deployment &amp; Source Code IP
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Deploy your own perpetual OpesFuel license—or own the entire source code &amp; IP.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Built for regional fuel marketers, oil distribution networks, and sovereign technology buyers
            who want private infrastructure control at 5 000 000 FCFA/year or a custom-built Web, Mobile,
            and Desktop platform with full intellectual property ownership.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={() => scrollToProposal()}
              className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Request License or IP Quote
            </button>
            <button
              type="button"
              onClick={onOpenConsole}
              className="px-5 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Sign In to Station Portal
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 min-h-[300px]">
          {!imgFailed ? (
            <img
              src={ENTERPRISE_IMG}
              alt="OpesFuel software running across Desktop, Web Laptop, and Mobile Phone"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full lg:h-[400px] object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-slate-200">
              <Server className="w-10 h-10 text-amber-500 mb-3" />
              <span className="font-display font-semibold text-base">
                OpesFuel Web · Mobile · Desktop Enterprise Suite
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Two Dedicated Ownership & Licensing Models */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Perpetual License at 5M FCFA / Year */}
        <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono font-semibold text-amber-700">Self-Hosted Dedicated Instance</span>
              <span>Unlimited Stations</span>
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Perpetual Deployment License
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Deploy OpesFuel inside your own private cloud or data center with full annual
                engineering management, security hardening, and maintenance included.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="font-mono tabular-nums text-3xl font-bold text-slate-900">
                {formatFromXaf(5000000)}
                <span className="text-sm font-sans font-normal text-slate-500"> / year</span>
              </div>
              {currency !== 'USD' && (
                <div className="font-mono text-xs font-semibold text-amber-700 mt-1">
                  ≈ {formatUsdFromXaf(5000000)} USD / year
                </div>
              )}
              <div className="text-xs text-slate-500 mt-1">
                All-inclusive management, security updates, database backups &amp; 24/7 SLA maintenance
              </div>
            </div>

            <ul className="space-y-3 text-sm text-slate-700">
              {[
                'Perpetual usage rights on dedicated PostgreSQL 17 + Java 25 Spring Boot nodes',
                'Full DevOps server management, TLS rotation & automated disaster recovery backups',
                'Continuous security patching, Auth0/RBAC audits & CVE vulnerability remediation',
                'Annual regulatory tax/VAT upgrades, Android/iPhone mobile releases & zero per-pump seat fees',
                'Complete data ownership inside your organization’s sovereign infrastructure',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => scrollToProposal('PERPETUAL_5M')}
            className="w-full py-3 px-4 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-semibold text-center transition-colors"
          >
            Select {formatFromXaf(5000000)}/Year Perpetual License
          </button>
        </div>

        {/* Custom-Built Dedicated System + Full Source Code & IP Buyout */}
        <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-8 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono font-semibold text-amber-400">Bespoke Engineering &amp; IP Buyout</span>
              <span>Negotiated Contract</span>
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                Custom Development &amp; Source Code IP License
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                Commission a custom-engineered version tailored to your brand, pump hardware, and
                ERP—with full source code delivery and intellectual property ownership across Web,
                Mobile, and Desktop.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <div className="font-display text-3xl font-bold text-amber-400">
                Negotiated Price
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Structured fixed-bid or milestone acquisition including full IP transfer agreement
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="border border-slate-700 rounded-lg p-3 space-y-1">
                <Code2 className="w-4 h-4 text-amber-400" />
                <div className="font-semibold text-white">Web + Backend</div>
                <div className="text-slate-400">TypeScript, Java 25 Spring Boot &amp; OpenAPI 3.1</div>
              </div>
              <div className="border border-slate-700 rounded-lg p-3 space-y-1">
                <Smartphone className="w-4 h-4 text-amber-400" />
                <div className="font-semibold text-white">Android &amp; iPhone</div>
                <div className="text-slate-400">Branded iOS &amp; Android apps under your store account</div>
              </div>
              <div className="border border-slate-700 rounded-lg p-3 space-y-1">
                <Monitor className="w-4 h-4 text-amber-400" />
                <div className="font-semibold text-white">Desktop App</div>
                <div className="text-slate-400">Offline-first Windows, macOS &amp; Linux terminal build</div>
              </div>
            </div>

            <ul className="space-y-3 text-sm text-slate-200">
              {[
                '100% full source code handover across Web, Mobile, Desktop & Java Spring Boot backend',
                'Written Intellectual Property (IP) ownership & commercial white-label rights',
                'Custom hardware ATG tank probe, pump controller & local ERP connectors built to spec',
                'Dedicated engineering knowledge transfer + optional post-handover SLA',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => scrollToProposal('CUSTOM_IP_BUYOUT')}
            className="w-full py-3 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold text-center transition-colors"
          >
            Negotiate Custom Build &amp; Source Code IP
          </button>
        </div>
      </div>

      {/* Proposal & Commercial Negotiation Intake Form */}
      <div id="license-proposal" className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 space-y-6">
        <div className="max-w-2xl space-y-2">
          <div className="text-sm font-medium text-amber-700">Direct Licensing &amp; IP Desk</div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Request Perpetual Deployment or Negotiate Source Code Ownership
          </h2>
          <p className="text-sm text-slate-600">
            Select your preferred licensing structure and deliverables. Our engineering directors at{' '}
            <span className="font-medium text-slate-900">info@opesware.com</span> respond with a formal
            commercial term sheet within 24 hours.
          </p>
        </div>

        {receipt ? (
          <div className="border border-emerald-300 bg-white rounded-xl p-7 space-y-4">
            <div className="text-sm font-semibold text-emerald-700">Enterprise Proposal Registered</div>
            <h3 className="font-display text-2xl font-bold text-slate-900">Reference {receipt}</h3>
            <p className="text-sm text-slate-700">
              Thank you, {form.fullName} ({form.organization}). Your licensing request for{' '}
              <span className="font-semibold">
                {licenseTrack === 'PERPETUAL_5M'
                  ? 'Perpetual Managed License (5 000 000 FCFA/year)'
                  : licenseTrack === 'CUSTOM_IP_BUYOUT'
                  ? 'Custom Development & Full Source Code IP'
                  : 'Hybrid Perpetual + Custom IP Transition'}
              </span>{' '}
              has been logged.
            </p>
            <button
              type="button"
              onClick={() => setReceipt(null)}
              className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800"
            >
              Submit Another Proposal
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(
                [
                  {
                    id: 'PERPETUAL_5M',
                    title: 'Perpetual License (5M/yr)',
                    desc: '5 000 000 FCFA/yr · Managed, secured & maintained',
                  },
                  {
                    id: 'CUSTOM_IP_BUYOUT',
                    title: 'Custom Build & Full IP',
                    desc: 'Negotiated price · Own Web, Mobile & Desktop code',
                  },
                  {
                    id: 'HYBRID',
                    title: 'Deploy Now + Custom Transition',
                    desc: 'Launch immediately while bespoke IP modules are built',
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLicenseTrack(opt.id)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    licenseTrack === opt.id
                      ? 'border-amber-600 bg-white'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-display font-bold text-sm text-slate-900">{opt.title}</div>
                  <div className="text-xs text-slate-600 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">Target Platform &amp; IP Scope</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {DELIVERABLES.map((item) => {
                  const checked = selectedDeliverables.includes(item);
                  return (
                    <label
                      key={item}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'border-slate-900 bg-slate-50 font-medium text-slate-900'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDeliverable(item)}
                        className="mt-0.5 accent-amber-600"
                      />
                      <span>{item}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Executive Contact Name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Jean-Paul Mbarga"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization / Fuel Network</label>
                <input
                  type="text"
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  placeholder="Opes Energy Distribution SA"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="director@company.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Direct Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+237 677 00 00 00"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stations in Network</label>
                <input
                  type="number"
                  min={1}
                  value={form.stationCount}
                  onChange={(e) => setForm({ ...form, stationCount: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Commercial Budget / Terms</label>
                <input
                  type="text"
                  value={form.targetBudget}
                  onChange={(e) => setForm({ ...form, targetBudget: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deployment &amp; Custom Development Requirements
              </label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Describe on-premise hosting preferences, white-label branding, desktop POS terminal specs, or ERP integration targets..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {submitting ? 'Submitting Proposal…' : 'Submit Licensing & IP Proposal'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
