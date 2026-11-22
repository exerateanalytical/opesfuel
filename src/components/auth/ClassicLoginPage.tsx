import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../../api/opesfuelClient';
import { AuthSession, isAuth0Configured, ROLE_PROFILES, startAuth0Login } from '../../auth/auth0';
import { formatFcfa } from '../../domain/formatters';
import { Station, UserRole } from '../../domain/types';
import { OpesFuelLogo } from '../brand/OpesFuelLogo';
import { FormModal } from '../shared/FormModal';
import loginCanopyImgUrl from '../../assets/images/opesfuel_login_canopy_black_1795293396503.jpg';

interface ClassicLoginPageProps {
  organizationName: string;
  stations: Station[];
  initialRole: UserRole;
  initialStationId: string;
  authSession?: AuthSession | null;
  pendingInviteToken?: string | null;
  authError?: string | null;
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

const LOGIN_CANOPY_IMG = loginCanopyImgUrl;

function normalizePhone(input: string): string {
  return input.replace(/[\s\-().]/g, '');
}

function detectIdentifierType(raw: string): 'EMAIL' | 'PHONE' | 'MEMBER_ID' | 'UNKNOWN' {
  const val = raw.trim();
  if (!val) return 'UNKNOWN';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'EMAIL';
  if (/^\+?[0-9]{8,15}$/.test(normalizePhone(val))) return 'PHONE';
  if (/^[A-Za-z]{2,5}[-_]?[A-Za-z0-9]{2,12}(-[A-Za-z0-9]{2,8})?$/.test(val)) return 'MEMBER_ID';
  return 'UNKNOWN';
}

function resolveRoleFromIdentifier(raw: string): UserRole | null {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const upper = trimmed.toUpperCase();
  const phone = normalizePhone(trimmed);

  for (const role of Object.keys(ROLE_PROFILES) as UserRole[]) {
    const p = ROLE_PROFILES[role];
    if (
      p.email.toLowerCase() === lower ||
      p.memberId.toUpperCase() === upper ||
      normalizePhone(p.phone) === phone ||
      (phone.length >= 9 && normalizePhone(p.phone).endsWith(phone))
    ) {
      return role;
    }
  }

  // Fallback heuristics for custom company staff identifiers
  if (lower.includes('superadmin') || upper.startsWith('OPF-ADM')) return 'PLATFORM_ADMIN';
  if (lower.includes('owner') || upper.startsWith('OPF-OWN')) return 'OWNER';
  if (lower.includes('manager') || upper.startsWith('OPF-MGR')) return 'MANAGER';
  if (lower.includes('finance') || lower.includes('acct') || upper.startsWith('OPF-ACC')) return 'ACCOUNTANT';
  if (lower.includes('attendant') || lower.includes('cashier') || upper.startsWith('OPF-ATT')) return 'ATTENDANT';
  return null;
}

export const ClassicLoginPage: React.FC<ClassicLoginPageProps> = ({
  organizationName,
  stations,
  initialRole,
  initialStationId,
  authSession,
  pendingInviteToken,
  authError,
  onAuthenticated,
  onCreateWorkspace,
  onBackToSite,
}) => {
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [identifier, setIdentifier] = useState(authSession?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberTerminal, setRememberTerminal] = useState(true);
  const [error, setError] = useState<string | null>(authError ?? null);
  const [ssoBusy, setSsoBusy] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // SaaS Workspace Creation form
  const [orgName, setOrgName] = useState('');
  const [ownerName, setOwnerName] = useState(authSession?.userName || '');
  const [ownerEmail, setOwnerEmail] = useState(authSession?.email || '');
  const [ownerPhone, setOwnerPhone] = useState('+237 ');
  const [signupPassword, setSignupPassword] = useState('');
  const [stationCode, setStationCode] = useState('ST-01');
  const [stationName, setStationName] = useState('');
  const [city, setCity] = useState('Douala');
  const [planId, setPlanId] = useState('starter');
  const [includeSampleData, setIncludeSampleData] = useState(false);

  const detectedKind = useMemo(() => detectIdentifierType(identifier), [identifier]);

  const handleAuth0Redirect = async (screenHint: 'login' | 'signup') => {
    setError(null);
    setSsoBusy(true);
    try {
      const returnHash = pendingInviteToken
        ? `#/invite/${pendingInviteToken}`
        : screenHint === 'signup'
        ? '#/login'
        : '#/app/overview';
      await startAuth0Login({ screenHint, returnHash });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Auth0 PKCE sign-in.');
      setSsoBusy(false);
    }
  };

  const handleQuickFill = (role: UserRole, mode: 'email' | 'phone' | 'memberId') => {
    const profile = ROLE_PROFILES[role];
    setIdentifier(mode === 'email' ? profile.email : mode === 'phone' ? profile.phone : profile.memberId);
    setPassword('OpesFuel#2026');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const kind = detectIdentifierType(identifier);
    if (kind === 'UNKNOWN') {
      setError('Enter a valid Email address, Phone number (e.g. +237690000002), or Member ID (e.g. OPF-OWN-001).');
      return;
    }
    if (password.trim().length < 6) {
      setError('Enter your password (minimum 6 characters).');
      return;
    }
    const resolvedRole = resolveRoleFromIdentifier(identifier) ?? initialRole ?? 'OWNER';
    const targetStation =
      resolvedRole === 'PLATFORM_ADMIN' || resolvedRole === 'OWNER'
        ? 'ALL'
        : initialStationId && initialStationId !== 'ALL'
        ? initialStationId
        : stations[0]?.id || 'ALL';

    onAuthenticated(resolvedRole, targetStation);
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!orgName.trim() || !ownerName.trim() || !stationName.trim() || !city.trim()) {
      setError('Complete all company, owner, and first petrol station fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) {
      setError('Enter a valid owner email address.');
      return;
    }
    if (signupPassword.trim().length < 8) {
      setError('Create an owner password of at least 8 characters.');
      return;
    }
    const chosenPlan = SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? SUBSCRIPTION_PLANS[0];
    onCreateWorkspace({
      organizationName: orgName.trim(),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      stationCode: stationCode.trim() || 'ST-01',
      stationName: stationName.trim(),
      city: city.trim(),
      planName: chosenPlan.name,
      monthlyFeeFcfa: chosenPlan.monthlyPriceFcfa,
      includeSampleData,
    });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* Left Brand & Forecourt Visual Column */}
      <div className="lg:w-1/2 relative bg-slate-900 text-white flex flex-col justify-between min-h-[260px] lg:min-h-screen overflow-hidden">
        {!imgFailed ? (
          <img
            src={LOGIN_CANOPY_IMG}
            alt="OpesFuel petrol station canopy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/55 to-slate-950/65" />

        <div className="relative z-10 p-6 sm:p-10 flex items-center justify-between">
          <OpesFuelLogo variant="light" size="lg" showSubline />
          <button
            type="button"
            onClick={onBackToSite}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900/75 hover:bg-slate-900 border border-slate-700 text-xs font-semibold text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Public Website
          </button>
        </div>

        <div className="relative z-10 p-6 sm:p-10 space-y-4 max-w-xl">
          <div className="text-xs font-mono text-amber-400">
            Multi-Tenant Petrol Station OS · {organizationName}
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
            Sign in with your Email, Phone Number, or Member ID.
          </h1>
          <p className="text-sm text-slate-200 leading-relaxed">
            Strict role-based workspace routing for SaaS Platform Admins, Fuel Station Owners,
            Station Managers, Chief Accountants, and Forecourt Attendants.
          </p>
        </div>
      </div>

      {/* Right Clean Login & SaaS Provisioning Column */}
      <div className="lg:w-1/2 flex items-center justify-center p-5 sm:p-10 lg:p-14 bg-white">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <OpesFuelLogo variant="dark" size="sm" showSubline />
            <span className="font-mono text-[11px] text-slate-500">
              {isAuth0Configured ? 'Auth0 SSO' : 'RBAC Portal'}
            </span>
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
              <Lock className="w-3.5 h-3.5" /> Sign In
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
              <Building2 className="w-3.5 h-3.5" /> Register Company
            </button>
          </div>

          {pendingInviteToken && (
            <div className="p-3 rounded-lg bg-white border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Staff Invitation Ready</div>
                <div>
                  Sign in below to accept invitation <span className="font-mono">{pendingInviteToken.slice(0, 14)}…</span>.
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {authTab === 'signin' ? (
            <>
              <div className="space-y-1">
                <h2 className="font-display text-xl font-bold text-slate-900">Sign in to your account</h2>
                <p className="text-xs text-slate-500">
                  Use your company email, registered phone number, or staff Member ID.
                </p>
              </div>

              {isAuth0Configured && (
                <button
                  type="button"
                  disabled={ssoBusy}
                  onClick={() => void handleAuth0Redirect('login')}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  {ssoBusy ? 'Redirecting to Auth0…' : 'Continue with Auth0 SSO'}
                </button>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-identifier" className="block text-xs font-semibold text-slate-700">
                      Email, Phone Number, or Member ID
                    </label>
                    {detectedKind !== 'UNKNOWN' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold">
                        {detectedKind === 'EMAIL' && <Mail className="w-3 h-3" />}
                        {detectedKind === 'PHONE' && <Phone className="w-3 h-3" />}
                        {detectedKind === 'MEMBER_ID' && <Hash className="w-3 h-3" />}
                        {detectedKind.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <input
                    id="login-identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="owner@opesfuel.com · +237690000002 · OPF-OWN-001"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetIdentifier(identifier);
                        setResetSent(false);
                        setForgotOpen(true);
                      }}
                      className="text-xs font-semibold text-amber-700 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
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

                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberTerminal}
                    onChange={(e) => setRememberTerminal(e.target.checked)}
                    className="rounded border-slate-300 accent-amber-600"
                  />
                  <span>Keep me signed in on this terminal</span>
                </label>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                >
                  Sign In
                </button>
              </form>

              {/* Clean Collapsible Demo Access Directory (keeps login form uncluttered) */}
              {!isAuth0Configured && (
                <div className="pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowDemoAccounts((v) => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 py-1"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      Demo Workspace Credentials (5 RBAC Roles)
                    </span>
                    {showDemoAccounts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showDemoAccounts && (
                    <div className="mt-2.5 space-y-2">
                      {(['PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'ACCOUNTANT', 'ATTENDANT'] as UserRole[]).map((r) => {
                        const p = ROLE_PROFILES[r];
                        return (
                          <div
                            key={r}
                            className="p-2.5 rounded-lg border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="min-w-0">
                              <div className="font-mono font-bold text-slate-950">
                                {r === 'PLATFORM_ADMIN' ? 'SAAS PLATFORM ADMIN' : r}
                              </div>
                              <div className="text-slate-500 truncate">
                                {p.email} · {p.phone} · {p.memberId}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleQuickFill(r, 'email')}
                                className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
                              >
                                Email
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickFill(r, 'phone')}
                                className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
                              >
                                Phone
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickFill(r, 'memberId')}
                                className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
                              >
                                ID
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <h2 className="font-display text-xl font-bold text-slate-900">Register your fuel company</h2>
                <p className="text-xs text-slate-500">
                  Launch a dedicated multi-station workspace with your own company logo &amp; letterhead.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Legal Company Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Littoral Petroleum Group SA"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Full Name</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Jean-Paul Mbarga"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Phone</label>
                  <input
                    type="tel"
                    required
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="+237 690 00 00 00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Email</label>
                  <input
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@company.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password (min 8 chars)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Site Code</label>
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
                    required
                    value={stationName}
                    onChange={(e) => setStationName(e.target.value)}
                    placeholder="Bonanjo Flagship Station"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
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
                        {p.name} ({formatFcfa(p.monthlyPriceFcfa)}/mo)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={includeSampleData}
                  onChange={(e) => setIncludeSampleData(e.target.checked)}
                  className="rounded border-slate-300 accent-amber-600"
                />
                <span>Pre-populate with sample demo shifts &amp; tanks</span>
              </label>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
              >
                Create Company Workspace
              </button>
            </form>
          )}

          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <a href="#/fleet-portal" className="font-semibold text-slate-800 hover:text-amber-700 underline">
              Corporate Fleet Client Portal →
            </a>
            <a href="#/verify" className="font-semibold text-slate-800 hover:text-amber-700 underline">
              Verify License / Letterhead
            </a>
          </div>
        </div>
      </div>

      {/* Password & PIN Recovery Modal */}
      <FormModal
        open={forgotOpen}
        title="Reset Operator Password"
        subtitle="Enter your Email, Phone Number, or Member ID to receive a real 6-digit OTP via Email or SMS."
        onClose={() => setForgotOpen(false)}
      >
        {resetSent ? (
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 font-medium">
              Recovery OTP dispatched for <span className="font-mono font-bold">{resetIdentifier}</span>. Check your email or SMS inbox.
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!resetIdentifier.trim()) return;
              const apiBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/+$/, '');
              if (apiBase) {
                try {
                  await fetch(`${apiBase}/api/v1/public/auth/request-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      identifier: resetIdentifier.trim(),
                      channel: resetIdentifier.includes('@') ? 'EMAIL' : 'SMS',
                    }),
                  });
                } catch {
                  // handled gracefully
                }
              }
              setResetSent(true);
            }}
            className="space-y-4"
          >
            <div>
              <label className="opes-label">Email, Phone Number, or Member ID</label>
              <input
                required
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                placeholder="owner@company.com or +237690000002"
                className="opes-input text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#D97706] text-white text-xs font-semibold"
              >
                Send Reset Link / SMS OTP
              </button>
            </div>
          </form>
        )}
      </FormModal>
    </div>
  );
};
