import React, { useState } from 'react';
import { Check, Copy, History, KeyRound, Pause, Play, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { formatShortDate } from '../../domain/formatters';
import { ApiKeyRecord, DomainEventLog, WebhookSubscription } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

interface ApiPlatformSectionProps {
  engine: OpesFuelApiEngine;
  events: DomainEventLog[];
  apiKeys: ApiKeyRecord[];
  webhooks: WebhookSubscription[];
  onCreateApiKey: (label: string, scopes: string[]) => void;
  onRevokeApiKey: (keyId: string) => void;
  onCreateWebhook: (targetUrl: string, subscribedEvents: string[]) => void;
  onToggleWebhook: (webhookId: string) => void;
  onDeleteWebhook: (webhookId: string) => void;
  onExecuteApiQuery: (endpoint: string) => unknown;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const TEST_ENDPOINTS = [
  { label: 'GET /api/v1/stations', path: '/api/v1/stations' },
  { label: 'GET /api/v1/forecourt/pumps', path: '/api/v1/forecourt/pumps' },
  { label: 'GET /api/v1/inventory/tanks', path: '/api/v1/inventory/tanks' },
  { label: 'GET /api/v1/accounting/reports', path: '/api/v1/accounting/reports' },
  { label: 'GET /api/v1/billing/plans', path: '/api/v1/billing/plans' },
];

export const ApiPlatformSection: React.FC<ApiPlatformSectionProps> = ({
  engine,
  events,
  apiKeys,
  webhooks,
  onRevokeApiKey,
  onToggleWebhook,
  onDeleteWebhook,
  onExecuteApiQuery,
  onNotify,
}) => {
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [keyLabel, setKeyLabel] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('https://erp.station-partner.cm/opesfuel-hook');
  const [selectedEndpoint, setSelectedEndpoint] = useState(TEST_ENDPOINTS[3].path);
  const [apiResponse, setApiResponse] = useState<string>(() =>
    JSON.stringify(onExecuteApiQuery(TEST_ENDPOINTS[3].path), null, 2)
  );

  // One-time revealed secret banner (raw X-API-Key or HMAC signingSecret)
  const [revealedSecret, setRevealedSecret] = useState<{ title: string; value: string; hint: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Webhook delivery logs modal/panel
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Array<Record<string, unknown>>>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const handleKeyCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyLabel.trim()) return;
    try {
      const created = (await engine.createApiKeyLive(keyLabel.trim(), [
        'stations:read',
        'accounting:read',
        'events:read',
      ])) as Record<string, unknown>;
      const rawKey = String(created.rawApiKey ?? created.apiKey ?? created.plainKey ?? '');
      if (rawKey) {
        setRevealedSecret({
          title: `New X-API-Key Provisioned (${keyLabel.trim()})`,
          value: rawKey,
          hint: 'Copy this API key now — for security, Spring Boot stores only the SHA-256 hash and will never display it again.',
        });
      }
      onNotify('success', `Provisioned scoped API key "${keyLabel.trim()}".`);
      setKeyLabel('');
      setKeyModalOpen(false);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to create API key.');
    }
  };

  const handleWebhookCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.startsWith('https://')) {
      onNotify('error', 'Webhook URL must use HTTPS (SSRF protection rejects http/private hosts).');
      return;
    }
    try {
      const created = await engine.createWebhookLive(webhookUrl.trim(), [
        'ShiftClosedEvent',
        'DipstickVarianceFlaggedEvent',
        'TankDeliveryReceivedEvent',
      ]);
      const signingSecret = String(created.signingSecret ?? '');
      if (signingSecret) {
        setRevealedSecret({
          title: `Webhook HMAC-SHA256 Signing Secret (${webhookUrl.trim()})`,
          value: signingSecret,
          hint: 'Store this secret in your ERP receiver to verify the X-OpesFuel-Signature header. It is encrypted with AES-256-GCM at rest.',
        });
      }
      onNotify('success', `Registered HMAC webhook endpoint ${webhookUrl.trim()}.`);
      setWebhookModalOpen(false);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to register webhook.');
    }
  };

  const inspectDeliveries = async (webhookId: string) => {
    setSelectedWebhookId(webhookId);
    setLoadingDeliveries(true);
    try {
      const logs = await engine.listWebhookDeliveries(webhookId);
      setDeliveries(Array.isArray(logs) ? logs : []);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to load webhook delivery logs.');
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const copySecret = async () => {
    if (!revealedSecret) return;
    try {
      await navigator.clipboard.writeText(revealedSecret.value);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      // ignore
    }
  };

  const runEndpoint = (path: string) => {
    setSelectedEndpoint(path);
    const data = onExecuteApiQuery(path);
    setApiResponse(JSON.stringify(data, null, 2));
  };

  return (
    <div className="space-y-6">
      {/* One-Time Secret Reveal Card */}
      {revealedSecret && (
        <div className="p-5 rounded-xl border-2 border-amber-400 bg-white space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <KeyRound className="w-4 h-4 text-amber-700" />
              {revealedSecret.title}
            </div>
            <button
              type="button"
              onClick={() => setRevealedSecret(null)}
              className="p-1 text-slate-500 hover:text-slate-900"
              aria-label="Dismiss secret"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-slate-900 text-amber-300 font-mono text-xs break-all">
              {revealedSecret.value}
            </code>
            <button
              type="button"
              onClick={() => void copySecret()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSecret ? 'Copied' : 'Copy Secret'}
            </button>
          </div>
          <p className="text-xs text-amber-900 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            {revealedSecret.hint}
          </p>
        </div>
      )}

      {/* Live OpenAPI Explorer */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">OpenAPI 3.1 Interactive Explorer</h2>
            <p className="text-xs text-slate-500">
              Contract source: <span className="font-mono">openapi/opesfuel-api.yaml</span> · Auth0 RS256 / X-API-Key
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TEST_ENDPOINTS.map((ep) => (
              <button
                key={ep.path}
                type="button"
                onClick={() => runEndpoint(ep.path)}
                className={`px-3 py-1.5 rounded-md font-mono text-xs font-medium border transition-colors ${
                  selectedEndpoint === ep.path
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {ep.label}
              </button>
            ))}
          </div>
        </div>
        <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-72">
          {apiResponse}
        </pre>
      </div>

      {/* API Keys & Webhooks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">Tenant API Keys</h3>
              <p className="text-xs text-slate-500">Scoped X-API-Key credentials for ERPs &amp; Android/iPhone mobile apps</p>
            </div>
            <button
              type="button"
              onClick={() => setKeyModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Generate API Key
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {apiKeys.map((k) => (
              <div key={k.id} className="py-2.5 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{k.label}</div>
                  <div className="font-mono text-slate-500">{k.maskedKey}</div>
                  <div className="font-mono text-[11px] text-slate-400">{k.scopes.join(' · ')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Revoke API key "${k.label}"? Any ERP or terminal using it will immediately receive 401 Unauthorized.`)) {
                      onRevokeApiKey(k.id);
                    }
                  }}
                  aria-label={`Revoke API key ${k.label}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-red-200 bg-white text-red-700 hover:bg-red-50 font-semibold shrink-0"
                >
                  <Trash2 className="w-3 h-3" /> Revoke
                </button>
              </div>
            ))}
            {apiKeys.length === 0 && (
              <div className="py-4 text-center text-slate-500">No active tenant API keys generated yet.</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">Domain Event Webhooks</h3>
              <p className="text-xs text-slate-500">HMAC-SHA256 signed event delivery from Java Outbox relay</p>
            </div>
            <button
              type="button"
              onClick={() => setWebhookModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Register Webhook
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {webhooks.map((w) => (
              <div key={w.id} className="py-2.5 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-slate-900 truncate">{w.targetUrl}</div>
                  <div className="text-slate-500 truncate">{w.subscribedEvents.join(' · ')}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void inspectDeliveries(w.id)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold"
                  >
                    <History className="w-3 h-3" /> Logs
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleWebhook(w.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded border font-semibold ${
                      w.active
                        ? 'border-emerald-300 bg-white text-emerald-800 hover:bg-slate-50'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {w.active ? (
                      <>
                        <Pause className="w-3 h-3" /> Active
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" /> Paused
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete webhook subscription "${w.targetUrl}"? Outbound events will immediately stop delivering to this endpoint.`)) {
                        onDeleteWebhook(w.id);
                      }
                    }}
                    aria-label={`Delete webhook ${w.targetUrl}`}
                    className="p-1.5 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {webhooks.length === 0 && (
              <div className="py-4 text-center text-slate-500">No webhook subscriptions registered yet.</div>
            )}
          </div>

          {selectedWebhookId && (
            <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  Webhook Delivery Logs ({selectedWebhookId})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedWebhookId(null)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {loadingDeliveries ? (
                <div className="text-slate-500">Loading delivery attempts…</div>
              ) : deliveries.length === 0 ? (
                <div className="text-slate-500">No outbound deliveries dispatched yet.</div>
              ) : (
                <div className="divide-y divide-slate-200 max-h-48 overflow-y-auto">
                  {deliveries.map((d, idx) => (
                    <div key={String(d.id ?? idx)} className="py-1.5 flex items-center justify-between gap-2 font-mono">
                      <div>
                        <span className={d.success ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                          HTTP {String(d.httpStatus ?? 0)}
                        </span>{' '}
                        · {String(d.eventType ?? 'Event')}
                      </div>
                      <span className="text-slate-500">
                        {d.deliveredAt ? formatShortDate(String(d.deliveredAt)) : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CQRS Event Outbox Log */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-bold text-slate-900">Transactional Outbox &amp; Domain Events</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {events.map((evt) => (
            <div key={evt.eventId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-1">
                <div className="font-mono font-semibold text-amber-700">
                  {evt.eventType} <span className="text-slate-400">·</span>{' '}
                  <span className="text-slate-600">{evt.aggregateType}:{evt.aggregateId}</span>
                </div>
                <div className="text-sm text-slate-800">{evt.summary}</div>
              </div>
              <div className="font-mono text-slate-500 shrink-0">{formatShortDate(evt.occurredAt)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Popup FormModal: Generate API Key */}
      <FormModal
        open={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        title="Generate Scoped Tenant API Key"
        subtitle="Creates a SHA-256 hashed X-API-Key credential for ERP or mobile sync integrations."
      >
        <form onSubmit={(e) => void handleKeyCreate(e)} className="space-y-4">
          <div>
            <label className="opes-label">Integration Label</label>
            <input
              type="text"
              required
              placeholder="e.g. Sage Accounting Connector"
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              className="opes-input"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setKeyModalOpen(false)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Generate API Key
            </button>
          </div>
        </form>
      </FormModal>

      {/* Popup FormModal: Register Webhook */}
      <FormModal
        open={webhookModalOpen}
        onClose={() => setWebhookModalOpen(false)}
        title="Register HTTPS Domain Event Webhook"
        subtitle="Delivers HMAC-SHA256 signed JSON events for shifts, dipstick variances, and tanker deliveries."
      >
        <form onSubmit={(e) => void handleWebhookCreate(e)} className="space-y-4">
          <div>
            <label className="opes-label">HTTPS Receiver Endpoint URL</label>
            <input
              type="url"
              required
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-erp.com/opesfuel-webhook"
              className="opes-input font-mono"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setWebhookModalOpen(false)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Register Webhook
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
