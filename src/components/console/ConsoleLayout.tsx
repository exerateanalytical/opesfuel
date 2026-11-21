import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Code2,
  Compass,
  CreditCard,
  Database,
  Fuel,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Smartphone,
  Sparkles,
  Truck,
  Users,
  X,
} from 'lucide-react';
import {
  buildAuth0AuthorizeUrl,
  canAccessSection,
  isAuth0Configured,
  ROLE_PROFILES,
} from '../../auth/auth0';
import { ConsoleSection, Station, TenantWorkspace, UserRole } from '../../domain/types';
import { OpesFuelLogo } from '../brand/OpesFuelLogo';

interface ConsoleLayoutProps {
  tenant: TenantWorkspace;
  role: UserRole;
  onChangeRole: (role: UserRole) => void;
  activeStationId: string;
  onChangeStation: (stationId: string) => void;
  stations: Station[];
  activeSection: ConsoleSection;
  onSelectSection: (section: ConsoleSection) => void;
  onOpenOnboardingGuide: () => void;
  onboardingCompletedCount: number;
  onExitToPublic: () => void;
  onSignOut: () => void;
  transportMode: 'SPRING_BOOT_REMOTE' | 'OPENAPI_PREVIEW_ADAPTER';
  toast: { type: 'success' | 'error'; message: string } | null;
  onDismissToast: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: ConsoleSection; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Station Overview', shortLabel: 'Overview', icon: LayoutDashboard },
  { id: 'forecourt', label: 'Forecourt & Shifts', shortLabel: 'Shifts', icon: Fuel },
  { id: 'inventory', label: 'Tanks & Deliveries', shortLabel: 'Tanks', icon: Truck },
  { id: 'fleet', label: 'Fleet Credit & POS', shortLabel: 'POS', icon: CreditCard },
  { id: 'workforce', label: 'Staff & Payroll', shortLabel: 'Staff', icon: Users },
  { id: 'accounting', label: 'Accounting & Reports', shortLabel: 'Ledger', icon: BookOpen },
  { id: 'ai-assistant', label: 'AI Copilot', shortLabel: 'AI', icon: Sparkles },
  { id: 'mobile-app', label: 'Mobile App', shortLabel: 'Mobile', icon: Smartphone },
  { id: 'api-platform', label: 'API & Events', shortLabel: 'API', icon: Code2 },
  { id: 'admin', label: 'Admin & Billing', shortLabel: 'Admin', icon: Building2 },
];

export const ConsoleLayout: React.FC<ConsoleLayoutProps> = ({
  tenant,
  role,
  onChangeRole,
  activeStationId,
  onChangeStation,
  stations,
  activeSection,
  onSelectSection,
  onOpenOnboardingGuide,
  onboardingCompletedCount,
  onExitToPublic,
  onSignOut,
  transportMode,
  toast,
  onDismissToast,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const auth0Url = buildAuth0AuthorizeUrl();
  const profile = ROLE_PROFILES[role];

  const permittedItems = NAV_ITEMS.filter((item) => canAccessSection(role, item.id));
  const fourthMobileItem = canAccessSection(role, 'ai-assistant')
    ? NAV_ITEMS.find((i) => i.id === 'ai-assistant')!
    : NAV_ITEMS.find((i) => i.id === 'fleet')!;
  const mobileBarItems = [
    NAV_ITEMS.find((i) => i.id === 'overview')!,
    NAV_ITEMS.find((i) => i.id === 'forecourt')!,
    NAV_ITEMS.find((i) => i.id === 'inventory')!,
    fourthMobileItem,
  ].filter((item) => item && canAccessSection(role, item.id));

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="min-w-0 space-y-1">
          <OpesFuelLogo variant="light" size="md" />
          <div className="text-[11px] text-slate-400 truncate pl-0.5">{tenant.organizationName}</div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-2 rounded text-slate-400 hover:text-white min-h-[40px] min-w-[40px] flex items-center justify-center"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-1 flex-1 overflow-y-auto">
        {permittedItems.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] ${
                active
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </span>
              {item.id === 'ai-assistant' && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300">
                  {tenant.aiSubscription.active ? 'ON' : 'PRO'}
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setSidebarOpen(false);
            onOpenOnboardingGuide();
          }}
          className="w-full mt-3 flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-semibold text-amber-300 min-h-[44px]"
        >
          <span className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 shrink-0" />
            <span>Setup Guide</span>
          </span>
          <span className="font-mono text-[11px]">{onboardingCompletedCount}/5</span>
        </button>
      </div>

      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="text-xs text-slate-400 space-y-1">
          <div className="font-semibold text-slate-200">{profile.name}</div>
          <div>{profile.title}</div>
          <div className="font-mono text-[11px] text-amber-400">
            {isAuth0Configured ? 'Auth0 OIDC Connected' : 'Demo RBAC Mode'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onExitToPublic}
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors min-h-[40px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Website
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-700 text-xs font-medium text-amber-400 hover:bg-slate-800 transition-colors min-h-[40px]"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900">
      {/* Desktop Rail */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 no-print">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 max-w-[85vw] h-full">{sidebarContent}</div>
          <div className="flex-1 bg-slate-900/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3.5 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <OpesFuelLogo variant="dark" size="sm" className="shrink-0" />
            <div className="h-6 w-px bg-slate-200 hidden sm:block shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-slate-500 truncate hidden sm:block">
                {tenant.organizationName} ·{' '}
                {transportMode === 'SPRING_BOOT_REMOTE'
                  ? 'Java 25 Spring Boot API'
                  : 'OpenAPI 3.1 SaaS Live'}
              </div>
              <div className="font-display text-sm sm:text-base font-bold text-slate-900 truncate">
                {NAV_ITEMS.find((n) => n.id === activeSection)?.label}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenOnboardingGuide}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-900 min-h-[38px]"
            >
              <Database className="w-3.5 h-3.5 text-amber-700" />
              <span>Setup Guide ({onboardingCompletedCount}/5)</span>
            </button>

            <select
              aria-label="Select petrol station"
              value={activeStationId}
              onChange={(e) => onChangeStation(e.target.value)}
              className="px-2.5 sm:px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-900 min-h-[38px] max-w-[165px] sm:max-w-none"
            >
              <option value="ALL">All Stations ({stations.length})</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.city})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 min-h-[38px]">
              <Shield className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <select
                aria-label="Switch demo RBAC role"
                value={role}
                onChange={(e) => onChangeRole(e.target.value as UserRole)}
                className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
              >
                <option value="OWNER">Owner</option>
                <option value="MANAGER">Manager</option>
                <option value="ATTENDANT">Attendant</option>
                <option value="ACCOUNTANT">Accountant</option>
              </select>
            </div>

            {auth0Url && (
              <a
                href={auth0Url}
                className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
              >
                Auth0 Sign In
              </a>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 max-w-7xl w-full mx-auto space-y-5">
          {toast && (
            <div
              role="status"
              className={`px-4 py-3 rounded-lg border flex items-center justify-between gap-4 text-sm no-print ${
                toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <span className="font-medium">{toast.message}</span>
              <button
                type="button"
                onClick={onDismissToast}
                className="text-xs font-semibold underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {children}
        </main>

        {/* Compact Mobile Bottom Navigation Bar */}
        <nav
          aria-label="Mobile quick navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white border-t border-slate-200 grid grid-cols-5 no-print"
        >
          {mobileBarItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                  active ? 'text-amber-700' : 'text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-600"
          >
            <Menu className="w-4 h-4" />
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

