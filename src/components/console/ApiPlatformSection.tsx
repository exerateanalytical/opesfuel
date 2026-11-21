import React, { useState } from 'react';
import { Pause, Play, Trash2 } from 'lucide-react';
import { formatShortDate } from '../../domain/formatters';
import { ApiKeyRecord, DomainEventLog, WebhookSubscription } from '../../domain/types';

interface ApiPlatformSectionProps {
  events: DomainEventLog[];
  apiKeys: ApiKeyRecord[];
  webhooks: WebhookSubscription[];
  onCreateApiKey: (label: string, scopes: string[]) => void;
  onRevokeApiKey: (keyId: string) => void;
  onCreateWebhook: (targetUrl: string, subscribedEvents: string[]) => void;
  onToggleWebhook: (webhookId: string) => void;
  onDeleteWebhook: (webhookId: string) => void;
  onExecuteApiQuery: (endpoint: string) => unknown;
}

const TEST_ENDPOINTS = [
  { label: 'GET /api/v1/stations', path: '/api/v1/stations' },
  { label: 'GET /api/v1/forecourt/pumps', path: '/api/v1/forecourt/pumps' },
  { label: 'GET /api/v1/inventory/tanks', path: '/api/v1/inventory/tanks' },
  { label: 'GET /api/v1/accounting/reports', path: '/api/v1/accounting/reports' },
  { label: 'GET /api/v1/billing/plans', path: '/api/v1/billing/plans' },
];

export const ApiPlatformSection: React.FC<ApiPlatformSectionProps> = ({
  events,
  apiKeys,
  webhooks,
  onCreateApiKey,
  onRevokeApiKey,
  onCreateWebhook,
  onToggleWebhook,
  onDeleteWebhook,
  onExecuteApiQuery,
}) => {
  const [keyLabel, setKeyLabel] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('https://erp.station-partner.cm/opesfuel-hook');
  const [selectedEndpoint, setSelectedEndpoint] = useState(TEST_ENDPOINTS[3].path);
  const [apiResponse, setApiResponse] = useState<string>(() =>
    JSON.stringify(onExecuteApiQuery(TEST_ENDPOINTS[3].path), null, 2)
  );

  const handleKeyCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyLabel.trim()) return;
    onCreateApiKey(keyLabel.trim(), ['stations:read', 'accounting:read', 'events:read']);
    setKeyLabel('');
  };

  const handleWebhookCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.startsWith('https://')) return;
    onCreateWebhook(webhookUrl.trim(), ['ShiftClosedEvent', 'DipstickVarianceFlaggedEvent']);
  };

  const runEndpoint = (path: string) => {
    setSelectedEndpoint(path);
    const data = onExecuteApiQuery(path);
    setApiResponse(JSON.stringify(data, null, 2));
  };

  return (
    <div className="space-y-6">
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
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">Tenant API Keys</h3>
            <p className="text-xs text-slate-500">Scoped X-API-Key credentials for ERPs &amp; Android/iPhone mobile apps</p>
          </div>
          <form onSubmit={handleKeyCreate} className="flex gap-2">
            <input
              type="text"
              placeholder="Integration Label (e.g. Odoo Connector)"
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap"
            >
              Generate Key
            </button>
          </form>
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
                  onClick={() => onRevokeApiKey(k.id)}
                  aria-label={`Revoke API key ${k.label}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 font-semibold shrink-0"
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
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">Domain Event Webhooks</h3>
            <p className="text-xs text-slate-500">HMAC-SHA256 signed event delivery from Java Outbox relay</p>
          </div>
          <form onSubmit={handleWebhookCreate} className="flex gap-2">
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-erp.com/webhook"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap"
            >
              Register
            </button>
          </form>
          <div className="divide-y divide-slate-100 text-xs">
            {webhooks.map((w) => (
              <div key={w.id} className="py-2.5 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-slate-900 truncate">{w.targetUrl}</div>
                  <div className="text-slate-500 truncate">{w.subscribedEvents.join(' · ')}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleWebhook(w.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded border font-semibold ${
                      w.active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                    onClick={() => onDeleteWebhook(w.id)}
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
    </div>
  );
};
