import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Cpu,
  Database,
  FileCheck2,
  Fuel,
  Globe2,
  HelpCircle,
  KeyRound,
  Layers,
  Lock,
  Network,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Truck,
  Wallet,
  Webhook,
} from 'lucide-react';
import { PublicPage } from '../../domain/types';

interface PublicPagesExtraProps {
  page: 'solutions' | 'integrations' | 'security' | 'customers' | 'about' | 'resources' | 'status';
  onNavigate: (page: PublicPage) => void;
  onOpenConsole: () => void;
}

export const PublicPagesExtra: React.FC<PublicPagesExtraProps> = ({
  page,
  onNavigate,
  onOpenConsole,
}) => {
  const [selectedSegment, setSelectedSegment] = useState<'independent' | 'network' | 'fleet' | 'audit'>('independent');
  const [integrationFilter, setIntegrationFilter] = useState<'ALL' | 'PAYMENTS' | 'IOT' | 'ERP' | 'SECURITY'>('ALL');
  const [faqQuery, setFaqQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // =========================================================================
  // 1. SOLUTIONS PAGE
  // =========================================================================
  if (page === 'solutions') {
    const segments = {
      independent: {
        badge: '1–2 Stations · From 25 000 FCFA/mo',
        title: 'Independent Petrol Station Owners',
        subtitle: 'Eliminate cash handover leakage, midnight Excel sheets, and unexplained underground tank shrinkage from day one.',
        outcomes: [
          'Close pump shifts in 90 seconds with automatic meter vs. Cash/Orange Money/MoMo reconciliation.',
          'Catch attendant shortages immediately and deduct verified variances transparently at payroll.',
          'Auto-generate daily P&L, VAT (19.25%), and Balance Sheet without hiring an external data-entry clerk.',
          'Monitor live pump sales and tank reserves from your iPhone or Android even while travelling.',
        ],
        metrics: [
          { label: 'Go-Live Time', value: 'Under 48 hrs' },
          { label: 'Average Cash Leakage Cut', value: '−94%' },
          { label: 'Monthly Starting Tariff', value: '25 000 FCFA' },
        ],
      },
      network: {
        badge: '3–100+ Stations · Multi-Site Command',
        title: 'Multi-Site Fuel Networks & Oil Marketers',
        subtitle: 'Standardize fuel pricing, wet-stock reconciliation, corporate fleet billing, and consolidated SYSCOHADA financials across every region.',
        outcomes: [
          'Push tariff changes and monitor tank autonomy across Douala, Yaoundé, Kribi, Bafoussam, and corridors in one view.',
          'Isolate branch managers to their assigned station while giving HQ executives network-wide visibility.',
          'Track tanker purchase orders, Bill-of-Lading shortfalls, and 15°C ATG thermal variance across depots.',
          'Connect headquarters ERP (Sage 100c, Odoo, SAP) via OpenAPI 3.1 and HMAC-signed webhooks.',
        ],
        metrics: [
          { label: 'Multi-Station Consolidation', value: 'Real-Time' },
          { label: 'Monthly Close Speed', value: '4× Faster' },
          { label: 'Deployment Model', value: 'Cloud or Sovereign VPS' },
        ],
      },
      fleet: {
        badge: 'B2B Corporate Fuel & Commercial Depots',
        title: 'Corporate Fleets, Transport & Fuel Depots',
        subtitle: 'Control postpaid fuel credit by whitelisted license plate, driver identity, and real-time credit ceilings.',
        outcomes: [
          'Enforce automated ACTIVE/HOLD credit controls that block over-limit dispensing at the pump.',
          'Issue itemized monthly corporate fuel statements with plate number, litres, grade, and timestamp.',
          'Track bulk Gasoil, Super, Kerosene, LPG, and Heavy Fuel (HFO) across depot reservoirs.',
          'Settle corporate receivables directly against Bank, Mobile Money, or Cash clearing accounts.',
        ],
        metrics: [
          { label: 'Unauthorized Fleet Fills', value: '0%' },
          { label: 'Statement Generation', value: '1-Click PDF' },
          { label: 'DSO Collection Gain', value: '−14 Days' },
        ],
      },
      audit: {
        badge: 'SYSCOHADA Rev. 2017 & IFRS Native',
        title: 'Petroleum Accounting & Audit Firms',
        subtitle: 'Give your chartered accountants an immutable, balanced double-entry PostgreSQL ledger built specifically for fuel retailing.',
        outcomes: [
          'Every closed shift, tanker receipt, AP payment, expense, and payroll run writes balanced integer FCFA journals.',
          'Zero floating-point rounding drift—every debit equals every credit down to 1 FCFA.',
          'Close and cryptographically lock monthly/annual fiscal periods so historical entries cannot be altered.',
          'Export Trial Balance, General Ledger, VAT 19.25% schedules, and Z-Reports in seconds.',
        ],
        metrics: [
          { label: 'Arithmetic Precision', value: 'Integer FCFA' },
          { label: 'Fiscal Controls', value: 'Locked Periods' },
          { label: 'Dedicated Role', value: 'ACCOUNTANT' },
        ],
      },
    };

    const current = segments[selectedSegment];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-amber-700">Industry Solutions</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Built for every fuel retail model—from single forecourts to national networks.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Whether you operate one urban service station or a 50-site regional oil marketing brand, OpesFuel
            adapts cleanly with role-isolated workspaces, integer FCFA accounting, and offline-resilient mobile apps.
          </p>
        </div>

        {/* Segment Tabs */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'independent', label: 'Independent Stations', icon: Fuel },
                { id: 'network', label: 'Multi-Site Networks', icon: Building2 },
                { id: 'fleet', label: 'Fleets & Fuel Depots', icon: Truck },
                { id: 'audit', label: 'Accounting & Audit Firms', icon: FileCheck2 },
              ] as const
            ).map((seg) => {
              const Icon = seg.icon;
              const active = selectedSegment === seg.id;
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setSelectedSegment(seg.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-slate-500'}`} />
                  {seg.label}
                </button>
              );
            })}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-5">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                {current.badge}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                {current.title}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{current.subtitle}</p>
              <ul className="space-y-3 pt-2">
                {current.outcomes.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 pt-4">
                <button
                  type="button"
                  onClick={onOpenConsole}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                >
                  Launch Station Workspace <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('contact')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors"
                >
                  Book a Tailored Demo
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              {current.metrics.map((m) => (
                <div key={m.label} className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">{m.label}</div>
                  <div className="font-mono text-2xl font-bold text-slate-900 mt-1">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200">
            <h2 className="font-display text-xl font-bold text-slate-900">
              How OpesFuel Replaces Legacy Spreadsheets &amp; Generic POS Tools
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Capability</th>
                  <th className="px-6 py-3.5">Excel / Paper Logs</th>
                  <th className="px-6 py-3.5">Generic Retail POS</th>
                  <th className="px-6 py-3.5 text-amber-800 bg-amber-50/70">OpesFuel Station OS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ['Mechanical & Electronic Totalizer Shifts', 'Manual errors', 'Not supported', 'Automated + Void Reversals'],
                  ['Underground Tank Dipstick & 15°C ATG', 'Manual formulas', 'Not supported', 'Native ASTM 15°C Reconciliation'],
                  ['SYSCOHADA Double-Entry FCFA Ledger', 'Separate software', 'Cash-only summaries', 'Real-Time ACID Journals + VAT 19.25%'],
                  ['Orange Money & MTN MoMo Tender Split', 'Unverified SMS', 'Single tender only', 'Per-Shift Multi-Tender Reconciliation'],
                  ['Offline Forecourt Mobile App (Android/iOS)', 'None', 'Drops connection', 'Offline Queue + UUID Idempotency'],
                  ['Multi-Tenant SaaS & OpenAPI 3.1', 'None', 'Closed database', '88 REST Endpoints + HMAC Webhooks'],
                ].map(([cap, legacy, generic, opes]) => (
                  <tr key={cap} className="hover:bg-slate-50/60">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{cap}</td>
                    <td className="px-6 py-3.5 text-slate-500">{legacy}</td>
                    <td className="px-6 py-3.5 text-slate-500">{generic}</td>
                    <td className="px-6 py-3.5 font-semibold text-emerald-700 bg-amber-50/30">{opes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. INTEGRATIONS & ECOSYSTEM PAGE
  // =========================================================================
  if (page === 'integrations') {
    const items = [
      {
        category: 'PAYMENTS',
        name: 'Orange Money Merchant',
        status: 'Production Ready',
        desc: 'Track Orange Money forecourt shift tenders, verify daily mobile wallet settlements, and auto-reconcile SaaS invoices.',
        icon: Wallet,
      },
      {
        category: 'PAYMENTS',
        name: 'MTN Mobile Money (MoMo)',
        status: 'Production Ready',
        desc: 'Separate MTN MoMo clearing accounts in the SYSCOHADA chart of accounts with bank-sweep transfer tracking.',
        icon: Smartphone,
      },
      {
        category: 'PAYMENTS',
        name: 'Bank Card POS & Fleet Vouchers',
        status: 'Production Ready',
        desc: 'Reconcile GIMAC, Visa, Mastercard POS batch slips and postpaid corporate fleet accounts per shift.',
        icon: Wallet,
      },
      {
        category: 'IOT',
        name: 'Veeder-Root TLS & ATG Probes',
        status: 'REST Ingestion API',
        desc: 'Ingest automated underground tank level, water level, and temperature probes with ASTM 15°C volume compensation.',
        icon: Cpu,
      },
      {
        category: 'IOT',
        name: 'Gilbarco / Tokheim Forecourt Controllers',
        status: 'OpenAPI Bridge',
        desc: 'Stream electronic nozzle totalizers into shift open/close endpoints using scoped X-API-Key credentials.',
        icon: Fuel,
      },
      {
        category: 'ERP',
        name: 'Sage 100c / Saari SYSCOHADA',
        status: 'CSV & API Export',
        desc: 'Export balanced SYSCOHADA journal entries, Trial Balance, and VAT 19.25% schedules directly into external accounting offices.',
        icon: BookOpen,
      },
      {
        category: 'ERP',
        name: 'Odoo & SAP Business One',
        status: 'Webhooks + REST',
        desc: 'Sync tanker purchase orders, AP vendor payments, and corporate fleet receivables via 88 versioned OpenAPI endpoints.',
        icon: Network,
      },
      {
        category: 'SECURITY',
        name: 'Auth0 OIDC PKCE & SSO',
        status: 'Native RS256',
        desc: 'Enterprise single sign-on, MFA enforcement, role-based access control, and 7-day cryptographically signed staff invitations.',
        icon: KeyRound,
      },
      {
        category: 'SECURITY',
        name: 'HMAC-SHA256 Transactional Outbox',
        status: 'AES-256-GCM',
        desc: 'Deliver guaranteed at-least-once domain events (ShiftClosedEvent, TankerDeliveredEvent, DipstickVarianceFlaggedEvent) to any URL.',
        icon: Webhook,
      },
    ] as const;

    const filtered =
      integrationFilter === 'ALL'
        ? items
        : items.filter((i) => i.category === integrationFilter);

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-amber-700">Ecosystem &amp; Integrations</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Connected to your forecourt hardware, mobile money, and ERP stack.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            OpesFuel is engineered API-first with OpenAPI 3.1, scoped X-API-Keys, and signed webhooks—never
            locking your station data inside a proprietary box.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'ALL', label: 'All Integrations' },
              { id: 'PAYMENTS', label: 'Mobile Money & Payments' },
              { id: 'IOT', label: 'Forecourt Hardware & ATG IoT' },
              { id: 'ERP', label: 'Accounting & ERPs' },
              { id: 'SECURITY', label: 'Identity & Webhooks' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setIntegrationFilter(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                integrationFilter === tab.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4 hover:border-amber-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {item.status}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900">{item.name}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400">{item.category}</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('api')}
                    className="font-semibold text-amber-700 hover:text-amber-800"
                  >
                    View API Spec →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900 text-white rounded-2xl p-8 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="font-display text-2xl font-bold">Need a custom dispenser protocol or ERP connector?</h2>
            <p className="text-sm text-slate-300">
              Our engineering team builds dedicated forecourt controller bridges and custom ERP integrations for
              multi-station networks and enterprise licensees.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('api')}
              className="px-5 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
            >
              Explore OpenAPI 3.1
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="px-5 py-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-white text-sm font-semibold"
            >
              Talk to Solutions Engineering
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. SECURITY & COMPLIANCE TRUST CENTER PAGE
  // =========================================================================
  if (page === 'security') {
    const pillars = [
      {
        icon: KeyRound,
        title: 'Auth0 OIDC PKCE (S256) & RS256 Verification',
        desc: 'All web and mobile sessions authenticate using Authorization Code Flow with PKCE. Spring Boot validates RS256 signatures against your Auth0 JWKS endpoint on every request.',
      },
      {
        icon: Shield,
        title: 'Strict Multi-Tenant Isolation',
        desc: 'Every database row carries an explicit tenant boundary enforced at the service and repository layer. Cross-tenant IDs are rejected with HTTP 403/404 by design.',
      },
      {
        icon: Lock,
        title: 'AES-256-GCM & SHA-256 Cryptographic Hygiene',
        desc: 'Webhook signing secrets are encrypted at rest with AES-256-GCM. Tenant X-API-Keys are hashed with SHA-256 and revealed only once upon creation.',
      },
      {
        icon: Database,
        title: 'PostgreSQL 17 ACID Integer FCFA Ledger',
        desc: 'All financial balances use 64-bit exact integer FCFA arithmetic with database-level debit=credit invariants, Flyway versioned migrations, and zero floating-point rounding drift.',
      },
      {
        icon: FileCheck2,
        title: 'SYSCOHADA Rev. 2017 & Immutable Fiscal Locks',
        desc: 'Once an accountant closes a fiscal period, backdated edits or deletions are blocked at the domain boundary—producing clean, tamper-evident statutory audit trails.',
      },
      {
        icon: Server,
        title: '99.9% Uptime SLA & Sovereign Deployment Option',
        desc: 'Deploy on OpesFuel managed TLS cloud infrastructure or license the full Docker/VPS stack for private in-country data residency.',
      },
    ];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <ShieldCheck className="w-4 h-4" /> Security &amp; Compliance Trust Center
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Bank-grade security engineered for high-volume cash &amp; fuel operations.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Petroleum stations process millions of FCFA daily across shifts, vaults, mobile money wallets, and
            underground inventory. OpesFuel protects every franc with end-to-end cryptographic and accounting controls.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900">{p.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
        </div>

        {/* RBAC Matrix */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                5-Role Enterprise RBAC Authorization Matrix
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enforced server-side via Spring Security method guards and frontend route policies.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('status')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800"
            >
              View Live System Status →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Forecourt &amp; POS</th>
                  <th className="px-6 py-3">Tanks &amp; Pricing</th>
                  <th className="px-6 py-3">Accounting &amp; Locks</th>
                  <th className="px-6 py-3">Billing &amp; API Keys</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {[
                  ['ATTENDANT', 'Open/Close Assigned Shifts & POS', 'Read-only tank levels', 'No access', 'No access'],
                  ['MANAGER', 'Full shift, void & voucher control', 'Tanker receipts, dips & ATG', 'Operating expenses only', 'No access'],
                  ['ACCOUNTANT', 'Read-only shift audit', 'Read-only valuation', 'Full SYSCOHADA, VAT, AP & Locks', 'Read-only invoices'],
                  ['OWNER', 'Full network oversight', 'Full pricing & station provisioning', 'Full financial statements', 'Billing, Invites & API Keys'],
                  ['PLATFORM_ADMIN', 'Multi-tenant SaaS oversight', 'Global tenant provisioning', 'Global MRR & revenue ops', 'Full SaaS Control Plane'],
                ].map(([r, f, t, a, b]) => (
                  <tr key={r}>
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-900">{r}</td>
                    <td className="px-6 py-3.5 text-slate-600">{f}</td>
                    <td className="px-6 py-3.5 text-slate-600">{t}</td>
                    <td className="px-6 py-3.5 text-slate-600">{a}</td>
                    <td className="px-6 py-3.5 text-slate-600">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 4. CUSTOMERS & CASE STUDIES PAGE
  // =========================================================================
  if (page === 'customers') {
    const studies = [
      {
        region: 'Douala, Cameroon · 1 Urban Forecourt (8 Nozzles)',
        company: 'Bonabéri Express Energy',
        headline: 'Cut unexplained monthly cash & fuel shrinkage from 1.8M FCFA to under 90 000 FCFA in 60 days.',
        challenge:
          'Handwritten shift books and delayed Orange Money reconciliations made it impossible to trace which attendant shift caused cash shortfalls or tank evaporation variances.',
        solution:
          'Deployed OpesFuel Starter + Android attendant app. Every pump totalizer and mobile money transfer now reconciles automatically before shift handover.',
        stats: [
          { k: 'Monthly Savings', v: '1.7M FCFA' },
          { k: 'Shift Handover Time', v: '2 mins' },
          { k: 'ROI Payback', v: '11 Days' },
        ],
      },
      {
        region: 'Yaoundé – Kribi Corridor · 8-Station Network',
        company: 'Equatorial Petroleum Distributors',
        headline: 'Consolidated 8 stations into real-time SYSCOHADA P&L and centralized corporate fleet credit.',
        challenge:
          'Branch managers sent Excel files every Monday, delaying management accounts by 3 weeks and allowing overdue corporate haulage fleets to keep fueling.',
        solution:
          'Migrated all 8 sites to OpesFuel Multi-Station Cloud with centralized fleet vehicle whitelists, automated ACTIVE/HOLD credit ceilings, and live ATG dipstick tracking.',
        stats: [
          { k: 'Monthly Close', v: 'Day 2 (vs Day 22)' },
          { k: 'Fleet Bad Debt', v: '0 FCFA' },
          { k: 'Sites Managed', v: '8 Stations' },
        ],
      },
      {
        region: 'Abidjan & San-Pédro · Commercial Fuel & Lubricant Depot',
        company: 'Atlantique Logistics & Fuel',
        headline: 'Automated 15°C tanker receipt reconciliation and Odoo ERP webhook synchronization.',
        challenge:
          'High ambient temperatures created recurring 400–900 L disputes with tanker drivers on every 36 000 L Gasoil delivery.',
        solution:
          'Activated OpesFuel ASTM 15°C thermal volume compensation and connected the Java 25 OpenAPI 3.1 webhooks directly into headquarters ERP.',
        stats: [
          { k: 'BoL Dispute Resolution', v: 'Instant' },
          { k: 'API Uptime', v: '99.98%' },
          { k: 'Manual Re-Entry', v: 'Eliminated' },
        ],
      },
    ];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-amber-700">Customer Outcomes</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Proven operational control across independent forecourts and fuel networks.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            See how station owners, operations directors, and petroleum accountants use OpesFuel to recover lost
            margin and accelerate monthly financial close.
          </p>
        </div>

        {/* Proof bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Average Shrinkage Reduction', value: '−89%' },
            { label: 'Faster Shift Handover', value: '6×' },
            { label: 'Ledger Balancing Accuracy', value: '100%' },
            { label: 'Platform Uptime SLA', value: '99.9%' },
          ].map((m) => (
            <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">{m.label}</div>
              <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{m.value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          {studies.map((s) => (
            <div
              key={s.company}
              className="bg-white border border-slate-200 rounded-2xl p-7 sm:p-9 grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-8 space-y-4">
                <div className="text-xs font-mono font-semibold text-amber-700">{s.region}</div>
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">{s.company}</div>
                <h2 className="font-display text-2xl font-bold text-slate-900">{s.headline}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-sm">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">Before OpesFuel</div>
                    <p className="text-slate-600 leading-relaxed">{s.challenge}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                    <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider">With OpesFuel</div>
                    <p className="text-slate-700 leading-relaxed">{s.solution}</p>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  {s.stats.map((st) => (
                    <div key={st.k} className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                      <span className="text-xs text-slate-400">{st.k}</span>
                      <span className="font-mono text-lg font-bold text-amber-400">{st.v}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('contact')}
                  className="w-full py-3 px-4 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-900 text-sm font-semibold text-center"
                >
                  Request Similar Deployment
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 5. ABOUT OPESFUEL / COMPANY PAGE
  // =========================================================================
  if (page === 'about') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-amber-700">About OpesFuel by Opesware</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Engineering industrial-grade financial clarity for Africa’s energy retail backbone.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            OpesFuel was built by systems architects and petroleum finance specialists who saw independent
            station owners and oil marketers losing millions of FCFA to fragmented spreadsheets, unverified pump
            handovers, and rigid legacy software that never matched CEMAC/WAEMU forecourt reality.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: TrendingUp,
              title: 'Zero-Drift Financial Engineering',
              desc: 'We treat fuel retail as a precision financial ledger. Every litre dispensed and every franc collected is stored in integer FCFA with strict double-entry integrity.',
            },
            {
              icon: Layers,
              title: '15-Module Java 25 Spring Boot Core',
              desc: 'Built as a verified Spring Modulith on PostgreSQL 17 and OpenAPI 3.1—giving both small stations and national networks rock-solid stability without microservice fragility.',
            },
            {
              icon: Globe2,
              title: 'Built for CEMAC & WAEMU Realities',
              desc: 'Native FCFA (XAF/XOF), SYSCOHADA Rev. 2017 & IFRS statements, VAT 19.25%, Orange Money / MTN MoMo splits, and offline-first mobile syncing for intermittent cellular links.',
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900">{card.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{card.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Regional Footprint & Partner Program */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-4">
            <h2 className="font-display text-2xl font-bold text-slate-900">Regional Focus &amp; Support</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              OpesFuel serves petrol stations, LPG depots, and regional fuel distributors across Central and
              West Africa—supporting both XAF (CEMAC) and XOF (WAEMU) operations with bilingual English &amp; French
              accounting alignment.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
              {['Cameroon (Douala / Yaoundé)', 'Côte d’Ivoire (Abidjan)', 'Senegal (Dakar)', 'Gabon & Congo', 'Chad & CAR', 'Benin & Togo'].map((r) => (
                <div key={r} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                  {r}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-8 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider text-amber-400">
                Channel &amp; Reseller Program
              </div>
              <h2 className="font-display text-2xl font-bold">
                Partner with Opesware or license OpesFuel for your region.
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Are you a petroleum equipment installer, accounting firm, or regional systems integrator? Join our
                certified deployment partner network or acquire a white-label enterprise IP license.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('licensing')}
                className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
              >
                Explore Licensing
              </button>
              <button
                type="button"
                onClick={() => onNavigate('contact')}
                className="px-5 py-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-white text-sm font-semibold"
              >
                Contact Partnerships
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 6. RESOURCES, HELP CENTER, FAQ & CHANGELOG PAGE
  // =========================================================================
  if (page === 'resources') {
    const faqs = [
      {
        q: 'How quickly can we onboard our first petrol station onto OpesFuel?',
        a: 'Most single stations go live in under 48 hours. Simply enter your underground tank capacities, opening dipstick volumes, pump nozzle totalizers, and staff roster inside the guided Setup Wizard—and you can open your first shift immediately.',
      },
      {
        q: 'What happens if the internet goes down at the petrol station?',
        a: 'Our native Android & iPhone app queues shift closes, dipstick readings, and Shop POS sales locally using UUID idempotency keys. As soon as cellular or Wi-Fi returns, every queued transaction syncs cleanly to PostgreSQL with zero duplicate entries.',
      },
      {
        q: 'Does OpesFuel handle Orange Money, MTN MoMo, and corporate fleet credit in the same shift?',
        a: 'Yes. Every shift closing screen breaks down expected FCFA across Cash, Orange Money, MTN MoMo, Card POS, and Fleet Credit vouchers, automatically posting balanced SYSCOHADA clearing entries and flagging any variance.',
      },
      {
        q: 'Do we need expensive new fuel dispensers or ATG hardware to start?',
        a: 'No hardware lock-in is required. You can start immediately using mechanical or electronic pump totalizers and manual dipstick calibration charts—and connect Veeder-Root/Tokheim ATG 15°C probes anytime via our OpenAPI ingestion endpoints.',
      },
      {
        q: 'Can we host OpesFuel on our own private VPS or country server?',
        a: 'Yes. In addition to our managed cloud SaaS (starting at 25 000 FCFA/month), we offer Perpetual Self-Hosted and Enterprise IP Licensing with full Docker Compose, PostgreSQL 17, and Java 25 Spring Boot deployment packages.',
      },
      {
        q: 'How does OpesFuel prevent attendants or managers from editing closed accounting records?',
        a: 'Closed shifts cannot be silently edited—only reversed via immutable audited void journals. Furthermore, accountants can close and lock monthly fiscal periods so no historical journal can ever be altered.',
      },
    ];

    const filteredFaqs = faqs.filter(
      (f) =>
        !faqQuery.trim() ||
        f.q.toLowerCase().includes(faqQuery.toLowerCase()) ||
        f.a.toLowerCase().includes(faqQuery.toLowerCase())
    );

    const releases = [
      {
        version: 'v2.6.0',
        date: 'Current Production Release',
        tag: 'UI/UX & Mobile Overhaul',
        items: [
          'Redesigned Android/iPhone & Web Mobile Companion with Hamburger Slide-Over Drawer and fixed 5-tab navigation.',
          'Upgraded platform typography to Manrope, Inter, and IBM Plex Mono for executive dashboard legibility.',
          'Added role-aware mobile console bars, destructive confirmation guards, and strict Auth0 route protection.',
        ],
      },
      {
        version: 'v2.5.0',
        date: 'Enterprise Platform Milestone',
        tag: '15 Spring Boot Modules + SaaS Control Plane',
        items: [
          'Completed all 15 Java 25 Spring Boot Modular Monolith modules with Flyway V1–V6 and 88 OpenAPI 3.1 endpoints.',
          'Launched PLATFORM_ADMIN SaaS Control Plane for multi-tenant MRR tracking, tenant lifecycle, and enterprise leads.',
          'Added ASTM 15°C ATG telemetry ingestion, shortage-only payroll runs, VAT 19.25% remittance, and fiscal period locks.',
        ],
      },
      {
        version: 'v2.4.0',
        date: 'Security & API Milestone',
        tag: 'Auth0 OIDC PKCE & AES-256-GCM Webhooks',
        items: [
          'Rolled out Auth0 OIDC PKCE (S256) authentication across Web and Expo Mobile apps with 7-day staff invitations.',
          'Introduced SHA-256 hashed scoped X-API-Keys and transactional Outbox HMAC-SHA256 webhook delivery logs.',
        ],
      },
    ];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-amber-700">Resources, Help Center &amp; Changelog</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Everything you need to launch, migrate, and scale your fuel operations.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Browse operational playbooks, answers to common station questions, and our latest Java 25 &amp;
            TypeScript production releases.
          </p>
        </div>

        {/* 3 Quick-Start Playbooks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Fuel,
              tag: '48-Hour Playbook',
              title: 'First Station Commissioning Guide',
              desc: 'Step-by-step checklist for tank calibration, initial nozzle totalizer snapshot, fuel grade tariffs, and attendant shift training.',
              action: () => onOpenConsole(),
              cta: 'Open Setup Wizard →',
            },
            {
              icon: Code2,
              tag: 'Developer Docs',
              title: 'OpenAPI 3.1 & Webhook Quickstart',
              desc: 'Generate a scoped X-API-Key, authenticate with Auth0 RS256 Bearer tokens, and verify HMAC-SHA256 signatures on your ERP.',
              action: () => onNavigate('api'),
              cta: 'Read API Docs →',
            },
            {
              icon: ShieldCheck,
              tag: 'Compliance Guide',
              title: 'SYSCOHADA & Fiscal Period Closing',
              desc: 'How to review daily Z-Reports, reconcile Orange Money & bank deposits, remit VAT 19.25%, and lock monthly periods.',
              action: () => onNavigate('security'),
              cta: 'View Controls →',
            },
          ].map((g) => {
            const Icon = g.icon;
            return (
              <div key={g.title} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-amber-700 font-semibold">
                    <Icon className="w-4 h-4" />
                    <span>{g.tag}</span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-slate-900">{g.title}</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">{g.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={g.action}
                  className="text-sm font-semibold text-amber-700 hover:text-amber-800 text-left"
                >
                  {g.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Interactive FAQ */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-amber-600" /> Frequently Asked Questions
              </h2>
              <p className="text-sm text-slate-500 mt-1">Answers for owners, accountants, and IT administrators.</p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={faqQuery}
                onChange={(e) => setFaqQuery(e.target.value)}
                placeholder="Search FAQ (offline, VAT, VPS...)"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={faq.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-semibold text-slate-900 text-sm sm:text-base">{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">{faq.a}</div>
                  )}
                </div>
              );
            })}
            {filteredFaqs.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">
                No matching FAQ entries.{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('contact')}
                  className="text-amber-700 font-semibold hover:underline"
                >
                  Ask our onboarding team directly →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Changelog */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" /> Platform Changelog
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('status')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              All Systems Operational →
            </button>
          </div>
          <div className="space-y-4">
            {releases.map((r) => (
              <div key={r.version} className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm font-bold px-2.5 py-1 rounded bg-slate-900 text-amber-400">
                    {r.version}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{r.tag}</span>
                  <span className="text-xs text-slate-500">· {r.date}</span>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  {r.items.map((it) => (
                    <li key={it} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 7. LIVE SYSTEM STATUS & SLA PAGE
  // =========================================================================
  const services = [
    { name: 'Core Forecourt & Shift API (Java 25 Spring Boot)', uptime: '99.98%', latency: '42 ms' },
    { name: 'PostgreSQL 17 ACID Accounting & Ledger Cluster', uptime: '99.99%', latency: '8 ms' },
    { name: 'Auth0 OIDC PKCE & Identity Gateway', uptime: '99.99%', latency: '64 ms' },
    { name: 'Mobile Offline Sync & Transactional Outbox Relay', uptime: '99.96%', latency: '51 ms' },
    { name: 'AES-256-GCM HMAC Webhook Delivery Engine', uptime: '99.95%', latency: '112 ms' },
    { name: 'Gemini AI Operations Copilot', uptime: '99.92%', latency: '480 ms' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            All Systems Operational
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            OpesFuel Platform Status &amp; 99.9% SLA
          </h1>
          <p className="text-sm text-slate-600">
            Real-time operational health across API gateways, ACID ledgers, mobile sync, and webhooks.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 text-white text-right shrink-0">
          <div className="text-[11px] font-mono text-slate-400 uppercase">90-Day Composite Uptime</div>
          <div className="font-mono text-2xl font-bold text-emerald-400">99.97%</div>
        </div>
      </div>

      <div className="space-y-4">
        {services.map((svc) => (
          <div key={svc.name} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-sm text-slate-900">{svc.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-slate-500">Avg {svc.latency}</span>
                <span className="font-semibold text-emerald-700">{svc.uptime} · Operational</span>
              </div>
            </div>
            <div className="flex gap-0.5 h-3" aria-label="30-day uptime bar">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[2px] bg-emerald-500/85 hover:bg-emerald-600 transition-colors"
                  title={`Day -${30 - i}: 100% operational`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" /> Recent Maintenance &amp; Incident History
        </h2>
        <div className="divide-y divide-slate-100 text-sm">
          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <span className="font-semibold text-slate-900">Flyway V6 Multi-Tenant SaaS Control Plane Migration</span>
              <p className="text-xs text-slate-500">Zero-downtime online schema rollout completed cleanly.</p>
            </div>
            <span className="font-mono text-xs text-emerald-700 font-semibold shrink-0">Completed · 0 min downtime</span>
          </div>
          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <span className="font-semibold text-slate-900">Past 90 Days Unplanned Outages</span>
              <p className="text-xs text-slate-500">No severity-1 or severity-2 service interruptions recorded.</p>
            </div>
            <span className="font-mono text-xs text-slate-500 shrink-0">0 Incidents</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <span className="text-xs text-slate-500">
          Need dedicated enterprise SLA reporting or private VPS architecture?
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onNavigate('security')}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Security Trust Center
          </button>
          <button
            type="button"
            onClick={() => onNavigate('contact')}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};
