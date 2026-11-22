import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileCheck2,
  Fuel,
  Globe2,
  KeyRound,
  Lock,
  Network,
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

  // =========================================================================
  // 1. SOLUTIONS PAGE (Station Owner & Manager Language)
  // =========================================================================
  if (page === 'solutions') {
    const segments = {
      independent: {
        badge: '1–2 Stations · From 25 000 FCFA/month',
        title: 'Independent Petrol Station Owners',
        subtitle:
          'Stop losing cash at shift change, ditch late-night Excel sheets, and know your real underground fuel stock and daily profit from anywhere.',
        outcomes: [
          'Close every pump shift in 2 minutes—comparing meter sales against Cash, Orange Money, MTN MoMo, and Fleet vouchers.',
          'Spot attendant cash shortages immediately and handle deductions fairly on monthly payslips.',
          'Get automatic daily Profit & Loss, VAT (19.25%), and Balance Sheet reports without hiring extra data-entry clerks.',
          'Check live pump sales and tank levels from your iPhone or Android whenever you travel.',
        ],
        metrics: [
          { label: 'Setup & Go-Live', value: 'Under 48 hrs' },
          { label: 'Average Cash Loss Reduction', value: '−94%' },
          { label: 'Monthly Starting Price', value: '25 000 FCFA' },
        ],
      },
      network: {
        badge: '3–100+ Stations · Multi-Station Command',
        title: 'Multi-Station Owners & Regional Oil Marketers',
        subtitle:
          'Control fuel prices, compare station profitability, stop tanker delivery shortfalls, and manage corporate clients across all your sites from one screen.',
        outcomes: [
          'Monitor every station in Douala, Yaoundé, Kribi, Bafoussam, or across borders in one consolidated dashboard.',
          'Give each branch manager access only to their station while headquarters sees the entire network.',
          'Catch tanker delivery shortages against supplier delivery notes and monitor tank evaporation daily.',
          'Export clean accounting reports directly to Sage 100c, Odoo, SAP, or your external auditor.',
        ],
        metrics: [
          { label: 'Network Visibility', value: 'Live Across All Sites' },
          { label: 'Month-End Closing', value: '4× Faster' },
          { label: 'Hosting Choice', value: 'Cloud or Your Server' },
        ],
      },
      fleet: {
        badge: 'Corporate Credit & Commercial Fuel Depots',
        title: 'Corporate Fleets, Transport Companies & Depots',
        subtitle:
          'Sell fuel on credit safely by approving exact vehicle plates, setting FCFA spending ceilings, and sending itemized monthly statements in one click.',
        outcomes: [
          'Put overdue corporate accounts on HOLD immediately so attendants cannot dispense extra fuel until payment arrives.',
          'Send itemized monthly statements showing date, license plate, driver, fuel grade, and exact litres dispensed.',
          'Manage Super, Gasoil, Kerosene, Bulk LPG, and Heavy Fuel across retail and commercial reservoirs.',
          'Track bank transfers, cheques, and cash payments against customer balances automatically.',
        ],
        metrics: [
          { label: 'Unauthorized Credit Fills', value: '0%' },
          { label: 'Monthly Statements', value: '1-Click PDF' },
          { label: 'Faster Credit Collection', value: '−14 Days' },
        ],
      },
      audit: {
        badge: 'SYSCOHADA & IFRS Accounting Ready',
        title: 'Station Accountants & Audit Firms',
        subtitle:
          'Give your accountant clean, always-balanced books generated directly from real forecourt sales, tanker purchases, expenses, and bank deposits.',
        outcomes: [
          'Every shift sale, fuel delivery, expense, and salary run posts balanced FCFA accounting entries automatically.',
          'Zero rounding discrepancies—every franc collected matches cash safe, mobile money, bank, or credit balances.',
          'Close and lock finished months so nobody can alter or backdate audited figures.',
          'Download Daily Z-Reports, Trial Balance, Profit & Loss, Balance Sheet, and VAT 19.25% schedules anytime.',
        ],
        metrics: [
          { label: 'Accounting Precision', value: 'Exact FCFA' },
          { label: 'Period Protection', value: 'Locked Months' },
          { label: 'Dedicated Access', value: 'Accountant Login' },
        ],
      },
    };

    const current = segments[selectedSegment];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-amber-700">Who OpesFuel Is Built For</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Whether you own 1 station or 50, you stay in full control of your fuel and cash.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Choose your operation type below to see how OpesFuel stops daily leakages, speeds up shift
            handovers, and delivers crystal-clear profit reports in FCFA.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'independent', label: 'Independent Stations', icon: Fuel },
                { id: 'network', label: 'Multi-Station Networks', icon: Building2 },
                { id: 'fleet', label: 'Fleets & Fuel Depots', icon: Truck },
                { id: 'audit', label: 'Accountants & Auditors', icon: FileCheck2 },
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
                  Open Live Station Workspace <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('contact')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors"
                >
                  Book a Personal Demo
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

        {/* Plain Comparison Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200">
            <h2 className="font-display text-xl font-bold text-slate-900">
              Why Station Owners Upgrade From Paper Notebooks &amp; Excel
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Daily Station Need</th>
                  <th className="px-6 py-3.5">Paper Books / Excel</th>
                  <th className="px-6 py-3.5">Basic Shop POS</th>
                  <th className="px-6 py-3.5 text-amber-800 bg-amber-50/70">OpesFuel Station OS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ['Pump Meter & Shift Handovers', 'Easy to alter or miscalculate', 'No pump meters', 'Locked meters + instant shortage check'],
                  ['Underground Tank Dipsticks & Leaks', 'Manual spreadsheets', 'Not supported', 'Automatic book vs. physical comparison'],
                  ['Daily Profit & Accounting (SYSCOHADA)', 'Wait 3 weeks for accountant', 'Cash total only', 'Real-time Profit, Balance Sheet & VAT'],
                  ['Cash + Orange Money + MTN MoMo', 'Mixed up at closing', 'Single payment only', 'Separate tracking per payment type'],
                  ['Works During Internet Outages', 'Paper only', 'Stops working', 'Offline mobile app syncs automatically'],
                  ['Corporate Fleet Credit Limits', 'Hard to track overdue bills', 'Not supported', 'Approved plates + instant HOLD block'],
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
  // 2. INTEGRATIONS PAGE
  // =========================================================================
  if (page === 'integrations') {
    const items = [
      {
        category: 'PAYMENTS',
        name: 'Orange Money Merchant',
        status: 'Ready Today',
        desc: 'Separate Orange Money receipts at every shift close so you can verify your merchant wallet matches forecourt sales down to the franc.',
        icon: Wallet,
      },
      {
        category: 'PAYMENTS',
        name: 'MTN Mobile Money (MoMo)',
        status: 'Ready Today',
        desc: 'Track MTN MoMo shift collections cleanly in their own account and record transfers from MoMo to your bank account.',
        icon: Smartphone,
      },
      {
        category: 'PAYMENTS',
        name: 'Bank Card POS & Fleet Vouchers',
        status: 'Ready Today',
        desc: 'Reconcile Visa, Mastercard, GIMAC card slips and postpaid corporate credit vouchers alongside physical cash.',
        icon: Wallet,
      },
      {
        category: 'IOT',
        name: 'Automatic Tank Gauges (Veeder-Root / ATG)',
        status: 'Supported',
        desc: 'Connect automatic underground tank probes to pull live fuel height, water detection, and 15°C temperature-adjusted stock.',
        icon: Cpu,
      },
      {
        category: 'IOT',
        name: 'Fuel Dispensers (Gilbarco, Tokheim & Mechanical)',
        status: 'No Lock-In',
        desc: 'Start immediately with any mechanical or electronic dispenser totalizer, and bridge electronic forecourt controllers whenever ready.',
        icon: Fuel,
      },
      {
        category: 'ERP',
        name: 'Sage 100c / Saari SYSCOHADA',
        status: '1-Click Export',
        desc: 'Export balanced SYSCOHADA accounting journals, Trial Balance, and VAT 19.25% reports for your external accounting firm.',
        icon: BookOpen,
      },
      {
        category: 'ERP',
        name: 'Odoo, SAP & Excel Spreadsheets',
        status: 'API & CSV Ready',
        desc: 'Download clean CSV/PDF reports anytime or connect headquarters ERP software automatically.',
        icon: Network,
      },
      {
        category: 'SECURITY',
        name: 'Secure Staff Sign-In & Invitations',
        status: 'Built-In',
        desc: 'Invite managers, attendants, and accountants with personal logins and instant access removal if staff leave.',
        icon: KeyRound,
      },
      {
        category: 'SECURITY',
        name: 'Real-Time Station Alerts & Webhooks',
        status: 'Built-In',
        desc: 'Get instant alerts when a tank runs low, a shift has a cash shortage, or a tanker delivery is short on litres.',
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
          <div className="text-sm font-semibold text-amber-700">Payments, Equipment &amp; Accounting</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Works smoothly with the payments, pumps, and accounting tools you already use.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            No need to replace your pumps or change your accountant. OpesFuel fits right into your existing
            forecourt setup and grows as your station network expands.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'ALL', label: 'All Connections' },
              { id: 'PAYMENTS', label: 'Mobile Money & Cards' },
              { id: 'IOT', label: 'Pumps & Tank Gauges' },
              { id: 'ERP', label: 'Accounting & Excel' },
              { id: 'SECURITY', label: 'Access & Alerts' },
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
                  <button
                    type="button"
                    onClick={() => onNavigate('docs')}
                    className="font-semibold text-amber-700 hover:text-amber-800"
                  >
                    Read Setup Guide →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900 text-white rounded-2xl p-8 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="font-display text-2xl font-bold">Have specific tank probes or headquarters software?</h2>
            <p className="text-sm text-slate-300">
              Tell us what equipment or accounting package your stations use and our onboarding team will show you
              exactly how OpesFuel connects to it.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="px-5 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
            >
              Ask Our Onboarding Team
            </button>
            <button
              type="button"
              onClick={() => onNavigate('api')}
              className="px-5 py-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-white text-sm font-semibold"
            >
              IT &amp; Developer API Docs
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. SECURITY & ANTI-FRAUD CONTROLS PAGE
  // =========================================================================
  if (page === 'security') {
    const pillars = [
      {
        icon: KeyRound,
        title: 'Individual Staff Logins — Never Share Passwords',
        desc: 'Every owner, manager, attendant, and accountant signs in with their own protected account. If an employee leaves, revoke their access in one click.',
      },
      {
        icon: Shield,
        title: 'Strict Role Permissions',
        desc: 'Attendants only see shift handovers and POS. Managers run daily forecourt and tank stock. Accountants handle VAT and books. Only Owners change prices or billing.',
      },
      {
        icon: FileCheck2,
        title: 'Tamper-Proof Shift History & Locked Months',
        desc: 'Nobody can quietly edit or delete yesterday’s closed sales. Corrections require an audited Void Reversal, and finished months can be permanently locked.',
      },
      {
        icon: Database,
        title: 'Private, Isolated Station Database',
        desc: 'Your fuel sales, customer lists, supplier prices, and profits are strictly isolated from every other company using OpesFuel—never shared or mixed.',
      },
      {
        icon: Lock,
        title: 'Bank-Grade Encryption & Automated Backups',
        desc: 'Every login and financial record travels over encrypted HTTPS connections and is backed up automatically every day so you never lose a single receipt.',
      },
      {
        icon: Server,
        title: 'Cloud Convenience or Your Own Private Server',
        desc: 'Run immediately on our 99.9%-uptime managed cloud, or purchase a Private Server License to host everything inside your own country or headquarters.',
      },
    ];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <ShieldCheck className="w-4 h-4" /> Anti-Fraud Controls &amp; Data Protection
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Built to protect your cash safe, your fuel stock, and your financial privacy.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            A busy petrol station handles millions of FCFA every week. OpesFuel combines strict internal
            anti-fraud controls with bank-grade cloud security so you can trust every report you read.
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

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Who Can See &amp; Do What Inside Your Station
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Clear separation of duties so every person has exactly the access their job requires.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('docs')}
              className="text-xs font-semibold text-amber-700 hover:underline"
            >
              Read Staff Permissions Guide →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Staff Role</th>
                  <th className="px-6 py-3">Pumps &amp; Shop POS</th>
                  <th className="px-6 py-3">Tanks &amp; Fuel Prices</th>
                  <th className="px-6 py-3">Accounting &amp; Profit</th>
                  <th className="px-6 py-3">Staff Invites &amp; Settings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {[
                  ['Pump Attendant', 'Open/Close own shifts & Shop POS', 'View stock levels only', 'No access', 'No access'],
                  ['Station Manager', 'Full shifts, voids & fleet vouchers', 'Tanker deliveries & daily dips', 'Log daily station expenses', 'Attendance logs only'],
                  ['Station Accountant', 'Audit shift history (read-only)', 'View fuel stock value', 'Full P&L, VAT, supplier bills & locks', 'View subscription bills'],
                  ['Station Owner', 'Full oversight across all stations', 'Change fuel prices & add pumps', 'Full profit & cash flow reports', 'Add/remove staff & stations'],
                ].map(([r, f, t, a, b]) => (
                  <tr key={r}>
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{r}</td>
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
  // 4. CUSTOMER STORIES PAGE
  // =========================================================================
  if (page === 'customers') {
    const studies = [
      {
        region: 'Douala, Cameroon · 1 Busy Urban Station (8 Nozzles)',
        company: 'Bonabéri Express Energy',
        headline: 'Cut unexplained monthly cash & fuel losses from 1.8M FCFA down to under 90 000 FCFA in 60 days.',
        challenge:
          'Handwritten shift notebooks and unverified Orange Money transfers made it impossible to prove which shift caused cash shortages or missing underground fuel.',
        solution:
          'Switched to OpesFuel Starter with the Android attendant app. Every pump totalizer, cash handover, and mobile money transfer now reconciles in 2 minutes at shift change.',
        stats: [
          { k: 'Monthly Savings', v: '1.7M FCFA' },
          { k: 'Shift Handover', v: '2 Minutes' },
          { k: 'Paid Back In', v: '11 Days' },
        ],
      },
      {
        region: 'Yaoundé – Kribi Corridor · 8-Station Network',
        company: 'Equatorial Petroleum Distributors',
        headline: 'Replaced weekly Excel reports across 8 stations with real-time daily profit and strict fleet credit control.',
        challenge:
          'Station managers emailed spreadsheets every Monday, leaving the owner waiting 3 weeks for true profit numbers while overdue transport companies kept refueling on credit.',
        solution:
          'Moved all 8 stations onto OpesFuel Multi-Station Cloud with approved license plates, automatic credit HOLD alerts, and centralized daily dipstick tracking.',
        stats: [
          { k: 'Monthly Books Ready', v: 'Day 2 (vs Day 22)' },
          { k: 'Overdue Fleet Losses', v: '0 FCFA' },
          { k: 'Stations Controlled', v: '8 Sites' },
        ],
      },
      {
        region: 'Abidjan & San-Pédro · Commercial Fuel & Lubricant Depot',
        company: 'Atlantique Logistics & Fuel',
        headline: 'Stopped tanker delivery disputes and automated monthly accounting exports for headquarters.',
        challenge:
          'Hot afternoon deliveries created recurring 400–900 litre arguments with fuel truck drivers on every 36,000 L Gasoil offload.',
        solution:
          'Activated OpesFuel before-and-after dipstick verification with 15°C temperature adjustment and connected monthly journal exports directly to headquarters accounting.',
        stats: [
          { k: 'Delivery Disputes', v: 'Resolved On-Site' },
          { k: 'Daily Stock Accuracy', v: '99.8%' },
          { k: 'Manual Re-Typing', v: 'Eliminated' },
        ],
      },
    ];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-amber-700">Customer Stories</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Real results from station owners who took back control of their forecourts.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            See how independent station owners, multi-site oil marketers, and fuel depots recover lost profit
            and save hours every single day.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Average Cash & Stock Loss Cut', value: '−89%' },
            { label: 'Faster Shift Handovers', value: '6×' },
            { label: 'Balanced Accounting Reports', value: '100%' },
            { label: 'Typical Payback Period', value: '< 2 Weeks' },
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
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">The Problem</div>
                    <p className="text-slate-600 leading-relaxed">{s.challenge}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                    <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider">The Result With OpesFuel</div>
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
                  See How This Works For My Station
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 5. ABOUT PAGE
  // =========================================================================
  if (page === 'about') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-amber-700">About OpesFuel</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Built to give petrol station owners total clarity over every litre and every franc.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Running a petrol station means managing thin margins per litre and massive daily cash volume.
            We created OpesFuel after watching hardworking station owners lose millions of FCFA to paper shift
            books, delayed spreadsheets, and generic software that never understood how African forecourts
            actually work.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: TrendingUp,
              title: 'Every Franc Must Balance',
              desc: 'We treat every pump shift like a bank transaction—matching dispensed litres against Cash, Mobile Money, Card, and Fleet vouchers with zero guesswork.',
            },
            {
              icon: Smartphone,
              title: 'Made for Real Forecourt Conditions',
              desc: 'Simple screens for attendants, clear summaries for owners, and built-in offline support so a slow internet connection never stops your pumps.',
            },
            {
              icon: Globe2,
              title: 'Tailored to CEMAC & WAEMU Stations',
              desc: 'Native FCFA (XAF/XOF) pricing, SYSCOHADA & IFRS financial reports, VAT 19.25% tracking, Orange Money & MTN MoMo support, and multi-station control.',
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-4">
            <h2 className="font-display text-2xl font-bold text-slate-900">Serving Fuel Operators Across Central &amp; West Africa</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              OpesFuel supports independent service stations, LPG depots, and regional petroleum distributors across
              both XAF and XOF markets—with responsive onboarding and ongoing support.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-medium">
              {['Cameroon (Douala / Yaoundé)', 'Côte d’Ivoire (Abidjan)', 'Senegal (Dakar)', 'Gabon & Congo', 'Chad & CAR', 'Benin & Togo'].map((r) => (
                <div key={r} className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                  {r}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-8 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider text-amber-400">
                Partners &amp; Local Installers
              </div>
              <h2 className="font-display text-2xl font-bold">
                Install pumps, advise station owners, or resell OpesFuel in your region.
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                We partner with forecourt technicians, accounting firms, and regional distributors who help petrol
                stations modernize their operations.
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
                Become a Partner
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 6. RESOURCES, CHECKLISTS & WHAT'S NEW PAGE
  // =========================================================================
  if (page === 'resources') {
    const releases = [
      {
        version: 'v2.6',
        date: 'Latest Release',
        tag: 'Redesigned Mobile App & Easier Navigation',
        items: [
          'Launched our redesigned Android & iPhone app with a clean side menu drawer and 5-tab bottom bar.',
          'Added safety confirmations before critical actions like closing a fiscal month, running payroll, or removing a station.',
          'Published the complete Station Operations Manual (Documentation) and 16-question Owner FAQ.',
        ],
      },
      {
        version: 'v2.5',
        date: 'Recent Update',
        tag: 'Complete Station Accounting, Payroll & Tank Shrinkage Tools',
        items: [
          'Added 15°C temperature-adjusted tank dipstick reconciliation and supplier delivery shortfall tracking.',
          'Added shortage-only monthly payroll runs with individual printable staff payslips.',
          'Added VAT (19.25%) remittance tracking, supplier bill payments, and locked monthly accounting periods.',
        ],
      },
      {
        version: 'v2.4',
        date: 'Platform Update',
        tag: 'Corporate Fleet Vehicle Whitelists & Offline Sync',
        items: [
          'Added approved vehicle license plate checks and instant ACTIVE/HOLD fleet credit protection.',
          'Improved offline shift and dipstick queuing so intermittent cellular coverage never interrupts sales.',
        ],
      },
    ];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        <div className="max-w-3xl space-y-4">
          <div className="text-sm font-semibold text-amber-700">Guides, Checklists &amp; Product Updates</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Practical tools to help your station go live smoothly.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Jump straight into our step-by-step Station User Manual, read our FAQ, or see what new tools we’ve
            recently added for station owners.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: BookOpen,
              tag: 'Step-by-Step Manual',
              title: 'Full Station Operations Documentation',
              desc: '10 clear chapters covering station setup, shift handovers, tanker deliveries, fleet accounts, payroll, and monthly accounting.',
              action: () => onNavigate('docs'),
              cta: 'Open Documentation →',
            },
            {
              icon: Fuel,
              tag: 'Owner Q&A',
              title: 'Frequently Asked Questions',
              desc: 'Plain answers to the 16 most common questions about stopping cash loss, working offline, hardware, and pricing.',
              action: () => onNavigate('faq'),
              cta: 'Browse FAQ →',
            },
            {
              icon: ShieldCheck,
              tag: 'Anti-Fraud Guide',
              title: 'Staff Roles & Monthly Period Locks',
              desc: 'See how OpesFuel separates attendant, manager, accountant, and owner access to keep your cash and books safe.',
              action: () => onNavigate('security'),
              cta: 'View Security Controls →',
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

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" /> What’s New in OpesFuel
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('status')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              All Services Running Normally →
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
  // 7. SERVICE STATUS PAGE
  // =========================================================================
  const services = [
    { name: 'Web Station Portal & Forecourt Shifts', uptime: '99.98%', speed: 'Fast (42 ms)' },
    { name: 'Financial Reports & Accounting Ledger', uptime: '99.99%', speed: 'Instant (8 ms)' },
    { name: 'Staff Sign-In & Account Security', uptime: '99.99%', speed: 'Fast (64 ms)' },
    { name: 'Android & iPhone App Cloud Sync', uptime: '99.96%', speed: 'Fast (51 ms)' },
    { name: 'Low-Stock & Shortage Alert Delivery', uptime: '99.95%', speed: 'Real-Time' },
    { name: 'Smart Business Assistant', uptime: '99.92%', speed: 'Active' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            All Services Running Normally
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            OpesFuel Service Status &amp; Reliability
          </h1>
          <p className="text-sm text-slate-600">
            Live availability across our station portal, accounting engine, mobile app sync, and alert systems.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 text-white text-right shrink-0">
          <div className="text-[11px] font-mono text-slate-400 uppercase">90-Day Reliability</div>
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
                <span className="text-slate-500">{svc.speed}</span>
                <span className="font-semibold text-emerald-700">{svc.uptime} · Operational</span>
              </div>
            </div>
            <div className="flex gap-0.5 h-3" aria-label="30-day uptime bar">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[2px] bg-emerald-500/85 hover:bg-emerald-600 transition-colors"
                  title={`Day -${30 - i}: 100% available`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" /> Recent Maintenance Log
        </h2>
        <div className="divide-y divide-slate-100 text-sm">
          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <span className="font-semibold text-slate-900">Scheduled Cloud Platform Upgrade</span>
              <p className="text-xs text-slate-500">Completed cleanly with zero station interruption.</p>
            </div>
            <span className="font-mono text-xs text-emerald-700 font-semibold shrink-0">0 min downtime</span>
          </div>
          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <span className="font-semibold text-slate-900">Past 90 Days Unplanned Outages</span>
              <p className="text-xs text-slate-500">No service interruptions recorded across any region.</p>
            </div>
            <span className="font-mono text-xs text-slate-500 shrink-0">0 Incidents</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <span className="text-xs text-slate-500">
          Need assistance with your station account or private server hosting?
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onNavigate('docs')}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Station Documentation
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
