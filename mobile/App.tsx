import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  CheckCircle2,
  Circle,
  Flame,
  RefreshCw,
  Sparkles,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react-native';
import {
  DEFAULT_INSTITUTIONAL_FUELS,
  MobileFuelGrade,
  MobileInstitutionalFuelTemplate,
  MobileRole,
  MobileSyncHealth,
  MobileTankDto,
  OpesFuelMobileClient,
  QueuedCommand,
} from './src/api/opesfuelMobileClient';
import {
  clearMobileAccessToken,
  getStoredMobileAccessToken,
  isMobileAuth0Configured,
  loginWithMobileAuth0,
} from './src/auth/mobileAuth0';

const client = new OpesFuelMobileClient();

const formatFcfa = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} FCFA`;
const formatLitres = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} L`;

type MobileTab = 'shifts' | 'inventory' | 'fleet' | 'reports' | 'ai' | 'setup';

interface SetupRowDraft {
  selected: boolean;
  grade: MobileFuelGrade;
  label: string;
  tankName: string;
  capacityLitres: string;
  openingLitres: string;
  unitCostFcfa: string;
  sellingPriceFcfa: string;
  nozzleCount: string;
}

const INITIAL_TANKS: MobileTankDto[] = [
  {
    id: 'tk_01',
    name: 'Underground Tank T-01 (Super)',
    grade: 'SUPER',
    capacityLitres: 35000,
    bookVolumeLitres: 24680,
    lastDipLitres: 24645,
    status: 'NOMINAL',
  },
  {
    id: 'tk_02',
    name: 'Underground Tank T-02 (Gasoil)',
    grade: 'GASOIL',
    capacityLitres: 45000,
    bookVolumeLitres: 31200,
    lastDipLitres: 31180,
    status: 'NOMINAL',
  },
  {
    id: 'tk_03',
    name: 'Underground Tank T-03 (Kerosene)',
    grade: 'KEROSENE',
    capacityLitres: 15000,
    bookVolumeLitres: 2450,
    lastDipLitres: 2370,
    status: 'LOW_STOCK',
  },
];

