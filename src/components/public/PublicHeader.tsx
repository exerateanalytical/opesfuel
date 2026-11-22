import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BookOpen,
  Building2,
  ChevronDown,
  Code2,
  Cpu,
  FileCheck2,
  Fuel,
  HelpCircle,
  KeyRound,
  Mail,
  Menu,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { PublicPage } from '../../domain/types';
import { OpesFuelLogo } from '../brand/OpesFuelLogo';

interface PublicHeaderProps {
  activePage: PublicPage;
  onNavigate: (page: PublicPage) => void;
  onOpenConsole: () => void;
}

interface DropdownItem {
  id: PublicPage;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  key: 'features' | 'solutions' | 'company';
  label: string;
  items: DropdownItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'features',
    label: 'Features',
    items: [
      {
        id: 'platform',
        label: 'Station Management Features',
        desc: 'Pump shifts, underground tanks, fleet credit, payroll & profit reports',
        icon: Fuel,
      },
      {
        id: 'mobile',
        label: 'Android & iPhone App',
        desc: 'Manage shifts, dips & daily sales from your phone—even offline',
        icon: Smartphone,
        badge: 'Offline Ready',
      },
      {
        id: 'integrations',
        label: 'Payments, Gauges & Accounting',
        desc: 'Orange Money, MTN MoMo, Card POS, tank probes, Sage & Odoo',
        icon: Cpu,
      },
      {
        id: 'security',
        label: 'Anti-Fraud & Data Security',
        desc: 'Staff permissions, locked closed months & automatic cloud backups',
        icon: ShieldCheck,
      },
    ],
  },
  {
    key: 'solutions',
    label: 'Solutions',
    items: [
      {
        id: 'solutions',
        label: 'By Station Type',
        desc: 'Independent stations, multi-site networks, depots & accountants',
        icon: Building2,
      },
      {
        id: 'customers',
        label: 'Customer Stories',
        desc: 'How station owners cut cash & fuel losses and close books faster',
        icon: Users,
      },
      {
        id: 'licensing',
        label: 'Private Server & Buyout License',
        desc: 'Host on your own server with a one-time enterprise license',
        icon: KeyRound,
      },
    ],
  },
  {
    key: 'company',
    label: 'Company',
    items: [
      {
        id: 'about',
        label: 'About OpesFuel',
        desc: 'Our mission to help fuel station owners protect every litre & franc',
        icon: Sparkles,
      },
      {
        id: 'resources',
        label: 'Guides & What’s New',
        desc: '48-hour launch checklists and recent platform improvements',
        icon: BookOpen,
      },
      {
        id: 'status',
        label: 'Service Status',
        desc: 'Live reliability monitor and 99.9% uptime commitment',
        icon: Activity,
        badge: '99.97%',
      },
      {
        id: 'api',
        label: 'IT & Developer API',
        desc: 'Technical API documentation for ERP & hardware teams',
        icon: Code2,
      },
      {
        id: 'contact',
        label: 'Contact & Book a Demo',
        desc: 'Speak with an onboarding advisor for your petrol station',
        icon: Mail,
      },
      {
        id: 'legal',
        label: 'Terms, Privacy & SLA',
        desc: 'Data ownership guarantees, privacy policy & service terms',
        icon: FileCheck2,
      },
    ],
  },
];

export const PublicHeader: React.FC<PublicHeaderProps> = ({
  activePage,
  onNavigate,
  onOpenConsole,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<NavGroup['key'] | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  const handleNav = (page: PublicPage) => {
    onNavigate(page);
    setOpenMenu(null);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isGroupActive = (group: NavGroup) => group.items.some((item) => item.id === activePage);

  const renderDropdownGroup = (group: NavGroup, alignRight = false) => {
    const expanded = openMenu === group.key;
    const active = isGroupActive(group);
    return (
      <div key={group.key} className="relative">
        <button
          type="button"
          aria-expanded={expanded}
          aria-haspopup="menu"
          onClick={() => setOpenMenu((prev) => (prev === group.key ? null : group.key))}
          className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            active || expanded
              ? 'text-slate-950 bg-slate-100 font-semibold'
              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
          }`}
        >
          <span>{group.label}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              expanded ? 'rotate-180 text-amber-600' : 'text-slate-400'
            }`}
          />
        </button>

        {expanded && (
          <div
            role="menu"
            className={`absolute ${
              alignRight ? 'right-0' : 'left-0'
            } top-full mt-2 w-[350px] rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 p-2 z-50`}
          >
            {group.items.map((item) => {
              const Icon = item.icon;
              const isCurrent = activePage === item.id;
              return (
                <button
                  key={`${group.key}-${item.id}`}
                  type="button"
                  role="menuitem"
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
                    isCurrent
                      ? 'bg-amber-50/90 text-slate-950'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isCurrent ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                      {item.badge && (
                        <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 leading-snug">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded-lg py-1"
        >
          <OpesFuelLogo variant="dark" size="md" />
        </button>

        {/* Desktop Primary Navigation */}
        <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activePage === 'home'
                ? 'text-slate-950 bg-slate-100 font-semibold'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
            }`}
          >
            Home
          </button>

          {renderDropdownGroup(NAV_GROUPS[0], false)}
          {renderDropdownGroup(NAV_GROUPS[1], false)}

          <button
            type="button"
            onClick={() => handleNav('pricing')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activePage === 'pricing'
                ? 'text-slate-950 bg-slate-100 font-semibold'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
            }`}
          >
            Pricing
          </button>

          <button
            type="button"
            onClick={() => handleNav('docs')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activePage === 'docs'
                ? 'text-slate-950 bg-slate-100 font-semibold'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
            }`}
          >
            Documentation
          </button>

          <button
            type="button"
            onClick={() => handleNav('faq')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activePage === 'faq'
                ? 'text-slate-950 bg-slate-100 font-semibold'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
            }`}
          >
            FAQ
          </button>

          {renderDropdownGroup(NAV_GROUPS[2], true)}
        </nav>

        {/* Right Actions + Mobile Trigger */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenConsole}
            className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 text-sm font-semibold text-slate-800 hover:text-slate-950 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleNav('contact')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
          >
            Book a Demo
          </button>

          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Full Categorized Drawer */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className="lg:hidden bg-white border-b border-slate-200 max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-5 space-y-5 shadow-xl"
        >
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['home', 'Home'],
                ['pricing', 'Pricing (FCFA)'],
                ['docs', 'Documentation'],
                ['faq', 'FAQ'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => handleNav(id)}
                className={`px-3.5 py-2.5 rounded-lg text-sm font-semibold text-left border ${
                  activePage === id
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="space-y-1.5">
              <div className="px-2 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.id;
                  return (
                    <button
                      key={`m-${group.key}-${item.id}`}
                      type="button"
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        active
                          ? 'bg-amber-50 text-amber-950 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-600' : 'text-slate-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-[11px] text-slate-500 truncate">{item.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenConsole();
              }}
              className="py-3 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-semibold text-center"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleNav('contact')}
              className="py-3 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold text-center"
            >
              Book a Demo
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
