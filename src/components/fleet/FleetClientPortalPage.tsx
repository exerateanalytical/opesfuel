import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Fuel,
  KeyRound,
  Lock,
  LogOut,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Smartphone,
  Truck,
  Unlock,
} from 'lucide-react';
import { OpesFuelLogo } from '../brand/OpesFuelLogo';
import { FormModal } from '../shared/FormModal';
import { MomoPaymentModal } from '../console/MomoPaymentModal';
import { formatFcfa, formatLitres } from '../../domain/formatters';
import {
  exportFleetPortalAuditWorkbookExcel,
  FleetPortalFuelingRow,
  FleetPortalPaymentRow,
  FleetPortalVehicleRow,
  printFleetPortalVatStatementPdf,
} from '../../utils/documentTemplates';

interface FleetClientPortalPageProps {
  onBackHome: () => void;
}

interface FleetPortalSession {
  token: string;
  email: string;
  fullName: string;
  fleetAccountId: string;
  companyName: string;
  taxId: string;
  demoMode?: boolean;
}

const FLEET_SESSION_KEY = 'opesfuel.fleet_portal.session.v1';
const VAT_RATE = 0.1925;

export const FleetClientPortalPage: React.FC<FleetClientPortalPageProps> = ({ onBackHome }) => {
  const apiBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/+$/, '');

  const [session, setSession] = useState<FleetPortalSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(FLEET_SESSION_KEY);
      return raw ? (JSON.parse(raw) as FleetPortalSession) : null;
    } catch {
      return null;
    }
  });

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Portal state
  const [activeTab, setActiveTab] = useState<'overview' | 'fuelings' | 'vehicles' | 'statements' | 'payments'>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<Record<string, unknown>>({
    companyName: 'Camrail Logistics SA',
    taxId: 'M0126000991',
    status: 'ACTIVE',
    creditLimitFcfa: 5_000_000,
    balanceOwedFcfa: 1_240_000,
    availableCreditFcfa: 3_760_000,
    utilizationPercent: 24.8,
    monthSpendFcfa: 1_850_000,
    monthLitres: 2_215,
    monthTransactions: 34,
    vehicleCount: 3,
    activeVehicleCount: 3,
    frozenVehicleCount: 0,
  });
  const [fuelings, setFuelings] = useState<Array<Record<string, unknown>>>([
    {
      id: 'ftx_demo1',
      station_id: 'DLA-01',
      vehicle_plate: 'LT-441-CM',
      driver_name: 'Paul Ndongo',
      grade: 'GASOIL',
      litres: 85,
      amount_fcfa: 70_380,
      created_at: new Date(Date.now() - 3600_000).toISOString(),
    },
    {
      id: 'ftx_demo2',
      station_id: 'DLA-01',
      vehicle_plate: 'LT-882-CM',
      driver_name: 'Samuel Eto',
      grade: 'SUPER',
      litres: 45,
      amount_fcfa: 37_800,
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
    {
      id: 'ftx_demo3',
      station_id: 'YDE-02',
      vehicle_plate: 'LT-441-CM',
      driver_name: 'Paul Ndongo',
      grade: 'GASOIL',
      litres: 110,
      amount_fcfa: 91_080,
      created_at: new Date(Date.now() - 172_800_000).toISOString(),
    },
  ]);
  const [vehicles, setVehicles] = useState<Array<Record<string, unknown>>>([
    {
      id: 'v1',
      plate_number: 'LT-441-CM',
      driver_name: 'Paul Ndongo',
      cardNumber: 'CRD-441',
      dailyLitreCap: 150,
      monthlyLitreCap: 2500,
      dailyXafCap: 150_000,
      monthlyXafCap: 2_200_000,
      allowedGradesCsv: 'GASOIL',
      mtdLitres: 920,
      mtdSpendFcfa: 761_760,
      active: true,
    },
    {
      id: 'v2',
      plate_number: 'LT-882-CM',
      driver_name: 'Samuel Eto',
      cardNumber: 'CRD-882',
      dailyLitreCap: 80,
      monthlyLitreCap: 1200,
      dailyXafCap: 80_000,
      monthlyXafCap: 1_100_000,
      allowedGradesCsv: 'SUPER,GASOIL',
      mtdLitres: 410,
      mtdSpendFcfa: 344_400,
      active: true,
    },
    {
      id: 'v3',
      plate_number: 'CE-209-CM',
      driver_name: 'Hervé Kamdem',
      cardNumber: 'CRD-209',
      dailyLitreCap: 120,
      monthlyLitreCap: 1800,
      dailyXafCap: 120_000,
      monthlyXafCap: 1_650_000,
      allowedGradesCsv: 'GASOIL',
      mtdLitres: 885,
      mtdSpendFcfa: 743_840,
      active: true,
    },
  ]);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([
    {
      id: 'momo_demo_01',
      provider: 'MTN_MOMO',
      msisdn: '+237677112233',
      amount_fcfa: 750_000,
      status: 'SUCCESSFUL',
      reference_id: 'OPF-FLT-9021A',
      provider_tx_id: 'MTN-8841201',
      created_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    },
  ]);

  // Filters
  const [plateFilter, setPlateFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'GASOIL' | 'SUPER' | 'JET_A1'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [serverStatement, setServerStatement] = useState<Record<string, unknown> | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Limit edit modal
  const [editingVehicle, setEditingVehicle] = useState<Record<string, unknown> | null>(null);
  const [cardNo, setCardNo] = useState('');
  const [dailyLitres, setDailyLitres] = useState('');
  const [monthlyLitres, setMonthlyLitres] = useState('');
  const [dailyXaf, setDailyXaf] = useState('');
  const [monthlyXaf, setMonthlyXaf] = useState('');
  const [allowedGrades, setAllowedGrades] = useState('GASOIL');
  const [vehicleActive, setVehicleActive] = useState(true);

  // Payment flow (amount picker -> live MoMo modal)
  const [amountPickerOpen, setAmountPickerOpen] = useState(false);
  const [customPayAmount, setCustomPayAmount] = useState('');
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmountFcfa, setPayAmountFcfa] = useState(250_000);

  // Change password modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const loadPortalData = useCallback(async () => {
    if (!session || session.demoMode || !apiBase) return;
    setRefreshing(true);
    const headers = { 'X-Fleet-Token': session.token };
    try {
      const [dRes, fRes, vRes, pRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/fleet-portal/dashboard`, { headers }),
        fetch(`${apiBase}/api/v1/fleet-portal/fuelings`, { headers }),
        fetch(`${apiBase}/api/v1/fleet-portal/vehicles`, { headers }),
        fetch(`${apiBase}/api/v1/fleet-portal/payments`, { headers }),
      ]);
      if (dRes.status === 401 || fRes.status === 401) {
        sessionStorage.removeItem(FLEET_SESSION_KEY);
        setSession(null);
        setLoginError('Your corporate fleet session has expired. Please sign in again.');
        return;
      }
      if (dRes.ok) setDashboard((await dRes.json()) as Record<string, unknown>);
      if (fRes.ok) setFuelings((await fRes.json()) as Array<Record<string, unknown>>);
      if (vRes.ok) setVehicles((await vRes.json()) as Array<Record<string, unknown>>);
      if (pRes.ok) setPayments((await pRes.json()) as Array<Record<string, unknown>>);
    } catch {
      // keep existing state on transient error
    } finally {
      setRefreshing(false);
    }
  }, [session, apiBase]);

  useEffect(() => {
    void loadPortalData();
  }, [loadPortalData]);

  // Fetch monthly statement from the exact backend endpoint whenever period or statements tab is active
  useEffect(() => {
    if (!session || session.demoMode || !apiBase || activeTab !== 'statements') {
      setServerStatement(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/v1/fleet-portal/statements/${encodeURIComponent(period)}`, {
          headers: { 'X-Fleet-Token': session.token },
        });
        if (!cancelled && res.ok) {
          setServerStatement((await res.json()) as Record<string, unknown>);
        }
      } catch {
        // fallback to client-side rows
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, apiBase, activeTab, period]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      if (apiBase) {
        const res = await fetch(`${apiBase}/api/v1/public/fleet-portal/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) throw new Error(String(data.detail || data.message || 'Invalid corporate fleet credentials.'));
        const user = (data.user ?? {}) as Record<string, unknown>;
        const next: FleetPortalSession = {
          token: String(data.token),
          email: String(user.email || email),
          fullName: String(user.fullName || 'Fleet Manager'),
          fleetAccountId: String(user.fleetAccountId || ''),
          companyName: String(user.companyName || ''),
          taxId: String(user.taxId || ''),
        };
        sessionStorage.setItem(FLEET_SESSION_KEY, JSON.stringify(next));
        setSession(next);
      } else {
        if (!email.includes('@') || password.length < 4) {
          throw new Error('Enter your corporate fleet email and password (min 4 characters in preview mode).');
        }
        const next: FleetPortalSession = {
          token: 'fltp_demo_session',
          email: email.trim().toLowerCase(),
          fullName: 'Marc Fotso (Fleet Manager)',
          fleetAccountId: 'flt_demo_camrail',
          companyName: 'Camrail Logistics SA',
          taxId: 'M0126000991',
          demoMode: true,
        };
        sessionStorage.setItem(FLEET_SESSION_KEY, JSON.stringify(next));
        setSession(next);
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleDemoQuickEnter = () => {
    const next: FleetPortalSession = {
      token: 'fltp_demo_session',
      email: 'fleetmgr@camrail.cm',
      fullName: 'Marc Fotso (Fleet Manager)',
      fleetAccountId: 'flt_demo_camrail',
      companyName: 'Camrail Logistics SA',
      taxId: 'M0126000991',
      demoMode: true,
    };
    sessionStorage.setItem(FLEET_SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };

  const handleSignOut = async () => {
    if (session && !session.demoMode && apiBase) {
      try {
        await fetch(`${apiBase}/api/v1/fleet-portal/logout`, {
          method: 'POST',
          headers: { 'X-Fleet-Token': session.token },
        });
      } catch {
        // still clear local session
      }
    }
    sessionStorage.removeItem(FLEET_SESSION_KEY);
    setSession(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.trim().length < 8) {
      setToast({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }
    setSavingPassword(true);
    try {
      if (session && !session.demoMode && apiBase) {
        const res = await fetch(`${apiBase}/api/v1/fleet-portal/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Fleet-Token': session.token },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          throw new Error(String(data.detail || data.message || `Unable to update password (HTTP ${res.status}).`));
        }
      }
      setPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setToast({ type: 'success', message: 'Corporate portal password updated and other active sessions revoked.' });
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Unable to update password.' });
    } finally {
      setSavingPassword(false);
    }
  };

  const filteredFuelings = useMemo(
    () =>
      fuelings.filter((f) => {
        const p = String(f.vehicle_plate ?? '').toUpperCase();
        const d = String(f.driver_name ?? '').toUpperCase();
        const g = String(f.grade ?? '').toUpperCase();
        const dateStr = String(f.created_at ?? '').slice(0, 10);
        return (
          (!plateFilter.trim() || p.includes(plateFilter.trim().toUpperCase())) &&
          (!driverFilter.trim() || d.includes(driverFilter.trim().toUpperCase())) &&
          (gradeFilter === 'ALL' || g === gradeFilter) &&
          (!fromDate || dateStr >= fromDate) &&
          (!toDate || dateStr <= toDate)
        );
      }),
    [fuelings, plateFilter, driverFilter, gradeFilter, fromDate, toDate]
  );

  const filteredSummary = useMemo(() => {
    const ttc = filteredFuelings.reduce((s, f) => s + Number(f.amount_fcfa || 0), 0);
    const litres = filteredFuelings.reduce((s, f) => s + Number(f.litres || 0), 0);
    const netHt = Math.round(ttc / (1 + VAT_RATE));
    return { count: filteredFuelings.length, litres, netHt, vat: ttc - netHt, ttc };
  }, [filteredFuelings]);

  const toFuelingRows = (rows: Array<Record<string, unknown>>): FleetPortalFuelingRow[] =>
    rows.map((f) => ({
      id: String(f.id || ''),
      stationId: String(f.station_id || ''),
      vehiclePlate: String(f.vehicle_plate || ''),
      driverName: String(f.driver_name || ''),
      grade: String(f.grade || ''),
      litres: Number(f.litres || 0),
      amountFcfa: Number(f.amount_fcfa || 0),
      createdAt: String(f.created_at || ''),
    }));

  const toVehicleRows = (): FleetPortalVehicleRow[] =>
    vehicles.map((v) => ({
      plateNumber: String(v.plate_number || ''),
      driverName: String(v.driver_name || ''),
      cardNumber: v.cardNumber ? String(v.cardNumber) : undefined,
      allowedGrades: String(v.allowedGradesCsv || v.allowed_grade || 'ALL'),
      dailyLitreCap: v.dailyLitreCap != null ? Number(v.dailyLitreCap) : null,
      monthlyLitreCap: v.monthlyLitreCap != null ? Number(v.monthlyLitreCap) : null,
      dailyXafCap: v.dailyXafCap != null ? Number(v.dailyXafCap) : null,
      monthlyXafCap: v.monthlyXafCap != null ? Number(v.monthlyXafCap) : null,
      mtdLitres: Number(v.mtdLitres || 0),
      mtdSpendFcfa: Number(v.mtdSpendFcfa || 0),
      active: v.active !== false && v.limitActive !== false,
    }));

  const toPaymentRows = (): FleetPortalPaymentRow[] =>
    payments.map((p) => ({
      id: String(p.id || ''),
      provider: String(p.provider || ''),
      msisdn: String(p.msisdn || ''),
      amountFcfa: Number(p.amount_fcfa || 0),
      status: String(p.status || ''),
      referenceId: String(p.reference_id || ''),
      providerTxId: p.provider_tx_id ? String(p.provider_tx_id) : undefined,
      createdAt: String(p.created_at || ''),
    }));

  // Statement rows for the selected YYYY-MM period (prefer server statement when loaded)
  const statementRows = useMemo(() => {
    if (serverStatement && Array.isArray(serverStatement.transactions)) {
      return serverStatement.transactions as Array<Record<string, unknown>>;
    }
    const matching = fuelings.filter((f) => String(f.created_at || '').startsWith(period));
    return matching;
  }, [serverStatement, fuelings, period]);

  const statementMetrics = useMemo(() => {
    const ttc =
      serverStatement?.totalTtcFcfa != null
        ? Number(serverStatement.totalTtcFcfa)
        : statementRows.reduce((s, f) => s + Number(f.amount_fcfa || 0), 0);
    const litres =
      serverStatement?.totalLitres != null
        ? Number(serverStatement.totalLitres)
        : statementRows.reduce((s, f) => s + Number(f.litres || 0), 0);
    const netHt = serverStatement?.netHtFcfa != null ? Number(serverStatement.netHtFcfa) : Math.round(ttc / (1 + VAT_RATE));
    const vat = serverStatement?.vatFcfa != null ? Number(serverStatement.vatFcfa) : ttc - netHt;

    const gradeMap = new Map<string, { grade: string; count: number; litres: number; ttc: number }>();
    for (const r of statementRows) {
      const g = String(r.grade || 'OTHER');
      const cur = gradeMap.get(g) ?? { grade: g, count: 0, litres: 0, ttc: 0 };
      cur.count += 1;
      cur.litres += Number(r.litres || 0);
      cur.ttc += Number(r.amount_fcfa || 0);
      gradeMap.set(g, cur);
    }
    return { ttc, litres, netHt, vat, grades: Array.from(gradeMap.values()) };
  }, [serverStatement, statementRows]);

  const exportCsv = () => {
    const header = 'TransactionId,Station,VehiclePlate,Driver,Grade,Litres,NetHT,TVA1925,AmountTTC,Timestamp\n';
    const rows = filteredFuelings
      .map((f) => {
        const ttc = Number(f.amount_fcfa || 0);
        const ht = Math.round(ttc / (1 + VAT_RATE));
        return `"${f.id}","${f.station_id}","${f.vehicle_plate}","${f.driver_name}","${f.grade}","${f.litres}","${ht}","${ttc - ht}","${ttc}","${f.created_at}"`;
      })
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleet-fuelings-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ type: 'success', message: `Exported ${filteredFuelings.length} fueling records to CSV.` });
  };

  const handleExportExcel = (rowsOverride?: Array<Record<string, unknown>>) => {
    const sourceRows = rowsOverride ?? filteredFuelings;
    exportFleetPortalAuditWorkbookExcel({
      companyName: String(dashboard.companyName || session?.companyName || 'Corporate Client'),
      taxId: String(dashboard.taxId || session?.taxId || ''),
      status: String(dashboard.status || 'ACTIVE'),
      period,
      creditLimitFcfa: Number(dashboard.creditLimitFcfa || 0),
      balanceOwedFcfa: Number(dashboard.balanceOwedFcfa || 0),
      availableCreditFcfa: Number(dashboard.availableCreditFcfa || 0),
      vatRate: VAT_RATE,
      fuelings: toFuelingRows(sourceRows),
      vehicles: toVehicleRows(),
      payments: toPaymentRows(),
    });
    setToast({ type: 'success', message: `Downloaded 4-sheet Corporate Fleet Excel Pack (${period}).` });
  };

  const downloadVatStatementPdf = async () => {
    let rowsToPrint = statementRows;
    if (session && !session.demoMode && apiBase) {
      try {
        const res = await fetch(`${apiBase}/api/v1/fleet-portal/statements/${encodeURIComponent(period)}`, {
          headers: { 'X-Fleet-Token': session.token },
        });
        if (res.ok) {
          const data = (await res.json()) as { transactions?: Array<Record<string, unknown>> };
          if (Array.isArray(data.transactions)) {
            rowsToPrint = data.transactions;
          }
        }
      } catch {
        // fallback to loaded rows
      }
    }

    printFleetPortalVatStatementPdf({
      companyName: String(dashboard.companyName || session?.companyName || 'Corporate Client'),
      taxId: String(dashboard.taxId || session?.taxId || ''),
      period,
      vatRate: VAT_RATE,
      creditLimitFcfa: Number(dashboard.creditLimitFcfa || 0),
      balanceOwedFcfa: Number(dashboard.balanceOwedFcfa || 0),
      transactions: toFuelingRows(rowsToPrint),
    });
    setToast({ type: 'success', message: `Downloaded branded OHADA VAT Statement PDF for ${period} (${rowsToPrint.length} fuelings).` });
  };

  const openEditLimit = (v: Record<string, unknown>) => {
    setEditingVehicle(v);
    setCardNo(String(v.cardNumber || ''));
    setDailyLitres(v.dailyLitreCap != null ? String(v.dailyLitreCap) : '');
    setMonthlyLitres(v.monthlyLitreCap != null ? String(v.monthlyLitreCap) : '');
    setDailyXaf(v.dailyXafCap != null ? String(v.dailyXafCap) : '');
    setMonthlyXaf(v.monthlyXafCap != null ? String(v.monthlyXafCap) : '');
    setAllowedGrades(String(v.allowedGradesCsv || v.allowed_grade || 'GASOIL'));
    setVehicleActive(v.active !== false && v.limitActive !== false);
  };

  const persistVehicleLimitUpdate = async (
    plate: string,
    payload: {
      cardNumber: string | null;
      dailyLitreCap: number | null;
      monthlyLitreCap: number | null;
      dailyXafCap: number | null;
      monthlyXafCap: number | null;
      allowedGradesCsv: string | null;
      active: boolean;
    },
    successMessage: string
  ) => {
    if (session && !session.demoMode && apiBase) {
      const res = await fetch(`${apiBase}/api/v1/fleet-portal/vehicles/${encodeURIComponent(plate)}/limits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Fleet-Token': session.token },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setToast({ type: 'error', message: `Unable to update card controls for ${plate} (HTTP ${res.status}).` });
        return false;
      }
      await loadPortalData();
    } else {
      setVehicles((prev) =>
        prev.map((v) =>
          String(v.plate_number) === plate ? { ...v, ...payload, active: payload.active, limitActive: payload.active } : v
        )
      );
      setDashboard((prev) => {
        const nextVehicles = vehicles.map((v) =>
          String(v.plate_number) === plate ? { ...v, active: payload.active, limitActive: payload.active } : v
        );
        const activeCount = nextVehicles.filter((v) => v.active !== false && v.limitActive !== false).length;
        return { ...prev, activeVehicleCount: activeCount, frozenVehicleCount: nextVehicles.length - activeCount };
      });
    }
    setToast({ type: 'success', message: successMessage });
    return true;
  };

  const saveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;
    const plate = String(editingVehicle.plate_number);
    const ok = await persistVehicleLimitUpdate(
      plate,
      {
        cardNumber: cardNo.trim() || null,
        dailyLitreCap: dailyLitres ? Number(dailyLitres) : null,
        monthlyLitreCap: monthlyLitres ? Number(monthlyLitres) : null,
        dailyXafCap: dailyXaf ? Number(dailyXaf) : null,
        monthlyXafCap: monthlyXaf ? Number(monthlyXaf) : null,
        allowedGradesCsv: allowedGrades.trim() || null,
        active: vehicleActive,
      },
      `Updated server-enforced card controls & spend limits for ${plate}.`
    );
    if (ok) setEditingVehicle(null);
  };

  const toggleCardFreeze = async (v: Record<string, unknown>) => {
    const plate = String(v.plate_number);
    const currentlyActive = v.active !== false && v.limitActive !== false;
    const nextActive = !currentlyActive;
    await persistVehicleLimitUpdate(
      plate,
      {
        cardNumber: v.cardNumber ? String(v.cardNumber) : null,
        dailyLitreCap: v.dailyLitreCap != null ? Number(v.dailyLitreCap) : null,
        monthlyLitreCap: v.monthlyLitreCap != null ? Number(v.monthlyLitreCap) : null,
        dailyXafCap: v.dailyXafCap != null ? Number(v.dailyXafCap) : null,
        monthlyXafCap: v.monthlyXafCap != null ? Number(v.monthlyXafCap) : null,
        allowedGradesCsv: v.allowedGradesCsv ? String(v.allowedGradesCsv) : v.allowed_grade ? String(v.allowed_grade) : null,
        active: nextActive,
      },
      nextActive
        ? `Unfroze fuel card for ${plate} — forecourt authorizations re-enabled.`
        : `Froze fuel card for ${plate} — forecourt voucher issuance immediately blocked.`
    );
  };

  const openPayBalanceFlow = () => {
    const owed = Math.max(1_000, Number(dashboard.balanceOwedFcfa || 100_000));
    setCustomPayAmount(String(owed));
    setAmountPickerOpen(true);
  };

  const proceedToMomoCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.round(Number(customPayAmount));
    if (!Number.isFinite(parsed) || parsed < 100) {
      setToast({ type: 'error', message: 'Enter a valid settlement amount (minimum 100 FCFA).' });
      return;
    }
    setPayAmountFcfa(parsed);
    setAmountPickerOpen(false);
    setPayModalOpen(true);
  };

  const handleDemoSettlement = () => {
    const parsed = Math.round(Number(customPayAmount));
    if (!Number.isFinite(parsed) || parsed < 100) {
      setToast({ type: 'error', message: 'Enter a valid settlement amount (minimum 100 FCFA).' });
      return;
    }
    setDashboard((prev) => {
      const prevBal = Number(prev.balanceOwedFcfa || 0);
      const limit = Number(prev.creditLimitFcfa || 0);
      const nextBal = Math.max(0, prevBal - parsed);
      const util = limit > 0 ? Math.min(100, Math.round((nextBal * 1000) / limit) / 10) : 0;
      return {
        ...prev,
        balanceOwedFcfa: nextBal,
        availableCreditFcfa: Math.max(0, limit - nextBal),
        utilizationPercent: util,
      };
    });
    setPayments((prev) => [
      {
        id: `momo_demo_${Date.now().toString(36)}`,
        provider: 'MTN_MOMO',
        msisdn: '+237677112233',
        amount_fcfa: parsed,
        status: 'SUCCESSFUL',
        reference_id: `OPF-FLT-${Date.now().toString().slice(-5)}`,
        provider_tx_id: 'PREVIEW-SETTLED',
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setAmountPickerOpen(false);
    setToast({ type: 'success', message: `Preview settlement confirmed (${formatFcfa(parsed)}) — balance updated.` });
  };

  const balanceOwed = Number(dashboard.balanceOwedFcfa || 0);
  const creditLimit = Number(dashboard.creditLimitFcfa || 0);
  const availableCredit = Number(dashboard.availableCreditFcfa || Math.max(0, creditLimit - balanceOwed));
  const utilizationPct =
    dashboard.utilizationPercent != null
      ? Number(dashboard.utilizationPercent)
      : creditLimit > 0
      ? Math.min(100, Math.round((balanceOwed * 1000) / creditLimit) / 10)
      : 0;
  const accountStatus = String(dashboard.status || 'ACTIVE').toUpperCase();
  const activeVehCount =
    dashboard.activeVehicleCount != null
      ? Number(dashboard.activeVehicleCount)
      : vehicles.filter((v) => v.active !== false && v.limitActive !== false).length;
  const frozenVehCount =
    dashboard.frozenVehicleCount != null ? Number(dashboard.frozenVehicleCount) : Math.max(0, vehicles.length - activeVehCount);

  if (!session) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col">
        <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between max-w-5xl w-full mx-auto">
          <OpesFuelLogo variant="dark" size="md" />
          <button type="button" onClick={onBackHome} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /> Back to OpesFuel
          </button>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-slate-200 rounded-2xl p-8 bg-white space-y-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
                <Truck className="w-4 h-4" /> Corporate B2B Self-Service
              </div>
              <h1 className="font-display text-2xl font-bold text-slate-900">Corporate Fleet Client Portal</h1>
              <p className="text-xs text-slate-500">
                Monitor real-time driver fuelings, freeze lost cards, enforce per-vehicle spend limits, download OHADA VAT statements, and settle invoices via MTN MoMo or Orange Money.
              </p>
            </div>
            {loginError && (
              <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs">{loginError}</div>
            )}
            <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="fleetmgr@company.cm"
                  className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-amber-600"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-amber-600"
                />
              </div>
              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
              >
                {loggingIn ? 'Signing in…' : 'Sign In to Fleet Portal'}
              </button>
            </form>
            {!apiBase && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDemoQuickEnter}
                  className="w-full py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                >
                  Open Interactive Preview (Camrail Logistics SA)
                </button>
              </div>
            )}
            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              Need access? Ask your fuel station network manager to invite you from <strong>Fleet Credit &amp; POS → Invite Fleet Client</strong>.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 px-6 py-4 bg-white">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <OpesFuelLogo variant="dark" size="sm" />
            <div className="border-l border-slate-300 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-slate-900">{String(dashboard.companyName || session.companyName)}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    accountStatus === 'HOLD'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {accountStatus}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                FLEET PORTAL · NIU {String(dashboard.taxId || session.taxId)} · {session.email}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!session.demoMode && apiBase && (
              <button
                type="button"
                onClick={() => void loadPortalData()}
                disabled={refreshing}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Sync
              </button>
            )}
            <button
              type="button"
              onClick={openPayBalanceFlow}
              className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" /> Pay Balance via MoMo
            </button>
            <button
              type="button"
              onClick={() => setPasswordModalOpen(true)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" /> Password
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6 space-y-6">
        {toast && (
          <div
            className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} className="font-bold ml-4">×</button>
          </div>
        )}

        {(accountStatus === 'HOLD' || utilizationPct >= 85) && (
          <div
            className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
              accountStatus === 'HOLD'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  {accountStatus === 'HOLD'
                    ? 'Corporate Account on Credit Hold — Forecourt Fueling Suspended'
                    : `Credit Utilization Alert (${utilizationPct.toFixed(1)}% Used)`}
                </div>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {accountStatus === 'HOLD'
                    ? 'Settle your outstanding balance via MTN MoMo or Orange Money to automatically restore driver voucher issuance.'
                    : `Available headroom is ${formatFcfa(availableCredit)}. Settle part or all of your balance to avoid automatic credit freeze.`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openPayBalanceFlow}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Settle Balance Now
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {(
            [
              { id: 'overview', label: 'Credit Overview', icon: ShieldCheck },
              { id: 'fuelings', label: 'Driver Fuelings & Exports', icon: Fuel },
              { id: 'vehicles', label: 'Vehicles & Card Controls', icon: Sliders },
              { id: 'statements', label: 'Monthly VAT Statements', icon: FileText },
              { id: 'payments', label: 'Payments & Settlements', icon: Receipt },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 ${
                  activeTab === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border border-slate-200 rounded-xl p-5 bg-white">
                <div className="text-xs text-slate-500">Current Balance Owed</div>
                <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">{formatFcfa(balanceOwed)}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">{utilizationPct.toFixed(1)}% of approved limit</div>
              </div>
              <div className="border border-slate-200 rounded-xl p-5 bg-white">
                <div className="text-xs text-slate-500">Approved Credit Limit</div>
                <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">{formatFcfa(creditLimit)}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">Status: {accountStatus}</div>
              </div>
              <div className="border border-slate-200 rounded-xl p-5 bg-white">
                <div className="text-xs text-slate-500">Available Credit Headroom</div>
                <div className="font-mono tabular-nums text-2xl font-bold text-emerald-700 mt-1">{formatFcfa(availableCredit)}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">Immediate pump capacity</div>
              </div>
              <div className="border border-slate-200 rounded-xl p-5 bg-white">
                <div className="text-xs text-slate-500">Month-to-Date Fuel Spend</div>
                <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">{formatFcfa(Number(dashboard.monthSpendFcfa || 0))}</div>
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  {formatLitres(Number(dashboard.monthLitres || 0))} · {Number(dashboard.monthTransactions || 0)} fills
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 border border-slate-200 rounded-xl p-5 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">Credit Facility Utilization</h3>
                    <p className="text-xs text-slate-500">Real-time exposure across all authorized station forecourts</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-900">{utilizationPct.toFixed(1)}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all ${
                      utilizationPct >= 85 ? 'bg-red-600' : utilizationPct >= 65 ? 'bg-amber-600' : 'bg-slate-900'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, utilizationPct))}%` }}
                  />
                </div>
                <div className="flex flex-wrap justify-between text-[11px] font-mono text-slate-600">
                  <span>Used: {formatFcfa(balanceOwed)}</span>
                  <span>Remaining: {formatFcfa(availableCredit)}</span>
                  <span>Limit: {formatFcfa(creditLimit)}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-5 bg-white flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">Fleet Cards &amp; Vehicles</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Active fuel cards authorized on your account</p>
                </div>
                <div className="grid grid-cols-2 gap-3 my-3">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-500">Active Cards</div>
                    <div className="font-mono text-xl font-bold text-emerald-700">{activeVehCount}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-500">Frozen Cards</div>
                    <div className="font-mono text-xl font-bold text-slate-900">{frozenVehCount}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('vehicles')}
                  className="w-full py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-800"
                >
                  Manage Cards &amp; Limits
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-900">Recent Driver Fuelings</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('fuelings')}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                >
                  View Full Ledger →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 text-white text-left">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Station</th>
                      <th className="px-4 py-2.5">Plate</th>
                      <th className="px-4 py-2.5">Driver</th>
                      <th className="px-4 py-2.5">Grade</th>
                      <th className="px-4 py-2.5 text-right">Litres</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fuelings.slice(0, 5).map((f, idx) => (
                      <tr key={String(f.id || idx)} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-slate-600">{String(f.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-700">{String(f.station_id || '')}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{String(f.vehicle_plate)}</td>
                        <td className="px-4 py-2.5">{String(f.driver_name)}</td>
                        <td className="px-4 py-2.5 font-mono">{String(f.grade)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{Number(f.litres || 0).toFixed(2)} L</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold">{formatFcfa(Number(f.amount_fcfa || 0))}</td>
                      </tr>
                    ))}
                    {fuelings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                          No corporate fuelings recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fuelings' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={plateFilter}
                  onChange={(e) => setPlateFilter(e.target.value)}
                  placeholder="Filter plate (e.g. LT-441)…"
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                />
                <input
                  type="text"
                  value={driverFilter}
                  onChange={(e) => setDriverFilter(e.target.value)}
                  placeholder="Filter driver name…"
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value as 'ALL' | 'GASOIL' | 'SUPER' | 'JET_A1')}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                >
                  <option value="ALL">All Grades</option>
                  <option value="GASOIL">GASOIL</option>
                  <option value="SUPER">SUPER</option>
                  <option value="JET_A1">JET_A1</option>
                </select>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  title="From date"
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  title="To date"
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                />
                {(plateFilter || driverFilter || gradeFilter !== 'ALL' || fromDate || toDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlateFilter('');
                      setDriverFilter('');
                      setGradeFilter('ALL');
                      setFromDate('');
                      setToDate('');
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportExcel()}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Export Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Filtered Fills</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{filteredSummary.count}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Volume</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{formatLitres(filteredSummary.litres)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Net HT</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{formatFcfa(filteredSummary.netHt)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">TVA (19.25%)</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{formatFcfa(filteredSummary.vat)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Total TTC</div>
                <div className="font-mono font-bold text-amber-700 mt-0.5">{formatFcfa(filteredSummary.ttc)}</div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 text-white text-left">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Station</th>
                    <th className="px-4 py-3">Vehicle Plate</th>
                    <th className="px-4 py-3">Driver</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3 text-right">Litres</th>
                    <th className="px-4 py-3 text-right">Amount (TTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFuelings.map((f, idx) => (
                    <tr key={String(f.id || idx)} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-600">{String(f.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{String(f.station_id || '')}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{String(f.vehicle_plate)}</td>
                      <td className="px-4 py-3">{String(f.driver_name)}</td>
                      <td className="px-4 py-3 font-mono">{String(f.grade)}</td>
                      <td className="px-4 py-3 text-right font-mono">{Number(f.litres || 0).toFixed(2)} L</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{formatFcfa(Number(f.amount_fcfa || 0))}</td>
                    </tr>
                  ))}
                  {filteredFuelings.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No fueling transactions match your current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'vehicles' && (
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-white text-left">
                <tr>
                  <th className="px-4 py-3">Vehicle Plate</th>
                  <th className="px-4 py-3">Driver / Card</th>
                  <th className="px-4 py-3">Card Status</th>
                  <th className="px-4 py-3">Allowed Grades</th>
                  <th className="px-4 py-3 text-right">Daily Cap</th>
                  <th className="px-4 py-3 text-right">Monthly Cap &amp; MTD Usage</th>
                  <th className="px-4 py-3 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.map((v, idx) => {
                  const isActive = v.active !== false && v.limitActive !== false;
                  const mtdL = Number(v.mtdLitres || 0);
                  const mCapL = Number(v.monthlyLitreCap || v.monthly_litre_cap || 0);
                  const capPct = mCapL > 0 ? Math.min(100, Math.round((mtdL / mCapL) * 100)) : 0;
                  return (
                    <tr key={String(v.id || idx)} className={`hover:bg-slate-50 ${!isActive ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{String(v.plate_number)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{String(v.driver_name)}</div>
                        {Boolean(v.cardNumber) && (
                          <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                            <CreditCard className="w-3 h-3" /> {String(v.cardNumber)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}
                        >
                          {isActive ? 'ACTIVE' : 'FROZEN'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{String(v.allowedGradesCsv || v.allowed_grade || 'ALL')}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {v.dailyLitreCap ? `${String(v.dailyLitreCap)} L` : '—'}
                        {v.dailyXafCap ? ` / ${formatFcfa(Number(v.dailyXafCap))}` : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <div>
                          {mCapL ? `${mCapL} L` : '—'}
                          {v.monthlyXafCap ? ` / ${formatFcfa(Number(v.monthlyXafCap))}` : ''}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          MTD: {mtdL.toFixed(0)} L ({formatFcfa(Number(v.mtdSpendFcfa || 0))})
                        </div>
                        {mCapL > 0 && (
                          <div className="w-28 ml-auto h-1.5 rounded-full bg-slate-200 overflow-hidden mt-1">
                            <div
                              className={`h-full ${capPct >= 90 ? 'bg-red-600' : capPct >= 70 ? 'bg-amber-600' : 'bg-slate-900'}`}
                              style={{ width: `${capPct}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void toggleCardFreeze(v)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 ${
                              isActive
                                ? 'border-red-200 text-red-700 hover:bg-red-50'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {isActive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            {isActive ? 'Freeze' : 'Unfreeze'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditLimit(v)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-semibold"
                          >
                            Edit Limits
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'statements' && (
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-xl p-6 space-y-5 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">Monthly Corporate VAT Statement (19.25% TVA)</h3>
                  <p className="text-xs text-slate-500">Tax-deductible itemized statement issued on company letterhead for OHADA / DGI accounting.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="month"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleExportExcel(statementRows)}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel Pack
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadVatStatementPdf()}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Download VAT PDF
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">Net HT (Excl. VAT)</div>
                  <div className="font-mono text-lg font-bold text-slate-900 mt-1">{formatFcfa(statementMetrics.netHt)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">Recoverable TVA (19.25%)</div>
                  <div className="font-mono text-lg font-bold text-emerald-700 mt-1">{formatFcfa(statementMetrics.vat)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">Total TTC ({period})</div>
                  <div className="font-mono text-lg font-bold text-slate-900 mt-1">{formatFcfa(statementMetrics.ttc)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">Total Volume Dispensed</div>
                  <div className="font-mono text-lg font-bold text-slate-900 mt-1">{formatLitres(statementMetrics.litres)}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{statementRows.length} fuelings</div>
                </div>
              </div>

              {statementMetrics.grades.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-900 text-white text-left">
                      <tr>
                        <th className="px-4 py-2.5">Fuel Grade</th>
                        <th className="px-4 py-2.5 text-right">Fills</th>
                        <th className="px-4 py-2.5 text-right">Litres</th>
                        <th className="px-4 py-2.5 text-right">Net HT</th>
                        <th className="px-4 py-2.5 text-right">TVA 19.25%</th>
                        <th className="px-4 py-2.5 text-right">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statementMetrics.grades.map((g) => {
                        const gHt = Math.round(g.ttc / (1 + VAT_RATE));
                        return (
                          <tr key={g.grade}>
                            <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{g.grade}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{g.count}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{g.litres.toFixed(1)} L</td>
                            <td className="px-4 py-2.5 text-right font-mono">{formatFcfa(gHt)}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{formatFcfa(g.ttc - gHt)}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold">{formatFcfa(g.ttc)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">Mobile Money Balance Settlements</h3>
                <p className="text-xs text-slate-500">MTN MoMo &amp; Orange Money Cameroon settlement receipts credited to your corporate AR balance.</p>
              </div>
              <button
                type="button"
                onClick={openPayBalanceFlow}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" /> New Settlement Payment
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 text-white text-left">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Mobile Number</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p, idx) => {
                    const st = String(p.status || 'PENDING').toUpperCase();
                    return (
                      <tr key={String(p.id || idx)} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-600">{String(p.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                        <td className="px-4 py-3 font-mono text-slate-900 font-semibold">{String(p.reference_id || p.id)}</td>
                        <td className="px-4 py-3 font-mono">{String(p.provider || '').replace('_', ' ')}</td>
                        <td className="px-4 py-3 font-mono">{String(p.msisdn || '')}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{formatFcfa(Number(p.amount_fcfa || 0))}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              st === 'SUCCESSFUL'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : st === 'PENDING'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                          >
                            {st === 'SUCCESSFUL' && <CheckCircle2 className="w-3 h-3" />}
                            {st}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No Mobile Money balance settlements recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Edit Limits & Card Freeze Modal */}
      <FormModal
        open={Boolean(editingVehicle)}
        onClose={() => setEditingVehicle(null)}
        title={`Enforce Card & Spend Limits — ${String(editingVehicle?.plate_number || '')}`}
      >
        <form onSubmit={(e) => void saveLimits(e)} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Fuel Card Number</label>
            <input type="text" value={cardNo} onChange={(e) => setCardNo(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Allowed Fuel Grades (comma-separated, e.g. GASOIL or SUPER,GASOIL)</label>
            <input type="text" value={allowedGrades} onChange={(e) => setAllowedGrades(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Daily Litre Cap</label>
              <input type="number" min="1" value={dailyLitres} onChange={(e) => setDailyLitres(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Monthly Litre Cap</label>
              <input type="number" min="1" value={monthlyLitres} onChange={(e) => setMonthlyLitres(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Daily Spend Cap (FCFA)</label>
              <input type="number" min="1000" value={dailyXaf} onChange={(e) => setDailyXaf(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Monthly Spend Cap (FCFA)</label>
              <input type="number" min="1000" value={monthlyXaf} onChange={(e) => setMonthlyXaf(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
          </div>
          <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={vehicleActive}
              onChange={(e) => setVehicleActive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Card Active (uncheck to immediately freeze fueling for this vehicle)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditingVehicle(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Save Server-Enforced Limits</button>
          </div>
        </form>
      </FormModal>

      {/* Settlement Amount Selector Modal */}
      <FormModal
        open={amountPickerOpen}
        onClose={() => setAmountPickerOpen(false)}
        title="Choose Corporate Balance Settlement Amount"
      >
        <form onSubmit={proceedToMomoCheckout} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">Current Balance Owed</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{formatFcfa(balanceOwed)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setCustomPayAmount(String(Math.max(1000, balanceOwed)))}
              className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold"
            >
              100% Full
            </button>
            <button
              type="button"
              onClick={() => setCustomPayAmount(String(Math.max(1000, Math.round(balanceOwed / 2))))}
              className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold"
            >
              50% Half
            </button>
            <button
              type="button"
              onClick={() => setCustomPayAmount('250000')}
              className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold"
            >
              250 000 FCFA
            </button>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Settlement Amount (FCFA)</label>
            <input
              type="number"
              min="100"
              required
              value={customPayAmount}
              onChange={(e) => setCustomPayAmount(e.target.value)}
              className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-sm focus:outline-none focus:border-amber-600"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAmountPickerOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
              Cancel
            </button>
            {session.demoMode || !apiBase ? (
              <button
                type="button"
                onClick={handleDemoSettlement}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" /> Confirm Preview Settlement
              </button>
            ) : (
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" /> Continue to MTN MoMo / OM
              </button>
            )}
          </div>
        </form>
      </FormModal>

      {/* Change Password Modal */}
      <FormModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title="Change Corporate Fleet Portal Password"
      >
        <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">New Password (min 8 characters)</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPasswordModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingPassword}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              {savingPassword ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </FormModal>

      <MomoPaymentModal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Settle Corporate Fleet Balance"
        amountFcfa={payAmountFcfa}
        targetType="FLEET_BALANCE"
        targetId={session.fleetAccountId}
        endpointPath="/api/v1/fleet-portal/pay-balance"
        authHeader={{ 'X-Fleet-Token': session.token }}
        onSettled={() => {
          void loadPortalData();
        }}
        onNotify={(type, message) => setToast({ type, message })}
      />
    </div>
  );
};
