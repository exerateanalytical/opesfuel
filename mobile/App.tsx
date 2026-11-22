import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
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
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Circle,
  Cloud,
  CloudOff,
  CreditCard,
  Fuel,
  Gauge,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react-native';
import {
  DEFAULT_INSTITUTIONAL_FUELS,
  MobileFuelGrade,
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

type MobileTab = 'shifts' | 'inventory' | 'fleet' | 'reports' | 'sync' | 'ai' | 'setup';

interface MobilePump {
  id: string;
  code: string;
  grade: MobileFuelGrade;
  totalizerLitres: number;
  unitPriceFcfa: number;
  status: 'ACTIVE_SHIFT' | 'IDLE';
  attendantName: string | null;
}

interface MobileFleet {
  id: string;
  companyName: string;
  creditLimitFcfa: number;
  currentBalanceFcfa: number;
}

const INITIAL_PUMPS: MobilePump[] = [
  {
    id: 'pmp_01',
    code: 'PMP-01',
    grade: 'SUPER',
    totalizerLitres: 485000,
    unitPriceFcfa: 840,
    status: 'ACTIVE_SHIFT',
    attendantName: 'Samuel Tchoupo',
  },
  {
    id: 'pmp_02',
    code: 'PMP-02',
    grade: 'GASOIL',
    totalizerLitres: 612400,
    unitPriceFcfa: 828,
    status: 'IDLE',
    attendantName: null,
  },
  {
    id: 'pmp_03',
    code: 'PMP-03',
    grade: 'SUPER',
    totalizerLitres: 294120,
    unitPriceFcfa: 840,
    status: 'ACTIVE_SHIFT',
    attendantName: 'Mireille Ngo',
  },
];

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

const INITIAL_FLEETS: MobileFleet[] = [
  { id: 'flt_01', companyName: 'Cameroon Timber Logistics SA', creditLimitFcfa: 6000000, currentBalanceFcfa: 2450000 },
  { id: 'flt_02', companyName: 'Douala Express Freight SARL', creditLimitFcfa: 4500000, currentBalanceFcfa: 1820000 },
  { id: 'flt_03', companyName: 'Littoral Construction Group', creditLimitFcfa: 8000000, currentBalanceFcfa: 3100000 },
];

export default function App() {
  const [role, setRole] = useState<MobileRole>('OWNER');
  const [activeTab, setActiveTab] = useState<MobileTab>('shifts');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Master -> Detail drill-down IDs
  const [detailPumpId, setDetailPumpId] = useState<string | null>(null);
  const [detailTankId, setDetailTankId] = useState<string | null>(null);
  const [detailFleetId, setDetailFleetId] = useState<string | null>(null);
  const [posSubTab, setPosSubTab] = useState<'fleet' | 'shop'>('fleet');

  // Operational state
  const [pumps, setPumps] = useState<MobilePump[]>(INITIAL_PUMPS);
  const [tanks, setTanks] = useState<MobileTankDto[]>(INITIAL_TANKS);
  const [fleets] = useState<MobileFleet[]>(INITIAL_FLEETS);
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
  const [signedIn, setSignedIn] = useState(false);

  // Form states inside detail screens
  const [litresDelta, setLitresDelta] = useState('420');
  const [cashFcfa, setCashFcfa] = useState('247000');
  const [momoFcfa, setMomoFcfa] = useState('105800');
  const [dipLitres, setDipLitres] = useState('24645');
  const [fleetPlate, setFleetPlate] = useState('LT-482-AK');
  const [fleetDriver, setFleetDriver] = useState('Jean-Luc Fotso');
  const [fleetLitres, setFleetLitres] = useState('120');

  // Setup screen drafts
  const [setupRows, setSetupRows] = useState(() =>
    DEFAULT_INSTITUTIONAL_FUELS.map((f) => ({
      selected: f.code === 'SUPER' || f.code === 'GASOIL',
      grade: f.code,
      label: f.label,
      tankName: f.tankName,
      capacityLitres: String(f.defaultCapacityLitres),
      openingLitres: String(f.defaultOpeningLitres),
      unitCostFcfa: String(f.defaultUnitCostFcfa),
      sellingPriceFcfa: String(f.defaultSellingPriceFcfa),
      nozzleCount: String(f.defaultNozzleCount),
    }))
  );

  const refreshSyncState = async () => {
    const [q, health] = await Promise.all([client.getOfflineQueue(), client.checkConnectivity()]);
    setQueue(q);
    setSyncHealth(health);
  };

  useEffect(() => {
    void (async () => {
      const token = await getStoredMobileAccessToken();
      if (token) {
        client.setAccessToken(token);
        setSignedIn(true);
      }
      await refreshSyncState();
    })();
  }, []);

  const detailPump = useMemo(() => pumps.find((p) => p.id === detailPumpId) ?? null, [pumps, detailPumpId]);
  const detailTank = useMemo(() => tanks.find((t) => t.id === detailTankId) ?? null, [tanks, detailTankId]);
  const detailFleet = useMemo(() => fleets.find((f) => f.id === detailFleetId) ?? null, [fleets, detailFleetId]);

  const navigateTab = (next: MobileTab) => {
    setActiveTab(next);
    setDetailPumpId(null);
    setDetailTankId(null);
    setDetailFleetId(null);
    setDrawerOpen(false);
  };

  const handleCloseShift = async (pump: MobilePump) => {
    const sold = Math.max(1, Number(litresDelta) || 0);
    const closingMeterLitres = pump.totalizerLitres + sold;
    const res = await client.submitOrQueueCommand(
      `Close Shift ${pump.code} (${sold} L)`,
      `/forecourt/shifts/${pump.id}/close`,
      {
        closingMeterLitres,
        cashFcfa: Number(cashFcfa) || 0,
        mobileMoneyFcfa: Number(momoFcfa) || 0,
        cardFcfa: 0,
        fleetCreditFcfa: 0,
      }
    );
    setPumps((prev) =>
      prev.map((p) => (p.id === pump.id ? { ...p, totalizerLitres: closingMeterLitres, status: 'IDLE', attendantName: null } : p))
    );
    setDetailPumpId(null);
    setBanner(res.synced ? `Shift closed on ${pump.code} and synced live.` : `Queued offline (${res.idempotencyKey.slice(0, 8)}).`);
    await refreshSyncState();
  };

  const handleOpenShift = async (pump: MobilePump) => {
    const res = await client.submitOrQueueCommand(`Open Shift ${pump.code}`, '/forecourt/shifts/open', {
      stationId: 'st_plateau',
      pumpId: pump.id,
      attendantId: 'emp_01',
    });
    setPumps((prev) =>
      prev.map((p) => (p.id === pump.id ? { ...p, status: 'ACTIVE_SHIFT', attendantName: 'Samuel Tchoupo' } : p))
    );
    setBanner(res.synced ? `Opened shift on ${pump.code}.` : `Shift open queued offline (${res.idempotencyKey.slice(0, 8)}).`);
    await refreshSyncState();
  };

  const handleRecordDipstick = async (tank: MobileTankDto) => {
    const measuredLitres = Number(dipLitres) || tank.bookVolumeLitres;
    const res = await client.submitOrQueueCommand(
      `Dipstick ${tank.name}: ${measuredLitres} L`,
      `/inventory/tanks/${tank.id}/dipstick`,
      { measuredLitres }
    );
    setTanks((prev) => prev.map((t) => (t.id === tank.id ? { ...t, lastDipLitres: measuredLitres } : t)));
    setDetailTankId(null);
    setBanner(res.synced ? `Dipstick saved (${formatLitres(measuredLitres)}).` : `Dipstick queued offline (${res.idempotencyKey.slice(0, 8)}).`);
    await refreshSyncState();
  };

  const handleIssueVoucher = async (fleet: MobileFleet) => {
    const litres = Math.max(1, Number(fleetLitres) || 0);
    const res = await client.submitOrQueueCommand(
      `Fleet Voucher ${fleetPlate} (${litres} L)`,
      '/fleet/vouchers',
      {
        accountId: fleet.id,
        stationId: 'st_plateau',
        vehiclePlate: fleetPlate.trim(),
        driverName: fleetDriver.trim(),
        grade: 'GASOIL',
        litres,
      }
    );
    setDetailFleetId(null);
    setBanner(res.synced ? `Voucher posted for ${fleet.companyName}.` : `Voucher queued offline (${res.idempotencyKey.slice(0, 8)}).`);
    await refreshSyncState();
  };

  const handleFlushQueue = async () => {
    const count = await client.flushOfflineQueue();
    await refreshSyncState();
    setBanner(count > 0 ? `Synchronized ${count} queued operation(s) cleanly.` : 'Server unreachable — queue safely preserved.');
  };

  const handleAuthToggle = async () => {
    if (signedIn) {
      await clearMobileAccessToken();
      client.setAccessToken(null);
      setSignedIn(false);
      setBanner('Signed out of Auth0 session.');
      return;
    }
    if (!isMobileAuth0Configured) {
      setBanner('Configure EXPO_PUBLIC_AUTH0_DOMAIN to enable SSO sign-in.');
      return;
    }
    const result = await loginWithMobileAuth0();
    if (result.accessToken) {
      client.setAccessToken(result.accessToken);
      setSignedIn(true);
      setBanner('Signed in via Auth0 PKCE.');
    } else if (result.error) {
      setBanner(result.error);
    }
  };

  const activeCount = pumps.filter((p) => p.status === 'ACTIVE_SHIFT').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Clean Obsidian Navy Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.iconBtn} accessibilityLabel="Open menu">
            <Menu color="#FFFFFF" size={22} />
          </TouchableOpacity>
          <View>
            <Text style={styles.topTitle}>OpesFuel Douala</Text>
            <Text style={styles.topSub}>{role} · Forecourt Companion</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => navigateTab('sync')} style={styles.syncPill}>
          {syncHealth.connected ? <Cloud color="#FFFFFF" size={14} /> : <CloudOff color="#F59E0B" size={14} />}
          <Text style={styles.syncPillText}>
            {queue.length > 0 ? `${queue.length} Queued` : syncHealth.connected ? 'LIVE' : 'OFFLINE'}
          </Text>
        </TouchableOpacity>
      </View>

      {banner && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
          <TouchableOpacity onPress={() => setBanner(null)}>
            <X color="#FFFFFF" size={16} />
          </TouchableOpacity>
        </View>
      )}

      {/* Slide-Over Hamburger Drawer */}
      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerPanel}>
            <View style={styles.drawerHeader}>
              <View>
                <Text style={styles.drawerBrand}>OpesFuel Mobile</Text>
                <Text style={styles.drawerSub}>Petrol Station OS</Text>
              </View>
              <TouchableOpacity onPress={() => setDrawerOpen(false)}>
                <X color="#94A3B8" size={22} />
              </TouchableOpacity>
            </View>

            <Text style={styles.drawerSectionLabel}>ACTIVE ROLE</Text>
            <View style={styles.roleRow}>
              {(['OWNER', 'MANAGER', 'ATTENDANT', 'ACCOUNTANT'] as MobileRole[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                >
                  <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.drawerNavList}>
              {[
                { id: 'shifts' as const, label: 'Forecourt & Shifts', icon: Fuel },
                { id: 'inventory' as const, label: 'Underground Tanks', icon: Gauge },
                { id: 'fleet' as const, label: 'Fleet Credit & POS', icon: CreditCard },
                { id: 'reports' as const, label: 'Daily Reports & P&L', icon: TrendingUp },
                { id: 'sync' as const, label: `Offline Sync Queue (${queue.length})`, icon: RefreshCw },
                { id: 'setup' as const, label: 'Fuel Grade Setup', icon: Wrench },
                { id: 'ai' as const, label: 'AI Station Copilot', icon: Sparkles },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => navigateTab(item.id)}
                    style={[styles.drawerNavItem, active && styles.drawerNavItemActive]}
                  >
                    <Icon color={active ? '#FFFFFF' : '#CBD5E1'} size={18} />
                    <Text style={[styles.drawerNavText, active && styles.drawerNavTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={() => void handleAuthToggle()} style={styles.authButton}>
              <ShieldCheck color="#FFFFFF" size={16} />
              <Text style={styles.authButtonText}>{signedIn ? 'Sign Out Auth0' : 'Sign In with Auth0 SSO'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
        </View>
      </Modal>

      {/* Pure Crisp White Scrollable Body */}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* SHIFTS MASTER LIST */}
        {activeTab === 'shifts' && !detailPump && (
          <>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Active Pumps</Text>
                <Text style={styles.kpiValue}>
                  {activeCount} / {pumps.length}
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Queued Offline</Text>
                <Text style={styles.kpiValue}>{queue.length}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Forecourt Pumps</Text>
            {pumps.map((pump) => (
              <TouchableOpacity
                key={pump.id}
                onPress={() => setDetailPumpId(pump.id)}
                style={styles.listCard}
              >
                <View style={styles.listCardMain}>
                  <Text style={styles.cardTitle}>
                    {pump.code} · {pump.grade}
                  </Text>
                  <Text style={styles.cardSub}>
                    {pump.attendantName ? `Attendant: ${pump.attendantName}` : 'Idle — Tap to start shift'}
                  </Text>
                  <Text style={styles.cardMono}>
                    Meter {formatLitres(pump.totalizerLitres)} · {formatFcfa(pump.unitPriceFcfa)}/L
                  </Text>
                </View>
                <View style={styles.listCardRight}>
                  <View style={[styles.badge, pump.status === 'ACTIVE_SHIFT' ? styles.badgeActive : styles.badgeIdle]}>
                    <Text style={[styles.badgeText, pump.status === 'ACTIVE_SHIFT' ? styles.badgeTextActive : styles.badgeTextIdle]}>
                      {pump.status === 'ACTIVE_SHIFT' ? 'OPEN' : 'IDLE'}
                    </Text>
                  </View>
                  <ChevronRight color="#94A3B8" size={18} />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* PUMP DETAIL SCREEN */}
        {activeTab === 'shifts' && detailPump && (
          <View style={styles.detailWrap}>
            <TouchableOpacity onPress={() => setDetailPumpId(null)} style={styles.backRow}>
              <ArrowLeft color="#0F172A" size={18} />
              <Text style={styles.backText}>Back to Pumps</Text>
            </TouchableOpacity>

            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>
                Pump {detailPump.code} ({detailPump.grade})
              </Text>
              <Text style={styles.cardMono}>
                Current Totalizer: {formatLitres(detailPump.totalizerLitres)} · Tariff: {formatFcfa(detailPump.unitPriceFcfa)}/L
              </Text>
            </View>

            {detailPump.status === 'IDLE' ? (
              <View style={styles.detailCard}>
                <Text style={styles.sectionTitle}>Start Forecourt Shift</Text>
                <TouchableOpacity onPress={() => void handleOpenShift(detailPump)} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Open Shift on {detailPump.code}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.detailCard}>
                <Text style={styles.sectionTitle}>Close &amp; Reconcile Shift</Text>
                <Text style={styles.inputLabel}>Litres Sold</Text>
                <TextInput value={litresDelta} onChangeText={setLitresDelta} keyboardType="numeric" style={styles.input} />
                <Text style={styles.inputLabel}>Cash Collected (FCFA)</Text>
                <TextInput value={cashFcfa} onChangeText={setCashFcfa} keyboardType="numeric" style={styles.input} />
                <Text style={styles.inputLabel}>Mobile Money (FCFA)</Text>
                <TextInput value={momoFcfa} onChangeText={setMomoFcfa} keyboardType="numeric" style={styles.input} />
                <TouchableOpacity onPress={() => void handleCloseShift(detailPump)} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Submit Closing Reading</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* TANKS MASTER LIST */}
        {activeTab === 'inventory' && !detailTank && (
          <>
            <Text style={styles.sectionTitle}>Underground Fuel Tanks</Text>
            {tanks.map((tank) => {
              const pct = Math.min(100, Math.round((tank.bookVolumeLitres / Math.max(1, tank.capacityLitres)) * 100));
              return (
                <TouchableOpacity
                  key={tank.id}
                  onPress={() => {
                    setDetailTankId(tank.id);
                    setDipLitres(String(tank.bookVolumeLitres));
                  }}
                  style={styles.detailCard}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>{tank.name}</Text>
                    <Text style={styles.cardMonoBold}>{pct}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardSub}>Book: {formatLitres(tank.bookVolumeLitres)}</Text>
                    <Text style={styles.cardSub}>Last Dip: {formatLitres(tank.lastDipLitres)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* TANK DETAIL SCREEN */}
        {activeTab === 'inventory' && detailTank && (
          <View style={styles.detailWrap}>
            <TouchableOpacity onPress={() => setDetailTankId(null)} style={styles.backRow}>
              <ArrowLeft color="#0F172A" size={18} />
              <Text style={styles.backText}>Back to Tanks</Text>
            </TouchableOpacity>

            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>{detailTank.name}</Text>
              <Text style={styles.cardMono}>
                Book Stock: {formatLitres(detailTank.bookVolumeLitres)} / {formatLitres(detailTank.capacityLitres)}
              </Text>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Record Physical Dipstick</Text>
              <Text style={styles.inputLabel}>Measured Volume (Litres)</Text>
              <TextInput value={dipLitres} onChangeText={setDipLitres} keyboardType="numeric" style={styles.input} />
              <TouchableOpacity onPress={() => void handleRecordDipstick(detailTank)} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Save Dipstick Reading</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* FLEET & SHOP POS */}
        {activeTab === 'fleet' && !detailFleet && (
          <>
            <View style={styles.segmentWrap}>
              <TouchableOpacity
                onPress={() => setPosSubTab('fleet')}
                style={[styles.segmentBtn, posSubTab === 'fleet' && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentText, posSubTab === 'fleet' && styles.segmentTextActive]}>Fleet Credit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPosSubTab('shop')}
                style={[styles.segmentBtn, posSubTab === 'shop' && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentText, posSubTab === 'shop' && styles.segmentTextActive]}>Shop &amp; Lubes</Text>
              </TouchableOpacity>
            </View>

            {posSubTab === 'fleet' ? (
              fleets.map((f) => (
                <TouchableOpacity key={f.id} onPress={() => setDetailFleetId(f.id)} style={styles.listCard}>
                  <View style={styles.listCardMain}>
                    <Text style={styles.cardTitle}>{f.companyName}</Text>
                    <Text style={styles.cardMono}>
                      Bal: {formatFcfa(f.currentBalanceFcfa)} / {formatFcfa(f.creditLimitFcfa)}
                    </Text>
                  </View>
                  <ChevronRight color="#94A3B8" size={18} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.detailCard}>
                <Text style={styles.cardTitle}>Total Quartz 5W-30 (4L Lubricant)</Text>
                <Text style={styles.cardSub}>24,500 FCFA · Instant Cash / MoMo Sale</Text>
                <TouchableOpacity
                  onPress={() =>
                    void client
                      .submitOrQueueCommand('Shop Sale: Total Quartz 4L', '/shop/sales', {
                        itemId: 'sku_01',
                        quantity: 1,
                        paymentMethod: 'CASH',
                      })
                      .then(async (res) => {
                        setBanner(res.synced ? 'Lubricant sale posted.' : 'Sale queued offline.');
                        await refreshSyncState();
                      })
                  }
                  style={styles.primaryBtn}
                >
                  <Text style={styles.primaryBtnText}>Record 1x Lubricant Sale</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* FLEET DETAIL SCREEN */}
        {activeTab === 'fleet' && detailFleet && (
          <View style={styles.detailWrap}>
            <TouchableOpacity onPress={() => setDetailFleetId(null)} style={styles.backRow}>
              <ArrowLeft color="#0F172A" size={18} />
              <Text style={styles.backText}>Back to Fleet Accounts</Text>
            </TouchableOpacity>
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>{detailFleet.companyName}</Text>
              <Text style={styles.inputLabel}>Vehicle Plate</Text>
              <TextInput value={fleetPlate} onChangeText={setFleetPlate} style={styles.input} />
              <Text style={styles.inputLabel}>Driver Name</Text>
              <TextInput value={fleetDriver} onChangeText={setFleetDriver} style={styles.input} />
              <Text style={styles.inputLabel}>Litres Dispensed</Text>
              <TextInput value={fleetLitres} onChangeText={setFleetLitres} keyboardType="numeric" style={styles.input} />
              <TouchableOpacity onPress={() => void handleIssueVoucher(detailFleet)} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Post Fleet Fuel Voucher</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* REPORTS */}
        {activeTab === 'reports' && (
          <>
            <Text style={styles.sectionTitle}>Daily Station P&amp;L</Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Today Revenue</Text>
                <Text style={styles.kpiValueSmall}>{formatFcfa(4860000)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Gross Margin</Text>
                <Text style={styles.kpiValueSmall}>{formatFcfa(548000)}</Text>
              </View>
            </View>
            <View style={styles.detailCard}>
              <Text style={styles.cardTitle}>SYSCOHADA Trial Balance</Text>
              <Text style={styles.cardSub}>Balanced (Debit = Credit) · Auto-posted on shift close</Text>
            </View>
          </>
        )}

        {/* OFFLINE SYNC QUEUE SCREEN */}
        {activeTab === 'sync' && (
          <>
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>Offline Sync Queue</Text>
              <Text style={styles.cardSub}>
                Endpoint: {syncHealth.endpoint} · {queue.length} pending item(s)
              </Text>
              <TouchableOpacity onPress={() => void handleFlushQueue()} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Sync All Queued Actions ({queue.length})</Text>
              </TouchableOpacity>
            </View>

            {queue.length === 0 ? (
              <View style={styles.detailCard}>
                <Text style={styles.cardTitle}>All Forecourt Data Synchronized</Text>
                <Text style={styles.cardSub}>Zero pending offline commands in device storage.</Text>
              </View>
            ) : (
              queue.map((cmd) => (
                <View key={cmd.idempotencyKey} style={styles.detailCard}>
                  <Text style={styles.cardTitle}>{cmd.label}</Text>
                  <Text style={styles.cardMono}>UUID: {cmd.idempotencyKey}</Text>
                  <Text style={styles.cardSub}>
                    {cmd.path} · {cmd.createdAt}
                  </Text>
                </View>
              ))
            )}
          </>
        )}

        {/* FUEL GRADE SETUP (FROM DRAWER) */}
        {activeTab === 'setup' && (
          <>
            <Text style={styles.sectionTitle}>Station Fuel Setup</Text>
            {setupRows.map((row, idx) => (
              <TouchableOpacity
                key={row.grade}
                onPress={() =>
                  setSetupRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)))
                }
                style={styles.listCard}
              >
                <View style={styles.listCardMain}>
                  <Text style={styles.cardTitle}>{row.label}</Text>
                  <Text style={styles.cardMono}>
                    Opening: {row.openingLitres} L · {row.sellingPriceFcfa} FCFA/L
                  </Text>
                </View>
                {row.selected ? <CheckCircle2 color="#D97706" size={20} /> : <Circle color="#94A3B8" size={20} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() =>
                void client
                  .applyInstitutionalSetup(
                    'st_plateau',
                    setupRows
                      .filter((r) => r.selected)
                      .map((r) => ({
                        grade: r.grade,
                        tankName: r.tankName,
                        capacityLitres: Number(r.capacityLitres) || 35000,
                        openingLitres: Number(r.openingLitres) || 12000,
                        unitCostFcfa: Number(r.unitCostFcfa) || 720,
                        sellingPriceFcfa: Number(r.sellingPriceFcfa) || 840,
                        nozzleCount: Number(r.nozzleCount) || 2,
                      })),
                    { includeLubricants: true, oilBottlesQty: 24, lpgCylindersQty: 12 }
                  )
                  .then(async (res) => {
                    setBanner(res.synced ? 'Fuel setup synced.' : 'Fuel setup queued offline.');
                    await refreshSyncState();
                  })
              }
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Save Fuel Configuration</Text>
            </TouchableOpacity>
          </>
        )}

        {/* AI COPILOT (FROM DRAWER) */}
        {activeTab === 'ai' && (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>AI Station Copilot</Text>
            <Text style={styles.cardSub}>
              Monitors underground dipstick shrinkage, attendant cash variance, and forecasts tank reorder dates.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Clean Fixed 5-Tab Bottom Navigation Bar */}
      <View style={styles.bottomBar}>
        {[
          { id: 'shifts' as const, label: 'Shifts', icon: Fuel },
          { id: 'inventory' as const, label: 'Tanks', icon: Gauge },
          { id: 'fleet' as const, label: 'POS', icon: CreditCard },
          { id: 'reports' as const, label: 'Reports', icon: TrendingUp },
          { id: 'sync' as const, label: 'Sync', icon: RefreshCw },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <TouchableOpacity key={item.id} onPress={() => navigateTab(item.id)} style={styles.bottomTab}>
              {active && <View style={styles.bottomTabIndicator} />}
              <Icon color={active ? '#D97706' : '#64748B'} size={19} />
              <Text style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 6 },
  topTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  topSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
  },
  syncPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  banner: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerText: { color: '#FFFFFF', fontSize: 12, flex: 1, marginRight: 10 },
  body: { flex: 1, backgroundColor: '#FFFFFF' },
  bodyContent: { padding: 16, gap: 14, paddingBottom: 32 },
  kpiGrid: { flexDirection: 'row', gap: 12 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
  },
  kpiLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  kpiValue: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  kpiValueSmall: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  listCardMain: { flex: 1, gap: 4 },
  listCardRight: { alignItems: 'flex-end', gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B' },
  cardMono: { fontSize: 12, color: '#334155' },
  cardMonoBold: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeActive: { backgroundColor: '#D1FAE5' },
  badgeIdle: { backgroundColor: '#F1F5F9' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeTextActive: { color: '#065F46' },
  badgeTextIdle: { color: '#334155' },
  detailWrap: { gap: 14 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  backText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  detailTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  primaryBtn: {
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTrack: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#0F172A', borderRadius: 999 },
  segmentWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 4,
    backgroundColor: '#FFFFFF',
  },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#0F172A' },
  segmentText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  segmentTextActive: { color: '#FFFFFF' },
  bottomBar: {
    height: 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
  },
  bottomTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, position: 'relative' },
  bottomTabIndicator: { position: 'absolute', top: 0, left: 12, right: 12, height: 2.5, backgroundColor: '#D97706', borderRadius: 4 },
  bottomTabText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  bottomTabTextActive: { color: '#D97706' },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerPanel: { width: 290, backgroundColor: '#0F172A', padding: 20, paddingTop: 52, gap: 16 },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)' },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  drawerBrand: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  drawerSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  drawerSectionLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  roleChipActive: { backgroundColor: '#D97706', borderColor: '#D97706' },
  roleChipText: { color: '#CBD5E1', fontSize: 10, fontWeight: '700' },
  roleChipTextActive: { color: '#FFFFFF' },
  drawerNavList: { flex: 1, gap: 4 },
  drawerNavItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10 },
  drawerNavItemActive: { backgroundColor: '#D97706' },
  drawerNavText: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  drawerNavTextActive: { color: '#FFFFFF' },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  authButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
