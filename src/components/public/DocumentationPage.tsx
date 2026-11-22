import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  CreditCard,
  FileText,
  Fuel,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { PublicPage } from '../../domain/types';

interface DocumentationPageProps {
  onNavigate: (page: PublicPage) => void;
  onOpenConsole: () => void;
}

interface DocSection {
  id: string;
  group: 'Station Operations Manual' | 'Finance & Staff Guides' | 'IT & Technical Setup';
  title: string;
  readTime: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: { heading: string; body: string; tip?: string }[];
  checklist: string[];
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'quick-start',
    group: 'Station Operations Manual',
    title: '1. Setting Up Your First Petrol Station',
    readTime: '5 min read',
    summary:
      'Get your station ready to run live shifts in under an hour. Enter your underground tanks, link each fuel nozzle, set today’s selling prices, and add your staff.',
    icon: Fuel,
    steps: [
      {
        heading: 'Step 1 — Create Your Station Profile',
        body: 'Sign in as the Station Owner and open Admin & Billing → Stations. Enter your station name (e.g., Bonabéri Main Forecourt), city, and opening fuel prices per litre for Super, Gasoil, Kerosene, or LPG.',
      },
      {
        heading: 'Step 2 — Add Your Underground Tanks & Opening Stock',
        body: 'Open Tanks & Deliveries and create one record per underground tank. Enter the tank capacity (for example 40,000 L), the current physical dipstick volume in litres, and your current purchase cost per litre so profit margins calculate accurately from day one.',
        tip: 'Measure every tank with your dipstick at the start of the day before opening the first shift so your book stock matches physical fuel.',
      },
      {
        heading: 'Step 3 — Register Your Pump Nozzles & Starting Meter Readings',
        body: 'Open Forecourt & Shifts → Add Pump. Assign each pump nozzle (P1, P2, P3…) to its underground tank and enter the exact current totalizer reading shown on the dispenser screen.',
      },
      {
        heading: 'Step 4 — Invite Your Manager, Attendants & Accountant',
        body: 'Go to Staff & Payroll to add your team and send 7-day email invitations. Each person only sees the screens allowed for their role—attendants cannot see owner profits or edit past records.',
      },
    ],
    checklist: [
      'Every underground tank has a starting dipstick reading and cost per litre',
      'Every active nozzle is linked to the right tank with its current meter reading',
      'Fuel selling prices match the station price totem outside',
      'Each staff member has their own personal login (never share passwords)',
    ],
  },
  {
    id: 'pump-shifts',
    group: 'Station Operations Manual',
    title: '2. Opening & Closing Daily Pump Shifts',
    readTime: '6 min read',
    summary:
      'Replace paper shift books with a clean 2-minute handover that automatically checks meter sales against Cash, Orange Money, MTN MoMo, Card POS, and Fleet vouchers.',
    icon: Wallet,
    steps: [
      {
        heading: 'Step 1 — Open a Shift at Handover',
        body: 'In Forecourt & Shifts, pick an idle pump and choose the attendant taking over. OpesFuel automatically locks the opening meter reading from the previous closed shift so no litres can be skipped between shifts.',
      },
      {
        heading: 'Step 2 — Enter Closing Meter & Collected Payments',
        body: 'At the end of the shift, click Close Shift. Enter the new meter reading from the pump display. OpesFuel calculates the exact litres sold and total FCFA expected. Next, enter the physical Cash handed over, Orange Money & MTN MoMo transfers received, Card slips, and Corporate Fleet vouchers.',
        tip: 'Always count physical cash and verify Mobile Money confirmation SMS messages before clicking Commit Shift.',
      },
      {
        heading: 'Step 3 — Instant Shortage or Overage Detection',
        body: 'Before you confirm, OpesFuel shows the exact difference in FCFA. If an attendant is short by 5,000 FCFA, the shortage is logged cleanly to their staff profile for review at month-end payroll.',
      },
      {
        heading: 'Step 4 — Fixing a Mistake Safely (Void & Re-Enter)',
        body: 'If a manager accidentally mistypes a meter reading, closed shifts are never silently erased. Instead, click Void Shift—OpesFuel automatically reverses the sale and tank deduction with a permanent audit record so you can enter the correct figures.',
      },
    ],
    checklist: [
      'Opening meter matches the closing meter of the previous shift',
      'Cash, Orange Money, MTN MoMo, and Fleet vouchers are entered separately',
      'Any cash shortage is reviewed with the attendant before signing off',
      'Daily sales and profit update immediately on the Owner Overview',
    ],
  },
  {
    id: 'tanks-deliveries',
    group: 'Station Operations Manual',
    title: '3. Tanker Deliveries, Dipsticks & Stopping Fuel Loss',
    readTime: '6 min read',
    summary:
      'Catch tanker delivery shortfalls before the truck leaves your station and spot underground leaks or evaporation early with daily dipstick and gauge comparisons.',
    icon: Truck,
    steps: [
      {
        heading: 'Step 1 — Order Fuel & Record the Tanker Arrival',
        body: 'Create a Purchase Order in Tanks & Deliveries when ordering from your depot supplier. When the truck arrives, dip the underground tank BEFORE offloading, offload the fuel, wait for foam to settle, and dip the tank AFTER offloading.',
      },
      {
        heading: 'Step 2 — Compare Bill-of-Lading vs. Actual Litres Received',
        body: 'Record the supplier delivery note litres alongside your actual measured litres received and cost per litre. OpesFuel immediately highlights any shortfall and recalculates your tank’s weighted average fuel cost automatically.',
      },
      {
        heading: 'Step 3 — Daily Physical Dipstick & Automatic Tank Gauge (ATG) Checks',
        body: 'At the end of each day, record a physical dipstick reading (or connect your automatic tank gauge). OpesFuel compares what SHOULD be in the tank (Book Stock) against what IS physically in the tank (Measured Stock) and alerts you if variance exceeds normal evaporation.',
        tip: 'Hot afternoon deliveries expand in volume. Use the 15°C temperature-adjusted check to verify whether a volume difference is thermal expansion or genuine fuel loss.',
      },
      {
        heading: 'Step 4 — Post Approved Shrinkage Adjustments',
        body: 'When a variance is confirmed, managers or accountants can post an approved Shrinkage Adjustment so book inventory stays realistic and accounting reflects true station margin.',
      },
    ],
    checklist: [
      'Dip the tank before and after every tanker offload',
      'Verify supplier invoice litres against physical volume received',
      'Record daily closing dipsticks for Super, Gasoil, and Kerosene',
      'Investigate any tank showing recurring negative variance over 3 days',
    ],
  },
  {
    id: 'fleet-credit',
    group: 'Station Operations Manual',
    title: '4. Corporate Fleet Credit & Vehicle Controls',
    readTime: '4 min read',
    summary:
      'Supply transport companies, factories, and NGOs on monthly credit without ever losing track of unpaid balances or letting unauthorized vehicles refuel.',
    icon: CreditCard,
    steps: [
      {
        heading: 'Step 1 — Open a Corporate Account & Set a Credit Limit',
        body: 'In Fleet Credit & POS, create the customer profile with their company name, contact phone, and maximum FCFA credit limit (for example 5,000,000 FCFA).',
      },
      {
        heading: 'Step 2 — Register Approved Vehicle Plates & Drivers',
        body: 'Add the exact license plates and authorized driver names allowed to refuel on that company’s account so attendants can verify every vehicle at the pump.',
      },
      {
        heading: 'Step 3 — Automatic Credit Hold Protection',
        body: 'If a customer reaches their credit limit or becomes overdue, flip their status to HOLD. Attendants are immediately blocked from issuing new credit vouchers until a payment is recorded.',
      },
      {
        heading: 'Step 4 — Monthly Statements & Recording Payments',
        body: 'Generate an itemized customer statement listing every date, vehicle plate, fuel grade, and litre dispensed. When the company pays by bank transfer, cheque, or cash, click Record Payment to clear their balance automatically.',
      },
    ],
    checklist: [
      'Every credit customer has a realistic FCFA credit limit',
      'Only whitelisted license plates are served on corporate credit',
      'Overdue accounts are placed on HOLD until payment clears',
      'Itemized PDF statements are sent on the 1st of every month',
    ],
  },
  {
    id: 'shop-pos',
    group: 'Station Operations Manual',
    title: '5. Lubricants, LPG Cylinders & Mini-Mart Sales',
    readTime: '3 min read',
    summary:
      'Track motor oil, brake fluid, filters, gas bottles, and convenience shop items alongside fuel—with automatic stock counts and real profit margins.',
    icon: FileText,
    steps: [
      {
        heading: 'Step 1 — Add Shop & Lubricant Products',
        body: 'In Fleet Credit & POS → Shop Inventory, add each item with its SKU, purchase cost, selling price, and current quantity on the shelf.',
      },
      {
        heading: 'Step 2 — Ring Up Counter Sales Quickly',
        body: 'Attendants or cashiers select the product, quantity, and payment method (Cash, Orange Money, MTN MoMo, or Card). Stock drops automatically and the revenue plus product cost is added to daily profit.',
      },
      {
        heading: 'Step 3 — Restock Before Best-Sellers Run Out',
        body: 'Monitor low-stock alerts on popular 1L/5L engine oils and 12.5 kg cooking gas cylinders so you never turn away high-margin shop customers.',
      },
    ],
    checklist: [
      'Purchase cost is entered for every lubricant and shop item',
      'Physical shelf counts are spot-checked weekly against system stock',
      'All counter sales are logged under the right payment method',
    ],
  },
  {
    id: 'staff-payroll',
    group: 'Finance & Staff Guides',
    title: '6. Staff Roster, Attendance & Shortage Payroll',
    readTime: '5 min read',
    summary:
      'Track when attendants arrive and leave, see every employee’s cash accuracy over the month, and run fair, transparent monthly payroll in minutes.',
    icon: Users,
    steps: [
      {
        heading: 'Step 1 — Maintain Your Employee Directory',
        body: 'In Staff & Payroll, record each employee’s full name, station assignment, job role (Attendant, Manager, Accountant), monthly base salary in FCFA, and hire date.',
      },
      {
        heading: 'Step 2 — Daily Clock-In & Clock-Out Tracking',
        body: 'Log daily arrival and departure times for each shift team so managers have a clear attendance history before approving monthly pay.',
      },
      {
        heading: 'Step 3 — Fair Shortage-Only Payroll Calculation',
        body: 'When you run monthly payroll, OpesFuel totals each employee’s base salary minus only verified, unresolved cash shortages from their closed shifts—never double-deducting or guessing from scratch paper.',
      },
      {
        heading: 'Step 4 — Individual Payslips & Automatic Salary Expense',
        body: 'Inspect or print each employee’s payslip breakdown. Approving the payroll run automatically records the salary expense in your station accounting reports.',
      },
    ],
    checklist: [
      'Every employee has an up-to-date base salary and role',
      'Shift cash shortages are reviewed weekly so there are no surprises on payday',
      'Monthly payroll run is approved once per calendar month',
    ],
  },
  {
    id: 'accounting-reports',
    group: 'Finance & Staff Guides',
    title: '7. Profit Reports, VAT & Locking Closed Months',
    readTime: '5 min read',
    summary:
      'Your daily Profit & Loss, Balance Sheet, Trial Balance, and VAT (19.25%) figures update automatically from forecourt operations—ready for your accountant or tax office.',
    icon: BookOpen,
    steps: [
      {
        heading: 'Step 1 — Record Station Expenses & Bank Deposits',
        body: 'In Accounting & Reports, log daily station expenses (generator diesel, electricity, security, repairs) and record every bank deposit or mobile money sweep from your cash safe to your bank account.',
      },
      {
        heading: 'Step 2 — Review Daily Z-Report & Profit Statement',
        body: 'Open your Daily Z-Report at the end of every day to verify total litres sold, cash collected, mobile money balances, fuel cost, operating expenses, and true net profit in FCFA.',
      },
      {
        heading: 'Step 3 — Track VAT & Supplier Payments',
        body: 'View accumulated VAT payable (19.25%) from fuel sales and record official tax remittances or supplier bill payments so your Balance Sheet always shows exact amounts owed.',
      },
      {
        heading: 'Step 4 — Close & Lock Completed Months',
        body: 'Once your accountant finishes verifying a month, click Close & Lock Period. Locked months cannot be modified or backdated by anyone—protecting your financial records for audits and bank loans.',
      },
    ],
    checklist: [
      'Cash safe deposits match bank deposit slips every week',
      'All generator, utility, and maintenance bills are logged as expenses',
      'Monthly VAT remittance and supplier payments are recorded',
      'Completed months are locked after accountant review',
    ],
  },
  {
    id: 'mobile-offline',
    group: 'Finance & Staff Guides',
    title: '8. Using the Android & iPhone App (Even Offline)',
    readTime: '4 min read',
    summary:
      'Equip station owners, managers, and pump attendants with the dedicated OpesFuel mobile app—designed with a clean side menu, bottom tab bar, and offline safety.',
    icon: Smartphone,
    steps: [
      {
        heading: 'Step 1 — Navigate Easily With the Menu & Bottom Tabs',
        body: 'Use the bottom bar for 1-tap access to Shifts, Tanks, POS, and Reports, or tap the top-left Menu button (☰) to open the slide-over drawer for Station Setup, Role info, and Sync status.',
      },
      {
        heading: 'Step 2 — Keep Working When Station Internet Drops',
        body: 'If mobile data or Wi-Fi goes down on the forecourt, attendants can still close shifts, log dipsticks, and record shop sales. Every entry is saved safely on the phone in an offline queue.',
      },
      {
        heading: 'Step 3 — Automatic Duplicate-Free Cloud Sync',
        body: 'The moment internet connectivity returns, tap Sync Now (or let the app sync automatically). Every queued entry uploads cleanly to your station account with zero double-counting.',
      },
    ],
    checklist: [
      'Attendants sign in with their own staff account on the forecourt phone',
      'Check the top-right sync indicator at the end of each day to confirm 0 pending items',
      'Owners can monitor live daily revenue and tank reserves from anywhere',
    ],
  },
  {
    id: 'erp-integrations',
    group: 'IT & Technical Setup',
    title: '9. Connecting Accounting Software, Probes & Webhooks',
    readTime: '5 min read',
    summary:
      'For IT teams and fuel networks connecting OpesFuel to Sage 100c, Odoo, SAP, or automatic tank gauges (ATG).',
    icon: Code2,
    steps: [
      {
        heading: 'Step 1 — Generate a Scoped API Key',
        body: 'In the console under API & Events, click Generate Key and give it a clear label (e.g., "Odoo HQ Connector"). Copy the secret once and store it in your integration server.',
      },
      {
        heading: 'Step 2 — Subscribe to Real-Time Event Webhooks',
        body: 'Register your HTTPS endpoint to receive signed real-time alerts whenever a pump shift closes, a tanker is delivered, or a tank variance is flagged.',
      },
      {
        heading: 'Step 3 — Inspect the OpenAPI 3.1 Reference',
        body: 'Use the Developer API page for full endpoint paths, request/response schemas, and live JSON payload examples across all 88 endpoints.',
      },
    ],
    checklist: [
      'Rotate API keys whenever an external contractor changes',
      'Verify HMAC-SHA256 signatures on all incoming webhook events',
      'Use CSV/PDF exports if your external accountant prefers manual monthly imports',
    ],
  },
  {
    id: 'vps-deployment',
    group: 'IT & Technical Setup',
    title: '10. Private Server (VPS) Hosting & Security Setup',
    readTime: '5 min read',
    summary:
      'For enterprise groups and sovereign licensees hosting OpesFuel on their own private cloud or in-country Linux VPS.',
    icon: Server,
    steps: [
      {
        heading: 'Step 1 — Provision Server & Domain with HTTPS',
        body: 'Deploy on any Ubuntu/Debian Linux VPS with Docker, PostgreSQL 17, and Nginx TLS (Let’s Encrypt) using the included production compose bundle.',
      },
      {
        heading: 'Step 2 — Configure Auth0 Login & Environment Secrets',
        body: 'Populate your `.env.production` file with your PostgreSQL password, Auth0 domain/audience/client ID, and 32-byte encryption key for webhook secrets.',
      },
      {
        heading: 'Step 3 — Schedule Automated Daily Database Backups',
        body: 'Enable encrypted nightly `pg_dump` backups to off-site object storage so your financial ledger can be restored cleanly in the event of server hardware failure.',
      },
    ],
    checklist: [
      'HTTPS TLS certificate is active and auto-renewing',
      'Nightly encrypted database backups are tested monthly',
      'Database port 5432 is restricted to private local network only',
    ],
  },
];

