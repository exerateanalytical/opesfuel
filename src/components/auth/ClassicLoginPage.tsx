import React, { useState } from 'react';
import { ArrowLeft, Building2, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../../api/opesfuelClient';
import { buildAuth0AuthorizeUrl, ROLE_PROFILES } from '../../auth/auth0';
import { formatFcfa } from '../../domain/formatters';
import { Station, UserRole } from '../../domain/types';
import { OpesFuelLogo } from '../brand/OpesFuelLogo';

interface ClassicLoginPageProps {
  organizationName: string;
  stations: Station[];
  initialRole: UserRole;
  initialStationId: string;
  onAuthenticated: (role: UserRole, stationId: string) => void;
  onCreateWorkspace: (input: {
    organizationName: string;
    ownerName: string;
    ownerEmail: string;
    stationCode: string;
    stationName: string;
    city: string;
    planName: string;
    monthlyFeeFcfa: number;
    includeSampleData: boolean;
  }) => void;
  onBackToSite: () => void;
}

const LOGIN_CANOPY_IMG = '/src/assets/images/opesfuel_login_canopy_black_1795293396503.jpg';

const EMAIL_TO_ROLE: Record<string, UserRole> = {
  'owner@opesfuel.com': 'OWNER',
  'manager@opesfuel.com': 'MANAGER',
  'attendant@opesfuel.com': 'ATTENDANT',
  'finance@opesfuel.com': 'ACCOUNTANT',
};

export const ClassicLoginPage: React.FC<ClassicLoginPageProps> = ({
  organizationName,
  stations,
  initialRole,
  initialStationId,
  onAuthenticated,
  onCreateWorkspace,
  onBackToSite,
}) => {
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState(ROLE_PROFILES[initialRole].email);
  const [password, setPassword] = useState('OpesFuel#2026');
  const [showPassword, setShowPassword] = useState(false);
  const [stationId, setStationId] = useState(initialStationId || stations[0]?.id || 'ALL');
  const [rememberTerminal, setRememberTerminal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  // SaaS Workspace Creation form
  const [orgName, setOrgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [stationCode, setStationCode] = useState('OPF-DLA-01');
  const [stationName, setStationName] = useState('');
  const [city, setCity] = useState('Douala');
  const [planId, setPlanId] = useState('starter');
  const [includeSampleData, setIncludeSampleData] = useState(false);

  const auth0Url = buildAuth0AuthorizeUrl();

  const handleRolePreset = (role: UserRole) => {
    setSelectedRole(role);
    setEmail(ROLE_PROFILES[role].email);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid operator email address.');
      return;
    }
    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    const resolvedRole = EMAIL_TO_ROLE[trimmedEmail] ?? selectedRole;
    onAuthenticated(resolvedRole, stationId);
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!orgName.trim() || !ownerName.trim() || !stationName.trim() || !city.trim()) {
      setError('Complete all organization, owner, and first petrol station fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) {
      setError('Enter a valid owner email address.');
      return;
    }
    const chosenPlan = SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? SUBSCRIPTION_PLANS[0];
    onCreateWorkspace({
      organizationName: orgName.trim(),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      stationCode: stationCode.trim() || 'OPF-01',
      stationName: stationName.trim(),
      city: city.trim(),
      planName: chosenPlan.name,
      monthlyFeeFcfa: chosenPlan.monthlyPriceFcfa,
      includeSampleData,
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Left Brand & Forecourt Visual Column */}
      <div className="lg:w-1/2 relative bg-slate-900 text-white flex flex-col justify-between min-h-[280px] lg:min-h-screen overflow-hidden">
        {!imgFailed ? (
          <img
            src={LOGIN_CANOPY_IMG}
            alt="OpesFuel branded petrol station canopy and digital price totem"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/55 to-slate-950/65" />

        <div className="relative z-10 p-6 sm:p-10 flex items-center justify-between">
          <OpesFuelLogo variant="light" size="lg" showSubline />
          <button
            type="button"
            onClick={onBackToSite}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900/70 hover:bg-slate-900 border border-slate-700 text-xs font-semibold text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Public Website
          </button>
        </div>

        <div className="relative z-10 p-6 sm:p-10 space-y-5 max-w-xl">
          <div className="text-xs font-mono text-amber-400">
            Multi-Tenant SaaS · {organizationName}
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
            Sign in or provision a clean petrol station SaaS tenant.
          </h1>
          <p className="text-sm text-slate-200 leading-relaxed">
            Protected by Auth0 RS256 role-based access control, Java 25 Spring Boot modular APIs,
            and integer FCFA PostgreSQL double-entry journals.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300 pt-2 border-t border-white/15">
            <span>SYSCOHADA &amp; IFRS Ready</span>
            <span aria-hidden="true">·</span>
            <span>Shift &amp; Dipstick Audit</span>
            <span aria-hidden="true">·</span>
            <span>Plans from 25 000 FCFA/mo</span>
          </div>
        </div>
      </div>

      {/* Right Classic Login & SaaS Provisioning Column */}
      <div className="lg:w-1/2 flex items-center justify-center p-5 sm:p-10 lg:p-14">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <OpesFuelLogo variant="dark" size="sm" showSubline />
            <span className="font-mono text-[11px] text-slate-500">Auth0 SSO</span>
          </div>
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setAuthTab('signin');
                setError(null);
              }}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                authTab === 'signin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" /> Operator Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('signup');
                setError(null);
              }}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                authTab === 'signup'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" /> New SaaS Tenant
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {authTab === 'signin' ? (
            <>
              <div className="space-y-1">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Sign in to {organizationName}
                </h2>
                <p className="text-xs text-slate-500">
                  Enter station credentials or switch an Auth0 RBAC profile below.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Operator Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@opesfuel.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="login-station" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Station Scope
                  </label>
                  <select
                    id="login-station"
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  >
                    <option value="ALL">All Network Stations ({stations.length})</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberTerminal}
                      onChange={(e) => setRememberTerminal(e.target.checked)}
                      className="rounded border-slate-300 accent-amber-600"
                    />
                    <span>Remember this station terminal</span>
                  </label>
                  <span className="text-xs font-mono text-slate-500">Auth0 RBAC</span>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                >
                  Sign In to Classic Dashboard
                </button>
              </form>

              {auth0Url && (
                <a
                  href={auth0Url}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Continue with Auth0 SSO
                </a>
              )}

              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <div className="text-xs font-semibold text-slate-700">
                  Instant Role Presets (Demo RBAC Profiles)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['OWNER', 'MANAGER', 'ATTENDANT', 'ACCOUNTANT'] as UserRole[]).map((r) => {
                    const active = selectedRole === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRolePreset(r)}
                        className={`p-2.5 rounded-lg border text-left transition-colors ${
                          active
                            ? 'border-amber-600 bg-amber-50/70 text-slate-900'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="font-mono text-[11px] font-bold text-amber-700">{r}</div>
                        <div className="text-xs font-medium truncate">{ROLE_PROFILES[r].name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Provision SaaS Organization
                </h2>
                <p className="text-xs text-slate-500">
                  Start clean with zero demo records or load sample Cameroon station operations.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Network Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Littoral Petroleum Group SA"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Marc Fonkou"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Email</label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="marc@littoral.cm"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={stationCode}
                    onChange={(e) => setStationCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Station Name</label>
                  <input
                    type="text"
                    value={stationName}
                    onChange={(e) => setStationName(e.target.value)}
                    placeholder="Station Akwa Nord"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SaaS Plan</label>
                  <select
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    {SUBSCRIPTION_PLANS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatFcfa(p.monthlyPriceFcfa)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={includeSampleData}
                  onChange={(e) => setIncludeSampleData(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 accent-amber-600"
                />
                <span>Pre-populate with sample pumps, tanks, shifts &amp; FCFA ledger entries</span>
              </label>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
              >
                Create Tenant Workspace &amp; Launch Console
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
