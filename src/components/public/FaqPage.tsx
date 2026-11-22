import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Search,
} from 'lucide-react';
import { PublicPage } from '../../domain/types';

interface FaqPageProps {
  onNavigate: (page: PublicPage) => void;
  onOpenConsole: () => void;
}

type FaqCategory =
  | 'ALL'
  | 'GETTING_STARTED'
  | 'SHIFTS_CASH'
  | 'TANKS_FUEL'
  | 'PAYMENTS_FLEET'
  | 'ACCOUNTING_PRICING';

interface FaqItem {
  category: Exclude<FaqCategory, 'ALL'>;
  q: string;
  a: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    category: 'GETTING_STARTED',
    q: 'How fast can I start using OpesFuel at my petrol station?',
    a: 'Most single stations go live within 24 to 48 hours. You enter your underground tank capacities, opening dipstick volumes, current pump meter readings, fuel prices, and staff names—and your attendants can open their first shift the very same day.',
  },
  {
    category: 'GETTING_STARTED',
    q: 'Do I need to buy new fuel dispensers or expensive hardware first?',
    a: 'No. OpesFuel works immediately with your existing mechanical or electronic fuel pumps and manual dipstick charts. Whenever you decide to install automatic underground tank gauges (ATG) or connect dispenser controllers later, OpesFuel supports them too.',
  },
  {
    category: 'GETTING_STARTED',
    q: 'Will my pump attendants and station managers find it easy to use?',
    a: 'Yes. Attendants only see the simple screens they need—opening a shift, entering the closing meter, logging Cash/Orange Money/MoMo, and checking approved fleet plates. Managers and owners see full stock, expenses, and profit views.',
  },
  {
    category: 'SHIFTS_CASH',
    q: 'How does OpesFuel stop cash theft and shortages at shift change?',
    a: 'Every shift opens with the exact locked meter reading from the previous closed shift so no fuel can be hidden between shifts. When closing, OpesFuel calculates exact FCFA expected from litres dispensed and compares it immediately against Cash, Orange Money, MTN MoMo, Card slips, and Fleet vouchers.',
  },
  {
    category: 'SHIFTS_CASH',
    q: 'What if an attendant or manager tries to go back and change yesterday’s numbers?',
    a: 'Closed shifts can never be silently edited or deleted. If a genuine typing error happened, a manager must use the audited Void Shift action—which leaves a permanent trail showing who reversed it and why. Once your accountant locks a completed month, nobody can alter past figures.',
  },
  {
    category: 'SHIFTS_CASH',
    q: 'What happens if the internet goes down at the station?',
    a: 'Your station never stops selling. On the OpesFuel Android and iPhone app, shift closings, dipsticks, and shop sales save safely on the phone while offline and sync automatically to your cloud account the moment mobile data or Wi-Fi returns—with zero duplicate entries.',
  },
  {
    category: 'TANKS_FUEL',
    q: 'How do I catch fuel shortages during tanker deliveries?',
    a: 'Record your dipstick reading before and after every tanker offload. OpesFuel compares the supplier delivery note litres against the actual litres that entered your underground tank and highlights any shortage immediately—before the truck leaves your forecourt.',
  },
  {
    category: 'TANKS_FUEL',
    q: 'How does OpesFuel help me detect underground tank leaks or evaporation?',
    a: 'Every litre sold at a pump automatically deducts from the linked underground tank’s book stock. When your manager enters the daily physical dipstick reading (or automatic tank gauge reading), OpesFuel compares book stock vs. physical stock—including 15°C temperature adjustment—and alerts you immediately if fuel is missing.',
  },
  {
    category: 'TANKS_FUEL',
    q: 'Can OpesFuel manage Super, Gasoil, Kerosene, LPG, and Lubricants together?',
    a: 'Yes. You can track all fuel grades (Super, Gasoil, Kerosene, Bulk LPG, Heavy Fuel) across separate underground tanks while also managing engine oils, gas cylinders, filters, and mini-mart items in the built-in Shop POS.',
  },
  {
    category: 'PAYMENTS_FLEET',
    q: 'Can attendants accept Cash, Orange Money, MTN MoMo, and Card in the same shift?',
    a: 'Yes. Every shift closing screen separates Cash, Orange Money, MTN MoMo, Bank Card POS, and Corporate Fleet vouchers so you know exactly how much cash belongs in the safe and how much money arrived in your mobile wallets.',
  },
  {
    category: 'PAYMENTS_FLEET',
    q: 'How do corporate fleet credit accounts work?',
    a: 'Create an account for each corporate client, set their maximum credit limit in FCFA, and register their approved vehicle license plates and drivers. If a company exceeds their limit or delays payment, set them to HOLD so attendants cannot dispense more fuel on credit until they pay.',
  },
  {
    category: 'PAYMENTS_FLEET',
    q: 'Can I monitor multiple petrol stations from my phone?',
    a: 'Yes. Station network owners can view each station individually or switch to All Stations to see consolidated daily sales, fuel reserves, cash collected, and net profit across every site in real time.',
  },
  {
    category: 'ACCOUNTING_PRICING',
    q: 'Do I still need to pay someone to type daily sales into Excel or accounting software?',
    a: 'No. Every closed pump shift, tanker delivery, station expense, bank deposit, and staff payroll run automatically generates balanced SYSCOHADA & IFRS accounting records, Daily Z-Reports, Profit & Loss, Balance Sheet, and VAT (19.25%) figures.',
  },
  {
    category: 'ACCOUNTING_PRICING',
    q: 'How does shortage-only staff payroll work?',
    a: 'OpesFuel keeps a transparent monthly log of every employee’s base salary and any unresolved shift cash shortages. At month-end, payroll calculates exact net pay automatically and generates printable payslips for every worker.',
  },
  {
    category: 'ACCOUNTING_PRICING',
    q: 'How much does OpesFuel cost, and are there hidden fees?',
    a: 'Cloud plans start at 25,000 FCFA per station per month with all core forecourt, tank, mobile app, and accounting tools included—and you save 15% on annual billing. Larger oil marketers can also choose Growth Network plans or a one-time Private Server (VPS) license.',
  },
  {
    category: 'ACCOUNTING_PRICING',
    q: 'Do I keep ownership of my station data if I ever want to export it?',
    a: '100% yes. Your sales history, tank logs, customer statements, and accounting ledgers belong strictly to you. You can export reports anytime in CSV, PDF, and SYSCOHADA formats, or host the entire system on your own private server.',
  },
];