export const DocumentationPage: React.FC<DocumentationPageProps> = ({
  onNavigate,
  onOpenConsole,
}) => {
  const [activeId, setActiveId] = useState<string>(DOC_SECTIONS[0].id);
  const [query, setQuery] = useState('');

  const filtered = DOC_SECTIONS.filter(
    (s) =>
      !query.trim() ||
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.summary.toLowerCase().includes(query.toLowerCase()) ||
      s.steps.some(
        (st) =>
          st.heading.toLowerCase().includes(query.toLowerCase()) ||
          st.body.toLowerCase().includes(query.toLowerCase())
      )
  );

  const activeDoc =
    filtered.find((s) => s.id === activeId) ?? filtered[0] ?? DOC_SECTIONS[0];
  const currentIdx = DOC_SECTIONS.findIndex((s) => s.id === activeDoc.id);
  const nextDoc = currentIdx >= 0 && currentIdx < DOC_SECTIONS.length - 1 ? DOC_SECTIONS[currentIdx + 1] : null;
  const ActiveIcon = activeDoc.icon;

  const groups: DocSection['group'][] = [
    'Station Operations Manual',
    'Finance & Staff Guides',
    'IT & Technical Setup',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-slate-200">
        <div className="max-w-2xl space-y-3">
          <div className="text-sm font-semibold text-amber-700">OpesFuel Documentation &amp; User Manual</div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Clear step-by-step guides to run your petrol station smoothly.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Written in plain everyday language for station owners, forecourt managers, pump attendants, and
            accountants—plus dedicated IT &amp; ERP setup chapters at the end.
          </p>
        </div>

        <div className="w-full lg:w-80 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guides (dipstick, payroll, VAT...)"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{filtered.length} of {DOC_SECTIONS.length} chapters</span>
            <button
              type="button"
              onClick={() => onNavigate('faq')}
              className="font-semibold text-amber-700 hover:underline"
            >
              Read Quick FAQ →
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar + Main Article */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          {groups.map((grp) => {
            const groupItems = filtered.filter((d) => d.group === grp);
            if (groupItems.length === 0) return null;
            return (
              <div key={grp} className="space-y-1.5">
                <div className="px-2 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  {grp}
                </div>
                <div className="space-y-1">
                  {groupItems.map((doc) => {
                    const Icon = doc.icon;
                    const selected = doc.id === activeDoc.id;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => {
                          setActiveId(doc.id);
                          window.scrollTo({ top: 180, behavior: 'smooth' });
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm transition-colors ${
                          selected
                            ? 'bg-slate-900 text-white font-semibold shadow-xs'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${selected ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span className="truncate">{doc.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <ShieldCheck className="w-4 h-4 text-amber-700" /> Need Live Staff Training?
            </div>
            <p className="text-xs text-amber-900/80 leading-relaxed">
              Our onboarding specialists train your station managers and attendants in under 2 hours via video
              call or on-site rollout.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="text-xs font-bold text-amber-800 hover:underline"
            >
              Schedule Onboarding Session →
            </button>
          </div>
        </aside>

        {/* Active Documentation Content */}
        <article className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 space-y-8">
          <div className="space-y-3 pb-6 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                {activeDoc.group}
              </span>
              <span className="text-slate-500">{activeDoc.readTime}</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <ActiveIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                  {activeDoc.title}
                </h2>
                <p className="text-sm sm:text-base text-slate-600 mt-1.5 leading-relaxed">
                  {activeDoc.summary}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {activeDoc.steps.map((step) => (
              <section key={step.heading} className="space-y-2">
                <h3 className="font-display text-lg font-bold text-slate-900">{step.heading}</h3>
                <p className="text-sm text-slate-700 leading-relaxed">{step.body}</p>
                {step.tip && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 leading-relaxed">
                    <span className="font-bold">Station Best Practice:</span> {step.tip}
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Practical Manager Checklist */}
          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="font-display text-base font-bold text-slate-900">
              Quick Verification Checklist
            </h3>
            <ul className="space-y-2">
              {activeDoc.checklist.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer Navigation */}
          <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={onOpenConsole}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
            >
              Try This in Your Station Workspace <ArrowRight className="w-4 h-4" />
            </button>
            {nextDoc ? (
              <button
                type="button"
                onClick={() => {
                  setActiveId(nextDoc.id);
                  window.scrollTo({ top: 180, behavior: 'smooth' });
                }}
                className="text-sm font-semibold text-slate-800 hover:text-amber-700"
              >
                Next Guide: {nextDoc.title} →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('api')}
                className="text-sm font-semibold text-amber-700 hover:underline"
              >
                Open Full Developer API Spec →
              </button>
            )}
          </div>
        </article>
      </div>
    </div>
  );
};
