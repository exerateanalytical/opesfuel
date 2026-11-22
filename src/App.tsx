import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildExtendedOperationsDataset,
  ExtendedOperationsBundle,
} from './api/demoDataset1000';
import {
  buildEnterpriseModulesDataset,
  EnterpriseModulesDataset,
} from './api/enterpriseModulesData';
import {
  CHART_OF_ACCOUNTS,
  computeFinancialReports,
  OpesFuelApiEngine,
  OpesFuelStoreState,
  SUBSCRIPTION_PLANS,
} from './api/opesfuelClient';
import {
  AuthSession,
  buildAuth0LogoutUrl,
  canAccessSection,
  clearAuthSession,
  getStoredAuthSession,
  handleAuth0CallbackIfPresent,
  isAuth0Configured,
  refreshAuth0SessionIfNeeded,
} from './auth/auth0';
import { ClassicLoginPage } from './components/auth/ClassicLoginPage';
import { AccountingSection } from './components/console/AccountingSection';
import { AdminBillingSection } from './components/console/AdminBillingSection';
import { AiAssistantSection } from './components/console/AiAssistantSection';
import { ApiPlatformSection } from './components/console/ApiPlatformSection';
import { CashVaultPanel } from './components/console/CashVaultPanel';
import { ConsoleLayout, NotificationItem } from './components/console/ConsoleLayout';
import { DataImportWizardPanel } from './components/console/DataImportWizardPanel';
import { EnterpriseOperationsSection } from './components/console/EnterpriseOperationsSection';
import { FixedAssetsAndBudgetsPanel } from './components/console/FixedAssetsAndBudgetsPanel';
import { FleetShopSection } from './components/console/FleetShopSection';
import { ForecourtSection } from './components/console/ForecourtSection';
import { GlobalSearchModal } from './components/console/GlobalSearchModal';
import { HrManagementPanel } from './components/console/HrManagementPanel';
import { HseFraudQcSection } from './components/console/HseFraudQcSection';
import { InventorySection } from './components/console/InventorySection';
import { OnboardingGuideModal } from './components/console/OnboardingGuideModal';
import { OverviewSection } from './components/console/OverviewSection';
import { PlatformAdminSection } from './components/console/PlatformAdminSection';
import { PumpCalibrationPanel } from './components/console/PumpCalibrationPanel';
import { SecurityAuditAndProfilePanel } from './components/console/SecurityAuditAndProfilePanel';
import { WorkforceSection } from './components/console/WorkforceSection';
import { MobileAppShowcase } from './components/mobile/MobileAppShowcase';
import { PublicFooter } from './components/public/PublicFooter';
import { PublicHeader } from './components/public/PublicHeader';
import { PublicSite } from './components/public/PublicSite';
import { CookiePrivacyNotice } from './components/shared/CookiePrivacyNotice';
import { ConsoleSection, PublicPage, UserRole } from './domain/types';

const PUBLIC_PAGES: PublicPage[] = [
  'home',
  'platform',
  'solutions',
  'integrations',
  'pricing',
  'licensing',
  'mobile',
  'docs',
  'faq',
  'api',
  'security',
  'customers',
  'about',
  'resources',
  'status',
  'contact',
  'legal',
];

const PUBLIC_SEO: Record<PublicPage, { title: string; description: string }> = {
  home: {
    title: 'OpesFuel — Petrol Station Management Software for Shifts, Tanks, Fleet & SYSCOHADA',
    description: 'Run every pump, tank, shift, fleet account, HR contract, and SYSCOHADA journal across your petrol stations in real time.',
  },
  platform: {
    title: 'Platform Capabilities — OpesFuel Petrol Station Operating System',
    description: 'Forecourt shift reconciliation, tank dipstick variance alerts, cash safe ledger, HR & payroll, and automated accounting.',
  },
  solutions: {
    title: 'Solutions for Single Stations & Multi-Site Networks — OpesFuel',
    description: 'Tailored workflows for station owners, managers, pump attendants, and chief accountants.',
  },
  integrations: {
    title: 'Integrations: Orange Money, MTN MoMo, ATG & ERP — OpesFuel',
    description: 'Connect mobile money payments, thermal POS printers, webhooks, and external accounting systems.',
  },
  pricing: {
    title: 'Transparent FCFA Pricing — OpesFuel Petrol Station SaaS',
    description: 'Simple per-station monthly plans starting at 25,000 FCFA/month with a 14-day free trial.',
  },
  licensing: {
    title: 'Enterprise & On-Premise Licensing — OpesFuel',
    description: 'Dedicated VPS deployment, white-label branding, and multi-country enterprise station licensing.',
  },
  mobile: {
    title: 'OpesFuel Mobile Companion App — Offline-First Forecourt App',
    description: 'Record pump shifts, tank dipsticks, and fleet fuel vouchers from Android or iOS even when internet drops.',
  },
  docs: {
    title: 'Station Operations & HR Documentation — OpesFuel Manual',
    description: 'Step-by-step operating manual for petrol station owners, managers, attendants, accountants, and HR teams.',
  },
  faq: {
    title: 'Frequently Asked Questions — OpesFuel Petrol Station Software',
    description: 'Clear answers on setup, offline sync, tank reconciliation, HR & CNPS, Mobile Money, and SYSCOHADA compliance.',
  },
  api: {
    title: 'Developer API & Webhooks — OpesFuel OpenAPI 3.1',
    description: 'Integrate petrol station shifts, deliveries, and accounting journals with scoped API keys and HMAC webhooks.',
  },
  security: {
    title: 'Security, Audit Trail & Multi-Tenant Isolation — OpesFuel',
    description: 'Role-based access control, immutable reversing journals, TLS encryption, and automated daily PostgreSQL backups.',
  },
  customers: {
    title: 'Customer Stories — African Petrol Station Networks on OpesFuel',
    description: 'See how independent station owners and regional fuel marketers stop stock losses and speed up daily closing.',
  },
  about: {
    title: 'About OpesFuel — Built by OpesWare for Fuel Retailers',
    description: 'Purpose-built petrol station operations software engineered for real forecourts across Central and West Africa.',
  },
  resources: {
    title: 'Guides & Station Checklists — OpesFuel Resources',
    description: 'Daily shift handover checklists, dipstick variance playbooks, and tax compliance guides for fuel station owners.',
  },
  status: {
    title: 'System Status & Uptime — OpesFuel Cloud',
    description: 'Live operational status across OpesFuel web console, mobile sync API, and payment webhooks.',
  },
  contact: {
    title: 'Book a Live Demo & Contact Sales — OpesFuel',
    description: 'Talk with our petrol station onboarding specialists in Douala, Yaounde, or remotely.',
  },
  legal: {
    title: 'Privacy Policy, Terms & Data Governance — OpesFuel',
    description: 'Terms of service, data ownership guarantee, and privacy controls for OpesFuel SaaS.',
  },
};

const CONSOLE_SECTIONS: ConsoleSection[] = [
  'platform-admin',
  'overview',
  'forecourt',
  'inventory',
  'fleet',
  'workforce',
  'accounting',
  'hse-fraud',
  'enterprise-ops',
  'ai-assistant',
  'mobile-app',
  'api-platform',
  'admin',
];