const CATEGORIES: { id: FaqCategory; label: string }[] = [
  { id: 'ALL', label: 'All Questions (16)' },
  { id: 'GETTING_STARTED', label: 'Getting Started' },
  { id: 'SHIFTS_CASH', label: 'Shifts & Cash Control' },
  { id: 'TANKS_FUEL', label: 'Tanks & Fuel Loss' },
  { id: 'PAYMENTS_FLEET', label: 'MoMo & Fleet Credit' },
  { id: 'ACCOUNTING_PRICING', label: 'Accounting & Pricing' },
];

export const FaqPage: React.FC<FaqPageProps> = ({ onNavigate, onOpenConsole }) => {
  const [category, setCategory] = useState<FaqCategory>('ALL');
  const [query, setQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const visible = FAQ_ITEMS.filter((item) => {
    const matchCat = category === 'ALL' || item.category === category;
    const matchQuery =
      !query.trim() ||
      item.q.toLowerCase().includes(query.toLowerCase()) ||
      item.a.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 space-y-10">
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700">
          <HelpCircle className="w-4 h-4" /> Frequently Asked Questions
        </div>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">
          Straight answers for petrol station owners &amp; managers.
        </h1>
        <p className="text-base text-slate-600 max-w-2xl leading-relaxed">
          Everything you need to know about stopping cash shortages, monitoring underground tanks, working
          offline, paying in FCFA, and getting your station running quickly.
        </p>
      </div>

      {/* Search + Category Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenIndex(0);
            }}
            placeholder="Search a question (e.g. Orange Money, tanker delivery, internet outage, cost...)"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCategory(c.id);
                setOpenIndex(0);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                category === c.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion List */}
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden">
        {visible.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <span className="font-display font-bold text-slate-900 text-sm sm:text-base">
                  {item.q}
                </span>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">{item.a}</div>
              )}
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="p-10 text-center space-y-2">
            <div className="text-sm font-semibold text-slate-900">No matching questions found.</div>
            <p className="text-xs text-slate-500">
              Try a different keyword, browse our step-by-step Documentation, or message our team directly.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Help Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h2 className="font-display text-xl sm:text-2xl font-bold">Still have a question about your station?</h2>
          <p className="text-sm text-slate-300">
            Browse our step-by-step Station Manual or speak with an onboarding advisor today.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('docs')}
            className="px-4 py-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-white text-sm font-semibold"
          >
            Read Documentation
          </button>
          <button
            type="button"
            onClick={() => onNavigate('contact')}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
          >
            Ask Our Team <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenConsole}
            className="px-4 py-2.5 rounded-lg bg-white text-slate-950 hover:bg-slate-100 text-sm font-semibold"
          >
            Try Live Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
