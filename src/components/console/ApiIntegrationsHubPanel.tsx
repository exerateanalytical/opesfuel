import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Mail,
  MessageCircle,
  Plug,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { getStoredAuthSession } from '../../auth/auth0';
import { UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

type ProviderKey = 'MTN_MOMO' | 'ORANGE_MONEY' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'GEMINI_AI';

interface ConnectorState {
  providerKey: ProviderKey;
  configured: boolean;
  enabled: boolean;
  config: Record<string, string>;
  secretPresent: Record<string, boolean>;
  lastTestStatus: 'CONNECTED' | 'FAILED' | 'UNVERIFIED';
  lastTestMessage: string | null;
  lastTestedAt: string | null;
}

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  type?: 'text' | 'password' | 'select';
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
  hint?: string;
}

interface ProviderMeta {
  key: ProviderKey;
  title: string;
  subtitle: string;
  category: 'PAYMENT' | 'MESSAGING' | 'AI';
  icon: React.ComponentType<{ className?: string }>;
  webhookPath?: string;
  supportsTestRecipient?: boolean;
  testRecipientPlaceholder?: string;
  fields: FieldDef[];
}

const PROVIDERS: ProviderMeta[] = [
  {
    key: 'MTN_MOMO',
    title: 'MTN MoMo Cameroon',
    subtitle: 'Collections (Request-to-Pay USSD) & Disbursements (Refunds)',
    category: 'PAYMENT',
    icon: Smartphone,
    webhookPath: '/api/v1/public/webhooks/momo/mtn',
    fields: [
      {
        key: 'targetEnvironment',
        label: 'Target Environment',
        type: 'select',
        defaultValue: 'mtncameroon',
        options: [
          { value: 'mtncameroon', label: 'Production — mtncameroon (XAF)' },
          { value: 'sandbox', label: 'Sandbox Testing — sandbox (EUR)' },
        ],
      },
      {
        key: 'baseUrl',
        label: 'MTN MoMo API Base URL',
        defaultValue: 'https://proxy.momoapi.mtn.com',
        placeholder: 'https://proxy.momoapi.mtn.com or https://sandbox.momodeveloper.mtn.com',
      },
      { key: 'apiUser', label: 'API User (UUID)', placeholder: 'e.g. 9f2c1b4e-...' },
      { key: 'apiKey', label: 'API Key', secret: true, placeholder: 'MTN MoMo API Key' },
      { key: 'collectionSubscriptionKey', label: 'Collections Subscription Key (Ocp-Apim)', secret: true, placeholder: 'Primary Collections Key' },
      { key: 'disbursementSubscriptionKey', label: 'Disbursements Subscription Key (Optional for Refunds)', secret: true, placeholder: 'Primary Disbursements Key' },
      { key: 'callbackUrl', label: 'Callback Webhook URL (Host must match MTN Partner Portal)', placeholder: 'https://api.yourdomain.com/api/v1/public/webhooks/momo/mtn' },
    ],
  },
  {
    key: 'ORANGE_MONEY',
    title: 'Orange Money Cameroon WebPay',
    subtitle: 'WebPay API v1 (OAuth v3 + Payment Redirect + notif_token Webhook)',
    category: 'PAYMENT',
    icon: Smartphone,
    webhookPath: '/api/v1/public/webhooks/momo/orange',
    fields: [
      {
        key: 'environment',
        label: 'Environment',
        type: 'select',
        defaultValue: 'prod',
        options: [
          { value: 'prod', label: 'Production Cameroon — cm (XAF)' },
          { value: 'dev', label: 'Developer Sandbox — dev (OUV)' },
        ],
      },
      { key: 'baseUrl', label: 'Orange API Base URL', defaultValue: 'https://api.orange.com' },
      { key: 'clientId', label: 'OAuth Client ID', placeholder: 'From developer.orange.com' },
      { key: 'clientSecret', label: 'OAuth Client Secret', secret: true, placeholder: 'From developer.orange.com' },
      { key: 'merchantKey', label: 'Merchant Key', secret: true, placeholder: 'Orange Money CM Merchant Key' },
      { key: 'returnUrl', label: 'Customer Return URL', placeholder: 'https://app.yourdomain.com/app/admin' },
      { key: 'cancelUrl', label: 'Customer Cancel URL', placeholder: 'https://app.yourdomain.com/app/admin' },
      { key: 'notifUrl', label: 'Server-to-Server Notification URL', placeholder: 'https://api.yourdomain.com/api/v1/public/webhooks/momo/orange' },
    ],
  },
  {
    key: 'EMAIL',
    title: 'Transactional Email (SMTP / Resend)',
    subtitle: 'Password-reset OTPs, staff invites, SaaS invoices & fleet portal invites',
    category: 'MESSAGING',
    icon: Mail,
    supportsTestRecipient: true,
    testRecipientPlaceholder: 'test@yourcompany.com',
    fields: [
      {
        key: 'provider',
        label: 'Email Provider',
        type: 'select',
        defaultValue: 'SMTP',
        options: [
          { value: 'SMTP', label: 'SMTP Server (STARTTLS 587 / SMTPS 465)' },
          { value: 'RESEND', label: 'Resend HTTP API (api.resend.com)' },
          { value: 'LOG_ONLY', label: 'LOG_ONLY (Dev fallback)' },
        ],
      },
      { key: 'from', label: 'From Email Address', defaultValue: 'noreply@opesfuel.com', placeholder: 'noreply@yourdomain.com' },
      { key: 'apiKey', label: 'Resend API Key (if using RESEND)', secret: true, placeholder: 're_xxxxxxxx' },
      { key: 'smtpHost', label: 'SMTP Host (if using SMTP)', placeholder: 'smtp.mailgun.org / smtp.gmail.com' },
      { key: 'smtpPort', label: 'SMTP Port', defaultValue: '587', placeholder: '587 or 465' },
      { key: 'smtpUsername', label: 'SMTP Username', placeholder: 'SMTP login' },
      { key: 'smtpPassword', label: 'SMTP Password', secret: true, placeholder: 'SMTP password / app token' },
      {
        key: 'smtpStartTls',
        label: 'Enable STARTTLS',
        type: 'select',
        defaultValue: 'true',
        options: [
          { value: 'true', label: 'Yes (Port 587 STARTTLS)' },
          { value: 'false', label: 'No' },
        ],
      },
    ],
  },
  {
    key: 'SMS',
    title: 'SMS Gateway (Africa’s Talking / Twilio)',
    subtitle: 'SMS OTP codes, shift alerts & digital fuel receipts for feature phones',
    category: 'MESSAGING',
    icon: KeyRound,
    supportsTestRecipient: true,
    testRecipientPlaceholder: '+237677112233',
    fields: [
      {
        key: 'provider',
        label: 'SMS Provider',
        type: 'select',
        defaultValue: 'AFRICAS_TALKING',
        options: [
          { value: 'AFRICAS_TALKING', label: "Africa's Talking (Recommended for Cameroon)" },
          { value: 'TWILIO', label: 'Twilio Programmable SMS' },
          { value: 'LOG_ONLY', label: 'LOG_ONLY (Dev fallback)' },
        ],
      },
      { key: 'atUsername', label: "Africa's Talking Username", placeholder: 'e.g. opesfuel or sandbox' },
      { key: 'atApiKey', label: "Africa's Talking API Key", secret: true, placeholder: 'atsk_xxxxxxxx' },
      { key: 'atFrom', label: "Africa's Talking Sender ID", defaultValue: 'OPESFUEL', placeholder: 'OPESFUEL' },
      { key: 'twilioAccountSid', label: 'Twilio Account SID (if Twilio)', placeholder: 'ACxxxxxxxx' },
      { key: 'twilioAuthToken', label: 'Twilio Auth Token (if Twilio)', secret: true, placeholder: 'Twilio Auth Token' },
      { key: 'twilioFrom', label: 'Twilio From Number (if Twilio)', placeholder: '+1...' },
    ],
  },
  {
    key: 'WHATSAPP',
    title: 'WhatsApp Business (Meta Cloud API)',
    subtitle: 'Instant digital fuel receipts, loyalty balances & manager alerts',
    category: 'MESSAGING',
    icon: MessageCircle,
    supportsTestRecipient: true,
    testRecipientPlaceholder: '+237699112233',
    fields: [
      {
        key: 'provider',
        label: 'WhatsApp Mode',
        type: 'select',
        defaultValue: 'META_CLOUD',
        options: [
          { value: 'META_CLOUD', label: 'Meta WhatsApp Cloud API (v20.0)' },
          { value: 'LOG_ONLY', label: 'LOG_ONLY (Dev fallback)' },
        ],
      },
      { key: 'phoneNumberId', label: 'Meta Phone Number ID', placeholder: 'e.g. 109988776655' },
      { key: 'accessToken', label: 'Meta Permanent System Access Token', secret: true, placeholder: 'EAAG...' },
    ],
  },
  {
    key: 'GEMINI_AI',
    title: 'Google Gemini AI Copilot',
    subtitle: 'Powers executive revenue forecasting, anomaly & wet-stock AI advisor',
    category: 'AI',
    icon: Sparkles,
    fields: [
      {
        key: 'model',
        label: 'Gemini Model',
        type: 'select',
        defaultValue: 'gemini-2.5-flash',
        options: [
          { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Fast & Cost-Optimal)' },
          { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (Deep Financial Reasoning)' },
        ],
      },
      { key: 'geminiApiKey', label: 'Google Gemini API Key', secret: true, placeholder: 'AIza...' },
    ],
  },
];

interface ApiIntegrationsHubPanelProps {
  role: UserRole;
  scope: 'GLOBAL' | 'TENANT';
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const LOCAL_STORAGE_KEY = (scope: string) => `opesfuel.integrations.${scope.toLowerCase()}.v1`;

export const ApiIntegrationsHubPanel: React.FC<ApiIntegrationsHubPanelProps> = ({
  role,
  scope,
  onNotify,
}) => {
  const canEdit = scope === 'GLOBAL' ? role === 'PLATFORM_ADMIN' : role === 'OWNER' || role === 'PLATFORM_ADMIN';
  const apiBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/+$/, '');

  const buildAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const session = getStoredAuthSession();
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    return headers;
  }, []);

  const [connectors, setConnectors] = useState<Record<ProviderKey, ConnectorState>>(() => {
    const initial = {} as Record<ProviderKey, ConnectorState>;
    let cached: Record<string, ConnectorState> = {};
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY(scope));
      if (raw) cached = JSON.parse(raw) as Record<string, ConnectorState>;
    } catch {
      // ignore
    }
    for (const p of PROVIDERS) {
      initial[p.key] = cached[p.key] ?? {
        providerKey: p.key,
        configured: false,
        enabled: false,
        config: {},
        secretPresent: {},
        lastTestStatus: 'UNVERIFIED',
        lastTestMessage: null,
        lastTestedAt: null,
      };
    }
    return initial;
  });

  const [loading, setLoading] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderMeta | null>(null);
  const [draftConfig, setDraftConfig] = useState<Record<string, string>>({});
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingKey, setTestingKey] = useState<ProviderKey | null>(null);
  const [testRecipient, setTestRecipient] = useState('');

  const loadConnectors = useCallback(async () => {
    if (!apiBase) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/integrations/connectors?scope=${scope}`, {
        headers: buildAuthHeaders(),
      });
      if (!res.ok) return;
      const list = (await res.json()) as ConnectorState[];
      setConnectors((prev) => {
        const next = { ...prev };
        for (const item of list) {
          if (item.providerKey) next[item.providerKey] = item;
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [apiBase, scope, buildAuthHeaders]);

  useEffect(() => {
    void loadConnectors();
  }, [loadConnectors]);

  const openEditor = (meta: ProviderMeta) => {
    const current = connectors[meta.key];
    const defaults: Record<string, string> = {};
    for (const f of meta.fields) {
      const existingVal = current?.config?.[f.key];
      if (f.secret) {
        defaults[f.key] = ''; // Leave blank on open so existing encrypted secret is preserved unless overwritten
      } else if (existingVal) {
        defaults[f.key] = existingVal;
      } else if (f.key === 'callbackUrl' || f.key === 'notifUrl') {
        defaults[f.key] = `${apiBase || window.location.origin}${meta.webhookPath || ''}`;
      } else if (f.key === 'returnUrl' || f.key === 'cancelUrl') {
        defaults[f.key] = `${window.location.origin}/app/admin`;
      } else {
        defaults[f.key] = f.defaultValue ?? '';
      }
    }
    setDraftConfig(defaults);
    setDraftEnabled(current?.configured ? current.enabled : true);
    setEditingProvider(meta);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;
    setSaving(true);
    try {
      if (apiBase) {
        const res = await fetch(
          `${apiBase}/api/v1/integrations/connectors/${encodeURIComponent(editingProvider.key)}`,
          {
            method: 'PUT',
            headers: buildAuthHeaders(),
            body: JSON.stringify({ scope, enabled: draftEnabled, config: draftConfig }),
          }
        );
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) throw new Error(String(data.detail || data.message || `Save failed (HTTP ${res.status})`));
        await loadConnectors();
        onNotify(
          'success',
          `${editingProvider.title} credentials saved with AES-256-GCM encryption${data.hotReloaded ? ' and hot-reloaded live' : ''}.`
        );
      } else {
        // Local preview persistence (masks secrets)
        const masked: Record<string, string> = {};
        const secrets: Record<string, boolean> = { ...(connectors[editingProvider.key]?.secretPresent ?? {}) };
        for (const f of editingProvider.fields) {
          const val = (draftConfig[f.key] || '').trim();
          if (f.secret) {
            if (val) {
              secrets[f.key] = true;
              masked[f.key] = val.length > 4 ? `••••${val.slice(-4)}` : '••••';
            } else if (connectors[editingProvider.key]?.config?.[f.key]) {
              masked[f.key] = connectors[editingProvider.key].config[f.key];
            }
          } else {
            masked[f.key] = val;
          }
        }
        setConnectors((prev) => {
          const next = {
            ...prev,
            [editingProvider.key]: {
              providerKey: editingProvider.key,
              configured: true,
              enabled: draftEnabled,
              config: masked,
              secretPresent: secrets,
              lastTestStatus: 'UNVERIFIED' as const,
              lastTestMessage: 'Saved in browser preview. Connect backend API (VITE_API_BASE_URL) for AES-256-GCM server storage.',
              lastTestedAt: null,
            },
          };
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY(scope), JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        onNotify('success', `Saved ${editingProvider.title} configuration.`);
      }
      setEditingProvider(null);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save connector credentials.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (meta: ProviderMeta) => {
    setTestingKey(meta.key);
    try {
      if (!apiBase) {
        onNotify(
          'error',
          `Live ${meta.title} handshake requires the deployed Spring Boot backend (VITE_API_BASE_URL).`
        );
        return;
      }
      const res = await fetch(`${apiBase}/api/v1/integrations/connectors/${encodeURIComponent(meta.key)}/test`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({ scope, testRecipient: testRecipient.trim() || null }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data.detail || data.message || `Test failed (HTTP ${res.status})`));
      await loadConnectors();
      const ok = String(data.status) === 'CONNECTED';
      onNotify(ok ? 'success' : 'error', `${meta.title}: ${String(data.message || data.status)}`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Connection test failed.');
    } finally {
      setTestingKey(null);
    }
  };

  const handleDisconnect = async (meta: ProviderMeta) => {
    if (!window.confirm(`Disconnect and wipe saved encrypted credentials for ${meta.title}?`)) return;
    try {
      if (apiBase) {
        const res = await fetch(
          `${apiBase}/api/v1/integrations/connectors/${encodeURIComponent(meta.key)}?scope=${scope}`,
          { method: 'DELETE', headers: buildAuthHeaders() }
        );
        if (!res.ok) throw new Error(`Disconnect failed (HTTP ${res.status})`);
        await loadConnectors();
      } else {
        setConnectors((prev) => {
          const next = {
            ...prev,
            [meta.key]: {
              providerKey: meta.key,
              configured: false,
              enabled: false,
              config: {},
              secretPresent: {},
              lastTestStatus: 'UNVERIFIED' as const,
              lastTestMessage: null,
              lastTestedAt: null,
            },
          };
          localStorage.setItem(LOCAL_STORAGE_KEY(scope), JSON.stringify(next));
          return next;
        });
      }
      onNotify('success', `Disconnected ${meta.title}.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to disconnect.');
    }
  };

  const copyWebhook = (path: string) => {
    const full = `${apiBase || window.location.origin}${path}`;
    void navigator.clipboard?.writeText(full);
    onNotify('success', `Copied webhook URL: ${full}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <Plug className="w-5 h-5 text-amber-600" />
            {scope === 'GLOBAL'
              ? 'Platform API & Payment Gateway Connectors (Global SaaS)'
              : 'Company API & Payment Gateway Connectors'}
          </h3>
          <p className="text-xs text-slate-500 max-w-2xl">
            Connect MTN MoMo Cameroon, Orange Money Cameroon WebPay, SMTP/Resend Email, Africa&apos;s Talking/Twilio SMS, Meta WhatsApp Cloud API, and Gemini AI directly from the Admin Panel. Secrets are encrypted at rest with <span className="font-mono font-semibold text-slate-700">AES-256-GCM</span> and hot-reloaded live without server restarts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadConnectors()}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Status
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PROVIDERS.map((meta) => {
          const st = connectors[meta.key];
          const Icon = meta.icon;
          const statusBadge = !st?.configured
            ? { text: 'NOT CONFIGURED', cls: 'bg-slate-100 text-slate-700 border-slate-200' }
            : st.lastTestStatus === 'CONNECTED'
            ? { text: 'CONNECTED · VERIFIED', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
            : st.lastTestStatus === 'FAILED'
            ? { text: 'CONNECTION FAILED', cls: 'bg-red-50 text-red-800 border-red-200' }
            : { text: 'SAVED · ENCRYPTED', cls: 'bg-amber-50 text-amber-900 border-amber-200' };

          return (
            <div key={meta.key} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-display text-sm font-bold text-slate-900">{meta.title}</div>
                      <div className="text-xs text-slate-500">{meta.subtitle}</div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded border font-mono text-[10px] font-bold whitespace-nowrap ${statusBadge.cls}`}>
                    {statusBadge.text}
                  </span>
                </div>

                {meta.webhookPath && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-[11px]">
                    <div className="truncate font-mono text-slate-700">
                      Webhook: {apiBase || window.location.origin}{meta.webhookPath}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyWebhook(meta.webhookPath!)}
                      className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold inline-flex items-center gap-1 shrink-0"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                )}

                {st?.configured && (
                  <div className="text-[11px] font-mono text-slate-600 space-y-1 bg-slate-50 border border-slate-100 rounded-lg p-3">
                    {Object.entries(st.config).slice(0, 4).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 truncate">
                        <span className="text-slate-500">{k}:</span>
                        <span className="text-slate-900 font-semibold truncate">{v || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {st?.lastTestMessage && (
                  <div
                    className={`text-[11px] p-2.5 rounded-lg border flex items-start gap-2 ${
                      st.lastTestStatus === 'CONNECTED'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : st.lastTestStatus === 'FAILED'
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {st.lastTestStatus === 'CONNECTED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    ) : st.lastTestStatus === 'FAILED' ? (
                      <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    )}
                    <span>{st.lastTestMessage}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openEditor(meta)}
                      className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                    >
                      {st?.configured ? 'Edit API Credentials' : 'Connect API'}
                    </button>
                  )}
                  {st?.configured && canEdit && (
                    <button
                      type="button"
                      disabled={testingKey === meta.key}
                      onClick={() => void handleTest(meta)}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                    >
                      {testingKey === meta.key ? 'Testing…' : 'Test Connection'}
                    </button>
                  )}
                </div>
                {st?.configured && canEdit && (
                  <button
                    type="button"
                    onClick={() => void handleDisconnect(meta)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title={`Disconnect ${meta.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Configure Connector Popup Modal */}
      <FormModal
        open={Boolean(editingProvider)}
        onClose={() => setEditingProvider(null)}
        title={editingProvider ? `Connect ${editingProvider.title}` : 'Connect API'}
        subtitle="Secrets are encrypted with AES-256-GCM before storage. Leave any secret field blank to keep the previously saved value."
      >
        {editingProvider && (
          <form onSubmit={(e) => void handleSave(e)} className="space-y-3.5">
            {editingProvider.fields.map((f) => {
              const hasExistingSecret = Boolean(connectors[editingProvider.key]?.secretPresent?.[f.key]);
              return (
                <div key={f.key}>
                  <label className="opes-label flex items-center justify-between">
                    <span>{f.label}</span>
                    {f.secret && hasExistingSecret && (
                      <span className="font-mono text-[10px] text-emerald-700">
                        Saved ({connectors[editingProvider.key]?.config?.[f.key]}) — leave blank to keep
                      </span>
                    )}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      value={draftConfig[f.key] ?? f.defaultValue ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftConfig((prev) => {
                          const next = { ...prev, [f.key]: val };
                          if (editingProvider.key === 'MTN_MOMO' && f.key === 'targetEnvironment') {
                            next.baseUrl =
                              val === 'sandbox'
                                ? 'https://sandbox.momodeveloper.mtn.com'
                                : 'https://proxy.momoapi.mtn.com';
                          }
                          return next;
                        });
                      }}
                      className="opes-input text-xs bg-white"
                    >
                      {(f.options ?? []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.secret ? 'password' : 'text'}
                      value={draftConfig[f.key] ?? ''}
                      onChange={(e) => setDraftConfig((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.secret && hasExistingSecret ? '•••••••• (unchanged)' : f.placeholder}
                      className="opes-input text-xs font-mono"
                    />
                  )}
                </div>
              );
            })}

            {editingProvider.supportsTestRecipient && (
              <div className="pt-2 border-t border-slate-100">
                <label className="opes-label">Optional Test Recipient (used when clicking Test Connection)</label>
                <input
                  type="text"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder={editingProvider.testRecipientPlaceholder}
                  className="opes-input text-xs font-mono"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-700 pt-1">
              <input
                type="checkbox"
                checked={draftEnabled}
                onChange={(e) => setDraftEnabled(e.target.checked)}
                className="rounded border-slate-300 accent-amber-600"
              />
              <span>Enable this API connector immediately upon save (live hot-reload)</span>
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingProvider(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {saving ? 'Encrypting & Saving…' : 'Save & Activate Connector'}
              </button>
            </div>
          </form>
        )}
      </FormModal>
    </div>
  );
};
