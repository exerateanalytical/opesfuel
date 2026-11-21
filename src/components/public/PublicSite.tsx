import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  Database,
  Fuel,
  ShieldCheck,
  Smartphone,
  Truck,
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../../api/opesfuelClient';
import { formatFcfa } from '../../domain/formatters';
import {
  AiSubscriptionState,
  Employee,
  FinancialReportBundle,
  FleetAccount,
  FuelTank,
  PublicPage,
  Pump,
  ShiftRecord,
  ShopItem,
  Station,
} from '../../domain/types';
import { LicensingView } from './LicensingView';
import { MobileAppShowcase } from '../mobile/MobileAppShowcase';

interface PublicSiteProps {
  page: PublicPage;
  stations: Station[];
  pumps: Pump[];
  tanks: FuelTank[];
  shifts: ShiftRecord[];
  employees: Employee[];
  fleetAccounts: FleetAccount[];
  shopItems: ShopItem[];
  aiSubscription: AiSubscriptionState;
  report: FinancialReportBundle;
  onNavigate: (page: PublicPage) => void;
  onOpenConsole: () => void;
}

const HERO_IMG = '/src/assets/images/opesfuel_hero_forecourt_black_1795293395675.jpg';
const MOBILE_IMG = '/src/assets/images/opesfuel_mobile_companion_black_1795293395662.jpg';
const DEPOT_IMG = '/src/assets/images/opesfuel_depot_telemetry_1795292393601.jpg';

const ResilientImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  fallbackTitle: string;
}> = ({ src, alt, className = '', fallbackTitle }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-slate-200 p-8 ${className}`}
      >
        <Fuel className="w-10 h-10 text-amber-500 mb-3" />
        <span className="font-display font-semibold text-base text-center">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

export const PublicSite: React.FC<PublicSiteProps> = ({
  page,
  stations,
  pumps,
  tanks,
  shifts,
  employees,
  fleetAccounts,
  shopItems,
  aiSubscription,
  report,
  onNavigate,
  onOpenConsole,
}) => {
  // Pricing interactive state
  const [annualBilling, setAnnualBilling] = useState(false);
  const [calcStations, setCalcStations] = useState(1);
  const [calcPumps, setCalcPumps] = useState(6);

  // Contact form state
  const [leadForm, setLeadForm] = useState({
    fullName: '',
    stationName: '',
    email: '',
    phone: '',
    pumpCount: '6',
    selectedPlan: 'Starter Station (25 000 FCFA/mo)',
  });
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadReceipt, setLeadReceipt] = useState<string | null>(null);

  const recommendedPlan =
    calcStations > 2 || calcPumps > 18
      ? SUBSCRIPTION_PLANS[2]
      : calcPumps > 6
      ? SUBSCRIPTION_PLANS[1]
      : SUBSCRIPTION_PLANS[0];

  const baseMonthlyFcfa = recommendedPlan.monthlyPriceFcfa * calcStations;
  const effectiveMonthlyFcfa = annualBilling ? Math.round(baseMonthlyFcfa * 0.85) : baseMonthlyFcfa;

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError(null);
    if (!leadForm.fullName.trim() || !leadForm.stationName.trim()) {
      setLeadError('Please provide your full name and petrol station name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadForm.email.trim())) {
      setLeadError('Please enter a valid work email address.');
      return;
    }
    if (leadForm.phone.trim().length < 7) {
      setLeadError('Please enter a valid telephone number.');
      return;
    }

    let refId = `LEAD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    if (apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/v1/public/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: leadForm.fullName.trim(),
            stationName: leadForm.stationName.trim(),
            email: leadForm.email.trim(),
            phone: leadForm.phone.trim(),
            pumpCount: Number(leadForm.pumpCount) || 6,
            selectedPlan: leadForm.selectedPlan,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { referenceId?: string };
          if (data.referenceId) {
            refId = data.referenceId;
          }
        }
      } catch {
        // Fallback to local receipt reference when remote Spring Boot server is unreachable
      }
    }
    setLeadReceipt(refId);
  };

  if (page === 'platform') {
    const modules = [
      {
        num: '01',
        title: 'Forecourt Pumps & Shift Reconciliation',
        desc: 'Track mechanical and electronic totalizers across Super, Gasoil, and Kerosene nozzles. Compute expected FCFA against Cash, Orange Money, MTN MoMo, Card, and Fleet vouchers in seconds.',
        meta: 'Forecourt Context · ShiftClosedEvent',
      },
      {
        num: '02',
        title: 'Underground Tank Inventory & Tanker Receiving',
        desc: 'Monitor book stock vs. physical morning and evening dipsticks. Compare supplier bill-of-lading volumes against actual tanker receipts and catch evaporation or leakage early.',
        meta: 'Inventory Context · DipstickVarianceFlaggedEvent',
      },
      {
        num: '03',
        title: 'Corporate Fleet Credit & Lubricants POS',
        desc: 'Issue postpaid fuel vouchers by vehicle plate and driver, enforce FCFA credit limits, settle corporate Accounts Receivable, and ring up lubricants and LPG cylinders.',
        meta: 'Fleet & Shop Context · FleetAccountSettledEvent',
      },
      {
        num: '04',
        title: 'Employee Roster, Attendance & Payroll Variance',
        desc: 'Assign attendants to pump islands, track shift clock-in/clock-out times, and maintain an auditable employee variance ledger tied directly to monthly FCFA payroll.',
        meta: 'Workforce Context · Auth0 RBAC',
      },
      {
        num: '05',
        title: 'Automated Double-Entry Accounting & Treasury',
        desc: 'Every closed shift, fuel delivery, safe-to-bank deposit, and station expense posts balanced Debit/Credit lines automatically—generating P&L, Balance Sheet, Trial Balance, and VAT summaries.',
        meta: 'Accounting Context · SYSCOHADA & IFRS',
      },
      {
        num: '06',
        title: 'Mobile App (Android & iPhone) & OpenAPI Platform',
        desc: 'Equip attendants and station owners with an offline-resilient mobile app for Android and iPhone and expose every station workflow through versioned REST endpoints and HMAC webhooks.',
        meta: 'Mobile & API Context · OpenAPI 3.1',
      },
    ];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-medium text-amber-700">Platform Modules</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Seven bounded domains engineered for zero fuel or cash leakage.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Built on a Java 25 Spring Boot modular monolith and PostgreSQL, OpesFuel keeps physical
            forecourt operations and financial accounting locked in a single source of truth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((mod) => (
            <div
              key={mod.num}
              className="bg-white border border-slate-200 rounded-xl p-7 flex flex-col justify-between gap-5"
            >
              <div className="space-y-3">
                <div className="text-xs font-mono text-slate-500">{mod.meta}</div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  {mod.num}. {mod.title}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">{mod.desc}</p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={onOpenConsole}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800"
                >
                  Test module in live console <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (page === 'pricing') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="text-sm font-medium text-amber-700">Transparent FCFA Pricing</div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              Simple station pricing starting at 25 000 FCFA/month.
            </h1>
            <p className="text-base text-slate-600">
              Every plan includes PostgreSQL ledger backups, Auth0 role security, OpenAPI 3.1 access,
              and mobile sync for Android &amp; iPhone.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setAnnualBilling(false)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                !annualBilling ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setAnnualBilling(true)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                annualBilling ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual (-15%)
            </button>
          </div>
        </div>

        {/* Station Cost Estimator */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between text-sm font-medium text-slate-700 mb-2">
                <span>Number of Petrol Stations</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">{calcStations}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={calcStations}
                onChange={(e) => setCalcStations(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm font-medium text-slate-700 mb-2">
                <span>Total Dispensers / Pumps</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">{calcPumps} pumps</span>
              </div>
              <input
                type="range"
                min={2}
                max={32}
                step={2}
                value={calcPumps}
                onChange={(e) => setCalcPumps(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-lg p-5 flex flex-col justify-between gap-2">
            <div className="text-xs text-slate-400">
              Recommended Tier · {recommendedPlan.name}
            </div>
            <div className="font-mono tabular-nums text-2xl font-bold text-white">
              {formatFcfa(effectiveMonthlyFcfa)}
              <span className="text-sm font-sans font-normal text-slate-400"> / month</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="mt-2 w-full py-2.5 px-4 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
            >
              Request Onboarding
            </button>
          </div>
        </div>

        {/* Tier Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const displayPrice = annualBilling
              ? Math.round(plan.monthlyPriceFcfa * 0.85)
              : plan.monthlyPriceFcfa;
            return (
              <div
                key={plan.id}
                className={`rounded-xl p-7 flex flex-col justify-between border ${
                  plan.recommended
                    ? 'bg-white border-amber-600 ring-1 ring-amber-600'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-5">
                  <div>
                    <div className="text-xs font-medium text-slate-500">{plan.audience}</div>
                    <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">{plan.name}</h2>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="font-mono tabular-nums text-3xl font-bold text-slate-900">
                      {formatFcfa(displayPrice)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      per station / month {annualBilling ? '(billed annually)' : '(billed monthly)'}
                    </div>
                  </div>

                  <div className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                    <div>{plan.pumpLimit}</div>
                    <div className="text-slate-500">{plan.apiQuotaPerMonth}</div>
                  </div>

                  <ul className="space-y-2.5 text-sm text-slate-700">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-7">
                  <button
                    type="button"
                    onClick={() => {
                      setLeadForm((f) => ({
                        ...f,
                        selectedPlan: `${plan.name} (${formatFcfa(displayPrice)}/mo)`,
                      }));
                      onNavigate('contact');
                    }}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-semibold transition-colors ${
                      plan.recommended
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    Start with {plan.name}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise Perpetual & Source Code IP Cross-Link */}
        <div className="bg-slate-900 text-white rounded-xl p-7 sm:p-9 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-mono text-amber-400">
              Self-Hosted Perpetual License · Full Source Code &amp; IP Ownership
            </div>
            <h2 className="font-display text-2xl font-bold">
              Need a perpetual deployment at 5 000 000 FCFA/year or your own custom-developed IP?
            </h2>
            <p className="text-sm text-slate-300">
              Deploy OpesFuel on private infrastructure with managed security &amp; maintenance, or acquire
              dedicated Web, Mobile, and Desktop source code with negotiable full intellectual property ownership.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('licensing')}
            className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold whitespace-nowrap shrink-0"
          >
            Explore Perpetual &amp; IP Licensing
          </button>
        </div>
      </div>
    );
  }

  if (page === 'licensing') {
    return <LicensingView onOpenConsole={onOpenConsole} />;
  }

  if (page === 'mobile') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <MobileAppShowcase
          stations={stations}
          tanks={tanks}
          pumps={pumps}
          shifts={shifts}
          employees={employees}
          fleetAccounts={fleetAccounts}
          shopItems={shopItems}
          report={report}
          aiSubscription={aiSubscription}
          onOpenConsole={onOpenConsole}
        />

        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-3">
            <div className="text-xs font-mono font-semibold text-amber-700">Field-Proven Offline Resilience</div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Built for busy African forecourts and remote highway stations.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every mobile action for Android and iPhone connects directly to your OpesFuel Java 25 Spring Boot
              backend. When forecourt 4G/5G connectivity drops, the Sync Status header indicator immediately switches
              to Offline-Queued Mode and protects shift closures and dipsticks with UUID idempotency keys until
              automatic reconciliation.
            </p>
          </div>
          <div className="lg:col-span-6 rounded-xl overflow-hidden border border-slate-200">
            <ResilientImage
              src={MOBILE_IMG}
              alt="African station manager reviewing OpesFuel mobile analytics next to a fuel dispenser"
              fallbackTitle="OpesFuel Mobile App (Android & iPhone)"
              className="w-full h-[300px] object-cover"
            />
          </div>
        </div>
      </div>
    );
  }

  if (page === 'api') {
    const endpoints = [
      { method: 'POST', path: '/api/v1/forecourt/shifts/{id}/close', scope: 'forecourt:write', desc: 'Closes shift, deducts tank volume, emits ShiftClosedEvent, and posts balanced revenue + VAT + COGS journals.' },
      { method: 'POST', path: '/api/v1/inventory/deliveries', scope: 'inventory:write', desc: 'Records supplier tanker delivery against BoL volume and posts Inventory/AP ledger entry.' },
      { method: 'POST', path: '/api/v1/inventory/dipsticks', scope: 'inventory:write', desc: 'Logs physical tank dipstick reading and raises DipstickVarianceFlaggedEvent on shrinkage.' },
      { method: 'GET', path: '/api/v1/accounting/reports', scope: 'accounting:read', desc: 'CQRS read projection returning P&L, Trial Balance, Balance Sheet, and VAT payable in FCFA.' },
      { method: 'POST', path: '/api/v1/platform/webhooks', scope: 'platform:admin', desc: 'Subscribes external ERPs and fleet systems to signed HMAC domain events.' },
    ];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-medium text-amber-700">API-as-a-Product · OpenAPI 3.1</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Contract-first REST APIs backed by Java 25 Spring Boot &amp; PostgreSQL.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Every capability in OpesFuel is specified in <span className="font-mono text-slate-900">openapi/opesfuel-api.yaml</span> before
            implementation. Protected by Auth0 RS256 JWTs, scoped tenant API keys, and UUID
            idempotency keys.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-sm">Base URL: https://api.opesfuel.com/v1</span>
            <button
              type="button"
              onClick={onOpenConsole}
              className="px-3.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Try Live API Explorer in Console
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {endpoints.map((ep) => (
              <div key={ep.path} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-900">
                      {ep.method}
                    </span>
                    <span className="font-mono text-sm font-semibold text-slate-900">{ep.path}</span>
                  </div>
                  <p className="text-sm text-slate-600">{ep.desc}</p>
                </div>
                <div className="font-mono text-xs text-slate-500 shrink-0">Scope: {ep.scope}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (page === 'contact') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
        <div className="space-y-3">
          <div className="text-sm font-medium text-amber-700">Station Onboarding</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Schedule a live station walkthrough.
          </h1>
          <p className="text-base text-slate-600">
            Tell us about your petrol station pumps and accounting requirements. Onboarding starts at
            25 000 FCFA/month with zero hardware lock-in.
          </p>
        </div>

        {leadReceipt ? (
          <div className="bg-white border border-emerald-300 rounded-xl p-8 space-y-4">
            <div className="text-sm font-semibold text-emerald-700">Request Confirmed</div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Reference {leadReceipt}
            </h2>
            <p className="text-sm text-slate-600">
              Thank you, {leadForm.fullName}. Our engineering and onboarding team will reach out to{' '}
              <span className="font-medium text-slate-900">{leadForm.email}</span> regarding{' '}
              <span className="font-medium text-slate-900">{leadForm.stationName}</span>.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onOpenConsole}
                className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
              >
                Explore Live Console Now
              </button>
              <button
                type="button"
                onClick={() => setLeadReceipt(null)}
                className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
              >
                Submit Another Station
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLeadSubmit} className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
            {leadError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {leadError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={leadForm.fullName}
                  onChange={(e) => setLeadForm({ ...leadForm, fullName: e.target.value })}
                  placeholder="Jean-Paul Mbarga"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Station / Company Name</label>
                <input
                  type="text"
                  value={leadForm.stationName}
                  onChange={(e) => setLeadForm({ ...leadForm, stationName: e.target.value })}
                  placeholder="Station Plateau Energies"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Work Email</label>
                <input
                  type="email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  placeholder="director@station.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  placeholder="+237 677 00 00 00"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Pump Count</label>
                <input
                  type="number"
                  min={1}
                  value={leadForm.pumpCount}
                  onChange={(e) => setLeadForm({ ...leadForm, pumpCount: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Selected Plan</label>
                <select
                  value={leadForm.selectedPlan}
                  onChange={(e) => setLeadForm({ ...leadForm, selectedPlan: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                >
                  <option>Starter Station (25 000 FCFA/mo)</option>
                  <option>Multi-Pump Pro (55 000 FCFA/mo)</option>
                  <option>Network Enterprise (120 000 FCFA/mo)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
            >
              Submit Onboarding Request
            </button>
          </form>
        )}
      </div>
    );
  }

  if (page === 'legal') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <h1 className="font-display text-3xl font-bold text-slate-900">Terms of Service &amp; Data Privacy</h1>
        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="font-display text-lg font-bold text-slate-900">1. Tenant Financial Ledger Integrity</h2>
            <p>
              All station sales, tank deliveries, and double-entry accounting journals recorded in OpesFuel
              are stored in isolated tenant schemas in PostgreSQL using integer FCFA precision and immutable
              audit logs.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-display text-lg font-bold text-slate-900">2. Auth0 Identity &amp; Access Control</h2>
            <p>
              Station owners retain complete ownership over employee roles (`OWNER`, `MANAGER`, `ATTENDANT`,
              `ACCOUNTANT`), API keys, and webhook subscriptions. All API access requires signed Auth0 OIDC
              tokens or scoped tenant API keys.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-display text-lg font-bold text-slate-900">3. Subscription Billing</h2>
            <p>
              Subscriptions start at 25 000 FCFA per station per month and may be upgraded or exported in
              standard CSV/SYSCOHADA ledger formats at any time.
            </p>
          </section>
        </div>
      </div>
    );
  }

  // Default: Home Landing Page
  return (
    <div className="space-y-20 pb-20">
      {/* Hero Split */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="text-sm font-medium text-amber-700">
              Petrol Station Operations &amp; Accounting · Starting at 25 000 FCFA/month
            </div>
            <h1 className="font-display text-[clamp(2.25rem,4vw,3.75rem)] leading-[1.08] font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              Every litre metered. Every franc accounted for.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              OpesFuel unifies pump totalizers, underground tank dipsticks, employee shifts, corporate
              fleet credit, AI forecasting, and automated double-entry FCFA accounting—engineered on
              Java 25 Spring Boot, PostgreSQL, OpenAPI 3.1, TypeScript, and Mobile Apps for Android &amp; iPhone.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={onOpenConsole}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
              >
                Launch Operations Console <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pricing')}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors whitespace-nowrap"
              >
                View FCFA Pricing
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 min-h-[320px]">
            <ResilientImage
              src={HERO_IMG}
              alt="Modern OpesFuel petrol station forecourt canopy and digital fuel dispensers"
              fallbackTitle="OpesFuel Forecourt Platform"
              className="w-full h-full lg:h-[460px] object-cover"
            />
          </div>
        </div>

        {/* Full-width 4-column station proof strip directly below hero split */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs text-slate-500">Starter Subscription</div>
            <div className="font-mono tabular-nums text-xl font-bold text-slate-900 mt-1">25 000 FCFA/mo</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs text-slate-500">Ledger Precision</div>
            <div className="font-mono tabular-nums text-xl font-bold text-slate-900 mt-1">Integer FCFA</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs text-slate-500">Backend Engine</div>
            <div className="font-mono text-xl font-bold text-slate-900 mt-1">Java 25 · Spring Boot</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs text-slate-500">Field Companion</div>
            <div className="font-mono text-xl font-bold text-slate-900 mt-1">Android &amp; iPhone</div>
          </div>
        </div>
      </section>

      {/* Asymmetric Capability Bento */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="max-w-2xl space-y-2">
          <div className="text-sm font-medium text-amber-700">Core Architecture</div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Designed around forecourt reality and audit-grade accounting.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-7 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                <Fuel className="w-4 h-4 text-amber-600" />
                <span>Forecourt &amp; Accounting Event Loop</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-slate-900">
                01. One closed pump shift posts your entire day’s books automatically.
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                When an attendant submits a closing totalizer and cash/Orange Money/MoMo/fleet count,
                OpesFuel validates the arithmetic, deducts the exact litres from the linked underground
                tank, logs any employee cash variance, and emits a ShiftClosedEvent that writes balanced
                Revenue, VAT, and COGS journal lines to PostgreSQL.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-sm">
              <div>
                <div className="text-xs text-slate-500">Debit 1010 / 1020</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900">Cash + Mobile Money</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Credit 4010 / 2200</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900">Fuel Sales + VAT</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Debit 5010 / Credit 1200</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900">COGS &amp; Tank Asset</div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-7 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>Inventory &amp; Dipsticks</span>
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900">
                02. Tanker receipts &amp; shrinkage alerts.
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Reconcile supplier bill-of-lading litres against morning and evening dipstick readings.
                Flag underground leaks or delivery shortfalls immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('platform')}
              className="text-sm font-semibold text-amber-700 hover:text-amber-800 text-left"
            >
              Explore all 7 modules →
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-7 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <Smartphone className="w-4 h-4 text-amber-600" />
              <span>Mobile Apps · Android &amp; iPhone</span>
            </div>
            <h3 className="font-display text-xl font-bold text-slate-900">
              03. Offline-capable attendant &amp; owner app.
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Dedicated mobile apps for Android and iPhone with idempotency keys so shifts and dipsticks queue
              cleanly when forecourt cellular coverage drops.
            </p>
          </div>

          <div className="lg:col-span-2 bg-slate-900 text-white rounded-xl p-7 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                <Code2 className="w-4 h-4" />
                <span>API-as-a-Product · OpenAPI 3.1</span>
              </div>
              <h3 className="font-display text-2xl font-bold">
                04. Java 25 Spring Boot Modular Monolith + CQRS + Auth0.
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Connect fleet cards, ERPs, or custom BI dashboards via scoped API keys, Auth0 JWTs,
                and signed domain-event webhooks.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('api')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400 hover:text-amber-300"
              >
                Inspect OpenAPI 3.1 Specification →
              </button>
            </div>
            <div className="rounded-lg overflow-hidden border border-slate-700">
              <ResilientImage
                src={DEPOT_IMG}
                alt="Precision fuel depot pipes and mechanical flow meters"
                fallbackTitle="Fuel Depot Telemetry"
                className="w-full h-48 object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Conversion Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Auth0 RBAC Ready</span>
              <span aria-hidden="true">·</span>
              <Database className="w-4 h-4 text-amber-600" />
              <span>PostgreSQL ACID Ledger</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Ready to run a shift closure or inspect live financial statements?
            </h2>
            <p className="text-sm text-slate-600">
              Open the interactive console with instant role switching across Owner, Station Manager,
              Pump Attendant, and Accountant profiles.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenConsole}
              className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Open Interactive Console
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="px-5 py-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Book Station Demo
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
