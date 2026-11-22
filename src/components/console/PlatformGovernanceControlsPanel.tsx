import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Save,
  ShieldCheck,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Wrench,
} from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { formatFcfa } from '../../domain/formatters';

interface TenantFeatureRow {
  tenantId: string;
  tenantName: string;
  aiCopilotEnabled: boolean;
  hardwareBridgeEnabled: boolean;
  ocppEvEnabled: boolean;
  b2bWholesaleEnabled: boolean;
  franchiseModeEnabled: boolean;
  whiteLabelBrandingEnabled: boolean;
  customMonthlyOverrideFcfa: string;
}

interface PlatformGovernanceControlsPanelProps {
  engine: OpesFuelApiEngine;
  tenants: Array<Record<string, unknown>>;
  onPostBackend?: (path: string, method: 'POST' | 'PATCH' | 'PUT', body?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onEnterSupportView?: () => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const PlatformGovernanceControlsPanel: React.FC<PlatformGovernanceControlsPanelProps> = ({
  engine,
  tenants,
  onPostBackend,
  onEnterSupportView,
  onNotify,
}) => {
  // Global SaaS Platform Controls (hydrated from GET /api/v1/platform-admin/governance/settings)
  const [xafPerUsdRate, setXafPerUsdRate] = useState('605');
  const [defaultTrialDays, setDefaultTrialDays] = useState('14');
  const [gracePeriodDays, setGracePeriodDays] = useState('7');
  const [aiAddonMonthlyFcfa, setAiAddonMonthlyFcfa] = useState('30000');
  const [perpetualLicenseAnnualFcfa, setPerpetualLicenseAnnualFcfa] = useState('5000000');
  const [selfSignupEnabled, setSelfSignupEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceBanner, setMaintenanceBanner] = useState('');
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Per-Tenant Feature Flag Matrix (hydrated from GET /api/v1/platform-admin/governance/tenants/{id}/features)
  const [featureRows, setFeatureRows] = useState<TenantFeatureRow[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await engine.getPlatformGovernanceSettings();
        if (!active || !s) return;
        if (s.xafPerUsdRate != null) setXafPerUsdRate(String(s.xafPerUsdRate));
        if (s.defaultTrialDays != null) setDefaultTrialDays(String(s.defaultTrialDays));
        if (s.gracePeriodDays != null) setGracePeriodDays(String(s.gracePeriodDays));
        if (s.aiAddonMonthlyFcfa != null) setAiAddonMonthlyFcfa(String(s.aiAddonMonthlyFcfa));
        if (s.perpetualLicenseAnnualFcfa != null) setPerpetualLicenseAnnualFcfa(String(s.perpetualLicenseAnnualFcfa));
        if (s.selfSignupEnabled != null) setSelfSignupEnabled(Boolean(s.selfSignupEnabled));
        if (s.maintenanceMode != null) setMaintenanceMode(Boolean(s.maintenanceMode));
        if (s.maintenanceBanner != null) setMaintenanceBanner(String(s.maintenanceBanner));
        setHydrated(true);
      } catch {
        // Keep safe defaults
      }
    })();
    return () => {
      active = false;
    };
  }, [engine]);

  useEffect(() => {
    let active = true;
    const source =
      tenants.length > 0
        ? tenants
        : [
            { id: 'ten_opes_cm', name: 'OpesFuel Cameroon Flagship' },
            { id: 'ten_littoral', name: 'Littoral Energy Stations SARL' },
          ];
    (async () => {
      const loaded = await Promise.all(
        source.map(async (t) => {
          const tid = String(t.id ?? 'ten_default');
          const tname = String(t.name ?? 'Customer Organization');
          try {
            const flags = await engine.getPlatformTenantFeatures(tid);
            return {
              tenantId: tid,
              tenantName: tname,
              aiCopilotEnabled: flags.aiCopilotEnabled !== false,
              hardwareBridgeEnabled: flags.hardwareBridgeEnabled !== false,
              ocppEvEnabled: flags.ocppEvEnabled !== false,
              b2bWholesaleEnabled: flags.b2bWholesaleEnabled !== false,
              franchiseModeEnabled: Boolean(flags.franchiseModeEnabled),
              whiteLabelBrandingEnabled: flags.whiteLabelBrandingEnabled !== false,
              customMonthlyOverrideFcfa: flags.customMonthlyOverrideFcfa != null ? String(flags.customMonthlyOverrideFcfa) : '',
            };
          } catch {
            return {
              tenantId: tid,
              tenantName: tname,
              aiCopilotEnabled: true,
              hardwareBridgeEnabled: true,
              ocppEvEnabled: true,
              b2bWholesaleEnabled: true,
              franchiseModeEnabled: false,
              whiteLabelBrandingEnabled: true,
              customMonthlyOverrideFcfa: '',
            };
          }
        })
      );
      if (active) setFeatureRows(loaded);
    })();
    return () => {
      active = false;
    };
  }, [engine, tenants]);

  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGlobal(true);
    try {
      const payload = {
        xafPerUsdRate: Math.max(1, Number(xafPerUsdRate) || 605),
        defaultTrialDays: Math.max(0, Number(defaultTrialDays) || 14),
        gracePeriodDays: Math.max(0, Number(gracePeriodDays) || 7),
        selfSignupEnabled,
        maintenanceMode,
        maintenanceBanner: maintenanceBanner.trim(),
        aiAddonMonthlyFcfa: Math.max(0, Number(aiAddonMonthlyFcfa) || 30000),
        perpetualLicenseAnnualFcfa: Math.max(0, Number(perpetualLicenseAnnualFcfa) || 5000000),
      };
      await engine.updatePlatformGovernanceSettings(payload);
      onNotify(
        'success',
        `Saved global SaaS platform settings (FX: 1 USD = ${payload.xafPerUsdRate} XAF · AI Add-on: ${formatFcfa(payload.aiAddonMonthlyFcfa)}/mo · Self-Signup: ${selfSignupEnabled ? 'ON' : 'PAUSED'}).`
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save global settings.');
    } finally {
      setSavingGlobal(false);
    }
  };

  const toggleFlag = (tenantId: string, key: keyof Omit<TenantFeatureRow, 'tenantId' | 'tenantName' | 'customMonthlyOverrideFcfa'>) => {
    setFeatureRows((prev) =>
      prev.map((row) => (row.tenantId === tenantId ? { ...row, [key]: !row[key] } : row))
    );
  };

  const handleSaveTenantFeatures = async (row: TenantFeatureRow) => {
    const customOverride = row.customMonthlyOverrideFcfa.trim() ? Number(row.customMonthlyOverrideFcfa) : null;
    if (onPostBackend) {
      await onPostBackend(
        `/api/v1/platform-admin/governance/tenants/${encodeURIComponent(row.tenantId)}/features`,
        'PATCH',
        {
          aiCopilotEnabled: row.aiCopilotEnabled,
          hardwareBridgeEnabled: row.hardwareBridgeEnabled,
          ocppEvEnabled: row.ocppEvEnabled,
          b2bWholesaleEnabled: row.b2bWholesaleEnabled,
          franchiseModeEnabled: row.franchiseModeEnabled,
          whiteLabelBrandingEnabled: row.whiteLabelBrandingEnabled,
          customMonthlyOverrideFcfa: customOverride,
        }
      );
    }
    onNotify(
      'success',
      `Updated module entitlements & custom price override for ${row.tenantName}${hydrated ? ' (synced to backend)' : ''}.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Global FX, Pricing, Trials, Self-Signup & Maintenance Mode */}
      <form onSubmit={(e) => void handleSaveGlobalSettings(e)} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-slate-950" />
              <h3 className="font-display text-lg font-bold text-slate-950">
                Global SaaS Platform Governance, Pricing &amp; Kill-Switches
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Control international USD/XAF conversion rates, AI Copilot &amp; Perpetual License pricing, default trials, grace lockouts, public self-signup, and global maintenance banners.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onEnterSupportView && (
              <button
                type="button"
                onClick={onEnterSupportView}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-900"
              >
                <Wrench className="w-3.5 h-3.5" /> Enter Tenant Support View
              </button>
            )}
            <button
              type="submit"
              disabled={savingGlobal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" /> {savingGlobal ? 'Saving...' : 'Save Global Settings'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="opes-label">FX Rate (XAF per 1 USD)</label>
            <input
              type="number"
              step="0.5"
              min={100}
              required
              value={xafPerUsdRate}
              onChange={(e) => setXafPerUsdRate(e.target.value)}
              className="opes-input font-mono text-xs"
            />
          </div>
          <div>
            <label className="opes-label">Default Free Trial (Days)</label>
            <input
              type="number"
              min={0}
              max={90}
              required
              value={defaultTrialDays}
              onChange={(e) => setDefaultTrialDays(e.target.value)}
              className="opes-input font-mono text-xs"
            />
          </div>
          <div>
            <label className="opes-label">Overdue Grace Period (Days)</label>
            <input
              type="number"
              min={0}
              max={60}
              required
              value={gracePeriodDays}
              onChange={(e) => setGracePeriodDays(e.target.value)}
              className="opes-input font-mono text-xs"
            />
          </div>
          <div>
            <label className="opes-label">AI Copilot Add-On (FCFA/mo)</label>
            <input
              type="number"
              min={0}
              required
              value={aiAddonMonthlyFcfa}
              onChange={(e) => setAiAddonMonthlyFcfa(e.target.value)}
              className="opes-input font-mono text-xs"
            />
          </div>
          <div>
            <label className="opes-label">Perpetual License (FCFA/yr)</label>
            <input
              type="number"
              min={0}
              required
              value={perpetualLicenseAnnualFcfa}
              onChange={(e) => setPerpetualLicenseAnnualFcfa(e.target.value)}
              className="opes-input font-mono text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-lg border border-slate-200 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-950">
                <Globe className="w-4 h-4 text-emerald-700" /> Public Self-Serve Company Registration
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Allow new fuel station companies to self-register workspaces from the public login page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelfSignupEnabled((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                selfSignupEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {selfSignupEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {selfSignupEnabled ? 'ENABLED' : 'PAUSED'}
            </button>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-950">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Platform Maintenance Mode Banner
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Display a scheduled maintenance notice across all tenant dashboards.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMaintenanceMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                maintenanceMode
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {maintenanceMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {maintenanceMode ? 'ACTIVE' : 'OFF'}
            </button>
          </div>
        </div>

        {maintenanceMode && (
          <div>
            <label className="opes-label">Global Maintenance Notice Banner Message</label>
            <input
              value={maintenanceBanner}
              onChange={(e) => setMaintenanceBanner(e.target.value)}
              placeholder="Scheduled PostgreSQL upgrade Sunday 02:00-02:30 UTC — zero forecourt downtime expected."
              className="opes-input text-xs"
            />
          </div>
        )}
      </form>

      {/* Per-Tenant Feature Flags & Custom Price Overrides */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-slate-950" />
          <div>
            <h3 className="font-display text-base font-bold text-slate-950">
              Per-Tenant Module Entitlements &amp; Custom Contract Price Overrides
            </h3>
            <p className="text-xs text-slate-500">
              Enable or restrict individual enterprise modules and set negotiated custom monthly contract fees per fuel company.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0F172A] text-white font-mono text-[10px] uppercase">
                <th className="py-2.5 px-3">Tenant Company</th>
                <th className="py-2.5 px-2 text-center">AI Copilot</th>
                <th className="py-2.5 px-2 text-center">Hardware Bridge</th>
                <th className="py-2.5 px-2 text-center">OCPP EV</th>
                <th className="py-2.5 px-2 text-center">B2B Bulk</th>
                <th className="py-2.5 px-2 text-center">Franchise</th>
                <th className="py-2.5 px-2 text-center">White-Label</th>
                <th className="py-2.5 px-3">Custom Price (FCFA)</th>
                <th className="py-2.5 px-3 text-right">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {featureRows.map((row) => (
                <tr key={row.tenantId} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-950">{row.tenantName}</div>
                    <div className="font-mono text-[10px] text-slate-500">{row.tenantId}</div>
                  </td>
                  {(
                    [
                      'aiCopilotEnabled',
                      'hardwareBridgeEnabled',
                      'ocppEvEnabled',
                      'b2bWholesaleEnabled',
                      'franchiseModeEnabled',
                      'whiteLabelBrandingEnabled',
                    ] as const
                  ).map((flagKey) => (
                    <td key={flagKey} className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleFlag(row.tenantId, flagKey)}
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                          row[flagKey]
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        {row[flagKey] ? 'ON' : 'OFF'}
                      </button>
                    </td>
                  ))}
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min={0}
                      placeholder="Standard plan"
                      value={row.customMonthlyOverrideFcfa}
                      onChange={(e) =>
                        setFeatureRows((prev) =>
                          prev.map((r) =>
                            r.tenantId === row.tenantId ? { ...r, customMonthlyOverrideFcfa: e.target.value } : r
                          )
                        )
                      }
                      className="w-28 px-2 py-1 rounded border border-slate-300 font-mono text-xs"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleSaveTenantFeatures(row)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-semibold"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Apply
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