function parseHashRoute(hashStr = window.location.hash): {
  mode: 'public' | 'login' | 'console';
  publicPage: PublicPage;
  consoleSection: ConsoleSection;
  inviteToken: string | null;
  unknownHash: string | null;
} {
  const rawOriginal = hashStr.replace(/^#\/?/, '');
  const raw = rawOriginal.toLowerCase();
  if (!raw) {
    return { mode: 'public', publicPage: 'home', consoleSection: 'overview', inviteToken: null, unknownHash: null };
  }
  if (raw.startsWith('invite/')) {
    const token = rawOriginal.slice('invite/'.length).trim();
    return { mode: 'login', publicPage: 'home', consoleSection: 'overview', inviteToken: token || null, unknownHash: null };
  }
  if (raw === 'login') {
    return { mode: 'login', publicPage: 'home', consoleSection: 'overview', inviteToken: null, unknownHash: null };
  }
  if (raw.startsWith('app/')) {
    const seg = raw.slice(4) as ConsoleSection;
    if (CONSOLE_SECTIONS.includes(seg)) {
      return { mode: 'console', publicPage: 'home', consoleSection: seg, inviteToken: null, unknownHash: null };
    }
    return { mode: 'console', publicPage: 'home', consoleSection: 'overview', inviteToken: null, unknownHash: null };
  }
  if (PUBLIC_PAGES.includes(raw as PublicPage)) {
    return { mode: 'public', publicPage: raw as PublicPage, consoleSection: 'overview', inviteToken: null, unknownHash: null };
  }
  return { mode: 'public', publicPage: 'home', consoleSection: 'overview', inviteToken: null, unknownHash: rawOriginal };
}

export default function App() {
  const engineRef = useRef<OpesFuelApiEngine>(new OpesFuelApiEngine());
  const [store, setStore] = useState<OpesFuelStoreState>(() => engineRef.current.getSnapshot());
  const [extOps, setExtOps] = useState<ExtendedOperationsBundle>(() =>
    buildExtendedOperationsDataset(engineRef.current.getSnapshot().stations[0]?.id ?? 'st_plateau')
  );
  const [entOps, setEntOps] = useState<EnterpriseModulesDataset>(() =>
    buildEnterpriseModulesDataset(engineRef.current.getSnapshot().stations[0]?.id ?? 'st_plateau')
  );
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  const initialRoute = useMemo(() => parseHashRoute(), []);
  const [mode, setMode] = useState<'public' | 'login' | 'console'>(initialRoute.mode);
  const [publicPage, setPublicPage] = useState<PublicPage>(initialRoute.publicPage);
  const [unknownHash, setUnknownHash] = useState<string | null>(initialRoute.unknownHash);
  const [consoleSection, setConsoleSection] = useState<ConsoleSection>(initialRoute.consoleSection);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(initialRoute.inviteToken);
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const [authError, setAuthError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>(() => getStoredAuthSession()?.role ?? 'OWNER');
  const [activeStationId, setActiveStationId] = useState<string>(() => store.stations[0]?.id ?? 'ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingTab, setOnboardingTab] = useState<'guide' | 'institutional'>('guide');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  // Dynamic SEO / GEO / AEO document title & meta description per page
  useEffect(() => {
    if (mode === 'public') {
      const seo = PUBLIC_SEO[publicPage] ?? PUBLIC_SEO.home;
      document.title = seo.title;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', seo.description);
    } else if (mode === 'login') {
      document.title = 'Sign In — OpesFuel Station Workspace';
    } else {
      document.title = `OpesFuel Console · ${consoleSection.toUpperCase()}`;
    }
  }, [mode, publicPage, consoleSection]);

  // Keep activeStationId valid if stations are deleted or tenant workspace is reset
  const effectiveActiveStationId = useMemo(() => {
    if (activeStationId === 'ALL') return 'ALL';
    if (store.stations.some((s) => s.id === activeStationId)) return activeStationId;
    return store.stations[0]?.id ?? 'ALL';
  }, [activeStationId, store.stations]);

  const defaultStationId = store.stations[0]?.id ?? 'st_plateau';

  const refreshNotifications = useCallback(async (stationScope = effectiveActiveStationId) => {
    try {
      const raw = await engineRef.current.fetchNotifications(stationScope, false);
      if (Array.isArray(raw)) {
        setNotifications(
          raw.map((item) => {
            const n = item as Record<string, unknown>;
            return {
              id: String(n.id ?? ''),
              stationId: n.stationId ? String(n.stationId) : null,
              category: n.category ? String(n.category) : 'ALERT',
              severity: n.severity ? String(n.severity) : 'INFO',
              title: String(n.title ?? 'Operational Alert'),
              message: String(n.message ?? ''),
              read: Boolean(n.read ?? n.isRead ?? false),
              createdAt: String(n.createdAt ?? new Date().toISOString()),
            };
          })
        );
      }
    } catch {
      // keep existing notifications on transient error
    }
  }, [effectiveActiveStationId]);

  // Register server-authoritative sync & RFC 7807 error callbacks
  useEffect(() => {
    engineRef.current.setRemoteCallbacks({
      onError: (msg) => setToast({ type: 'error', message: msg }),
      onSynced: (nextState) => setStore(nextState),
    });
  }, []);

  // Auth0 OIDC PKCE callback exchange + session restoration + live Spring Boot hydration
  useEffect(() => {
    let active = true;
    (async () => {
      const callbackResult = await handleAuth0CallbackIfPresent();
      if (!active) return;

      if (callbackResult.error) {
        setAuthError(callbackResult.error);
        setToast({ type: 'error', message: callbackResult.error });
        setMode('login');
        return;
      }

      let resolvedSession = callbackResult.session ?? getStoredAuthSession();
      resolvedSession = await refreshAuth0SessionIfNeeded(resolvedSession);
      if (!active) return;

      if (resolvedSession?.accessToken) {
        setAuthSession(resolvedSession);
        setRole(resolvedSession.role);
        engineRef.current.setAccessToken(resolvedSession.accessToken);

        // If returning from Auth0 PKCE callback, navigate to the intended route
        if (callbackResult.session && callbackResult.returnHash) {
          const parsedReturn = parseHashRoute(callbackResult.returnHash);
          if (parsedReturn.inviteToken) {
            try {
              await engineRef.current.acceptStaffInvite(parsedReturn.inviteToken, resolvedSession.accessToken);
              setPendingInviteToken(null);
              setToast({ type: 'success', message: 'Staff invitation accepted and Auth0 account linked.' });
            } catch (err) {
              setToast({
                type: 'error',
                message: err instanceof Error ? err.message : 'Unable to accept staff invitation.',
              });
            }
            setMode('console');
            setConsoleSection('overview');
          } else {
            setMode(parsedReturn.mode === 'public' ? 'console' : parsedReturn.mode);
            setConsoleSection(parsedReturn.consoleSection);
          }
        }
      }

      const hydrated = await engineRef.current.hydrateFromSpringBoot(resolvedSession?.accessToken ?? null);
      if (active && hydrated) {
        setStore(hydrated);
      }
      if (active) {
        void refreshNotifications();
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshNotifications]);

  // Refresh notifications when switching active station inside the console
  useEffect(() => {
    if (mode === 'console') {
      void refreshNotifications(effectiveActiveStationId);
    }
  }, [mode, effectiveActiveStationId, refreshNotifications]);

  // Production Auth0 route guard: prevent unauthenticated direct access to #/app/* when Auth0 is enabled
  useEffect(() => {
    if (isAuth0Configured && mode === 'console' && !authSession?.accessToken) {
      setMode('login');
    }
  }, [mode, authSession]);

  // Auto-dismiss success toasts after 5 seconds (keep error toasts visible until dismissed)
  useEffect(() => {
    if (!toast || toast.type !== 'success') return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Scroll cleanly to top when switching console sections
  useEffect(() => {
    if (mode === 'console') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [mode, consoleSection]);

  // Bidirectional URL hash sync for direct bookmarkable individual pages
  useEffect(() => {
    const nextHash =
      mode === 'login'
        ? pendingInviteToken
          ? `#/invite/${pendingInviteToken}`
          : '#/login'
        : mode === 'console'
        ? `#/app/${consoleSection}`
        : publicPage === 'home'
        ? '#/'
        : `#/${publicPage}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, [mode, publicPage, consoleSection, pendingInviteToken]);

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHashRoute();
      if (isAuth0Configured && parsed.mode === 'console' && !authSession?.accessToken) {
        setMode('login');
      } else {
        setMode(parsed.mode);
      }
      setPublicPage(parsed.publicPage);
      setConsoleSection(parsed.consoleSection);
      setPendingInviteToken(parsed.inviteToken);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [authSession]);

  const report = useMemo(
    () => computeFinancialReports(store, effectiveActiveStationId),
    [store, effectiveActiveStationId]
  );

  const onboardingCompletedCount = useMemo(() => {
    const checks = [
      store.tanks.length > 0,
      store.pumps.length > 0 && store.employees.length > 0,
      store.shifts.some((s) => s.status === 'CLOSED'),
      store.journals.length > 0 && report.trialBalanceBalanced,
      store.tenant.aiSubscription.active,
    ];
    return checks.filter(Boolean).length;
  }, [
    store.tanks.length,
    store.pumps.length,
    store.employees.length,
    store.shifts,
    store.journals.length,
    report.trialBalanceBalanced,
    store.tenant.aiSubscription.active,
  ]);

  const openOnboardingGuide = (tab: 'guide' | 'institutional' = 'guide') => {
    setOnboardingTab(tab);
    setOnboardingOpen(true);
  };

  const runCommand = (action: () => OpesFuelStoreState, successMsg: string) => {
    try {
      const next = action();
      setStore(next);
      setToast({ type: 'success', message: successMsg });
      void refreshNotifications(effectiveActiveStationId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Operation failed.';
      setToast({ type: 'error', message: msg });
    }
  };

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
    if (nextRole === 'PLATFORM_ADMIN') {
      setConsoleSection('platform-admin');
    } else if (!canAccessSection(nextRole, consoleSection)) {
      setConsoleSection('overview');
    }
    setToast({
      type: 'success',
      message: `Switched active workspace role to ${nextRole}.`,
    });
  };

  const executeApiQuery = (endpoint: string) => {
    switch (endpoint) {
      case '/api/v1/stations':
        return store.stations;
      case '/api/v1/forecourt/pumps':
        return store.pumps.filter((p) => effectiveActiveStationId === 'ALL' || p.stationId === effectiveActiveStationId);
      case '/api/v1/inventory/tanks':
        return store.tanks.filter((t) => effectiveActiveStationId === 'ALL' || t.stationId === effectiveActiveStationId);
      case '/api/v1/inventory/deliveries':
        return store.deliveries;
      case '/api/v1/accounting/accounts':
        return CHART_OF_ACCOUNTS;
      case '/api/v1/accounting/reports':
        return report;
      case '/api/v1/billing/plans':
        return SUBSCRIPTION_PLANS;
      default:
        return { status: 'OK' };
    }
  };

  const openClassicLogin = () => {
    setMode('login');
    window.scrollTo({ top: 0 });
  };

  const handleSignOut = () => {
    const wasAuth0 = authSession?.mode === 'AUTH0_OIDC';
    clearAuthSession();
    setAuthSession(null);
    engineRef.current.setAccessToken(null);
    if (wasAuth0) {
      const logoutUrl = buildAuth0LogoutUrl();
      if (logoutUrl) {
        window.location.assign(logoutUrl);
        return;
      }
    }
    setMode('login');
    window.scrollTo({ top: 0 });
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await engineRef.current.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to mark notification as read.');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await engineRef.current.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      notify('success', 'All operational notifications marked as read.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to clear notifications.');
    }
  };

  const currentActorEmail = authSession?.email ?? `${role.toLowerCase()}@opesfuel.cm`;

  const postOptionalBackend = useCallback(
    async (path: string, method: 'POST' | 'PATCH', body?: Record<string, unknown>) => {
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
      if (!apiBase) return null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession?.accessToken) {
        headers.Authorization = `Bearer ${authSession.accessToken}`;
      }
      try {
        const res = await fetch(`${apiBase}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (res.ok) return (await res.json().catch(() => null)) as Record<string, unknown> | null;
      } catch {
        // fallback to optimistic local state when remote API is unavailable
      }
      return null;
    },
    [authSession?.accessToken]
  );

  const appendAudit = useCallback(
    (action: string, entityType: string, entityId: string, summary: string, stationId = defaultStationId) => {
      setExtOps((prev) => ({
        ...prev,
        auditLogs: [
          {
            id: `aud_${Date.now().toString(36)}`,
            stationId,
            actorEmail: currentActorEmail,
            actorRole: role,
            action,
            entityType,
            entityId,
            summary,
            createdAt: new Date().toISOString(),
          },
          ...prev.auditLogs,
        ],
      }));
    },
    [currentActorEmail, defaultStationId, role]
  );

  const handleSeed1000Demo = useCallback(async () => {
    const remote = await postOptionalBackend('/api/v1/tenants/current/seed-1000-demo', 'POST');
    const nextStore = engineRef.current.restoreSampleDemoData(role);
    setStore(nextStore);
    const rebuilt = buildExtendedOperationsDataset(nextStore.stations[0]?.id ?? defaultStationId);
    setExtOps(rebuilt);
    const totalCount = Number(remote?.totalRecords ?? rebuilt.totalDemoRecords);
    notify(
      'success',
      `Seeded flagship demo petrol station with ${totalCount.toLocaleString()} balanced records across Fuel, Shifts, Tanks, Fleet, HR, Salaries, Taxes, Safe & SYSCOHADA Ledger.`
    );
  }, [defaultStationId, notify, postOptionalBackend, role]);

  if (mode === 'login') {
    return (
      <ClassicLoginPage
        organizationName={store.tenant.organizationName}
        stations={store.stations}
        initialRole={role}
        initialStationId={effectiveActiveStationId}
        authSession={authSession}
        pendingInviteToken={pendingInviteToken}
        authError={authError}
        onAuthenticated={async (nextRole, nextStationId) => {
          setRole(nextRole);
          setActiveStationId(nextStationId);
          if (nextRole === 'PLATFORM_ADMIN') {
            setConsoleSection('platform-admin');
          } else if (!canAccessSection(nextRole, consoleSection)) {
            setConsoleSection('overview');
          }
          if (pendingInviteToken) {
            try {
              await engineRef.current.acceptStaffInvite(pendingInviteToken);
              setPendingInviteToken(null);
              setToast({
                type: 'success',
                message: `Signed in as ${nextRole} and accepted staff invitation.`,
              });
            } catch (err) {
              setToast({
                type: 'error',
                message: err instanceof Error ? err.message : 'Invitation acceptance failed.',
              });
            }
          } else {
            setToast({
              type: 'success',
              message: `Signed in cleanly as ${nextRole}.`,
            });
          }
          setMode('console');
          window.scrollTo({ top: 0 });
        }}
        onCreateWorkspace={(input) => {
          const next = engineRef.current.createTenantWorkspace(input);
          setStore(next);
          setRole('OWNER');
          setActiveStationId(next.stations[0]?.id ?? 'ALL');
          setConsoleSection('overview');
          setMode('console');
          if (!input.includeSampleData) {
            setOnboardingTab('institutional');
            setOnboardingOpen(true);
          }
          setToast({
            type: 'success',
            message: `Provisioned SaaS workspace for ${next.tenant.organizationName}.`,
          });
          window.scrollTo({ top: 0 });
        }}
        onBackToSite={() => {
          setMode('public');
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  if (mode === 'public') {
    const handlePublicNavigate = (nextPage: PublicPage) => {
      setUnknownHash(null);
      setPublicPage(nextPage);
    };
    return (
      <div className="min-h-screen flex flex-col bg-white text-slate-900">
        <PublicHeader
          activePage={publicPage}
          onNavigate={handlePublicNavigate}
          onOpenConsole={openClassicLogin}
        />
        {unknownHash && (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
            <div className="rounded-xl border border-slate-300 border-l-4 border-l-amber-600 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-900">Page not found (#/{unknownHash}):</span>{' '}
                <span className="text-slate-600">
                  We redirected you to the OpesFuel homepage. Use the navigation bar or visit Station Docs.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUnknownHash(null)}
                className="px-3 py-1 rounded border border-slate-300 font-semibold text-slate-900 hover:bg-slate-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <main className="flex-1">
          <PublicSite
            page={publicPage}
            stations={store.stations}
            pumps={store.pumps}
            tanks={store.tanks}
            shifts={store.shifts}
            employees={store.employees}
            fleetAccounts={store.fleetAccounts}
            shopItems={store.shopItems}
            aiSubscription={store.tenant.aiSubscription}
            report={report}
            onNavigate={handlePublicNavigate}
            onOpenConsole={openClassicLogin}
            onLeadSubmitted={(lead) => engineRef.current.recordPreviewLead(lead)}
          />
        </main>
        <PublicFooter
          onNavigate={handlePublicNavigate}
          onOpenConsole={openClassicLogin}
        />
        <CookiePrivacyNotice onNavigate={handlePublicNavigate} />
      </div>
    );
  }

  const scopedStationId = effectiveActiveStationId === 'ALL' ? defaultStationId : effectiveActiveStationId;
  const scopedStationName =
    store.stations.find((s) => s.id === scopedStationId)?.name ??
    store.tenant.organizationName ??
    'OpesFuel Station';
  const scopedPumps = store.pumps.filter((p) => effectiveActiveStationId === 'ALL' || p.stationId === effectiveActiveStationId);
  const scopedEmployees = store.employees.filter((e) => effectiveActiveStationId === 'ALL' || e.stationId === effectiveActiveStationId);
  const canManageOps = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN';

  return (
    <ConsoleLayout
      tenant={store.tenant}
      role={role}
      authSession={authSession}
      onChangeRole={handleRoleChange}
      activeStationId={effectiveActiveStationId}
      onChangeStation={setActiveStationId}
      stations={store.stations}
      activeSection={consoleSection}
      onSelectSection={setConsoleSection}
      onOpenOnboardingGuide={() => openOnboardingGuide('guide')}
      onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
      onboardingCompletedCount={onboardingCompletedCount}
      notifications={notifications}
      onRefreshNotifications={() => void refreshNotifications(effectiveActiveStationId)}
      onMarkNotificationRead={(id) => void handleMarkNotificationRead(id)}
      onMarkAllNotificationsRead={() => void handleMarkAllNotificationsRead()}
      onExitToPublic={() => setMode('public')}
      onSignOut={handleSignOut}
      transportMode={engineRef.current.getTransportMode()}
      toast={toast}
      onDismissToast={() => setToast(null)}
    >
      {consoleSection === 'platform-admin' && role === 'PLATFORM_ADMIN' && (
        <PlatformAdminSection engine={engineRef.current} onNotify={notify} />
      )}
      {consoleSection === 'overview' && (
        <OverviewSection
          role={role}
          activeStationId={effectiveActiveStationId}
          stations={store.stations}
          tanks={store.tanks}
          pumps={store.pumps}
          shifts={store.shifts}
          events={store.events}
          priceHistory={extOps.priceHistory}
          report={report}
          onboardingCompletedCount={onboardingCompletedCount}
          onOpenOnboardingGuide={openOnboardingGuide}
          onUpdatePrice={(stId, grade, price, reason) => {
            const oldPrice = store.stations.find((s) => s.id === stId)?.prices[grade] ?? price;
            runCommand(
              () => engineRef.current.updateFuelPrice(role, stId, grade, price),
              `Published ${grade} price update to ${price} FCFA/L and recorded price history.`
            );
            setExtOps((prev) => ({
              ...prev,
              priceHistory: [
                {
                  id: `ph_${Date.now().toString(36)}`,
                  stationId: stId,
                  grade,
                  oldPriceFcfa: oldPrice,
                  newPriceFcfa: price,
                  changedBy: currentActorEmail,
                  reason: reason ?? 'Regulatory tariff update',
                  changedAt: new Date().toISOString(),
                },
                ...prev.priceHistory,
              ],
            }));
            void postOptionalBackend(`/api/v1/stations/${encodeURIComponent(stId)}/price-history`, 'POST', {
              grade,
              oldPriceFcfa: oldPrice,
              newPriceFcfa: price,
              reason: reason ?? 'Regulatory tariff update',
            });
            appendAudit('PRICE_UPDATED', 'STATION', stId, `${grade}: ${oldPrice} → ${price} FCFA/L`, stId);
          }}
          onCreateStation={(input) =>
            runCommand(
              () => engineRef.current.createStation(role, input),
              `Onboarded station ${input.name} on Starter plan (25 000 FCFA/mo).`
            )
          }
          onJumpTo={(sec) => {
            if (canAccessSection(role, sec)) setConsoleSection(sec);
          }}
        />
      )}

      {consoleSection === 'forecourt' && (
        <ForecourtSection
          role={role}
          stationId={effectiveActiveStationId}
          defaultStationId={defaultStationId}
          pumps={store.pumps}
          tanks={store.tanks}
          shifts={store.shifts}
          employees={store.employees}
          onOpenShift={(stId, pId, attId) =>
            runCommand(
              () => engineRef.current.openShift(role, stId, pId, attId),
              'Opened shift and emitted ShiftOpenedEvent.'
            )
          }
          onCloseShift={(shiftId, payload) =>
            runCommand(
              () => engineRef.current.closeShift(role, shiftId, payload),
              'Shift closed, tank stock deducted, and double-entry Revenue + VAT + COGS journals posted.'
            )
          }
          onCreatePump={(input) =>
            runCommand(
              () => engineRef.current.createPump(role, input),
              `Provisioned forecourt pump dispenser ${input.code}.`
            )
          }
          onDeletePump={(pumpId) =>
            runCommand(
              () => engineRef.current.deletePump(role, pumpId),
              'Removed forecourt pump dispenser.'
            )
          }
          onDeleteShift={(shiftId) =>
            runCommand(
              () => engineRef.current.deleteShift(role, shiftId),
              'Deleted shift record and reversed linked shift journal.'
            )
          }
          calibrationSlot={
            <PumpCalibrationPanel
              stationId={scopedStationId}
              stationName={scopedStationName}
              pumps={scopedPumps}
              canManage={canManageOps}
              calibrations={extOps.calibrations}
              maintenance={extOps.maintenance}
              onRecordCalibration={(item) => {
                const rec = { ...item, id: `cal_${Date.now().toString(36)}`, testedAt: new Date().toISOString() };
                setExtOps((prev) => ({ ...prev, calibrations: [rec, ...prev.calibrations] }));
                void postOptionalBackend(`/api/v1/forecourt/pumps/${encodeURIComponent(item.pumpId)}/calibrations`, 'POST', item as unknown as Record<string, unknown>);
                appendAudit('PUMP_CALIBRATION', 'PUMP', item.pumpId, `20L test (${item.testLitres} L) on ${item.pumpCode}`, item.stationId);
                notify('success', `Recorded ${item.testLitres}L calibration on ${item.pumpCode} (returned to tank — zero shortage created).`);
              }}
              onRecordMaintenance={(item) => {
                const rec = { ...item, id: `mnt_${Date.now().toString(36)}`, loggedAt: new Date().toISOString() };
                setExtOps((prev) => ({ ...prev, maintenance: [rec, ...prev.maintenance] }));
                void postOptionalBackend(`/api/v1/forecourt/pumps/${encodeURIComponent(item.pumpId)}/maintenance`, 'POST', item as unknown as Record<string, unknown>);
                appendAudit('PUMP_MAINTENANCE', 'PUMP', item.pumpId, `${item.maintenanceType} on ${item.pumpCode}`, item.stationId);
                notify('success', `Logged ${item.maintenanceType} service on ${item.pumpCode}.`);
              }}
            />
          }
        />
      )}

      {consoleSection === 'inventory' && (
        <InventorySection
          engine={engineRef.current}
          role={role}
          stationId={effectiveActiveStationId}
          defaultStationId={defaultStationId}
          tanks={store.tanks}
          purchaseOrders={store.purchaseOrders}
          deliveries={store.deliveries}
          dipsticks={store.dipsticks}
          onRecordDipstick={(tankId, litres) =>
            runCommand(
              () => engineRef.current.recordDipstick(role, tankId, litres),
              'Physical dipstick calibration recorded.'
            )
          }
          onCreatePO={(input) =>
            runCommand(
              () => engineRef.current.createPurchaseOrder(role, input),
              `Supplier purchase order created for ${input.orderedLitres} L.`
            )
          }
          onReceiveDelivery={(input) =>
            runCommand(
              () => engineRef.current.receiveDelivery(role, input),
              'Tanker delivery received and Inventory/Accounts Payable journal posted.'
            )
          }
          onCreateTank={(input) =>
            runCommand(
              () => engineRef.current.createTank(role, input),
              `Provisioned underground fuel tank ${input.name}.`
            )
          }
          onDeleteTank={(tankId) =>
            runCommand(
              () => engineRef.current.deleteTank(role, tankId),
              'Deleted underground fuel tank.'
            )
          }
          onDeletePO={(poId) =>
            runCommand(
              () => engineRef.current.deletePurchaseOrder(role, poId),
              'Removed supplier purchase order.'
            )
          }
          onDeleteDelivery={(deliveryId) =>
            runCommand(
              () => engineRef.current.deleteDelivery(role, deliveryId),
              'Deleted tanker delivery record and linked AP journal.'
            )
          }
          onDeleteDipstick={(dipId) =>
            runCommand(
              () => engineRef.current.deleteDipstick(role, dipId),
              'Deleted dipstick calibration reading.'
            )
          }
          onNotify={notify}
        />
      )}

      {consoleSection === 'fleet' && (
        <FleetShopSection
          engine={engineRef.current}
          role={role}
          stationId={effectiveActiveStationId}
          defaultStationId={defaultStationId}
          fleetAccounts={store.fleetAccounts}
          fleetTransactions={store.fleetTransactions}
          shopItems={store.shopItems}
          onRecordVoucher={(input) =>
            runCommand(
              () => engineRef.current.recordFleetVoucher(role, input),
              `Fleet voucher for ${input.vehiclePlate} charged and posted to Accounts Receivable.`
            )
          }
          onSettleFleet={(accId, stId, amount, method) =>
            runCommand(
              () => engineRef.current.settleFleetAccount(role, accId, stId, amount, method),
              'Corporate fleet settlement recorded and AR cleared.'
            )
          }
          onRecordShopSale={(itemId, qty, method) =>
            runCommand(
              () => engineRef.current.recordShopSale(role, itemId, qty, method),
              'Shop/Lubricant sale recorded and non-fuel revenue journal posted.'
            )
          }
          onRestockShopItem={(itemId, qty) =>
            runCommand(
              () => engineRef.current.restockShopItem(role, itemId, qty),
              'SKU inventory restocked and Inventory/Accounts Payable journal posted.'
            )
          }
          onCreateFleetAccount={(input) =>
            runCommand(
              () => engineRef.current.createFleetAccount(role, input),
              `Onboarded corporate fleet client ${input.companyName}.`
            )
          }
          onDeleteFleetAccount={(accountId) =>
            runCommand(
              () => engineRef.current.deleteFleetAccount(role, accountId),
              'Deleted corporate fleet client account.'
            )
          }
          onCreateShopItem={(input) =>
            runCommand(
              () => engineRef.current.createShopItem(role, input),
              `Added shop SKU ${input.sku} (${input.name}).`
            )
          }
          onDeleteShopItem={(itemId) =>
            runCommand(
              () => engineRef.current.deleteShopItem(role, itemId),
              'Removed shop/lubricant SKU.'
            )
          }
          onNotify={notify}
        />
      )}

      {consoleSection === 'workforce' && (
        <WorkforceSection
          engine={engineRef.current}
          role={role}
          stationId={effectiveActiveStationId}
          defaultStationId={defaultStationId}
          employees={store.employees}
          onToggleAttendance={(empId) =>
            runCommand(
              () => engineRef.current.toggleAttendance(role, empId),
              'Employee shift attendance updated.'
            )
          }
          onCreateEmployee={(input) =>
            runCommand(
              () => engineRef.current.createEmployee(role, input),
              `Onboarded ${input.fullName} with role ${input.role}.`
            )
          }
          onUpdateEmployee={(empId, input) =>
            runCommand(
              () => engineRef.current.updateEmployee(role, empId, input),
              `Updated profile for ${input.fullName}.`
            )
          }
          onDeleteEmployee={(empId) =>
            runCommand(
              () => engineRef.current.deleteEmployee(role, empId),
              'Removed employee from station roster.'
            )
          }
          onNotify={notify}
          hrSlot={
            <HrManagementPanel
              stationId={scopedStationId}
              stationName={scopedStationName}
              employees={scopedEmployees}
              role={role}
              contracts={extOps.hrContracts}
              leaves={extOps.hrLeaves}
              certs={extOps.hrCerts}
              disciplinary={extOps.hrDisciplinary}
              onCreateContract={(c) => {
                const rec = { ...c, id: `hrc_${Date.now().toString(36)}`, status: 'ACTIVE' as const };
                setExtOps((prev) => ({ ...prev, hrContracts: [rec, ...prev.hrContracts] }));
                void postOptionalBackend('/api/v1/hr/contracts', 'POST', c as unknown as Record<string, unknown>);
                appendAudit('HR_CONTRACT_CREATED', 'HR_CONTRACT', rec.id, `${c.contractType} contract for ${c.employeeName}`, c.stationId);
                notify('success', `Saved ${c.contractType} contract & CNPS record for ${c.employeeName}.`);
              }}
              onCreateLeave={(l) => {
                const rec = { ...l, id: `hrl_${Date.now().toString(36)}`, status: 'PENDING' as const };
                setExtOps((prev) => ({ ...prev, hrLeaves: [rec, ...prev.hrLeaves] }));
                void postOptionalBackend('/api/v1/hr/leaves', 'POST', l as unknown as Record<string, unknown>);
                appendAudit('HR_LEAVE_REQUESTED', 'HR_LEAVE', rec.id, `${l.leaveType} (${l.daysCount}d) for ${l.employeeName}`, l.stationId);
                notify('success', `Logged ${l.leaveType} leave request for ${l.employeeName}.`);
              }}
              onDecideLeave={(leaveId, status) => {
                setExtOps((prev) => ({
                  ...prev,
                  hrLeaves: prev.hrLeaves.map((lv) =>
                    lv.id === leaveId ? { ...lv, status, reviewedBy: currentActorEmail } : lv
                  ),
                }));
                void postOptionalBackend(`/api/v1/hr/leaves/${encodeURIComponent(leaveId)}/decision`, 'PATCH', { status });
                appendAudit('HR_LEAVE_DECIDED', 'HR_LEAVE', leaveId, `Leave ${leaveId} marked ${status}`);
                notify('success', `Leave request ${status.toLowerCase()}.`);
              }}
              onCreateCert={(cert) => {
                const rec = { ...cert, id: `cert_${Date.now().toString(36)}`, status: 'VALID' as const };
                setExtOps((prev) => ({ ...prev, hrCerts: [rec, ...prev.hrCerts] }));
                void postOptionalBackend('/api/v1/hr/certifications', 'POST', cert as unknown as Record<string, unknown>);
                appendAudit('HSE_CERT_RECORDED', 'HR_CERT', rec.id, `${cert.certName} for ${cert.employeeName}`, cert.stationId);
                notify('success', `Recorded HSE safety certification (${cert.certName}) for ${cert.employeeName}.`);
              }}
              onCreateDisciplinary={(recInput) => {
                const rec = { ...recInput, id: `disc_${Date.now().toString(36)}`, recordedAt: new Date().toISOString() };
                setExtOps((prev) => ({ ...prev, hrDisciplinary: [rec, ...prev.hrDisciplinary] }));
                void postOptionalBackend('/api/v1/hr/disciplinary', 'POST', recInput as unknown as Record<string, unknown>);
                appendAudit('HR_DISCIPLINARY_LOGGED', 'HR_DISCIPLINARY', rec.id, `${recInput.category} (${recInput.severity}) for ${recInput.employeeName}`, recInput.stationId);
                notify('success', `Logged HR ${recInput.category} record for ${recInput.employeeName}.`);
              }}
            />
          }
        />
      )}

      {consoleSection === 'accounting' && (
        <AccountingSection
          engine={engineRef.current}
          role={role}
          stationId={effectiveActiveStationId}
          defaultStationId={defaultStationId}
          report={report}
          shifts={store.shifts}
          journals={store.journals}
          expenses={store.expenses}
          deposits={store.deposits}
          onRecordExpense={(input) =>
            runCommand(
              () => engineRef.current.recordExpense(role, input),
              'Operating expense posted to double-entry ledger.'
            )
          }
          onDeleteExpense={(expenseId) =>
            runCommand(
              () => engineRef.current.deleteExpense(role, expenseId),
              'Deleted operating expense and reversed its journal entry.'
            )
          }
          onRecordDeposit={(input) =>
            runCommand(
              () => engineRef.current.recordDeposit(role, input),
              'Treasury deposit posted from clearing account to Bank.'
            )
          }
          onDeleteDeposit={(depositId) =>
            runCommand(
              () => engineRef.current.deleteDeposit(role, depositId),
              'Deleted treasury deposit and reversed its journal entry.'
            )
          }
          onNotify={notify}
          vaultSlot={
            <div className="space-y-6">
              <CashVaultPanel
                stationId={scopedStationId}
                stationName={scopedStationName}
                entries={extOps.vaultEntries}
                canRecord={role === 'OWNER' || role === 'MANAGER' || role === 'ACCOUNTANT' || role === 'PLATFORM_ADMIN'}
                onRecordEntry={(entry) => {
                  const prevBal = extOps.vaultEntries[0]?.runningBalanceFcfa ?? 0;
                  const delta =
                    entry.entryType === 'SHIFT_DROP'
                      ? entry.amountFcfa
                      : entry.entryType === 'MANAGER_HANDOVER'
                      ? 0
                      : -entry.amountFcfa;
                  const rec = {
                    ...entry,
                    id: `vlt_${Date.now().toString(36)}`,
                    runningBalanceFcfa: Math.max(0, prevBal + delta),
                    recordedAt: new Date().toISOString(),
                  };
                  setExtOps((prev) => ({ ...prev, vaultEntries: [rec, ...prev.vaultEntries] }));
                  void postOptionalBackend('/api/v1/accounting/vault/entries', 'POST', entry as unknown as Record<string, unknown>);
                  appendAudit('VAULT_MOVEMENT', 'CASH_VAULT', rec.id, `${entry.entryType} of ${entry.amountFcfa} FCFA`, entry.stationId);
                  notify('success', `Recorded ${entry.entryType.replace(/_/g, ' ')} in Station Cash Safe.`);
                }}
              />
              <FixedAssetsAndBudgetsPanel
                role={role}
                stationId={scopedStationId}
                stationName={scopedStationName}
                assets={entOps.fixedAssets}
                budgets={entOps.budgets}
                approvals={entOps.approvals}
                onCreateAsset={(assetInput) => {
                  const rec = { ...assetInput, id: `ast_${Date.now().toString(36)}`, status: 'ACTIVE' as const };
                  setEntOps((prev) => ({ ...prev, fixedAssets: [rec, ...prev.fixedAssets] }));
                  void postOptionalBackend('/api/v1/enterprise/fixed-assets', 'POST', assetInput as unknown as Record<string, unknown>);
                  appendAudit('FIXED_ASSET_CAPITALIZED', 'FIXED_ASSET', rec.id, `${assetInput.assetTag} (${assetInput.assetName})`, assetInput.stationId);
                  notify('success', `Capitalized fixed asset ${assetInput.assetTag} (${assetInput.assetName}).`);
                }}
                onCreateBudget={(budgetInput) => {
                  const rec = { ...budgetInput, id: `bdg_${Date.now().toString(36)}` };
                  setEntOps((prev) => ({ ...prev, budgets: [rec, ...prev.budgets] }));
                  void postOptionalBackend('/api/v1/enterprise/budgets', 'POST', budgetInput as unknown as Record<string, unknown>);
                  notify('success', `Saved monthly budget line for ${budgetInput.category}.`);
                }}
                onCreateApproval={(aprInput) => {
                  const rec = { ...aprInput, id: `apr_${Date.now().toString(36)}`, status: 'PENDING' as const, createdAt: new Date().toISOString() };
                  setEntOps((prev) => ({ ...prev, approvals: [rec, ...prev.approvals] }));
                  void postOptionalBackend('/api/v1/enterprise/approvals', 'POST', aprInput as unknown as Record<string, unknown>);
                  notify('success', `Submitted "${aprInput.title}" into Maker-Checker Approval Inbox.`);
                }}
                onDecideApproval={(id, status) => {
                  const target = entOps.approvals.find((a) => a.id === id);
                  if (target && target.requestedBy.toLowerCase() === currentActorEmail.toLowerCase()) {
                    notify('error', 'Maker-Checker rule (T005): you cannot approve your own submission.');
                    return;
                  }
                  setEntOps((prev) => ({
                    ...prev,
                    approvals: prev.approvals.map((a) =>
                      a.id === id ? { ...a, status, decidedBy: currentActorEmail } : a
                    ),
                  }));
                  void postOptionalBackend(`/api/v1/enterprise/approvals/${encodeURIComponent(id)}`, 'PATCH', { status });
                  appendAudit('APPROVAL_DECIDED', 'APPROVAL', id, `Marked approval ${id} as ${status}`);
                  notify('success', `Approval request ${status.toLowerCase()}.`);
                }}
              />
            </div>
          }
        />
      )}

      {consoleSection === 'hse-fraud' && (
        <HseFraudQcSection
          role={role}
          stationId={scopedStationId}
          stationName={scopedStationName}
          tanks={store.tanks.filter((t) => effectiveActiveStationId === 'ALL' || t.stationId === effectiveActiveStationId)}
          shifts={store.shifts.filter((s) => effectiveActiveStationId === 'ALL' || s.stationId === effectiveActiveStationId)}
          deliveries={store.deliveries}
          hseRecords={entOps.hseRecords}
          fraudCases={entOps.fraudCases}
          qualitySamples={entOps.qualitySamples}
          onCreateHseRecord={(recInput) => {
            const rec = { ...recInput, id: `hse_${Date.now().toString(36)}`, status: 'OPEN' as const, recordedAt: new Date().toISOString() };
            setEntOps((prev) => ({ ...prev, hseRecords: [rec, ...prev.hseRecords] }));
            void postOptionalBackend('/api/v1/enterprise/hse-records', 'POST', recInput as unknown as Record<string, unknown>);
            appendAudit('HSE_RECORD_LOGGED', 'HSE', rec.id, recInput.title, recInput.stationId);
            notify('success', `Logged HSE record: ${recInput.title}.`);
          }}
          onCreateFraudCase={(fcInput) => {
            const rec = {
              ...fcInput,
              id: `frd_${Date.now().toString(36)}`,
              recoveredFcfa: 0,
              disposition: 'UNDER_INVESTIGATION' as const,
              openedAt: new Date().toISOString(),
            };
            setEntOps((prev) => ({ ...prev, fraudCases: [rec, ...prev.fraudCases] }));
            void postOptionalBackend('/api/v1/enterprise/fraud-cases', 'POST', fcInput as unknown as Record<string, unknown>);
            appendAudit('FRAUD_CASE_OPENED', 'FRAUD_CASE', rec.id, `${fcInput.anomalyType}: ${fcInput.subjectRef}`, fcInput.stationId);
            notify('success', `Opened fraud investigation case ${rec.id}.`);
          }}
          onUpdateFraudCase={(id, disposition, recoveredFcfa) => {
            setEntOps((prev) => ({
              ...prev,
              fraudCases: prev.fraudCases.map((fc) =>
                fc.id === id ? { ...fc, disposition, recoveredFcfa } : fc
              ),
            }));
            void postOptionalBackend(`/api/v1/enterprise/fraud-cases/${encodeURIComponent(id)}`, 'PATCH', { disposition, recoveredFcfa });
            appendAudit('FRAUD_CASE_UPDATED', 'FRAUD_CASE', id, `Disposition ${disposition} (recovered ${recoveredFcfa} FCFA)`);
            notify('success', `Updated fraud investigation case ${id} to ${disposition.replace(/_/g, ' ')}.`);
          }}
          onCreateQualitySample={(qcInput) => {
            const rec = {
              ...qcInput,
              id: `qc_${Date.now().toString(36)}`,
              quarantined: qcInput.waterPasteDetected,
              testedAt: new Date().toISOString(),
            };
            setEntOps((prev) => ({ ...prev, qualitySamples: [rec, ...prev.qualitySamples] }));
            void postOptionalBackend('/api/v1/enterprise/quality-samples', 'POST', qcInput as unknown as Record<string, unknown>);
            appendAudit('FUEL_QC_TESTED', 'TANK', qcInput.tankId, `${qcInput.tankName} density ${qcInput.densityKgM3} · water=${qcInput.waterPasteDetected}`, qcInput.stationId);
            notify(
              qcInput.waterPasteDetected ? 'error' : 'success',
              qcInput.waterPasteDetected
                ? `Water detected in ${qcInput.tankName} — tank automatically placed in STOP-SALE Quarantine!`
                : `Recorded Fuel Quality Certificate for ${qcInput.tankName}.`
            );
          }}
          onToggleQuarantine={(id, quarantined) => {
            setEntOps((prev) => ({
              ...prev,
              qualitySamples: prev.qualitySamples.map((q) => (q.id === id ? { ...q, quarantined } : q)),
            }));
            void postOptionalBackend(`/api/v1/enterprise/quality-samples/${encodeURIComponent(id)}/quarantine`, 'PATCH', { quarantined });
            appendAudit('TANK_QUARANTINE_TOGGLED', 'FUEL_QC', id, quarantined ? 'Placed tank under STOP-SALE Quarantine' : 'Released tank from Quarantine');
            notify('success', quarantined ? 'Tank placed under STOP-SALE Quarantine.' : 'Tank released for forecourt dispensing.');
          }}
        />
      )}

      {consoleSection === 'enterprise-ops' && (
        <EnterpriseOperationsSection
          role={role}
          stationId={scopedStationId}
          stationName={scopedStationName}
          stations={store.stations}
          tanks={store.tanks.filter((t) => effectiveActiveStationId === 'ALL' || t.stationId === effectiveActiveStationId)}
          shifts={store.shifts.filter((s) => effectiveActiveStationId === 'ALL' || s.stationId === effectiveActiveStationId)}
          serviceBayTickets={entOps.serviceBayTickets}
          transfers={entOps.transfers}
          vouchers={entOps.loyaltyVouchers}
          bulkOrders={entOps.bulkOrders}
          evUtility={entOps.evUtility}
          franchises={entOps.franchises}
          onCreateServiceBay={(bayInput) => {
            const rec = { ...bayInput, id: `bay_${Date.now().toString(36)}`, status: 'COMPLETED' as const, createdAt: new Date().toISOString() };
            setEntOps((prev) => ({ ...prev, serviceBayTickets: [rec, ...prev.serviceBayTickets] }));
            void postOptionalBackend('/api/v1/enterprise/service-bay', 'POST', bayInput as unknown as Record<string, unknown>);
            notify('success', `Posted ${bayInput.serviceCategory.replace(/_/g, ' ')} ticket for ${bayInput.vehiclePlate} (${bayInput.amountFcfa} FCFA).`);
          }}
          onCreateTransfer={(trfInput) => {
            const rec = { ...trfInput, id: `trf_${Date.now().toString(36)}`, receivedLitres: null, status: 'IN_TRANSIT' as const, dispatchedAt: new Date().toISOString() };
            setEntOps((prev) => ({ ...prev, transfers: [rec, ...prev.transfers] }));
            void postOptionalBackend('/api/v1/enterprise/transfers', 'POST', trfInput as unknown as Record<string, unknown>);
            notify('success', `Dispatched ${trfInput.dispatchedLitres} L ${trfInput.fuelGrade} transfer (${trfInput.sealNumber}) to ${trfInput.toStationName}.`);
          }}
          onReceiveTransfer={(id, receivedLitres) => {
            setEntOps((prev) => ({
              ...prev,
              transfers: prev.transfers.map((t) => (t.id === id ? { ...t, receivedLitres, status: 'RECEIVED' as const } : t)),
            }));
            void postOptionalBackend(`/api/v1/enterprise/transfers/${encodeURIComponent(id)}/receive`, 'PATCH', { receivedLitres });
            notify('success', `Confirmed receipt of ${receivedLitres} L on transfer ${id}.`);
          }}
          onIssueVoucher={(vInput) => {
            const code = `OPF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const rec = {
              ...vInput,
              id: `vch_${Date.now().toString(36)}`,
              voucherCode: code,
              balanceFcfa: vInput.issuedFcfa,
              loyaltyPoints: Math.round(vInput.issuedFcfa / 1000),
              status: 'ACTIVE' as const,
              issuedAt: new Date().toISOString(),
            };
            setEntOps((prev) => ({ ...prev, loyaltyVouchers: [rec, ...prev.loyaltyVouchers] }));
            void postOptionalBackend('/api/v1/enterprise/loyalty-vouchers', 'POST', vInput as unknown as Record<string, unknown>);
            notify('success', `Issued prepaid fuel voucher ${code} for ${vInput.customerName}.`);
          }}
          onRedeemVoucher={(id, amountFcfa) => {
            setEntOps((prev) => ({
              ...prev,
              loyaltyVouchers: prev.loyaltyVouchers.map((v) => {
                if (v.id !== id) return v;
                const nextBal = Math.max(0, v.balanceFcfa - amountFcfa);
                return { ...v, balanceFcfa: nextBal, status: nextBal === 0 ? ('REDEEMED' as const) : ('ACTIVE' as const) };
              }),
            }));
            void postOptionalBackend(`/api/v1/enterprise/loyalty-vouchers/${encodeURIComponent(id)}/redeem`, 'PATCH', { amountFcfa });
            notify('success', `Redeemed ${amountFcfa} FCFA from prepaid fuel voucher.`);
          }}
          onCreateBulkOrder={(blkInput) => {
            const totalFcfa = Math.round(blkInput.volumeLitres * blkInput.unitPriceFcfa);
            const rec = { ...blkInput, id: `blk_${Date.now().toString(36)}`, totalFcfa, status: 'SCHEDULED' as const, createdAt: new Date().toISOString() };
            setEntOps((prev) => ({ ...prev, bulkOrders: [rec, ...prev.bulkOrders] }));
            void postOptionalBackend('/api/v1/enterprise/bulk-orders', 'POST', blkInput as unknown as Record<string, unknown>);
            notify('success', `Scheduled B2B bulk tanker delivery for ${blkInput.customerCompany} (${blkInput.volumeLitres} L).`);
          }}
          onCreateEvUtility={(evInput) => {
            const rec = { ...evInput, id: `evu_${Date.now().toString(36)}`, recordedAt: new Date().toISOString() };
            setEntOps((prev) => ({ ...prev, evUtility: [rec, ...prev.evUtility] }));
            void postOptionalBackend('/api/v1/enterprise/ev-utility', 'POST', evInput as unknown as Record<string, unknown>);
            notify('success', `Logged ${evInput.meterType.replace(/_/g, ' ')} reading (${evInput.quantityUnit} ${evInput.unitLabel}).`);
          }}
          onCreateFranchise={(frnInput) => {
            const rec = { ...frnInput, id: `frn_${Date.now().toString(36)}`, status: 'ACTIVE' as const };
            setEntOps((prev) => ({ ...prev, franchises: [rec, ...prev.franchises] }));
            void postOptionalBackend('/api/v1/enterprise/franchises', 'POST', frnInput as unknown as Record<string, unknown>);
            notify('success', `Registered ${frnInput.operatingModel} dealer agreement for ${frnInput.dealerName}.`);
          }}
          onRaiseSuggestedPo={(grade, litres, unitCostFcfa) =>
            runCommand(
              () =>
                engineRef.current.createPurchaseOrder(role, {
                  stationId: scopedStationId,
                  supplierName: 'SCDP Depot Douala (Auto-Forecast)',
                  grade,
                  orderedLitres: litres,
                  unitCostFcfa,
                }),
              `Raised forecast replenishment PO for ${litres} L of ${grade}.`
            )
          }
        />
      )}

      {consoleSection === 'ai-assistant' && (
        <AiAssistantSection
          engine={engineRef.current}
          accessToken={authSession?.accessToken ?? null}
          tenant={store.tenant}
          role={role}
          activeStationId={effectiveActiveStationId}
          stations={store.stations}
          tanks={store.tanks}
          pumps={store.pumps}
          shifts={store.shifts}
          fleetAccounts={store.fleetAccounts}
          report={report}
          onToggleAiSubscription={(enable) =>
            runCommand(
              () => engineRef.current.activateAiSubscription(role, enable),
              enable
                ? 'OpesFuel Paid AI Copilot activated across your station network.'
                : 'OpesFuel Paid AI Copilot paused.'
            )
          }
          onJumpTo={(sec) => {
            if (canAccessSection(role, sec)) setConsoleSection(sec);
          }}
        />
      )}

      {consoleSection === 'mobile-app' && (
        <MobileAppShowcase
          stations={store.stations}
          activeStationId={effectiveActiveStationId}
          tanks={store.tanks}
          pumps={store.pumps}
          shifts={store.shifts}
          employees={store.employees}
          fleetAccounts={store.fleetAccounts}
          shopItems={store.shopItems}
          report={report}
          aiSubscription={store.tenant.aiSubscription}
          transportMode={engineRef.current.getTransportMode()}
          onOpenShift={(stId, pId, attId) =>
            runCommand(
              () => engineRef.current.openShift(role, stId, pId, attId),
              'Opened shift from Mobile App and emitted ShiftOpenedEvent.'
            )
          }
          onCloseShift={(shiftId, payload) =>
            runCommand(
              () => engineRef.current.closeShift(role, shiftId, payload),
              'Closed shift from Mobile App and posted double-entry journals.'
            )
          }
          onRecordDipstick={(tankId, litres) =>
            runCommand(
              () => engineRef.current.recordDipstick(role, tankId, litres),
              'Dipstick calibration recorded from Mobile App.'
            )
          }
          onRecordVoucher={(input) =>
            runCommand(
              () => engineRef.current.recordFleetVoucher(role, input),
              `Fleet voucher for ${input.vehiclePlate} posted from Mobile App.`
            )
          }
          onRecordShopSale={(itemId, qty, method) =>
            runCommand(
              () => engineRef.current.recordShopSale(role, itemId, qty, method),
              'Shop POS sale recorded from Mobile App.'
            )
          }
          onToggleAiSubscription={(enable) =>
            runCommand(
              () => engineRef.current.activateAiSubscription(role, enable),
              enable ? 'Activated Paid AI Copilot from Mobile App.' : 'Paused Paid AI Copilot.'
            )
          }
          onRunInstitutionalSetup={(stId, selections, lubricantsPack) =>
            runCommand(
              () => engineRef.current.runInstitutionalSetup(role, stId, selections, lubricantsPack),
              `Synchronized ${selections.length} institutional fuel grades from Mobile App.`
            )
          }
        />
      )}

      {consoleSection === 'api-platform' && (
        <ApiPlatformSection
          engine={engineRef.current}
          events={store.events}
          apiKeys={store.apiKeys}
          webhooks={store.webhooks}
          onCreateApiKey={(label, scopes) =>
            runCommand(
              () => engineRef.current.createApiKey(role, label, scopes),
              `Provisioned scoped API key "${label}".`
            )
          }
          onRevokeApiKey={(keyId) =>
            runCommand(
              () => engineRef.current.revokeApiKey(role, keyId),
              'Revoked tenant API key.'
            )
          }
          onCreateWebhook={(url, evts) =>
            runCommand(
              () => engineRef.current.createWebhook(role, url, evts),
              `Registered HMAC webhook endpoint ${url}.`
            )
          }
          onToggleWebhook={(webhookId) =>
            runCommand(
              () => engineRef.current.toggleWebhook(role, webhookId),
              'Toggled webhook subscription delivery state.'
            )
          }
          onDeleteWebhook={(webhookId) =>
            runCommand(
              () => engineRef.current.deleteWebhook(role, webhookId),
              'Deleted webhook subscription.'
            )
          }
          onExecuteApiQuery={executeApiQuery}
          onNotify={notify}
        />
      )}

      {consoleSection === 'admin' && (
        <AdminBillingSection
          engine={engineRef.current}
          tenant={store.tenant}
          role={role}
          stations={store.stations}
          pumps={store.pumps}
          tanks={store.tanks}
          employees={store.employees}
          onCreateStation={(input) =>
            runCommand(
              () => engineRef.current.createStation(role, input),
              `Onboarded station ${input.name} (${input.planName}).`
            )
          }
          onUpdateStation={(stationId, input) =>
            runCommand(
              () => engineRef.current.updateStation(role, stationId, input),
              `Updated station ${input.name} (${input.code}).`
            )
          }
          onDeleteStation={(stationId) =>
            runCommand(
              () => engineRef.current.deleteStation(role, stationId),
              'Removed station and cleaned up station operational records.'
            )
          }
          onUpdateSubscription={(stationId, planName, monthlyFeeFcfa) =>
            runCommand(
              () => engineRef.current.updateStationSubscription(role, stationId, planName, monthlyFeeFcfa),
              `Updated station subscription to ${planName} (${monthlyFeeFcfa} FCFA/mo).`
            )
          }
          onToggleAiSubscription={(enable) =>
            runCommand(
              () => engineRef.current.activateAiSubscription(role, enable),
              enable
                ? 'Activated Paid AI Copilot SaaS add-on.'
                : 'Paused Paid AI Copilot SaaS add-on.'
            )
          }
          onClearDemoData={() => {
            runCommand(
              () => engineRef.current.clearAllDemoData(role),
              'Cleared all sample demo data. Configure your station fuels & opening volumes now.'
            );
            setOnboardingTab('institutional');
            setOnboardingOpen(true);
          }}
          onRestoreDemoData={() =>
            runCommand(
              () => engineRef.current.restoreSampleDemoData(role),
              'Restored full Cameroon demo network data.'
            )
          }
          onNotify={notify}
          auditAndProfileSlot={
            <div className="space-y-6">
              <DataImportWizardPanel
                stationId={scopedStationId}
                onImportTank={(input) =>
                  runCommand(
                    () => engineRef.current.createTank(role, input),
                    `Imported underground tank ${input.name}.`
                  )
                }
                onImportEmployee={(input) =>
                  runCommand(
                    () => engineRef.current.createEmployee(role, input),
                    `Imported employee ${input.fullName}.`
                  )
                }
                onImportFleet={(input) =>
                  runCommand(
                    () => engineRef.current.createFleetAccount(role, input),
                    `Imported corporate fleet client ${input.companyName}.`
                  )
                }
                onImportShop={(input) =>
                  runCommand(
                    () => engineRef.current.createShopItem(role, input),
                    `Imported shop SKU ${input.sku}.`
                  )
                }
                onNotify={notify}
              />
              <SecurityAuditAndProfilePanel
                accounts={extOps.accounts}
                auditLogs={extOps.auditLogs}
                outboundMessages={extOps.outboundMessages}
                totalDemoRecords={extOps.totalDemoRecords}
                onSeed1000Demo={() => void handleSeed1000Demo()}
                onSendOutbound={(msg) => {
                  const rec = {
                    id: `msg_${Date.now().toString(36)}`,
                    channel: msg.channel,
                    recipient: msg.recipient,
                    subject: msg.subject,
                    bodyPreview: msg.body.slice(0, 120),
                    status: 'SENT' as const,
                    provider: msg.channel === 'EMAIL' ? 'SMTP_RELAY' : msg.channel === 'WHATSAPP' ? 'META_WHATSAPP' : 'AFRICASTALKING_SMS',
                    createdAt: new Date().toISOString(),
                  };
                  setExtOps((prev) => ({ ...prev, outboundMessages: [rec, ...prev.outboundMessages] }));
                  void postOptionalBackend('/api/v1/notifications/outbound/send', 'POST', msg as unknown as Record<string, unknown>);
                  appendAudit('OUTBOUND_MESSAGE_SENT', 'NOTIFICATION', rec.id, `${msg.channel} to ${msg.recipient}: ${msg.subject}`);
                  notify('success', `Dispatched ${msg.channel} message to ${msg.recipient}.`);
                }}
                onUpdateProfile={(profileInput) => {
                  setExtOps((prev) => ({
                    ...prev,
                    accounts: prev.accounts.map((acc) =>
                      acc.role === role
                        ? {
                            ...acc,
                            fullName: profileInput.fullName,
                            phone: profileInput.phone,
                            preferredLanguage: profileInput.preferredLanguage,
                            emailAlertsEnabled: profileInput.emailAlertsEnabled,
                          }
                        : acc
                    ),
                  }));
                  void postOptionalBackend('/api/v1/identity/profile', 'PATCH', profileInput as unknown as Record<string, unknown>);
                  appendAudit('PROFILE_UPDATED', 'USER_ACCOUNT', role, `Updated profile & language (${profileInput.preferredLanguage.toUpperCase()})`);
                  notify('success', `Saved profile settings (${profileInput.preferredLanguage.toUpperCase()}).`);
                }}
              />
            </div>
          }
        />
      )}

      <GlobalSearchModal
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        organizationName={store.tenant.organizationName}
        stationScope={scopedStationName}
        pumps={store.pumps}
        tanks={store.tanks}
        shifts={store.shifts}
        employees={store.employees}
        fleetAccounts={store.fleetAccounts}
        shopItems={store.shopItems}
        purchaseOrders={store.purchaseOrders}
        journals={store.journals}
        auditLogs={extOps.auditLogs}
        report={report}
        onNavigateSection={(sec) => {
          if (canAccessSection(role, sec)) setConsoleSection(sec);
        }}
      />

      <OnboardingGuideModal
        open={onboardingOpen}
        initialTab={onboardingTab}
        onClose={() => setOnboardingOpen(false)}
        tenant={store.tenant}
        stations={store.stations}
        activeStationId={effectiveActiveStationId}
        tanks={store.tanks}
        pumps={store.pumps}
        employees={store.employees}
        shifts={store.shifts}
        journals={store.journals}
        report={report}
        onJumpTo={(sec) => {
          if (canAccessSection(role, sec)) setConsoleSection(sec);
        }}
        onApplyInstitutionalSetup={(stId, selections, lubricantsPack) =>
          runCommand(
            () => engineRef.current.runInstitutionalSetup(role, stId, selections, lubricantsPack),
            `Synchronized ${selections.length} institutional fuel grades, tanks, nozzles, and opening capital ledger.`
          )
        }
      />
    </ConsoleLayout>
  );
}
