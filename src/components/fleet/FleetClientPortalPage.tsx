import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CreditCard,
  Download,
  FileText,
  Fuel,
  LogOut,
  ShieldCheck,
  Sliders,
  Smartphone,
  Truck,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OpesFuelLogo } from '../brand/OpesFuelLogo';
import { FormModal } from '../shared/FormModal';
import { MomoPaymentModal } from '../console/MomoPaymentModal';
import { formatFcfa, formatLitres } from '../../domain/formatters';
import { getCompanyBranding } from '../../utils/companyBranding';

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

  // Portal data
  const [activeTab, setActiveTab] = useState<'overview' | 'fuelings' | 'vehicles' | 'statements'>('overview');
  const [dashboard, setDashboard] = useState<Record<string, unknown>>({
    companyName: 'Camrail Logistics SA',
    taxId: 'M0126000991',
    status: 'ACTIVE',
    creditLimitFcfa: 5_000_000,
    balanceOwedFcfa: 1_240_000,
    availableCreditFcfa: 3_760_000,
    monthSpendFcfa: 1_850_000,
    monthLitres: 2_215,
    monthTransactions: 34,
    vehicleCount: 3,
  });
  const [fuelings, setFuelings] = useState<Array<Record<string, unknown>>>([
    { id: 'ftx_demo1', station_id: 'DLA-01', vehicle_plate: 'LT-441-CM', driver_name: 'Paul Ndongo', grade: 'GASOIL', litres: 85, amount_fcfa: 70380, created_at: new Date(Date.now() - 3600_000).toISOString() },
    { id: 'ftx_demo2', station_id: 'DLA-01', vehicle_plate: 'LT-882-CM', driver_name: 'Samuel Eto', grade: 'SUPER', litres: 45, amount_fcfa: 37800, created_at: new Date(Date.now() - 86400_000).toISOString() },
  ]);
  const [vehicles, setVehicles] = useState<Array<Record<string, unknown>>>([
    { id: 'v1', plate_number: 'LT-441-CM', driver_name: 'Paul Ndongo', cardNumber: 'CRD-441', dailyLitreCap: 150, monthlyLitreCap: 2500, dailyXafCap: 150000, monthlyXafCap: 2200000, allowedGradesCsv: 'GASOIL', active: true },
    { id: 'v2', plate_number: 'LT-882-CM', driver_name: 'Samuel Eto', cardNumber: 'CRD-882', dailyLitreCap: 80, monthlyLitreCap: 1200, dailyXafCap: 80000, monthlyXafCap: 1100000, allowedGradesCsv: 'SUPER,GASOIL', active: true },
  ]);
  const [plateFilter, setPlateFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Limit edit modal
  const [editingVehicle, setEditingVehicle] = useState<Record<string, unknown> | null>(null);
  const [cardNo, setCardNo] = useState('');
  const [dailyLitres, setDailyLitres] = useState('');
  const [monthlyLitres, setMonthlyLitres] = useState('');
  const [dailyXaf, setDailyXaf] = useState('');
  const [monthlyXaf, setMonthlyXaf] = useState('');
  const [allowedGrades, setAllowedGrades] = useState('GASOIL');

  // Pay balance modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmountFcfa, setPayAmountFcfa] = useState(250_000);

  const loadPortalData = useCallback(async () => {
    if (!session || session.demoMode || !apiBase) return;
    const headers = { 'X-Fleet-Token': session.token };
    try {
      const [dRes, fRes, vRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/fleet-portal/dashboard`, { headers }),
        fetch(`${apiBase}/api/v1/fleet-portal/fuelings`, { headers }),
        fetch(`${apiBase}/api/v1/fleet-portal/vehicles`, { headers }),
      ]);
      if (dRes.ok) setDashboard((await dRes.json()) as Record<string, unknown>);
      if (fRes.ok) setFuelings((await fRes.json()) as Array<Record<string, unknown>>);
      if (vRes.ok) setVehicles((await vRes.json()) as Array<Record<string, unknown>>);
    } catch {
      // keep existing state on transient error
    }
  }, [session, apiBase]);

  useEffect(() => {
    void loadPortalData();
  }, [loadPortalData]);

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

  const handleSignOut = () => {
    sessionStorage.removeItem(FLEET_SESSION_KEY);
    setSession(null);
  };

  const filteredFuelings = useMemo(
    () =>
      fuelings.filter((f) => {
        const p = String(f.vehicle_plate ?? '').toUpperCase();
        const d = String(f.driver_name ?? '').toUpperCase();
        return (
          (!plateFilter.trim() || p.includes(plateFilter.trim().toUpperCase())) &&
          (!driverFilter.trim() || d.includes(driverFilter.trim().toUpperCase()))
        );
      }),
    [fuelings, plateFilter, driverFilter]
  );

  const exportCsv = () => {
    const header = 'TransactionId,Station,VehiclePlate,Driver,Grade,Litres,AmountFCFA,Timestamp\n';
    const rows = filteredFuelings
      .map(
        (f) =>
          `"${f.id}","${f.station_id}","${f.vehicle_plate}","${f.driver_name}","${f.grade}","${f.litres}","${f.amount_fcfa}","${f.created_at}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleet-fuelings-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadVatStatementPdf = async () => {
    const b = getCompanyBranding();
    let statementRows = filteredFuelings.filter((f) => String(f.created_at || '').startsWith(period));
    if (session && !session.demoMode && apiBase) {
      try {
        const res = await fetch(
          `${apiBase}/api/v1/fleet-portal/statement?period=${encodeURIComponent(period)}`,
          { headers: { 'X-Fleet-Token': session.token } }
        );
        if (res.ok) {
          const data = (await res.json()) as { transactions?: Array<Record<string, unknown>> };
          if (Array.isArray(data.transactions)) {
            statementRows = data.transactions;
          }
        }
      } catch {
        // fallback to loaded rows
      }
    } else if (statementRows.length === 0) {
      statementRows = filteredFuelings;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const totalTtc = statementRows.reduce((s, f) => s + Number(f.amount_fcfa || 0), 0);
    const netHt = Math.round(totalTtc / 1.1925);
    const vat = totalTtc - netHt;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${b.legalName || 'OpesFuel Network'} — Monthly Corporate Fleet VAT Statement`, 14, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Client: ${String(dashboard.companyName)} (NIU: ${String(dashboard.taxId)}) · Period: ${period}`, 14, 22);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`Net HT: ${formatFcfa(netHt)}   |   VAT (19.25%): ${formatFcfa(vat)}   |   Total TTC: ${formatFcfa(totalTtc)}`, 14, 40);

    autoTable(doc, {
      startY: 46,
      head: [['Date', 'Station', 'Vehicle', 'Driver', 'Grade', 'Litres', 'Amount (FCFA)']],
      body:
        statementRows.length > 0
          ? statementRows.map((f) => [
              String(f.created_at || '').slice(0, 16).replace('T', ' '),
              String(f.station_id || ''),
              String(f.vehicle_plate || ''),
              String(f.driver_name || ''),
              String(f.grade || ''),
              Number(f.litres || 0).toFixed(2),
              formatFcfa(Number(f.amount_fcfa || 0)),
            ])
          : [['-', '-', 'No fuelings recorded in selected period', '-', '-', '0.00', '0 FCFA']],
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8.5 },
    });
    doc.save(`fleet-vat-statement-${period}.pdf`);
    setToast({ type: 'success', message: `Downloaded VAT statement PDF for ${period} (${statementRows.length} fuelings).` });
  };

  const openEditLimit = (v: Record<string, unknown>) => {
    setEditingVehicle(v);
    setCardNo(String(v.cardNumber || ''));
    setDailyLitres(v.dailyLitreCap != null ? String(v.dailyLitreCap) : '');
    setMonthlyLitres(v.monthlyLitreCap != null ? String(v.monthlyLitreCap) : '');
    setDailyXaf(v.dailyXafCap != null ? String(v.dailyXafCap) : '');
    setMonthlyXaf(v.monthlyXafCap != null ? String(v.monthlyXafCap) : '');
    setAllowedGrades(String(v.allowedGradesCsv || v.allowed_grade || 'GASOIL'));
  };

  const saveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;
    const plate = String(editingVehicle.plate_number);
    const payload = {
      cardNumber: cardNo.trim() || null,
      dailyLitreCap: dailyLitres ? Number(dailyLitres) : null,
      monthlyLitreCap: monthlyLitres ? Number(monthlyLitres) : null,
      dailyXafCap: dailyXaf ? Number(dailyXaf) : null,
      monthlyXafCap: monthlyXaf ? Number(monthlyXaf) : null,
      allowedGradesCsv: allowedGrades.trim() || null,
      active: true,
    };

    if (session && !session.demoMode && apiBase) {
      const res = await fetch(`${apiBase}/api/v1/fleet-portal/vehicles/${encodeURIComponent(plate)}/limits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Fleet-Token': session.token },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setToast({ type: 'error', message: `Unable to update limits (HTTP ${res.status}).` });
        return;
      }
      await loadPortalData();
    } else {
      setVehicles((prev) =>
        prev.map((v) => (String(v.plate_number) === plate ? { ...v, ...payload } : v))
      );
    }
    setEditingVehicle(null);
    setToast({ type: 'success', message: `Updated server-enforced card & spend limits for ${plate}.` });
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col">
        <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between max-w-5xl w-full mx-auto">
          <OpesFuelLogo variant="dark" size="md" />
          <button type="button" onClick={onBackHome} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
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
                Monitor real-time driver fuelings, enforce per-vehicle spend limits, download monthly VAT statements, and settle invoices via MTN MoMo or Orange Money.
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
              <div className="font-display text-sm font-bold text-slate-900">{String(dashboard.companyName || session.companyName)}</div>
              <div className="text-[11px] text-slate-500 font-mono">
                FLEET PORTAL · NIU {String(dashboard.taxId || session.taxId)} · {session.email}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPayAmountFcfa(Math.max(1000, Number(dashboard.balanceOwedFcfa || 100000)));
                setPayModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" /> Pay Balance via MoMo
            </button>
            <button
              type="button"
              onClick={handleSignOut}
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

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {(
            [
              { id: 'overview', label: 'Credit Overview', icon: ShieldCheck },
              { id: 'fuelings', label: 'Driver Fuelings & CSV', icon: Fuel },
              { id: 'vehicles', label: 'Vehicles & Spend Limits', icon: Sliders },
              { id: 'statements', label: 'Monthly VAT Statements', icon: FileText },
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-slate-200 rounded-xl p-5 bg-white">
              <div className="text-xs text-slate-500">Current Balance Owed</div>
              <div className="font-mono text-2xl font-bold text-slate-900 mt-1">{formatFcfa(Number(dashboard.balanceOwedFcfa || 0))}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-5 bg-white">
              <div className="text-xs text-slate-500">Approved Credit Limit</div>
              <div className="font-mono text-2xl font-bold text-slate-900 mt-1">{formatFcfa(Number(dashboard.creditLimitFcfa || 0))}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-5 bg-white">
              <div className="text-xs text-slate-500">Available Credit Headroom</div>
              <div className="font-mono text-2xl font-bold text-emerald-700 mt-1">{formatFcfa(Number(dashboard.availableCreditFcfa || 0))}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-5 bg-white">
              <div className="text-xs text-slate-500">Month-to-Date Fuel Spend</div>
              <div className="font-mono text-2xl font-bold text-slate-900 mt-1">{formatFcfa(Number(dashboard.monthSpendFcfa || 0))}</div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{formatLitres(Number(dashboard.monthLitres || 0))}</div>
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
              </div>
              <button
                type="button"
                onClick={exportCsv}
                className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 text-white text-left">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Vehicle Plate</th>
                    <th className="px-4 py-3">Driver</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3 text-right">Litres</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFuelings.map((f, idx) => (
                    <tr key={String(f.id || idx)} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-600">{String(f.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{String(f.vehicle_plate)}</td>
                      <td className="px-4 py-3">{String(f.driver_name)}</td>
                      <td className="px-4 py-3 font-mono">{String(f.grade)}</td>
                      <td className="px-4 py-3 text-right font-mono">{Number(f.litres || 0).toFixed(2)} L</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{formatFcfa(Number(f.amount_fcfa || 0))}</td>
                    </tr>
                  ))}
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
                  <th className="px-4 py-3">Allowed Grades</th>
                  <th className="px-4 py-3 text-right">Daily Cap</th>
                  <th className="px-4 py-3 text-right">Monthly Cap</th>
                  <th className="px-4 py-3 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.map((v, idx) => (
                  <tr key={String(v.id || idx)} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{String(v.plate_number)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{String(v.driver_name)}</div>
                      {Boolean(v.cardNumber) && <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1"><CreditCard className="w-3 h-3" /> {String(v.cardNumber)}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono">{String(v.allowedGradesCsv || v.allowed_grade || 'ALL')}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {v.dailyLitreCap ? `${String(v.dailyLitreCap)} L` : '—'}
                      {v.dailyXafCap ? ` / ${formatFcfa(Number(v.dailyXafCap))}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {v.monthlyLitreCap ? `${String(v.monthlyLitreCap)} L` : '—'}
                      {v.monthlyXafCap ? ` / ${formatFcfa(Number(v.monthlyXafCap))}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditLimit(v)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-semibold"
                      >
                        Edit Limits
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'statements' && (
          <div className="border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">Monthly Corporate VAT Statement (19.25% TVA)</h3>
                <p className="text-xs text-slate-500">Tax-deductible itemized statement issued on company letterhead for OHADA accounting.</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
                <button type="button" onClick={() => void downloadVatStatementPdf()} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Download VAT PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

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
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditingVehicle(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Save Server-Enforced Limits</button>
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
          if (session.demoMode || !apiBase) {
            setDashboard((prev) => {
              const prevBal = Number(prev.balanceOwedFcfa || 0);
              const limit = Number(prev.creditLimitFcfa || 0);
              const nextBal = Math.max(0, prevBal - payAmountFcfa);
              return { ...prev, balanceOwedFcfa: nextBal, availableCreditFcfa: Math.max(0, limit - nextBal) };
            });
          } else {
            void loadPortalData();
          }
        }}
        onNotify={(type, message) => setToast({ type, message })}
      />
    </div>
  );
};