export default function App() {
  const [role, setRole] = useState<MobileRole>('OWNER');
  const [activeTab, setActiveTab] = useState<MobileTab>('shifts');
  const [tanks, setTanks] = useState<MobileTankDto[]>(INITIAL_TANKS);
  const [closingMeter, setClosingMeter] = useState('485420');
  const [cashFcfa, setCashFcfa] = useState('840000');
  const [momoFcfa, setMomoFcfa] = useState('310000');
  const [dipTankId, setDipTankId] = useState('tk_01');
  const [dipTankLitres, setDipTankLitres] = useState('24645');
  const [fleetPlate, setFleetPlate] = useState('LT-482-AK');
  const [fleetGrade, setFleetGrade] = useState<MobileFuelGrade>('GASOIL');
  const [fleetLitres, setFleetLitres] = useState('150');
  const [shopQty, setShopQty] = useState('2');
  const [queue, setQueue] = useState<QueuedCommand[]>([]);
  const [syncHealth, setSyncHealth] = useState<MobileSyncHealth>({
    state: 'CHECKING',
    connected: false,
    latencyMs: null,
    pendingQueueCount: 0,
    lastSyncedAt: null,
    endpoint: 'http://localhost:8080/api/v1',
  });
  const [banner, setBanner] = useState<string | null>(null);

  // Paid AI Copilot state
  const [aiActive, setAiActive] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);

  // Institutional Fuels & Onboarding Setup state
  const [setupRows, setSetupRows] = useState<SetupRowDraft[]>(() =>
    DEFAULT_INSTITUTIONAL_FUELS.map((tpl) => ({
      selected: tpl.code === 'SUPER' || tpl.code === 'GASOIL',
      grade: tpl.code,
      label: tpl.label,
      tankName: tpl.tankName,
      capacityLitres: String(tpl.defaultCapacityLitres),
      openingLitres: String(tpl.defaultOpeningLitres),
      unitCostFcfa: String(tpl.defaultUnitCostFcfa),
      sellingPriceFcfa: String(tpl.defaultSellingPriceFcfa),
      nozzleCount: String(tpl.defaultNozzleCount),
    }))
  );
  const [includeLubricants, setIncludeLubricants] = useState(true);
  const [oilQty, setOilQty] = useState('30');
  const [lpgCylQty, setLpgCylQty] = useState('24');
  const [shiftClosedOnce, setShiftClosedOnce] = useState(true);

  const [report, setReport] = useState({
    totalRevenueFcfa: 48650000,
    grossProfitFcfa: 6240000,
    operatingExpensesFcfa: 1480000,
    vatPayableFcfa: 7854000,
    netIncomeFcfa: 4760000,
    trialBalanceBalanced: true,
  });

  const refreshSyncHealth = async () => {
    setSyncHealth((prev) => ({ ...prev, state: 'CHECKING' }));
    const health = await client.checkConnectivity();
    setSyncHealth(health);
    setQueue(await client.getOfflineQueue());
  };

  const [authToken, setAuthToken] = useState<string | null>(null);

  const handleMobileAuth0Toggle = async () => {
    if (authToken) {
      await clearMobileAccessToken();
      client.setAccessToken(null);
      setAuthToken(null);
      setBanner('Signed out from Auth0 mobile session.');
      return;
    }
    try {
      const token = await loginWithMobileAuth0();
      client.setAccessToken(token);
      setAuthToken(token);
      setBanner('Authenticated via Auth0 OIDC PKCE. Syncing live station telemetry.');
      await refreshSyncHealth();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Mobile Auth0 sign-in failed.');
    }
  };

  useEffect(() => {
    void getStoredMobileAccessToken().then((stored) => {
      if (stored) {
        client.setAccessToken(stored);
        setAuthToken(stored);
      }
    });
    void refreshSyncHealth();
    const poll = setInterval(() => {
      void client.checkConnectivity().then(setSyncHealth).catch(() => {});
    }, 15000);
    client
      .fetchTanks('st_plateau')
      .then((remoteTanks) => {
        if (Array.isArray(remoteTanks) && remoteTanks.length > 0) {
          setTanks(remoteTanks);
          setDipTankId(remoteTanks[0].id);
        }
      })
      .catch(() => {});
    client
      .fetchFinancialReport('st_plateau')
      .then((res) => setReport(res))
      .catch(() => {});
    client
      .fetchAiSubscription('st_plateau')
      .then((sub) => setAiActive(Boolean(sub.active)))
      .catch(() => {});
    client
      .fetchInstitutionalFuels()
      .then((catalog: MobileInstitutionalFuelTemplate[]) => {
        setSetupRows(
          catalog.map((tpl) => ({
            selected: tpl.code === 'SUPER' || tpl.code === 'GASOIL',
            grade: tpl.code,
            label: tpl.label,
            tankName: tpl.tankName,
            capacityLitres: String(tpl.defaultCapacityLitres),
            openingLitres: String(tpl.defaultOpeningLitres),
            unitCostFcfa: String(tpl.defaultUnitCostFcfa),
            sellingPriceFcfa: String(tpl.defaultSellingPriceFcfa),
            nozzleCount: String(tpl.defaultNozzleCount),
          }))
        );
      })
      .catch(() => {});
    return () => clearInterval(poll);
  }, []);

  const metricsSnapshot = useMemo(
    () => ({
      stationId: 'st_plateau',
      tanks,
      reportFcfa: report,
      queuedOfflineCommands: queue.length,
    }),
    [tanks, report, queue.length]
  );

  const onboardingSteps = useMemo(
    () => [
      { key: 'FUELS', label: '1. Institutional Fuels & Opening Volumes', done: tanks.length > 0 },
      { key: 'PUMPS', label: '2. Forecourt Pumps & Staff Roster', done: tanks.length > 0 },
      { key: 'SHIFT', label: '3. Open & Reconcile First Shift', done: shiftClosedOnce },
      { key: 'LEDGER', label: '4. Audit Balanced FCFA Trial Balance', done: report.trialBalanceBalanced },
      { key: 'AI', label: '5. Activate Paid AI Copilot (25 000 FCFA/mo)', done: aiActive },
    ],
    [tanks.length, shiftClosedOnce, report.trialBalanceBalanced, aiActive]
  );

  const completedStepsCount = onboardingSteps.filter((s) => s.done).length;

  const applyCommandSyncResult = async (synced: boolean) => {
    const updatedQueue = await client.getOfflineQueue();
    setQueue(updatedQueue);
    setSyncHealth((prev) => ({
      ...prev,
      connected: synced,
      pendingQueueCount: updatedQueue.length,
      state: synced && updatedQueue.length === 0 ? 'LIVE_CONNECTED' : 'OFFLINE_QUEUED',
      lastSyncedAt: synced ? new Date().toISOString() : prev.lastSyncedAt,
    }));
  };

  const handleShiftSubmit = async () => {
    const res = await client.submitOrQueueCommand('Close Pump P-01 Shift', '/forecourt/shifts/sh_101/close', {
      closingMeterLitres: Number(closingMeter) || 0,
      cashFcfa: Number(cashFcfa) || 0,
      mobileMoneyFcfa: Number(momoFcfa) || 0,
      cardFcfa: 0,
      fleetCreditFcfa: 0,
    });
    setShiftClosedOnce(true);
    await applyCommandSyncResult(res.synced);
    setBanner(res.synced ? 'Shift synced to Java Spring Boot ledger.' : 'Offline: queued safely with Idempotency-Key.');
  };

  const handleDipstickSubmit = async () => {
    const measured = Number(dipTankLitres) || 0;
    const res = await client.submitOrQueueCommand('Tank Dipstick Reading', '/inventory/dipsticks', {
      tankId: dipTankId,
      measuredLitres: measured,
    });
    setTanks((prev) =>
      prev.map((t) =>
        t.id === dipTankId
          ? {
              ...t,
              lastDipLitres: measured,
              status: Math.abs(measured - t.bookVolumeLitres) > 100 ? 'VARIANCE_ALERT' : t.status,
            }
          : t
      )
    );
    await applyCommandSyncResult(res.synced);
    setBanner(res.synced ? 'Dipstick reconciled.' : 'Offline: dipstick queued for auto-sync.');
  };

  const handleFleetVoucher = async () => {
    const res = await client.submitOrQueueCommand('Fleet Voucher ' + fleetPlate, '/fleet/vouchers', {
      accountId: 'flt_01',
      stationId: 'st_plateau',
      vehiclePlate: fleetPlate,
      driverName: 'Mobile Driver',
      grade: fleetGrade,
      litres: Number(fleetLitres) || 0,
    });
    await applyCommandSyncResult(res.synced);
    setBanner(res.synced ? `Fleet credit voucher (${fleetGrade}) posted.` : 'Offline: fleet voucher queued.');
  };

  const handleShopSale = async () => {
    const res = await client.submitOrQueueCommand('Lubricant 15W40 Sale', '/shop/sales', {
      itemId: 'sku_01',
      quantity: Number(shopQty) || 1,
      paymentMethod: 'MOBILE_MONEY',
    });
    await applyCommandSyncResult(res.synced);
    setBanner(res.synced ? 'Shop sale recorded.' : 'Offline: shop sale queued.');
  };

  const handleToggleAi = async () => {
    const next = !aiActive;
    setAiActive(next);
    const res = await client.toggleAiSubscription('st_plateau', next);
    await applyCommandSyncResult(res.synced);
    setBanner(
      res.synced
        ? next
          ? 'Paid AI Copilot activated (25 000 FCFA/mo).'
          : 'Paid AI Copilot paused.'
        : 'AI Copilot status queued for server sync.'
    );
  };

  const handleRunAiAnalysis = async () => {
    setAiLoading(true);
    try {
      const res = await client.runAiAnalysis('st_plateau', metricsSnapshot);
      setAiSummary(res.analysis);
    } catch {
      const lowTanks = tanks.filter((t) => t.bookVolumeLitres / Math.max(1, t.capacityLitres) < 0.25);
      const alerts =
        lowTanks.length > 0
          ? lowTanks.map((t) => `${t.name}: ${formatLitres(t.bookVolumeLitres)} left — schedule SCDP refill within 48h.`).join('\n')
          : 'All underground tanks are above 25% reserve threshold.';
      setAiSummary(
        `Offline Forecast Snapshot (30d est. ${formatFcfa(report.totalRevenueFcfa)}):\n${alerts}\nConnect to your OpesFuel Java Spring Boot server with GEMINI_API_KEY configured for live predictive modeling.`
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleAskAi = async () => {
    const q = aiQuestion.trim();
    if (!q) return;
    setAiLoading(true);
    setAiQuestion('');
    try {
      const res = await client.askAiAdvisor('st_plateau', q, metricsSnapshot);
      setAiAnswer(res.answer);
    } catch {
      const lowest = [...tanks].sort((a, b) => a.bookVolumeLitres - b.bookVolumeLitres)[0];
      setAiAnswer(
        lowest
          ? `Lowest current reserve is ${lowest.name} at ${formatLitres(lowest.bookVolumeLitres)}. Connect to live station API for full AI Q&A.`
          : 'No tanks configured yet. Complete Institutional Setup first.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const updateSetupRow = (grade: MobileFuelGrade, patch: Partial<SetupRowDraft>) => {
    setSetupRows((prev) => prev.map((r) => (r.grade === grade ? { ...r, ...patch } : r)));
  };

  const handleApplyInstitutionalSetup = async () => {
    const selected = setupRows.filter((r) => r.selected);
    if (selected.length === 0) {
      setBanner('Select at least one fuel grade before syncing.');
      return;
    }
    const items = selected.map((r) => ({
      grade: r.grade,
      tankName: r.tankName.trim() || `${r.grade} Reserve Tank`,
      capacityLitres: Math.max(1000, Number(r.capacityLitres) || 20000),
      openingLitres: Math.max(0, Number(r.openingLitres) || 0),
      unitCostFcfa: Math.max(100, Number(r.unitCostFcfa) || 500),
      sellingPriceFcfa: Math.max(100, Number(r.sellingPriceFcfa) || 600),
      nozzleCount: Math.max(1, Number(r.nozzleCount) || 1),
    }));

    const res = await client.applyInstitutionalSetup('st_plateau', items, {
      includeLubricants,
      oilBottlesQty: Math.max(0, Number(oilQty) || 0),
      lpgCylindersQty: Math.max(0, Number(lpgCylQty) || 0),
    });

    setTanks(
      items.map((item, idx) => ({
        id: `tk_sync_${idx + 1}`,
        name: item.tankName,
        grade: item.grade,
        capacityLitres: item.capacityLitres,
        bookVolumeLitres: item.openingLitres,
        lastDipLitres: item.openingLitres,
        status: item.openingLitres / item.capacityLitres < 0.2 ? 'LOW_STOCK' : 'NOMINAL',
      }))
    );
    await applyCommandSyncResult(res.synced);
    setBanner(
      res.synced
        ? `Synchronized ${items.length} institutional fuel grades & opening volumes across mobile and backend.`
        : `Synchronized locally & queued ${items.length} institutional grades with Idempotency-Key.`
    );
  };

  const handleSyncQueue = async () => {
    const synced = await client.flushOfflineQueue();
    await refreshSyncHealth();
    setBanner(`Synced ${synced} queued command(s) to Java Spring Boot.`);
  };

  const isLiveConnected = syncHealth.connected && queue.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.headerWrapper}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Flame size={18} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.brand}>
                Opes<Text style={styles.brandAccent}>Fuel</Text> Mobile
              </Text>
              <Text style={styles.subtitle}>Android &amp; iPhone · Station Plateau · FCFA · {role}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {isMobileAuth0Configured && (
              <TouchableOpacity style={styles.roleButton} onPress={handleMobileAuth0Toggle}>
                <Text style={styles.roleButtonText}>{authToken ? 'Auth0 Out' : 'Auth0 SSO'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.roleButton}
              onPress={() => setRole(role === 'OWNER' ? 'ATTENDANT' : 'OWNER')}
            >
              <Text style={styles.roleButtonText}>{role === 'OWNER' ? 'Attendant View' : 'Owner View'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Real-Time Java Spring Boot Sync Status Indicator */}
        <TouchableOpacity
          style={[
            styles.syncBar,
            isLiveConnected
              ? styles.syncBarLive
              : syncHealth.state === 'CHECKING'
              ? styles.syncBarChecking
              : styles.syncBarOffline,
          ]}
          onPress={queue.length > 0 ? handleSyncQueue : refreshSyncHealth}
        >
          <View style={styles.syncLeft}>
            <View
              style={[
                styles.syncDot,
                isLiveConnected
                  ? styles.syncDotLive
                  : syncHealth.state === 'CHECKING'
                  ? styles.syncDotChecking
                  : styles.syncDotOffline,
              ]}
            />
            {isLiveConnected ? (
              <Wifi size={14} color="#15803D" />
            ) : (
              <WifiOff size={14} color={syncHealth.connected ? '#B45309' : '#B91C1C'} />
            )}
            <Text
              style={[
                styles.syncStatusText,
                isLiveConnected
                  ? styles.syncTextLive
                  : syncHealth.state === 'CHECKING'
                  ? styles.syncTextChecking
                  : styles.syncTextOffline,
              ]}
            >
              {syncHealth.state === 'CHECKING'
                ? 'Checking Java Spring Boot Backend...'
                : isLiveConnected
                ? `Live Server Connected · Java Spring Boot (${syncHealth.latencyMs ?? 12}ms)`
                : syncHealth.connected
                ? `Connected · ${queue.length} Command(s) Queued (Tap to Sync)`
                : `Offline-Queued Mode · ${queue.length} Queued · Spring Boot Unreachable`}
            </Text>
          </View>
          <RefreshCw size={13} color={isLiveConnected ? '#15803D' : '#991B1B'} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabBar}>
        {([
          { id: 'shifts', label: 'Shifts' },
          { id: 'inventory', label: 'Tanks' },
          { id: 'fleet', label: 'Fleet/POS' },
          { id: 'reports', label: 'Reports' },
          { id: 'ai', label: 'AI Copilot' },
          { id: 'setup', label: `Setup (${completedStepsCount}/5)` },
        ] as const).map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {banner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        ) : null}

        {queue.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Offline Sync Queue ({queue.length})</Text>
            <Text style={styles.muted}>Idempotent commands waiting for connection</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleSyncQueue}>
              <Text style={styles.secondaryBtnText}>Sync Now</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {activeTab === 'shifts' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Close Pump Shift (P-01A · Super)</Text>
            <Text style={styles.label}>Closing Totalizer (Litres)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={closingMeter} onChangeText={setClosingMeter} />
            <Text style={styles.label}>Cash Collected (FCFA)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={cashFcfa} onChangeText={setCashFcfa} />
            <Text style={styles.label}>Mobile Money OM/MoMo (FCFA)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={momoFcfa} onChangeText={setMomoFcfa} />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleShiftSubmit}>
              <Text style={styles.primaryBtnText}>Submit &amp; Post Ledger</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'inventory' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Underground Tanks ({tanks.length})</Text>
              {tanks.map((tank) => (
                <TouchableOpacity
                  key={tank.id}
                  style={[styles.tankRow, dipTankId === tank.id && styles.tankRowSelected]}
                  onPress={() => {
                    setDipTankId(tank.id);
                    setDipTankLitres(String(tank.lastDipLitres));
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tankName}>{tank.name}</Text>
                    <Text style={styles.muted}>
                      {tank.grade} · Cap {formatLitres(tank.capacityLitres)}
                    </Text>
                  </View>
                  <Text style={styles.monoValue}>{formatLitres(tank.bookVolumeLitres)}</Text>
                </TouchableOpacity>
              ))}
              {tanks.length === 0 && (
                <Text style={styles.muted}>No tanks provisioned yet. Open Setup to tick fuels &amp; volumes.</Text>
              )}
            </View>

            {tanks.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Record Physical Dipstick</Text>
                <Text style={styles.label}>Measured Dipstick Volume (Litres)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={dipTankLitres} onChangeText={setDipTankLitres} />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleDipstickSubmit}>
                  <Text style={styles.primaryBtnText}>Record Dipstick Check</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {activeTab === 'fleet' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Corporate Fleet Voucher</Text>
              <Text style={styles.label}>Vehicle Plate</Text>
              <TextInput style={styles.input} value={fleetPlate} onChangeText={setFleetPlate} />
              <Text style={styles.label}>Fuel Grade</Text>
              <View style={styles.gradeRow}>
                {(['SUPER', 'GASOIL', 'KEROSENE', 'LPG_BULK', 'HEAVY_FUEL'] as MobileFuelGrade[]).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.gradeBtn, fleetGrade === g && styles.gradeBtnActive]}
                    onPress={() => setFleetGrade(g)}
                  >
                    <Text style={[styles.gradeBtnText, fleetGrade === g && styles.gradeBtnTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Dispensed Litres</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={fleetLitres} onChangeText={setFleetLitres} />
              <TouchableOpacity style={styles.primaryBtn} onPress={handleFleetVoucher}>
                <Text style={styles.primaryBtnText}>Charge Fleet Account</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Lubricants &amp; 12.5kg Gas POS</Text>
              <Text style={styles.muted}>OpesLube 15W40 (5L) · 18 500 FCFA</Text>
              <Text style={styles.label}>Quantity</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={shopQty} onChangeText={setShopQty} />
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleShopSale}>
                <Text style={styles.secondaryBtnText}>Record Mobile Money Sale</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {activeTab === 'reports' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Automated Financial Report (FCFA)</Text>
            <View style={styles.row}>
              <Text style={styles.muted}>Fuel &amp; Shop Revenue</Text>
              <Text style={styles.monoValue}>{formatFcfa(report.totalRevenueFcfa)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.muted}>Gross Margin</Text>
              <Text style={styles.monoValue}>{formatFcfa(report.grossProfitFcfa)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.muted}>Operating Expenses</Text>
              <Text style={styles.monoValue}>{formatFcfa(report.operatingExpensesFcfa)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.muted}>VAT Payable (19.25%)</Text>
              <Text style={styles.monoValue}>{formatFcfa(report.vatPayableFcfa)}</Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.cardTitle}>Net Income</Text>
              <Text style={styles.monoPositive}>{formatFcfa(report.netIncomeFcfa)}</Text>
            </View>
          </View>
        )}

        {activeTab === 'ai' && (
          <>
            <View style={styles.darkCard}>
              <View style={styles.rowHeader}>
                <Sparkles size={18} color="#F59E0B" />
                <Text style={styles.darkCardTitle}>OpesFuel Paid AI Copilot</Text>
              </View>
              <Text style={styles.darkMuted}>
                {aiActive
                  ? 'Active SaaS Intelligence · Tank stockout alerts, 30-day FCFA forecasts & variance checks.'
                  : '25 000 FCFA/month Add-On (Free with Network Enterprise). Unlock automated stockout predictions & financial Q&A.'}
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleToggleAi}>
                <Text style={styles.primaryBtnText}>
                  {aiActive ? 'Pause Paid AI Copilot' : 'Activate Paid AI Copilot (25 000 FCFA/mo)'}
                </Text>
              </TouchableOpacity>
            </View>

            {aiActive && (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Predictive Tank &amp; Margin Analysis</Text>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleRunAiAnalysis} disabled={aiLoading}>
                    <Text style={styles.secondaryBtnText}>
                      {aiLoading ? 'Analyzing Telemetry...' : 'Run AI Stockout & Revenue Forecast'}
                    </Text>
                  </TouchableOpacity>
                  {aiSummary ? <Text style={styles.aiOutput}>{aiSummary}</Text> : null}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Ask OpesFuel AI Advisor</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Which tank runs out first?"
                    value={aiQuestion}
                    onChangeText={setAiQuestion}
                  />
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleAskAi} disabled={aiLoading}>
                    <Text style={styles.primaryBtnText}>Ask Station Advisor</Text>
                  </TouchableOpacity>
                  {aiAnswer ? <Text style={styles.aiOutput}>{aiAnswer}</Text> : null}
                </View>
              </>
            )}
          </>
        )}

        {activeTab === 'setup' && (
          <>
            <View style={styles.card}>
              <View style={styles.rowHeader}>
                <Wrench size={18} color="#D97706" />
                <Text style={styles.cardTitle}>Onboarding Guide ({completedStepsCount}/5)</Text>
              </View>
              {onboardingSteps.map((step) => (
                <View key={step.key} style={styles.checkRow}>
                  {step.done ? <CheckCircle2 size={18} color="#16A34A" /> : <Circle size={18} color="#94A3B8" />}
                  <Text style={styles.checkLabel}>{step.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Institutional Fuels &amp; Opening Volumes</Text>
              <Text style={styles.muted}>
                Tick the fuels carried at your station and enter capacities &amp; Litres to sync tanks, nozzles, and ledger.
              </Text>
              {setupRows.map((row) => (
                <View key={row.grade} style={[styles.setupCard, row.selected && styles.setupCardActive]}>
                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => updateSetupRow(row.grade, { selected: !row.selected })}
                  >
                    {row.selected ? <CheckCircle2 size={18} color="#D97706" /> : <Circle size={18} color="#94A3B8" />}
                    <Text style={styles.tankName}>{row.label}</Text>
                  </TouchableOpacity>
                  {row.selected && (
                    <View style={styles.setupInputs}>
                      <View style={styles.setupCol}>
                        <Text style={styles.smallLabel}>Capacity (L)</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          value={row.capacityLitres}
                          onChangeText={(v) => updateSetupRow(row.grade, { capacityLitres: v })}
                        />
                      </View>
                      <View style={styles.setupCol}>
                        <Text style={styles.smallLabel}>Opening (L)</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          value={row.openingLitres}
                          onChangeText={(v) => updateSetupRow(row.grade, { openingLitres: v })}
                        />
                      </View>
                      <View style={styles.setupCol}>
                        <Text style={styles.smallLabel}>Sell FCFA/L</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          value={row.sellingPriceFcfa}
                          onChangeText={(v) => updateSetupRow(row.grade, { sellingPriceFcfa: v })}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setIncludeLubricants(!includeLubricants)}
              >
                {includeLubricants ? <CheckCircle2 size={18} color="#D97706" /> : <Circle size={18} color="#94A3B8" />}
                <Text style={styles.tankName}>Include Lubricants &amp; 12.5kg Gas Cylinders</Text>
              </TouchableOpacity>

              {includeLubricants && (
                <View style={styles.setupInputs}>
                  <View style={styles.setupCol}>
                    <Text style={styles.smallLabel}>15W40 5L Qty</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={oilQty} onChangeText={setOilQty} />
                  </View>
                  <View style={styles.setupCol}>
                    <Text style={styles.smallLabel}>12.5kg LPG Qty</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={lpgCylQty} onChangeText={setLpgCylQty} />
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.primaryBtn} onPress={handleApplyInstitutionalSetup}>
                <Text style={styles.primaryBtnText}>Apply &amp; Sync Station Modules</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dangerBtn}
                onPress={() => {
                  setTanks([]);
                  setBanner('Cleared mobile demo tanks. Tick fuels above to start with live station data.');
                }}
              >
                <Text style={styles.dangerBtnText}>Clear Demo Tanks</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  syncBarLive: { backgroundColor: '#ECFDF5' },
  syncBarOffline: { backgroundColor: '#FEF2F2' },
  syncBarChecking: { backgroundColor: '#FFFBEB' },
  syncLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  syncDotLive: { backgroundColor: '#16A34A' },
  syncDotOffline: { backgroundColor: '#DC2626' },
  syncDotChecking: { backgroundColor: '#D97706' },
  syncStatusText: { fontSize: 11, fontWeight: '700', flex: 1 },
  syncTextLive: { color: '#166534' },
  syncTextOffline: { color: '#991B1B' },
  syncTextChecking: { color: '#92400E' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  brandAccent: { color: '#D97706' },
  subtitle: { fontSize: 11, color: '#64748B', marginTop: 1 },
  roleButton: { backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  roleButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  tabScroll: { maxHeight: 58, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#F1F5F9' },
  tabActive: { backgroundColor: '#D97706' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  tabTextActive: { color: '#FFFFFF' },
  content: { padding: 16, gap: 14 },
  banner: { padding: 12, borderRadius: 8, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' },
  bannerText: { color: '#78350F', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  darkCard: { backgroundColor: '#0F172A', padding: 16, borderRadius: 10, gap: 10 },
  darkCardTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  darkMuted: { fontSize: 13, color: '#CBD5E1', lineHeight: 18 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 4 },
  smallLabel: { fontSize: 11, fontWeight: '600', color: '#475569', marginBottom: 4 },
  muted: { fontSize: 13, color: '#64748B' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, padding: 10, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC' },
  primaryBtn: { backgroundColor: '#D97706', paddingVertical: 13, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  secondaryBtn: { backgroundColor: '#0F172A', paddingVertical: 11, borderRadius: 6, alignItems: 'center' },
  secondaryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  dangerBtn: { borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  dangerBtnText: { color: '#B91C1C', fontWeight: '600', fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalRow: { borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 6, paddingTop: 12 },
  monoValue: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  monoPositive: { fontSize: 15, fontWeight: '700', color: '#16A34A' },
  tankRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  tankRowSelected: { borderColor: '#D97706', backgroundColor: '#FFFBEB' },
  tankName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  gradeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gradeBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  gradeBtnActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  gradeBtnText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  gradeBtnTextActive: { color: '#F59E0B' },
  aiOutput: { marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', fontSize: 13, color: '#0F172A', lineHeight: 19 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  checkLabel: { fontSize: 13, color: '#1E293B', flex: 1 },
  setupCard: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  setupCardActive: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  setupInputs: { flexDirection: 'row', gap: 8 },
  setupCol: { flex: 1 },
});
