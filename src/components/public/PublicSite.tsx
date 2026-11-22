import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Fuel,
  HelpCircle,
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
import heroImgUrl from '../../assets/images/opesfuel_hero_forecourt_black_1795293395675.jpg';
import mobileImgUrl from '../../assets/images/opesfuel_mobile_companion_black_1795293395662.jpg';
import depotImgUrl from '../../assets/images/opesfuel_depot_telemetry_1795292393601.jpg';
import { DocumentationPage } from './DocumentationPage';
import { FaqPage } from './FaqPage';
import { LicensingView } from './LicensingView';
import { PublicPagesExtra } from './PublicPagesExtra';
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

const HERO_IMG = heroImgUrl;
const MOBILE_IMG = mobileImgUrl;
const DEPOT_IMG = depotImgUrl;

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
  onLeadSubmitted,
}) => {
  // Interactive home page controls
  const [simLitres, setSimLitres] = useState(4200);
  const [activeRoleTab, setActiveRoleTab] = useState<'OWNER' | 'MANAGER' | 'ATTENDANT' | 'ACCOUNTANT'>('OWNER');

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
  const [leadSubmitting, setLeadSubmitting] = useState(false);
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

    setLeadSubmitting(true);
    let refId = `LEAD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const payload = {
      fullName: leadForm.fullName.trim(),
      stationName: leadForm.stationName.trim(),
      email: leadForm.email.trim(),
      phone: leadForm.phone.trim(),
      pumpCount: Number(leadForm.pumpCount) || 6,
      selectedPlan: leadForm.selectedPlan,
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
              : `Unable to submit request (${res.status}): ${errText.slice(0, 140)}`
          );
        }
        const data = (await res.json()) as { referenceId?: string };
        if (data.referenceId) {
          refId = data.referenceId;
        }
      }
      onLeadSubmitted?.({ referenceId: refId, ...payload });
      setLeadReceipt(refId);
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : 'Unable to submit onboarding request.');
    } finally {
      setLeadSubmitting(false);
    }
  };

  // Dedicated Documentation & FAQ Pages
  if (page === 'docs') {
    return <DocumentationPage onNavigate={onNavigate} onOpenConsole={onOpenConsole} />;
  }

  if (page === 'faq') {
    return <FaqPage onNavigate={onNavigate} onOpenConsole={onOpenConsole} />;
  }

  // Additional Public Pages
  if (
    page === 'solutions' ||
    page === 'integrations' ||
    page === 'security' ||
    page === 'customers' ||
    page === 'about' ||
    page === 'resources' ||
    page === 'status'
  ) {
    return (
      <PublicPagesExtra
        page={page}
        onNavigate={onNavigate}
        onOpenConsole={onOpenConsole}
      />
    );
  }

  // Station Management Features Page (Plain Station-Owner Language)
  if (page === 'platform') {
    const modules = [
      {
        num: '01',
        title: 'Pump Shifts & Cash Handover Control',
        desc: 'Track opening and closing pump meter readings across Super, Gasoil, Kerosene, and LPG nozzles. Verify expected FCFA sales against physical Cash, Orange Money, MTN MoMo, Card POS, and Fleet vouchers in 2 minutes—with automatic shortage alerts.',
        meta: 'Forecourt Operations · Zero Hidden Litres',
      },
      {
        num: '02',
        title: 'Underground Tanks, Tanker Deliveries & Leak Detection',
        desc: 'Compare book fuel stock against daily physical dipsticks or automatic tank gauges (with 15°C temperature adjustment). Catch supplier delivery shortfalls before the fuel truck leaves your station.',
        meta: 'Tank & Stock Control · Stop Fuel Shrinkage',
      },
      {
        num: '03',
        title: 'Corporate Fleet Credit & Shop / Lubricant Sales',
        desc: 'Manage postpaid fuel accounts with approved license plates, driver names, and instant HOLD credit limits. Sell engine oils, filters, cooking gas cylinders, and mini-mart items with automatic stock and profit tracking.',
        meta: 'Fleet Billing & Shop Counter POS',
      },
      {
        num: '04',
        title: 'Staff Roster, Attendance & Shortage-Only Payroll',
        desc: 'Record daily staff arrival and departure times, track each attendant’s cash accuracy over the month, calculate fair monthly pay after verified shortages, and print clean individual payslips.',
        meta: 'Workforce & Payroll · Transparent Deductions',
      },
      {
        num: '05',
        title: 'Automatic Accounting, Daily Profit & VAT (19.25%)',
        desc: 'Every closed shift, tanker purchase, station expense, bank deposit, and salary run builds your Profit & Loss, Balance Sheet, Trial Balance, and Daily Z-Report automatically—ready for SYSCOHADA, IFRS, and your tax office.',
        meta: 'Accounting & Tax Ready · Locked Closed Months',
      },
      {
        num: '06',
        title: 'Smart Business Assistant & Low-Stock Alerts',
        desc: 'Ask plain questions about station profitability, cash flow, or fuel variances—and receive instant alerts whenever a tank drops low, a shift comes up short, or a corporate client nears their credit limit.',
        meta: 'Owner Alerts & Financial Insights',
      },
      {
        num: '07',
        title: 'Android & iPhone App (Works Even Offline)',
        desc: 'Let managers and attendants close shifts, enter dipsticks, and check approved fleet vehicles right at the pump island. If station internet drops, entries queue safely on the phone and sync automatically.',
        meta: 'Mobile Companion · Offline Protected',
      },
      {
        num: '08',
        title: 'Multi-Station Network Control',
        desc: 'Own 2, 5, or 50 stations? Switch between individual sites or view consolidated network sales, fuel reserves, and cash collected across every city from one owner login.',
        meta: 'Multi-Site Command · Centralized Pricing',
      },
    ];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-amber-700">Station Management Features</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Everything you need to run a tighter, more profitable petrol station.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Built from the ground up for real forecourts—connecting your pump meters, underground tanks,
            attendants, mobile money wallets, and accounting reports in one simple workspace.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenConsole}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
            >
              Try Live Station Workspace <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('docs')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-900 text-sm font-semibold"
            >
              Read Step-by-Step Manual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((mod) => (
            <div
              key={mod.num}
              className="bg-white border border-slate-200 rounded-xl p-7 flex flex-col justify-between gap-6 hover:border-amber-300 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                  <span className="font-semibold text-amber-700">FEATURE {mod.num}</span>
                  <span>{mod.meta}</span>
                </div>
                <h2 className="font-display text-xl font-bold text-slate-900">{mod.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{mod.desc}</p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={onOpenConsole}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800"
                >
                  See this live in the station portal <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Pricing Page
  if (page === 'pricing') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="text-sm font-semibold text-amber-700">Simple FCFA Pricing</div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              Clear station pricing starting at 25 000 FCFA/month.
            </h1>
            <p className="text-base text-slate-600">
              Every plan includes pump shifts, underground tank tracking, automatic SYSCOHADA accounting,
              staff permissions, daily backups, and the Android &amp; iPhone mobile app.
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
              Annual (−15%)
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
                <span>Total Fuel Nozzles / Pumps</span>
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
              Recommended Plan · {recommendedPlan.name}
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
              Get Started Now
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

        {/* Private Server & Perpetual License Cross-Link */}
        <div className="bg-slate-900 text-white rounded-xl p-7 sm:p-9 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-mono text-amber-400">
              Private Server Hosting · Perpetual License &amp; Full Ownership
            </div>
            <h2 className="font-display text-2xl font-bold">
              Prefer to host OpesFuel on your own private server or own a dedicated license?
            </h2>
            <p className="text-sm text-slate-300">
              Large fuel marketers and petroleum groups can deploy OpesFuel on private in-country servers at
              5 000 000 FCFA/year or acquire a full custom-branded software license.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('licensing')}
            className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold whitespace-nowrap shrink-0"
          >
            View Private Server Licensing
          </button>
        </div>
      </div>
    );
  }

  if (page === 'licensing') {
    return <LicensingView onOpenConsole={onOpenConsole} onLeadSubmitted={onLeadSubmitted} />;
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
            <div className="text-xs font-mono font-semibold text-amber-700">Built for Real Forecourt Conditions</div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Your pumps keep running smoothly—even when mobile data drops.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Give owners live daily profit on their iPhone, and give station managers and attendants a fast
              Android app right at the pump island. Whenever internet drops, shift closings and dipstick readings
              are safely stored on the phone and uploaded automatically once signal returns—with zero double entries.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('docs')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800 pt-1"
            >
              Read the Mobile App Quick-Start Guide →
            </button>
          </div>
          <div className="lg:col-span-6 rounded-xl overflow-hidden border border-slate-200">
            <ResilientImage
              src={MOBILE_IMG}
              alt="Station manager reviewing OpesFuel mobile analytics next to a fuel dispenser"
              fallbackTitle="OpesFuel Mobile App (Android & iPhone)"
              className="w-full h-[300px] object-cover"
            />
          </div>
        </div>
      </div>
    );
  }

  // Developer / IT API Reference Page (Technical audience)
  if (page === 'api') {
    const endpoints = [
      { method: 'POST', path: '/api/v1/forecourt/shifts/{id}/close', scope: 'forecourt:write', desc: 'Closes a pump shift, deducts tank stock, records variances, and posts balanced revenue, VAT, and fuel cost journals.' },
      { method: 'POST', path: '/api/v1/inventory/tanks/{id}/atg-telemetry', scope: 'inventory:write', desc: 'Receives automatic tank gauge (ATG) readings with 15°C volume compensation and leak variance alerts.' },
      { method: 'POST', path: '/api/v1/inventory/tanks/{id}/reconcile-shrinkage', scope: 'inventory:write', desc: 'Aligns underground tank book stock with physical dipstick measurements and posts approved adjustments.' },
      { method: 'GET', path: '/api/v1/accounting/reports', scope: 'accounting:read', desc: 'Returns balanced Profit & Loss, Trial Balance, Balance Sheet, and VAT (19.25%) figures in exact FCFA.' },
      { method: 'GET', path: '/api/v1/reporting/z-report', scope: 'accounting:read', desc: 'Generates daily station Z-Report breakdown across Cash, Orange Money, MTN MoMo, Card POS, and Fleet credit.' },
      { method: 'POST', path: '/api/v1/billing/invoices/generate', scope: 'billing:write', desc: 'Creates monthly multi-station subscription invoices with Mobile Money, Bank, or Card settlement tracking.' },
      { method: 'POST', path: '/api/v1/platform/webhooks', scope: 'platform:admin', desc: 'Subscribes external accounting or ERP tools to real-time signed station events with delivery logs.' },
      { method: 'GET', path: '/api/v1/platform-admin/overview', scope: 'ROLE_PLATFORM_ADMIN', desc: 'Multi-tenant operator summary returning active station subscriptions, tenant status, and onboarding leads.' },
    ];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-amber-700">IT &amp; Developer Integration Reference</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Connect OpesFuel to your ERP, accounting package, or tank probes.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            For IT teams and software integrators: OpesFuel provides 88 documented OpenAPI 3.1 REST endpoints
            protected by OAuth2/Auth0 tokens and scoped tenant API keys. Looking for everyday station user guides?{' '}
            <button
              type="button"
              onClick={() => onNavigate('docs')}
              className="text-amber-700 font-semibold hover:underline"
            >
              Visit Station Documentation →
            </button>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-sm">Base URL: https://api.opesfuel.com/v1 · OpenAPI 3.1</span>
            <button
              type="button"
              onClick={onOpenConsole}
              className="px-3.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Open Live API Explorer
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

  // Contact & Book a Demo Page
  if (page === 'contact') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-amber-700">Book a Live Demo &amp; Station Setup</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Let’s get your petrol station running on OpesFuel.
          </h1>
          <p className="text-base text-slate-600">
            Tell us a little about your station and pump count. Our onboarding team will walk you through a live
            demo and help you go live in under 48 hours—or reach us directly at{' '}
            <span className="font-mono text-slate-900">info@opesware.com</span>.
          </p>
        </div>

        {leadReceipt ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 space-y-4">
            <div className="text-sm font-semibold text-emerald-800">Demo Request Received</div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Thank you, {leadForm.fullName}. Your reference is{' '}
              <span className="font-mono text-emerald-700">{leadReceipt}</span>.
            </h2>
            <p className="text-sm text-slate-700">
              Our station onboarding team will contact you shortly regarding{' '}
              <span className="font-semibold">{leadForm.stationName}</span> ({leadForm.pumpCount} pumps) on the{' '}
              <span className="font-semibold">{leadForm.selectedPlan}</span> plan.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onOpenConsole}
                className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
              >
                Explore Live Station Workspace Now
              </button>
              <button
                type="button"
                onClick={() => setLeadReceipt(null)}
                className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium"
              >
                Submit Another Request
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLeadSubmit} className="bg-white border border-slate-200 rounded-xl p-7 sm:p-9 space-y-6">
            {leadError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {leadError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Full Name</label>
                <input
                  type="text"
                  value={leadForm.fullName}
                  onChange={(e) => setLeadForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="e.g. Jean-Paul Nkomo"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Petrol Station / Company Name</label>
                <input
                  type="text"
                  value={leadForm.stationName}
                  onChange={(e) => setLeadForm((f) => ({ ...f, stationName: e.target.value }))}
                  placeholder="e.g. Bonabéri Express Station"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="owner@yourstation.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone / WhatsApp Number</label>
                <input
                  type="tel"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+237 6XX XXX XXX"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Fuel Nozzles / Pumps</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={leadForm.pumpCount}
                  onChange={(e) => setLeadForm((f) => ({ ...f, pumpCount: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Preferred Plan</label>
                <select
                  value={leadForm.selectedPlan}
                  onChange={(e) => setLeadForm((f) => ({ ...f, selectedPlan: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                >
                  <option>Starter Station (25 000 FCFA/mo)</option>
                  <option>Growth Network (55 000 FCFA/mo)</option>
                  <option>Enterprise Oil Marketer (110 000 FCFA/mo)</option>
                  <option>Private Server / Perpetual License</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={leadSubmitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {leadSubmitting ? 'Sending Request…' : 'Request Live Demo & Onboarding'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    );
  }

  // Legal, Privacy & Service Guarantee Page
  if (page === 'legal') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-amber-700">Terms, Privacy &amp; Service Guarantee</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900">
            Terms of Service, Privacy Policy &amp; 99.9% Uptime Guarantee
          </h1>
          <p className="text-sm text-slate-500">
            Effective Date: January 1, 2026 · Operated by Opesware (OpesFuel) · Contact:{' '}
            <span className="font-mono text-slate-700">info@opesware.com</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-8 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="font-display text-lg font-bold text-slate-900">1. Full Ownership of Your Station Data</h2>
            <p>
              All shift sales, tank deliveries, customer fleet balances, staff payroll records, and accounting
              reports stored in OpesFuel belong 100% to your business. Your station’s data is strictly isolated
              from all other companies on the platform and can be exported anytime in CSV, PDF, or SYSCOHADA format.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-lg font-bold text-slate-900">2. Privacy &amp; Data Safety</h2>
            <p>
              OpesFuel only collects the staff, supplier, and corporate client information your team enters to run
              daily station operations. We never sell, share, or disclose your fuel prices, sales volumes, or
              customer lists to third parties. All connections are encrypted over HTTPS with daily automated backups.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-lg font-bold text-slate-900">3. Staff Access &amp; Audit Trails</h2>
            <p>
              Station owners have full control to invite or deactivate managers, attendants, and accountants at any
              time. Closed shift adjustments require audited void reversals, and accountants can permanently lock
              completed monthly periods to safeguard historical financial statements.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-lg font-bold text-slate-900">4. Pricing &amp; 99.9% Service Availability</h2>
            <p>
              Cloud subscriptions start at 25 000 FCFA per station per month and include our 99.9% service uptime
              commitment, ongoing improvements, and customer support. Companies requiring in-country server hosting
              may opt for a Private Server Perpetual License at any time.
            </p>
          </section>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('security')}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Read Anti-Fraud &amp; Security Controls
            </button>
            <button
              type="button"
              onClick={() => onNavigate('status')}
              className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold"
            >
              Check Live Service Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // REDESIGNED LANDING PAGE ("CANOPY EXECUTIVE" — PLAIN STATION-OWNER COPY)
  // =========================================================================
  const simUnitPrice = 840;
  const simGrossFcfa = simLitres * simUnitPrice;
  const simNetRevenue = Math.round(simGrossFcfa / 1.1925);
  const simVat = simGrossFcfa - simNetRevenue;
  const simFuelCost = Math.round(simLitres * 745);
  const simShiftProfit = simNetRevenue - simFuelCost;

  const roleShowcase = {
    OWNER: {
      badge: 'Station Owner',
      title: 'See your true daily profit and fuel stock—even when you are away.',
      desc: 'Stop waiting for end-of-month calls or messy Excel files. Check live sales across one or multiple stations, update pump fuel prices, review cash safe vs. bank deposits, and approve supplier orders from your phone or laptop.',
      bullets: [
        'View one station or all your stations combined',
        'Change Super, Gasoil, Kerosene & LPG prices in seconds',
        'Spot cash shortages and low tanks immediately',
      ],
      highlightLabel: 'Owner Control',
      highlightValue: 'Live 24/7 Visibility',
    },
    MANAGER: {
      badge: 'Forecourt Manager',
      title: 'Close every shift in 2 minutes and verify every tanker delivery.',
      desc: 'Open and close pump shifts with locked meter readings, compare supplier delivery notes against before-and-after tank dipsticks, log daily station expenses, and manage staff attendance without paper notebooks.',
      bullets: [
        'Automatic check of meters vs. Cash, Orange Money & MoMo',
        'Catch tanker delivery shortages before the truck leaves',
        'Track attendant attendance and monthly cash accuracy',
      ],
      highlightLabel: 'Shift Handover',
      highlightValue: '2 Minutes Flat',
    },
    ATTENDANT: {
      badge: 'Pump Attendant',
      title: 'Fast, simple mobile screens right at the pump island.',
      desc: 'Attendants only see what they need to do their job—no clutter, no access to owner profits. Record closing meter readings, verify approved corporate fleet plates, ring up motor oils, and keep working even if internet drops.',
      bullets: [
        'Instant check for approved corporate vehicle license plates',
        'Clear receipt totals for Cash, Mobile Money & Vouchers',
        'Works offline and syncs automatically when signal returns',
      ],
      highlightLabel: 'Forecourt Ready',
      highlightValue: 'Works Offline',
    },
    ACCOUNTANT: {
      badge: 'Station Accountant',
      title: 'Always-balanced SYSCOHADA books without manual re-typing.',
      desc: 'Every closed shift, fuel delivery, expense, bank deposit, and salary run writes clean, balanced accounting figures automatically. Review Daily Z-Reports, VAT (19.25%), Profit & Loss, and lock finished months for audits.',
      bullets: [
        'Automatic Profit & Loss, Balance Sheet & Trial Balance',
        'Track VAT (19.25%) and supplier bills cleanly in FCFA',
        'Lock closed months so nobody can alter past figures',
      ],
      highlightLabel: 'Month-End Books',
      highlightValue: 'Ready on Day 2',
    },
  };

  const currentRoleInfo = roleShowcase[activeRoleTab];

  return (
    <div className="bg-[#FAFAF8] pb-20">
      {/* FULL-BLEED CINEMATIC CANOPY HERO */}
      <section className="relative bg-[#0B0F17] text-white overflow-hidden">
        <ResilientImage
          src={HERO_IMG}
          alt="Modern OpesFuel petrol station forecourt canopy at sunset with attendants and fuel dispensers"
          fallbackTitle="OpesFuel Modern Petrol Station Platform"
          className="w-full h-[560px] sm:h-[620px] object-cover object-center opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/65 to-[#0B0F17]/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F17]/90 via-[#0B0F17]/50 to-transparent" />

        <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col justify-between">
          <div className="max-w-2xl space-y-5 my-auto">
            <div className="text-xs font-mono uppercase tracking-[0.18em] text-amber-400 font-semibold">
              Petrol Station Management · Starting at 25 000 FCFA/month
            </div>
            <h1 className="font-display text-3xl sm:text-5xl lg:text-[54px] font-extrabold leading-[1.05] tracking-tight text-white [text-wrap:balance]">
              Every litre metered. Every franc accounted for.
            </h1>
            <p className="text-sm sm:text-lg text-slate-200 leading-relaxed max-w-xl">
              Stop losing cash at shift change and stop guessing what’s left in your underground tanks.
              OpesFuel brings your pump shifts, tanker deliveries, Orange Money &amp; MTN MoMo, fleet credit,
              staff payroll, and daily profit reports into one simple system.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onOpenConsole}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition-colors whitespace-nowrap"
              >
                Try Live Station Workspace <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('contact')}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg bg-white/10 hover:bg-white/15 backdrop-blur border border-white/20 text-white text-sm font-semibold transition-colors whitespace-nowrap"
              >
                Book a Free Demo
              </button>
            </div>
          </div>

          {/* Anchored 4-Column Proof Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/15 rounded-xl overflow-hidden border border-white/15 backdrop-blur-md">
            {[
              ['Starting Price', '25 000 FCFA / mo', 'All core station tools included'],
              ['Cash & Mobile Money', 'Cash · Orange · MoMo', 'Checked on every pump shift'],
              ['Tank & Stock Control', 'Dipsticks & Tank Gauges', 'Catch leaks & truck shortages'],
              ['Accounting & Mobile', 'SYSCOHADA · Offline App', 'Works on Web, Android & iPhone'],
            ].map(([label, val, sub]) => (
              <div key={label} className="bg-[#0B0F17]/80 px-4 py-3.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">{label}</div>
                <div className="font-display text-sm sm:text-base font-bold text-white mt-0.5">{val}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 1: INTERACTIVE SHIFT-TO-PROFIT CALCULATOR */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-5">
            <div className="text-xs font-mono uppercase tracking-[0.14em] text-amber-700 font-semibold">
              01 · Automatic Shift-to-Profit Control
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-950 leading-tight">
              Close one pump shift. Your daily cash, tank stock, and profit update instantly.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Slide the litres sold below to see how OpesFuel turns a simple pump meter reading into exact
              expected cash, underground tank stock deduction, VAT (19.25%), and true net station profit—with
              zero manual calculations.
            </p>

            <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-semibold text-slate-700">Fuel Sold on Shift (Super · 840 FCFA/L)</span>
                <span className="font-mono font-bold text-amber-700">{simLitres.toLocaleString()} L</span>
              </div>
              <input
                type="range"
                min={500}
                max={15000}
                step={100}
                value={simLitres}
                onChange={(e) => setSimLitres(Number(e.target.value))}
                aria-label="Simulate shift fuel volume in litres"
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>500 L</span>
                <span>Expected Handover: {formatFcfa(simGrossFcfa)}</span>
                <span>15 000 L</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#0F172A] text-slate-100 rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div>
                <div className="font-mono text-xs text-amber-400 font-semibold">
                  AUTOMATIC SHIFT CLOSING SUMMARY
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Instant check of pump meters, underground tank &amp; daily profit in exact FCFA
                </div>
              </div>
              <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                100% BALANCED
              </span>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-800/70">
                <span className="text-slate-300">Total Cash + Orange Money + MoMo Expected</span>
                <span className="font-mono font-bold text-white">{formatFcfa(simGrossFcfa)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800/70">
                <span className="text-slate-400">Deducted From Underground Super Tank</span>
                <span className="font-mono font-semibold text-amber-300">−{simLitres.toLocaleString()} Litres</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800/70">
                <span className="text-slate-400">Fuel Sales Revenue (Excluding VAT)</span>
                <span className="font-mono text-slate-200">{formatFcfa(simNetRevenue)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800/70">
                <span className="text-slate-400">VAT Set Aside Automatically (19.25%)</span>
                <span className="font-mono text-slate-200">{formatFcfa(simVat)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800/70">
                <span className="text-slate-400">Wholesale Cost of Fuel Sold (745 FCFA/L)</span>
                <span className="font-mono text-slate-200">−{formatFcfa(simFuelCost)}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-400">Your Real Gross Fuel Profit on This Shift</div>
                <div className="text-[11px] text-slate-500">Automatically added to your Daily Z-Report &amp; P&amp;L</div>
              </div>
              <div className="font-mono text-2xl font-bold text-emerald-400">{formatFcfa(simShiftProfit)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: 3-PILLAR REAL FORECOURT VISUAL STORY */}
      <section className="bg-white border-y border-slate-200 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2">
              <div className="text-xs font-mono uppercase tracking-[0.14em] text-amber-700 font-semibold">
                02 · Built for Real Petrol Stations
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-950">
                Protect your fuel underground, at the pump, and in your bank account.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('platform')}
              className="text-sm font-semibold text-amber-700 hover:text-amber-800"
            >
              See all station features →
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <article className="rounded-2xl border border-slate-200 overflow-hidden bg-[#FAFAF8] flex flex-col">
              <ResilientImage
                src={DEPOT_IMG}
                alt="Fuel depot metering pipes and underground tank delivery gauges"
                fallbackTitle="Underground Tank & Delivery Control"
                className="w-full h-48 object-cover"
              />
              <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-amber-700 font-semibold">
                    <Truck className="w-4 h-4" />
                    <span>Tanks &amp; Deliveries</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-950">
                    Catch tanker shortages &amp; underground leaks early.
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Compare supplier delivery notes against before-and-after tank dips (including 15°C temperature
                    adjustment) and track daily book vs. physical fuel stock.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('docs')}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 text-left pt-2"
                >
                  Read Tank &amp; Dipstick Guide →
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 overflow-hidden bg-[#FAFAF8] flex flex-col">
              <ResilientImage
                src={MOBILE_IMG}
                alt="Station manager using OpesFuel Android and iPhone app next to a fuel pump"
                fallbackTitle="Android & iPhone App"
                className="w-full h-48 object-cover"
              />
              <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-amber-700 font-semibold">
                    <Smartphone className="w-4 h-4" />
                    <span>Android &amp; iPhone App</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-950">
                    Manage your station from anywhere—even when internet drops.
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Attendants close shifts and check fleet plates right at the island; owners track live daily
                    revenue and tank levels from their phone—with full offline safety.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('mobile')}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 text-left pt-2"
                >
                  Try Interactive Mobile Preview →
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-800 bg-[#0F172A] text-white p-6 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Credit, Payroll &amp; Anti-Fraud</span>
                </div>
                <h3 className="font-display text-xl font-bold">
                  Stop bad corporate debt and run fair monthly staff payroll.
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Put overdue transport companies on HOLD with one tap, approve exact license plates, deduct only
                  verified cash shortages at payroll, and lock finished accounting months.
                </p>
              </div>
              <div className="space-y-2 pt-4 border-t border-slate-800 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Average Cash Loss Reduction</span>
                  <span className="font-mono font-bold text-emerald-400">−89%</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Typical Payback Time</span>
                  <span className="font-mono font-bold text-amber-400">Under 2 Weeks</span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('customers')}
                  className="pt-2 inline-block font-semibold text-amber-400 hover:text-amber-300"
                >
                  Read Customer Stories →
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* SECTION 3: INTERACTIVE 4-ROLE WORKSPACE SHOWCASE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8">
        <div className="max-w-2xl space-y-2">
          <div className="text-xs font-mono uppercase tracking-[0.14em] text-amber-700 font-semibold">
            03 · Made For Everyone On Your Team
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-950">
            Every person sees only the tools they need—nothing more, nothing less.
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['OWNER', 'Station Owner'],
              ['MANAGER', 'Forecourt Manager'],
              ['ATTENDANT', 'Pump Attendant'],
              ['ACCOUNTANT', 'Station Accountant'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveRoleTab(id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                activeRoleTab === id
                  ? 'bg-slate-950 text-amber-400 border-slate-950'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-7 sm:p-9 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-amber-700">
              {currentRoleInfo.badge} View
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">
              {currentRoleInfo.title}
            </h3>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              {currentRoleInfo.desc}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {currentRoleInfo.bullets.map((b) => (
                <div
                  key={b}
                  className="p-4 rounded-xl bg-[#FAFAF8] border border-slate-200 text-xs text-slate-700 leading-relaxed flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 p-6 rounded-xl bg-slate-950 text-white space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
              {currentRoleInfo.highlightLabel}
            </div>
            <div className="font-display text-3xl font-extrabold text-amber-400">
              {currentRoleInfo.highlightValue}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Each team member receives their own personal login with strict permission boundaries.
            </p>
            <button
              type="button"
              onClick={onOpenConsole}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
            >
              Preview This Role in Portal →
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 4: QUICK HELP STRIP (DOCUMENTATION + FAQ) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-7 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700">
                <BookOpen className="w-4 h-4" /> Step-by-Step Documentation
              </div>
              <h3 className="font-display text-xl font-bold text-slate-950">
                New to digital station management? Read our 10-chapter Station Manual.
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Simple, illustrated checklists showing how to set up tanks, close shifts, manage fleet credit, run
                payroll, and lock monthly accounts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('docs')}
              className="text-sm font-semibold text-amber-700 hover:text-amber-800 text-left"
            >
              Open Station Documentation →
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-7 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700">
                <HelpCircle className="w-4 h-4" /> Owner Questions Answered
              </div>
              <h3 className="font-display text-xl font-bold text-slate-950">
                Questions about internet outages, Orange Money, hardware, or cost?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Read plain answers to the 16 most common questions petrol station owners ask before switching from
                paper books and Excel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('faq')}
              className="text-sm font-semibold text-amber-700 hover:text-amber-800 text-left"
            >
              Browse Frequently Asked Questions →
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 5: ARCHITECTURAL CLOSING CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#0B0F17] text-white border border-slate-800 rounded-2xl p-8 sm:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-mono uppercase tracking-wider text-amber-400">
              Start in Under 48 Hours · From 25 000 FCFA/month
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Take complete control of your petrol station starting this week.
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              No expensive pump replacements needed. Start on our managed cloud or deploy on your own private
              server with full support from our onboarding team.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenConsole}
              className="px-6 py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap"
            >
              Try Live Workspace
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="px-5 py-3.5 rounded-lg border border-white/20 hover:bg-white/10 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Book a Free Demo
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
