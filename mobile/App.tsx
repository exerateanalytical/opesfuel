import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Clock, Cloud, CloudOff, Ellipsis, Fuel, Gauge, House, RefreshCw, ShoppingCart, TrendingUp, Truck, type LucideIcon } from 'lucide-react-native';
import { ApiError, OpesFuelMobileClient } from './src/api/opesfuelMobileClient';
import { clearMobileTokens, getStoredTokens, isDemoModeEnabled, isMobileAuth0Configured, loginWithMobileAuth0, refreshStoredTokens, StoredTokens, usesBackendIdentityLookup } from './src/auth/mobileAuth0';
import { DataProvider, useData } from './src/data';
import { DemoClient } from './src/demoClient';
import { LangProvider, useT } from './src/i18n';
import { Role, TABS_BY_ROLE, TabId } from './src/logic';
import { NotifyProvider } from './src/notify';
import { demoSession, Session, sessionFromTokens } from './src/session';
import { colors } from './src/theme';
import { FleetScreen } from './src/screens/Fleet';
import { HomeScreen } from './src/screens/Home';
import { AiScreen, MoreScreen, SetupScreen } from './src/screens/More';
import { MyShiftScreen } from './src/screens/MyShift';
import { PumpsScreen } from './src/screens/Pumps';
import { ReportsScreen } from './src/screens/Reports';
import { SellScreen } from './src/screens/Sell';
import { SendScreen } from './src/screens/Send';
import { SignInScreen } from './src/screens/SignIn';
import { TanksScreen } from './src/screens/Tanks';

const realClient = new OpesFuelMobileClient();
type ScreenId = TabId | 'setup' | 'ai';

export default function App() {
  return (
    <LangProvider>
      <Gate />
    </LangProvider>
  );
}

