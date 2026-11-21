import React, { useState } from 'react';
import { ArrowLeft, Building2, Check, ChevronRight, RotateCcw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../../api/opesfuelClient';
import { canPerformAction, isAuth0Configured, ROLE_PROFILES } from '../../auth/auth0';
import { ALL_FUEL_GRADES, formatFcfa, formatLitres, gradeLabel } from '../../domain/formatters';
import { Employee, FuelTank, Pump, Station, TenantWorkspace, UserRole } from '../../domain/types';

interface AdminBillingSectionProps {
  tenant: TenantWorkspace;
  role: UserRole;
  stations: Station[];
  pumps: Pump[];
  tanks: FuelTank[];
  employees: Employee[];
  onCreateStation: (input: {
    code: string;
    name: string;
    city: string;
    planName: string;
    monthlyFeeFcfa: number;
  }) => void;
  onUpdateStation: (stationId: string, input: { code: string; name: string; city: string }) => void;
  onDeleteStation: (stationId: string) => void;
  onUpdateSubscription: (stationId: string, planName: string, monthlyFeeFcfa: number) => void;
  onToggleAiSubscription: (enable: boolean) => void;
  onClearDemoData: () => void;
  onRestoreDemoData: () => void;
}

export const AdminBillingSection: React.FC<AdminBillingSectionProps> = ({
  tenant,
  role,
  stations,
  pumps,
  tanks,
  employees,
  onCreateStation,
  onUpdateStation,
  onDeleteStation,
  onUpdateSubscription,
  onToggleAiSubscription,
  onClearDemoData,
  onRestoreDemoData,
}) => {
  const [selectedStationId, setSelectedStationId] = useState(stations[0]?.id ?? '');
  const [detailStationId, setDetailStationId] = useState<string | null>(null);
  const [editingStation, setEditingStation] = useState(false);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [planId, setPlanId] = useState('starter');

  const selectedStation = stations.find((s) => s.id === selectedStationId) ?? stations[0];
  const totalMonthlyFcfa = stations.reduce((sum, s) => sum + s.monthlyFeeFcfa, 0);

  const handleOnboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !city.trim()) return;
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? SUBSCRIPTION_PLANS[0];
    onCreateStation({
      code: code.trim(),
      name: name.trim(),
      city: city.trim(),
      planName: plan.name,
      monthlyFeeFcfa: plan.monthlyPriceFcfa,
    });
    setCode('');
    setName('');
    setCity('');
  };

  // Dedicated Station Detail View
  const activeDetailStation = detailStationId ? stations.find((s) => s.id === detailStationId) : null;
  if (activeDetailStation) {
    const stationPumps = pumps.filter((p) => p.stationId === activeDetailStation.id);
    const stationTanks = tanks.filter((t) => t.stationId === activeDetailStation.id);
    const stationEmployees = employees.filter((e) => e.stationId === activeDetailStation.id);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setDetailStationId(null);
              setEditingStation(false);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Multi-Station Administration
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {role === 'OWNER' && (
              <button
                type="button"
                onClick={() => {
                  if (!editingStation) {
                    setEditCode(activeDetailStation.code);
                    setEditName(activeDetailStation.name);
                    setEditCity(activeDetailStation.city);
                  }
                  setEditingStation((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                {editingStation ? 'Cancel Edit' : 'Edit Station Details'}
              </button>
            )}
            {role === 'OWNER' && stations.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  onDeleteStation(activeDetailStation.id);
                  setDetailStationId(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Petrol Station
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">{activeDetailStation.name}</h2>
                <p className="text-xs text-slate-500">
                  Code <span className="font-mono font-semibold">{activeDetailStation.code}</span> ·{' '}
                  {activeDetailStation.city} · Plan {activeDetailStation.planName}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Monthly SaaS Subscription</div>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                {formatFcfa(activeDetailStation.monthlyFeeFcfa)}/mo
              </div>
            </div>
          </div>

          {editingStation && role === 'OWNER' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateStation(activeDetailStation.id, {
                  code: editCode,
                  name: editName,
                  city: editCity,
                });
                setEditingStation(false);
              }}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200"
            >
              <input
                type="text"
                placeholder="Station Code"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
              />
              <input
                type="text"
                placeholder="Station Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
              />
              <input
                type="text"
                placeholder="City"
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                Save Station Details
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {ALL_FUEL_GRADES.map((g) => (
              <div key={g} className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-600">{gradeLabel(g)}</span>
                <span className="font-mono tabular-nums font-bold text-slate-900">
                  {formatFcfa(activeDetailStation.prices[g])}/L
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="text-xs font-semibold text-slate-900">Forecourt Dispensers ({stationPumps.length})</div>
              {stationPumps.map((p) => (
                <div key={p.id} className="flex justify-between text-xs text-slate-600">
                  <span className="font-mono font-semibold text-slate-900">{p.code}</span>
                  <span>{gradeLabel(p.grade)}</span>
                </div>
              ))}
              {stationPumps.length === 0 && <div className="text-xs text-slate-400">No dispensers provisioned.</div>}
            </div>

            <div className="border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="text-xs font-semibold text-slate-900">Underground Tanks ({stationTanks.length})</div>
              {stationTanks.map((t) => (
                <div key={t.id} className="flex justify-between text-xs text-slate-600">
                  <span className="truncate">{t.name}</span>
                  <span className="font-mono">{formatLitres(t.bookVolumeLitres)}</span>
                </div>
              ))}
              {stationTanks.length === 0 && <div className="text-xs text-slate-400">No fuel tanks provisioned.</div>}
            </div>

            <div className="border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="text-xs font-semibold text-slate-900">Assigned Staff ({stationEmployees.length})</div>
              {stationEmployees.map((e) => (
                <div key={e.id} className="flex justify-between text-xs text-slate-600">
                  <span className="font-medium text-slate-900">{e.fullName}</span>
                  <span className="font-mono">{e.role}</span>
                </div>
              ))}
              {stationEmployees.length === 0 && <div className="text-xs text-slate-400">No staff assigned yet.</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SaaS Tenant Overview & Quota Usage */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="font-mono text-xs text-amber-700 font-semibold">
            Tenant ID: {tenant.tenantId} · Owner: {tenant.ownerName} ({tenant.ownerEmail})
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900">{tenant.organizationName}</h2>
          <p className="text-xs text-slate-500">
            Active workspace mode: {tenant.isSampleData ? 'Sample Demo Operations Loaded' : 'Clean Production Workspace'}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] text-slate-500">Stations</div>
            <div className="font-mono tabular-nums text-base font-bold text-slate-900">{stations.length}</div>
          </div>
          <div className="px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] text-slate-500">Dispensers</div>
            <div className="font-mono tabular-nums text-base font-bold text-slate-900">{pumps.length}</div>
          </div>
          <div className="px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] text-slate-500">Employees</div>
            <div className="font-mono tabular-nums text-base font-bold text-slate-900">{employees.length}</div>
          </div>
          <div className="px-4 py-2.5 rounded-lg bg-slate-900 text-white">
            <div className="text-[11px] text-slate-300">Monthly SaaS</div>
            <div className="font-mono tabular-nums text-base font-bold text-amber-400">
              {formatFcfa(totalMonthlyFcfa)}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Station Admin Directory & Billing Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Multi-Station Administration &amp; Subscriptions
              </h2>
              <p className="text-xs text-slate-500">
                Manage station licenses and monthly FCFA billing starting at 25 000 FCFA/month
              </p>
            </div>
            <div className="font-mono tabular-nums text-sm font-bold text-slate-900">
              Total Billing: {formatFcfa(totalMonthlyFcfa)}/mo
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Station</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3 text-right">Monthly Fee</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stations.map((st) => (
                  <tr
                    key={st.id}
                    onClick={() => setSelectedStationId(st.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedStation?.id === st.id ? 'bg-amber-50/60' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{st.code}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailStationId(st.id);
                        }}
                        className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-amber-700"
                      >
                        <span>{st.name}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{st.city}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-amber-800">{st.planName}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                      {formatFcfa(st.monthlyFeeFcfa)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {role === 'OWNER' && stations.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteStation(st.id);
                          }}
                          aria-label={`Delete station ${st.name}`}
                          className="p-1.5 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={handleOnboard} className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">Provision New Petrol Station</h3>
            <p className="text-xs text-slate-500">Creates tenant partition in PostgreSQL</p>
          </div>
          <input
            type="text"
            placeholder="Station Code (e.g. OPF-KRI-04)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
          />
          <input
            type="text"
            placeholder="Station Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
          />
          <input
            type="text"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
          />
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            {SUBSCRIPTION_PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatFcfa(p.monthlyPriceFcfa)}/mo
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={role !== 'OWNER'}
            className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold"
          >
            Add Station to Network
          </button>
        </form>
      </div>

      {/* Subscription Tier Switcher for Selected Station */}
      {selectedStation && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              Subscription Plan for {selectedStation.name}
            </h3>
            <p className="text-xs text-slate-500">
              Current active tier: <span className="font-semibold text-slate-900">{selectedStation.planName}</span> (
              <span className="font-mono tabular-nums">{formatFcfa(selectedStation.monthlyFeeFcfa)}/mo</span>)
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isCurrent = selectedStation.planName === plan.name;
              return (
                <div
                  key={plan.id}
                  className={`border rounded-lg p-4 flex flex-col justify-between gap-4 ${
                    isCurrent ? 'border-amber-600 bg-amber-50/40' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-slate-900">{plan.name}</span>
                      {isCurrent && <Check className="w-4 h-4 text-amber-700" />}
                    </div>
                    <div className="font-mono tabular-nums text-lg font-bold text-slate-900">
                      {formatFcfa(plan.monthlyPriceFcfa)}/mo
                    </div>
                    <div className="text-xs text-slate-500">{plan.pumpLimit}</div>
                  </div>
                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() =>
                      onUpdateSubscription(selectedStation.id, plan.name, plan.monthlyPriceFcfa)
                    }
                    className={`w-full py-2 rounded-md text-xs font-semibold ${
                      isCurrent
                        ? 'bg-slate-200 text-slate-600 cursor-default'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {isCurrent ? 'Current Plan' : `Switch to ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Paid AI Copilot SaaS Add-On */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-amber-700">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              Paid AI Intelligence Module ·{' '}
              {tenant.aiSubscription.active
                ? tenant.aiSubscription.planCode === 'INCLUDED_ENTERPRISE'
                  ? 'Active (Included on Network Enterprise)'
                  : 'Active (25 000 FCFA / mo)'
                : '25 000 FCFA / mo Add-On'}
            </span>
          </div>
          <h3 className="font-display text-base font-bold text-slate-900">
            OpesFuel Paid AI Copilot (Forecasting, Stockout Alerts &amp; Variance Audit)
          </h3>
          <p className="text-xs text-slate-500">
            Predicts tank depletion dates, suggests reorder Litres, audits shift/dipstick variances, and powers interactive financial Q&amp;A.
          </p>
        </div>
        {canPerformAction(role, 'MANAGE_AI_ADDON') && (
          <button
            type="button"
            onClick={() => onToggleAiSubscription(!tenant.aiSubscription.active)}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[44px] ${
              tenant.aiSubscription.active
                ? 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {tenant.aiSubscription.active ? 'Pause Paid AI Copilot' : 'Activate Paid AI Copilot'}
          </button>
        )}
      </div>

      {/* SaaS Workspace Data Management */}
      {role === 'OWNER' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-slate-900">
              SaaS Workspace Data Management
            </h3>
            <p className="text-xs text-slate-500">
              Wipe pre-seeded demo pumps, tanks, shifts, staff, and journals to enter real station numbers from scratch, or restore sample Cameroon network data anytime.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClearDemoData}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All Demo Data
            </button>
            <button
              type="button"
              onClick={onRestoreDemoData}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restore Sample Demo Data
            </button>
          </div>
        </div>
      )}

      {/* Auth0 Tenant & RBAC Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-700" />
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              Auth0 Security &amp; RBAC Policy Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Status: {isAuth0Configured ? 'Auth0 RS256 OIDC Active' : 'Demo RBAC Mode (Configure VITE_AUTH0_DOMAIN & AUTH0_ISSUER_URI for production)'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['OWNER', 'MANAGER', 'ATTENDANT', 'ACCOUNTANT'] as UserRole[]).map((r) => (
            <div key={r} className="border border-slate-200 rounded-lg p-4 space-y-1.5">
              <div className="font-mono text-xs font-bold text-amber-700">ROLE_{r}</div>
              <div className="text-sm font-semibold text-slate-900">{ROLE_PROFILES[r].title}</div>
              <p className="text-xs text-slate-600 leading-relaxed">{ROLE_PROFILES[r].summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Perpetual & Custom Source Code IP License Options */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="text-xs font-mono text-amber-400">Self-Hosted Enterprise Deployment</div>
          <h3 className="font-display text-lg font-bold">
            Perpetual License — 5 000 000 FCFA / year
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Dedicated private infrastructure deployment with full system management, security patching,
            database backups, and ongoing maintenance included.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-mono text-amber-400">Bespoke Development &amp; IP Transfer</div>
          <h3 className="font-display text-lg font-bold">
            Custom Source Code &amp; Intellectual Property Buyout
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Negotiated contract granting full source code and IP ownership across Web, Mobile Apps
            (Android &amp; iPhone), Desktop terminal apps, and Java 25 Spring Boot backend. Contact info@opesware.com.
          </p>
        </div>
      </div>
    </div>
  );
};
