import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Headphones, MessageSquare, Plus, RefreshCw, Send } from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { formatShortDate } from '../../domain/formatters';
import { Station } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

interface TenantSupportHelpdeskPanelProps {
  engine: OpesFuelApiEngine;
  organizationName: string;
  ownerEmail: string;
  stations: Station[];
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const CATEGORIES = ['TECHNICAL', 'PAYMENTS_MOMO', 'EDGE_HARDWARE', 'BILLING', 'ACCOUNT_ACCESS', 'COMPLIANCE'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const TenantSupportHelpdeskPanel: React.FC<TenantSupportHelpdeskPanelProps> = ({
  engine,
  organizationName,
  ownerEmail,
  stations,
  onNotify,
}) => {
  const [tickets, setTickets] = useState<Array<Record<string, unknown>>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [stationId, setStationId] = useState(stations[0]?.id ?? '');
  const [category, setCategory] = useState<string>('PAYMENTS_MOMO');
  const [priority, setPriority] = useState<string>('HIGH');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const list = await engine.listMyTenantSupportTickets();
      setTickets(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(String(list[0].id ?? ''));
      }
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to load support tickets.');
    } finally {
      setLoading(false);
    }
  }, [engine, selectedId, onNotify]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const selectedTicket = tickets.find((t) => String(t.id) === selectedId) ?? tickets[0] ?? null;

  const loadMessages = useCallback(
    async (ticketId: string) => {
      try {
        const list = await engine.listMyTenantTicketMessages(ticketId);
        setMessages(list);
      } catch {
        setMessages([]);
      }
    },
    [engine]
  );

  useEffect(() => {
    if (selectedTicket?.id) {
      void loadMessages(String(selectedTicket.id));
    } else {
      setMessages([]);
    }
  }, [selectedTicket?.id, loadMessages]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const created = await engine.submitMyTenantSupportTicket({
        stationId: stationId || undefined,
        requesterEmail: ownerEmail,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
      });
      setNewOpen(false);
      setSubject('');
      setDescription('');
      setSelectedId(String(created.id ?? ''));
      await loadTickets();
      onNotify('success', `Submitted ticket ${String(created.ticketNumber ?? '')} to OpesFuel 24/7 Support Desk.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to submit support ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket?.id || !replyBody.trim()) return;
    setSendingReply(true);
    try {
      await engine.postMyTenantTicketReply(String(selectedTicket.id), replyBody.trim());
      setReplyBody('');
      await loadMessages(String(selectedTicket.id));
      await loadTickets();
      onNotify('success', 'Sent follow-up reply to OpesFuel Platform Support.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
            <Headphones className="w-5 h-5 text-amber-600" /> OpesFuel Priority Support &amp; Helpdesk
          </h3>
          <p className="text-xs text-slate-500">
            Submit tickets directly to OpesWare platform engineers for {organizationName} (MTN/Orange MoMo, Edge Agents, Billing, or Hardware).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadTickets()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Open Support Ticket
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Ticket List */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-[#0F172A] text-white text-xs font-bold flex items-center justify-between">
            <span>My Organization&apos;s Tickets ({tickets.length})</span>
            <span className="font-mono text-[10px] text-amber-300">SLA: P1 2h · P2 6h</span>
          </div>
          <div className="divide-y divide-slate-200 max-h-[420px] overflow-y-auto">
            {tickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No support tickets yet. Click <strong>Open Support Ticket</strong> whenever you need assistance.
              </div>
            ) : (
              tickets.map((t) => {
                const active = selectedTicket && String(selectedTicket.id) === String(t.id);
                return (
                  <button
                    key={String(t.id)}
                    type="button"
                    onClick={() => setSelectedId(String(t.id))}
                    className={`w-full text-left p-3.5 space-y-1 transition-colors ${
                      active ? 'bg-amber-50/70 border-l-4 border-l-[#D97706]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-900">{String(t.ticketNumber ?? t.id)}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {String(t.status ?? 'OPEN').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-950">{String(t.subject ?? '')}</div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>{String(t.priority ?? 'MEDIUM')} · {String(t.category ?? 'TECHNICAL')}</span>
                      <span className="inline-flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {Number(t.messageCount ?? 0)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Ticket Thread */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          {!selectedTicket ? (
            <div className="p-10 text-center text-xs text-slate-500">Select a support ticket to view conversation updates.</div>
          ) : (
            <>
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-xs font-bold text-amber-700">{String(selectedTicket.ticketNumber ?? '')}</div>
                  <div className="text-sm font-bold text-slate-950">{String(selectedTicket.subject ?? '')}</div>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-500">
                  <div>Status: <strong className="text-slate-900">{String(selectedTicket.status ?? 'OPEN')}</strong></div>
                  {Boolean(selectedTicket.slaDueAt) && (
                    <div className="inline-flex items-center gap-1"><Clock className="w-3 h-3 text-amber-600" /> SLA: {formatShortDate(String(selectedTicket.slaDueAt))}</div>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3 max-h-[280px] overflow-y-auto flex-1">
                {messages.map((m) => (
                  <div key={String(m.id)} className="border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        {String(m.senderEmail ?? '')}{' '}
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {String(m.senderRole ?? '').includes('PLATFORM_ADMIN') ? 'OPESFUEL SUPPORT' : 'YOU'}
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">{formatShortDate(String(m.createdAt ?? ''))}</span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap">{String(m.body ?? '')}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={(e) => void handleReply(e)} className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
                <input
                  type="text"
                  required
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a reply to OpesFuel Support..."
                  className="opes-input text-xs flex-1"
                />
                <button
                  type="submit"
                  disabled={sendingReply || !replyBody.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <FormModal open={newOpen} onClose={() => setNewOpen(false)} title="Open OpesFuel Support Ticket" subtitle="Routed directly to the Platform Admin Support Desk with SLA tracking.">
        <form onSubmit={(e) => void handleSubmitTicket(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Affected Station (Optional)</label>
              <select value={stationId} onChange={(e) => setStationId(e.target.value)} className="opes-input text-xs">
                <option value="">All Stations / Organization-wide</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="opes-input text-xs">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="opes-label">Subject</label>
              <input type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Need help verifying Orange Money webhook" className="opes-input text-xs" />
            </div>
            <div>
              <label className="opes-label">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="opes-input text-xs">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="opes-label">Detailed Description</label>
            <textarea rows={4} required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Include station code, invoice/transaction ref, or pump ID..." className="opes-input text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNewOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Support Ticket'}
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