/** Decides between the sign-in screen and the app. The role always comes from the signed-in account, never from a switch. */
function Gate() {
  const { t } = useT();
  const [phase, setPhase] = useState<'boot' | 'out' | 'in'>('boot');
  const [session, setSession] = useState<Session | null>(null);
  const [client, setClient] = useState<OpesFuelMobileClient>(realClient);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tokens = useRef<StoredTokens | null>(null);
  const refreshing = useRef(false);

  const signOut = useCallback(async (msg?: string) => {
    await clearMobileTokens();
    realClient.setAccessToken(null);
    tokens.current = null;
    setSession(null); setClient(realClient); setMessage(msg ?? null); setPhase('out');
  }, []);

  const apply = useCallback(async (tok: StoredTokens): Promise<'ok' | 'EXPIRED' | 'INVALID' | 'UNSUPPORTED_ROLE' | 'NO_WORKSPACE'> => {
    let r = sessionFromTokens(tok.accessToken, tok.idToken);
    if (!r.ok && r.reason === 'UNSUPPORTED_ROLE' && usesBackendIdentityLookup) {
      // Keycloak tokens carry no OpesFuel claims: ask the backend who this is (it resolves company and role from the verified email)
      realClient.setAccessToken(tok.accessToken);
      try {
        const me = await realClient.getIdentityMe();
        r = sessionFromTokens(tok.accessToken, tok.idToken, undefined, { roles: me.roles ?? [], tenantId: me.tenantId ?? null, stationIds: me.allowedStationIds ?? [] });
      } catch (e) {
        realClient.setAccessToken(null);
        return e instanceof ApiError && (e.status === 403 || e.status === 404) ? 'NO_WORKSPACE' : 'INVALID';
      }
    }
    if (!r.ok) return r.reason;
    realClient.setAccessToken(tok.accessToken);
    tokens.current = tok;
    setClient(realClient); setSession(r.session); setMessage(null); setPhase('in');
    return 'ok';
  }, []);

  const renew = useCallback(async (): Promise<boolean> => {
    if (refreshing.current) return false;
    refreshing.current = true;
    try {
      const cur = tokens.current ?? (await getStoredTokens());
      const next = await refreshStoredTokens(cur?.refreshToken ?? null);
      return Boolean(next) && (await apply(next as StoredTokens)) === 'ok';
    } finally { refreshing.current = false; }
  }, [apply]);

  // boot: restore a saved login, renewing it silently when needed
  useEffect(() => {
    void (async () => {
      if (!isMobileAuth0Configured) { setPhase('out'); return; }
      const saved = await getStoredTokens();
      if (!saved) { setPhase('out'); return; }
      const res = await apply(saved);
      if (res === 'ok') return;
      if (res === 'UNSUPPORTED_ROLE') { await signOut(t('unsupportedRole')); return; }
      if (res === 'NO_WORKSPACE') { await signOut(t('noWorkspace')); return; }
      if (!(await renew())) await signOut(res === 'EXPIRED' ? t('sessionExpired') : undefined);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // a 401 from the server: try one silent renewal, otherwise ask the user to sign in again
  useEffect(() => {
    realClient.setUnauthorizedHandler(() => { void (async () => { if (!(await renew())) await signOut(t('sessionExpired')); })(); });
    return () => realClient.setUnauthorizedHandler(null);
  }, [renew, signOut, t]);

  // renew shortly before the token expires so nobody is thrown out mid-shift
  useEffect(() => {
    if (!session || session.mode !== 'AUTH0' || !session.exp) return;
    const ms = Math.max(5_000, session.exp * 1000 - Date.now() - 60_000);
    const timer = setTimeout(() => { void (async () => { if (!(await renew())) await signOut(t('sessionExpired')); })(); }, Math.min(ms, 2_000_000_000));
    return () => clearTimeout(timer);
  }, [session, renew, signOut, t]);

  const signIn = async () => {
    setBusy(true); setMessage(null);
    try {
      const tok = await loginWithMobileAuth0();
      const res = await apply(tok);
      if (res === 'UNSUPPORTED_ROLE') await signOut(t('unsupportedRole'));
      else if (res === 'NO_WORKSPACE') await signOut(t('noWorkspace'));
      else if (res !== 'ok') setMessage(t('signInError'));
    } catch { setMessage(t('signInError')); } finally { setBusy(false); }
  };

  const startDemo = (role: Role) => {
    const s = demoSession(role);
    setClient(new DemoClient(s)); setSession(s); setPhase('in');
  };

  if (phase === 'boot') return <View style={{ flex: 1, backgroundColor: colors.navy }} />;
  if (phase === 'out' || !session) {
    return <SignInScreen onSignIn={signIn} busy={busy} message={message} configured={isMobileAuth0Configured} demoEnabled={isDemoModeEnabled} onDemo={startDemo} />;
  }
  return (
    <NotifyProvider>
      <DataProvider client={client} session={session}>
        <Shell onSignOut={() => void signOut()} />
      </DataProvider>
    </NotifyProvider>
  );
}

const ICONS: Record<TabId, LucideIcon> = {
  home: House, pumps: Fuel, tanks: Gauge, sell: ShoppingCart, reports: TrendingUp, send: RefreshCw, more: Ellipsis, fleet: Truck, myshift: Clock,
};
const LABELS: Record<TabId, string> = {
  home: 'tabHome', pumps: 'tabPumps', tanks: 'tabTanks', sell: 'tabSell', reports: 'tabReports', send: 'tabSend', more: 'tabMore', fleet: 'tabFleet', myshift: 'tabMyShift',
};

function Shell({ onSignOut }: { onSignOut: () => void }) {
  const d = useData();
  const { t } = useT();
  const tabs = TABS_BY_ROLE[d.session.role];
  const [screen, setScreen] = useState<ScreenId>(tabs[0]);
  const go = (s: ScreenId) => setScreen(s);
  const online = d.health?.connected ?? false;
  const badge = d.queueCount + d.failedCount;

  let body: React.ReactNode;
  switch (screen) {
    case 'home': body = <HomeScreen onGo={go} />; break;
    case 'myshift': body = <MyShiftScreen />; break;
    case 'pumps': body = <PumpsScreen />; break;
    case 'tanks': body = <TanksScreen />; break;
    case 'sell': body = <SellScreen />; break;
    case 'reports': body = <ReportsScreen />; break;
    case 'fleet': body = <FleetScreen />; break;
    case 'send': body = <SendScreen />; break;
    case 'setup': body = <SetupScreen onBack={() => go('more')} />; break;
    case 'ai': body = <AiScreen onBack={() => go('more')} />; break;
    default: body = <MoreScreen onGo={go} onSignOut={onSignOut} />;
  }
  const activeTab: TabId = (['setup', 'ai'] as ScreenId[]).includes(screen) ? 'more' : (screen as TabId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }}>
      <StatusBar style="light" />
      <View style={st.header}>
        <View style={{ flex: 1 }}>
          <Text style={st.title} numberOfLines={1}>{d.stationName || 'OpesFuel'}</Text>
          <Text style={st.subtitle}>{t(`role${d.session.role}`)}{d.session.name ? ` · ${d.session.name}` : ''}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={online ? t('online') : t('offline')} onPress={() => go('send')} style={[st.pill, { borderColor: online ? '#34D399' : '#F59E0B' }]}>
          {online ? <Cloud color="#34D399" size={16} /> : <CloudOff color="#F59E0B" size={16} />}
          <Text style={[st.pillText, { color: online ? '#34D399' : '#F59E0B' }]}>{d.queueCount > 0 ? t('waiting', { n: d.queueCount }) : online ? t('online') : t('offline')}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>{body}</View>
      <View style={st.bar}>
        {tabs.map((id) => {
          const Icon = ICONS[id];
          const on = activeTab === id;
          const showBadge = (id === 'send' || id === 'more') && badge > 0;
          return (
            <TouchableOpacity key={id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t(LABELS[id])} onPress={() => go(id)} style={st.tab}>
              {on ? <View style={st.tabLine} /> : null}
              <View>
                <Icon color={on ? colors.amber : colors.mute} size={24} />
                {showBadge ? <View style={st.badge}><Text style={st.badgeText}>{badge}</Text></View> : null}
              </View>
              <Text style={[st.tabText, on && { color: colors.amber }]}>{t(LABELS[id])}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  header: { backgroundColor: colors.navy, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: '#fff', fontSize: 19, fontWeight: '800' },
  subtitle: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, minHeight: 40 },
  pillText: { fontSize: 13, fontWeight: '800' },
  bar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 64, paddingVertical: 8, gap: 3 },
  tabLine: { position: 'absolute', top: 0, left: 12, right: 12, height: 3, borderRadius: 2, backgroundColor: colors.amber },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.mute },
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
