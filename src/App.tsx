import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  refreshAuth0SessionIfNeeded,
} from './auth/auth0';
import { ClassicLoginPage } from './components/auth/ClassicLoginPage';
import { AccountingSection } from './components/console/AccountingSection';
import { AdminBillingSection } from './components/console/AdminBillingSection';
import { AiAssistantSection } from './components/console/AiAssistantSection';
import { ApiPlatformSection } from './components/console/ApiPlatformSection';
import { ConsoleLayout, NotificationItem } from './components/console/ConsoleLayout';
import { FleetShopSection } from './components/console/FleetShopSection';
import { ForecourtSection } from './components/console/ForecourtSection';
import { InventorySection } from './components/console/InventorySection';
import { OnboardingGuideModal } from './components/console/OnboardingGuideModal';
import { OverviewSection } from './components/console/OverviewSection';
import { PlatformAdminSection } from './components/console/PlatformAdminSection';
import { WorkforceSection } from './components/console/WorkforceSection';
import { MobileAppShowcase } from './components/mobile/MobileAppShowcase';
import { PublicFooter } from './components/public/PublicFooter';
import { PublicHeader } from './components/public/PublicHeader';
import { PublicSite } from './components/public/PublicSite';
import { ConsoleSection, PublicPage, UserRole } from './domain/types';

const PUBLIC_PAGES: PublicPage[] = [
  'home',
  'platform',
  'pricing',
  'licensing',
  'mobile',
  'api',
  'contact',
  'legal',
];

const CONSOLE_SECTIONS: ConsoleSection[] = [
  'platform-admin',
  'overview',
  'forecourt',
  'inventory',
  'fleet',
  'workforce',
  'accounting',
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
} {
  const rawOriginal = hashStr.replace(/^#\/?/, '');
  const raw = rawOriginal.toLowerCase();
  if (!raw) {
    return { mode: 'public', publicPage: 'home', consoleSection: 'overview', inviteToken: null };
  }
  if (raw.startsWith('invite/')) {
    const token = rawOriginal.slice('invite/'.length).trim();
    return { mode: 'login', publicPage: 'home', consoleSection: 'overview', inviteToken: token || null };
  }
  if (raw === 'login') {
    return { mode: 'login', publicPage: 'home', consoleSection: 'overview', inviteToken: null };
  }
  if (raw.startsWith('app/')) {
    const seg = raw.slice(4) as ConsoleSection;
    if (CONSOLE_SECTIONS.includes(seg)) {
      return { mode: 'console', publicPage: 'home', consoleSection: seg, inviteToken: null };
    }
    return { mode: 'console', publicPage: 'home', consoleSection: 'overview', inviteToken: null };
  }
  if (PUBLIC_PAGES.includes(raw as PublicPage)) {
    return { mode: 'public', publicPage: raw as PublicPage, consoleSection: 'overview', inviteToken: null };
  }
  return { mode: 'public', publicPage: 'home', consoleSection: 'overview', inviteToken: null };
}

export default function App() {
  const engineRef = useRef<OpesFuelApiEngine>(new OpesFuelApiEngine());
  const [store, setStore] = useState<OpesFuelStoreState>(() => engineRef.current.getSnapshot());

  const initialRoute = useMemo(() => parseHashRoute(), []);
  const [mode, setMode] = useState<'public' | 'login' | 'console'>(initialRoute.mode);
  const [publicPage, setPublicPage] = useState<PublicPage>(initialRoute.publicPage);
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
      setMode(parsed.mode);
      setPublicPage(parsed.publicPage);
      setConsoleSection(parsed.consoleSection);
      setPendingInviteToken(parsed.inviteToken);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
        <PublicHeader
          activePage={publicPage}
          onNavigate={setPublicPage}
          onOpenConsole={openClassicLogin}
        />
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
            onNavigate={setPublicPage}
            onOpenConsole={openClassicLogin}
            onLeadSubmitted={(lead) => engineRef.current.recordPreviewLead(lead)}
          />
        </main>
        <PublicFooter
          onNavigate={setPublicPage}
          onOpenConsole={openClassicLogin}
        />
      </div>
    );
  }

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
          report={report}
          onboardingCompletedCount={onboardingCompletedCount}
          onOpenOnboardingGuide={openOnboardingGuide}
          onUpdatePrice={(stId, grade, price) =>
            runCommand(
              () => engineRef.current.updateFuelPrice(role, stId, grade, price),
              `Published ${grade} price update to ${price} FCFA/L and emitted FuelPriceUpdatedEvent.`
            )
          }
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
        />
      )}

      {consoleSection === 'accounting' && (
        <AccountingSection
          engine={engineRef.current}
          role={role}
          stationId={effectiveActiveStationId}
          defaultStationId={defaultStationId}
          report={report}
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
        />
      )}

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
