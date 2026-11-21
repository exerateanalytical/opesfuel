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
  key: 'product' | 'solutions' | 'resources' | 'company';
  label: string;
  items: DropdownItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'product',
    label: 'Product',
    items: [
      {
        id: 'platform',
        label: 'Platform & 15 Modules',
        desc: 'Forecourt shifts, tanks, SYSCOHADA ledger & payroll',
        icon: Fuel,
      },
      {
        id: 'mobile',
        label: 'Android & iPhone App',
        desc: 'Offline-resilient forecourt & owner mobile app',
        icon: Smartphone,
        badge: 'New UI',
      },
      {
        id: 'integrations',
        label: 'Integrations & ATG IoT',
        desc: 'Orange Money, MTN MoMo, Veeder-Root, Sage & Odoo',
        icon: Cpu,
      },
      {
        id: 'security',
        label: 'Security & Compliance',
        desc: 'Auth0 RS256, AES-256-GCM, 5-role RBAC & audit locks',
        icon: ShieldCheck,
      },
      {
        id: 'api',
        label: 'OpenAPI 3.1 & Webhooks',
        desc: '88 REST endpoints, scoped API keys & outbox events',
        icon: Code2,
      },
    ],
  },
  {
    key: 'solutions',
    label: 'Solutions',
    items: [
      {
        id: 'solutions',
        label: 'By Station Type & Industry',
        desc: 'Independent sites, multi-station networks & depots',
        icon: Building2,
      },
      {
        id: 'customers',
        label: 'Customer Case Studies',
        desc: 'Verified ROI and shrinkage reduction outcomes',
        icon: Users,
      },
      {
        id: 'licensing',
        label: 'Perpetual & Sovereign IP',
        desc: 'Self-hosted VPS & enterprise source-code licensing',
        icon: KeyRound,
      },
    ],
  },
  {
    key: 'resources',
    label: 'Resources',
    items: [
      {
        id: 'resources',
        label: 'Help Center, FAQ & Changelog',
        desc: '48-hour go-live playbooks, FAQ & release notes',
        icon: HelpCircle,
      },
      {
        id: 'api',
        label: 'Developer Documentation',
        desc: 'Java 25 Spring Boot architecture & API reference',
        icon: BookOpen,
      },
      {
        id: 'status',
        label: 'Live System Status',
        desc: '99.9% uptime SLA monitor across API & ACID cluster',
        icon: Activity,
        badge: '99.97%',
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
        desc: 'Mission, engineering standards & CEMAC/WAEMU reach',
        icon: Sparkles,
      },
      {
        id: 'contact',
        label: 'Contact & Enterprise Demo',
        desc: 'Schedule live onboarding or talk to engineering',
        icon: Mail,
      },
      {
        id: 'legal',
        label: 'Legal, Privacy & DPA',
        desc: 'Terms of service, data residency & SLA policy',
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

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Logo */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded-lg py-1"
        >
          <OpesFuelLogo variant="dark" size="md" />
        </button>

        {/* Zone 2: Enterprise Desktop Navigation with Dropdown Panels */}
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

          {NAV_GROUPS.slice(0, 2).map((group) => {
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
                    className="absolute left-0 top-full mt-2 w-[340px] rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 p-2 z-50"
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
                              isCurrent
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-100 text-slate-700'
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
          })}

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

          {NAV_GROUPS.slice(2).map((group) => {
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
                    className="absolute right-0 top-full mt-2 w-[330px] rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 p-2 z-50"
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
                              isCurrent
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-100 text-slate-700'
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
          })}
        </nav>

        {/* Zone 3: Dual Enterprise CTAs + Mobile Hamburger Trigger */}
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

      {/* Mobile Full Categorized Navigation Drawer */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className="lg:hidden bg-white border-b border-slate-200 max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-5 space-y-5 shadow-xl"
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleNav('home')}
              className={`px-3.5 py-2.5 rounded-lg text-sm font-semibold text-left border ${
                activePage === 'home'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => handleNav('pricing')}
              className={`px-3.5 py-2.5 rounded-lg text-sm font-semibold text-left border ${
                activePage === 'pricing'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              Pricing (FCFA)
            </button>
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
