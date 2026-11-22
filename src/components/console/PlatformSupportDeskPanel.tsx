import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Headphones,
  KeyRound,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { formatShortDate } from '../../domain/formatters';
import { FormModal } from '../shared/FormModal';

interface PlatformSupportDeskPanelProps {
  engine: OpesFuelApiEngine;
  tenants: Array<Record<string, unknown>>;
  tickets: Array<Record<string, unknown>>;
  impersonations: Array<Record<string, unknown>>;
  onRefresh: () => Promise<void>;
  onStartImpersonation: (payload: { tenantId: string; tenantName: string; ticketId?: string; reason: string }) => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_TENANT', 'ESCALATED', 'RESOLVED', 'CLOSED'] as const;
const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const TICKET_CATEGORIES = ['TECHNICAL', 'PAYMENTS_MOMO', 'EDGE_HARDWARE', 'BILLING', 'ACCOUNT_ACCESS', 'COMPLIANCE'] as const;

export const PlatformSupportDeskPanel: React.FC<PlatformSupportDeskPanelProps> = ({
  engine,
  tenants,
  tickets,
  impersonations,
  onRefresh,
  onStartImpersonation,
  onNotify,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Reply state
  const [replyBody, setReplyBody] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [notifyRequester, setNotifyRequester] = useState(true);
  const [sendingReply, setSendingReply] = useState(false);

  // New Ticket Modal
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ntTenantId, setNtTenantId] = useState('');
  const [ntSubject, setNtSubject] = useState('');
  const [ntCategory, setNtCategory] = useState('TECHNICAL');
  const [ntPriority, setNtPriority] = useState('HIGH');
  const [ntDescription, setNtDescription] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Impersonation Modal
  const [impOpen, setImpOpen] = useState(false);
  const [impTenantId, setImpTenantId] = useState('');
  const [impTicketId, setImpTicketId] = useState<string | undefined>(undefined);
  const [impReason, setImpReason] = useState('');
  const [startingImp, setStartingImp] = useState(false);

  // Quick Troubleshooter
  const [troubleshootTenantId, setTroubleshootTenantId] = useState('');
  const [resendingAccess, setResendingAccess] = useState(false);

  useEffect(() => {
    if (!ntTenantId && tenants.length > 0) {
      setNtTenantId(String(tenants[0].id ?? ''));
    }
    if (!troubleshootTenantId && tenants.length > 0) {
      setTroubleshootTenantId(String(tenants[0].id ?? ''));
    }
    if (!impTenantId && tenants.length > 0) {
      setImpTenantId(String(tenants[0].id ?? ''));
    }
  }, [tenants, ntTenantId, troubleshootTenantId, impTenantId]);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== 'ALL' && String(t.status) !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && String(t.priority) !== priorityFilter) return false;
      if (!q) return true;
      return (
        String(t.ticketNumber ?? '').toLowerCase().includes(q) ||
        String(t.subject ?? '').toLowerCase().includes(q) ||
        String(t.tenantName ?? '').toLowerCase().includes(q) ||
        String(t.requesterEmail ?? '').toLowerCase().includes(q)
      );
    });
  }, [tickets, statusFilter, priorityFilter, search]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => String(t.id) === selectedTicketId) ?? filteredTickets[0] ?? null,
    [tickets, selectedTicketId, filteredTickets]
  );

  const loadMessages = useCallback(async (ticketId: string) => {
    setLoadingMessages(true);
    try {
      const list = await engine.listPlatformTicketMessages(ticketId);
      setMessages(list);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [engine]);

  useEffect(() => {
    if (selectedTicket?.id) {
      void loadMessages(String(selectedTicket.id));
    } else {
      setMessages([]);
    }
  }, [selectedTicket?.id, loadMessages]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ntTenantId || !ntSubject.trim() || !ntDescription.trim()) return;
    setCreatingTicket(true);
    try {
      const tenant = tenants.find((t) => String(t.id) === ntTenantId);
      const created = await engine.createPlatformSupportTicket({
        tenantId: ntTenantId,
        tenantName: String(tenant?.name ?? ntTenantId),
        requesterEmail: String(tenant?.ownerEmail ?? 'owner@opesfuel.cm'),
        subject: ntSubject.trim(),
        description: ntDescription.trim(),
        category: ntCategory,
        priority: ntPriority,
      });
      setNewTicketOpen(false);
      setNtSubject('');
      setNtDescription('');
      setSelectedTicketId(String(created.id ?? ''));
      await onRefresh();
      onNotify('success', `Support ticket ${String(created.ticketNumber ?? '')} created and assigned to Platform Support Desk.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to create support ticket.');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleUpdateTicket = async (ticketId: string, patch: { status?: string; priority?: string }) => {
    try {
      await engine.updatePlatformSupportTicket(ticketId, patch);
      await onRefresh();
      onNotify('success', `Updated support ticket (${patch.status ?? patch.priority}).`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update ticket.');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket?.id || !replyBody.trim()) return;
    setSendingReply(true);
    try {
      await engine.postPlatformTicketMessage(String(selectedTicket.id), {
        body: replyBody.trim(),
        internalNote,
        notifyRequester: !internalNote && notifyRequester,
      });
      setReplyBody('');
      await loadMessages(String(selectedTicket.id));
      await onRefresh();
      onNotify(
        'success',
        internalNote
          ? 'Saved internal engineering note on ticket.'
          : 'Reply posted to ticket thread' + (notifyRequester ? ' and emailed to customer.' : '.')
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to post message.');
    } finally {
      setSendingReply(false);
    }
  };

  const openImpersonateModal = (tenantId: string, ticketId?: string, defaultReason?: string) => {
    setImpTenantId(tenantId);
    setImpTicketId(ticketId);
    setImpReason(defaultReason ?? '');
    setImpOpen(true);
  };

  const handleConfirmImpersonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!impTenantId || !impReason.trim()) return;
    setStartingImp(true);
    try {
      const tenant = tenants.find((t) => String(t.id) === impTenantId);
      await onStartImpersonation({
        tenantId: impTenantId,
        tenantName: String(tenant?.name ?? impTenantId),
        ticketId: impTicketId,
        reason: impReason.trim(),
      });
      setImpOpen(false);
      setImpReason('');
    } finally {
      setStartingImp(false);
    }
  };

  const handleQuickResendAccess = async () => {
    if (!troubleshootTenantId) return;
    setResendingAccess(true);
    try {
      const res = await engine.resendPlatformTenantAccess(troubleshootTenantId);
      onNotify('success', `Dispatched workspace access recovery email to ${String(res.ownerEmail ?? 'tenant owner')}.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to resend owner access.');
    } finally {
      setResendingAccess(false);
    }
  };

  const openCount = tickets.filter((t) => ['OPEN', 'IN_PROGRESS', 'WAITING_TENANT', 'ESCALATED'].includes(String(t.status))).length;
  const urgentCount = tickets.filter(
    (t) => ['OPEN', 'IN_PROGRESS', 'ESCALATED'].includes(String(t.status)) && ['HIGH', 'URGENT'].includes(String(t.priority))
  ).length;
  const resolvedCount = tickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(String(t.status))).length;
  const activeImpersonationsCount = impersonations.filter((i) => String(i.status) === 'ACTIVE').length;

  const priorityBadge = (priority: string) => {
    if (priority === 'URGENT') return 'bg-red-50 text-red-700 border-red-200';
    if (priority === 'HIGH') return 'bg-amber-50 text-amber-800 border-amber-200';
    if (priority === 'MEDIUM') return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-slate-50 text-slate-500 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Headphones className="w-3.5 h-3.5 text-amber-600" /> Open Support Queue
          </div>
          <div className="font-mono text-2xl font-bold text-slate-950 mt-1">{openCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">{tickets.length} total tickets logged</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> High / Urgent SLA
          </div>
          <div className={`font-mono text-2xl font-bold mt-1 ${urgentCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {urgentCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">P1 target: 2h · P2 target: 6h</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Resolved Tickets
          </div>
          <div className="font-mono text-2xl font-bold text-slate-950 mt-1">{resolvedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Closed with audit trail</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-900" /> Audited Support Sessions
          </div>
          <div className="font-mono text-2xl font-bold text-slate-950 mt-1">{impersonations.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">{activeImpersonationsCount} currently active</div>
        </div>
      </div>

      {/* Quick Tenant Troubleshooter & Audited Impersonation Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-950">
            <Wrench className="w-4 h-4 text-amber-600" /> Tenant Quick Troubleshooter:
          </span>
          <select
            value={troubleshootTenantId}
            onChange={(e) => setTroubleshootTenantId(e.target.value)}
            className="opes-input text-xs py-1.5 w-60"
            aria-label="Select tenant to troubleshoot"
          >
            {tenants.map((t) => (
              <option key={String(t.id)} value={String(t.id)}>
                {String(t.name)} ({String(t.status)})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!troubleshootTenantId || resendingAccess}
            onClick={() => void handleQuickResendAccess()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-900 disabled:opacity-50"
          >
            <KeyRound className="w-3.5 h-3.5" /> {resendingAccess ? 'Sending...' : 'Resend Owner Access / OTP'}
          </button>
          <button
            type="button"
            disabled={!troubleshootTenantId}
            onClick={() => openImpersonateModal(troubleshootTenantId, undefined, 'Direct customer troubleshooting request')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50"
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-400" /> Enter Audited Support View
          </button>
          <button
            type="button"
            onClick={() => setNewTicketOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Log Support Ticket
          </button>
        </div>
      </div>

      {/* Main Ticket Queue + Thread Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Ticket List */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 space-y-2.5 bg-slate-50">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-950">Customer Ticket Queue</h3>
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-950"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket #, tenant, email, subject..."
              className="opes-input text-xs py-1.5"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="opes-input text-[11px] py-1"
              >
                <option value="ALL">All Statuses</option>
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="opes-input text-[11px] py-1"
              >
                <option value="ALL">All Priorities</option>
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="divide-y divide-slate-200 max-h-[520px] overflow-y-auto">
            {filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No support tickets match the active filter.
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = selectedTicket && String(selectedTicket.id) === String(t.id);
                const priority = String(t.priority ?? 'MEDIUM');
                return (
                  <button
                    key={String(t.id)}
                    type="button"
                    onClick={() => setSelectedTicketId(String(t.id))}
                    className={`w-full text-left p-3.5 transition-colors space-y-1.5 ${
                      isSelected ? 'bg-amber-50/70 border-l-4 border-l-[#D97706]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-900">{String(t.ticketNumber ?? t.id)}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${priorityBadge(priority)}`}>
                          {priority}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {String(t.status ?? 'OPEN').replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-slate-950 line-clamp-2">{String(t.subject ?? '')}</div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="truncate">{String(t.tenantName ?? '')}</span>
                      <span className="font-mono shrink-0 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> {Number(t.messageCount ?? 0)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Ticket Detail & Thread */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          {!selectedTicket ? (
            <div className="p-10 text-center text-xs text-slate-500">Select a ticket to inspect conversation &amp; troubleshoot.</div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-slate-200 space-y-3 bg-slate-50/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-700">{String(selectedTicket.ticketNumber ?? '')}</span>
                      <span className="text-[11px] font-mono text-slate-500">{String(selectedTicket.category ?? 'TECHNICAL')}</span>
                    </div>
                    <h4 className="font-display text-base font-bold text-slate-950 mt-0.5">{String(selectedTicket.subject ?? '')}</h4>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Tenant: <strong className="text-slate-900">{String(selectedTicket.tenantName ?? '')}</strong> · Requester: {String(selectedTicket.requesterEmail ?? '')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openImpersonateModal(
                        String(selectedTicket.tenantId ?? ''),
                        String(selectedTicket.id ?? ''),
                        `Investigating ticket ${String(selectedTicket.ticketNumber ?? '')}: ${String(selectedTicket.subject ?? '')}`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" /> Impersonate Tenant
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">Status:</span>
                    <select
                      value={String(selectedTicket.status ?? 'OPEN')}
                      onChange={(e) => void handleUpdateTicket(String(selectedTicket.id), { status: e.target.value })}
                      className="opes-input py-1 text-xs font-semibold w-40"
                    >
                      {TICKET_STATUSES.map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">Priority:</span>
                    <select
                      value={String(selectedTicket.priority ?? 'MEDIUM')}
                      onChange={(e) => void handleUpdateTicket(String(selectedTicket.id), { priority: e.target.value })}
                      className="opes-input py-1 text-xs font-semibold w-28"
                    >
                      {TICKET_PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  {Boolean(selectedTicket.slaDueAt) && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 ml-auto">
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> SLA Due: {formatShortDate(String(selectedTicket.slaDueAt))}
                    </span>
                  )}
                </div>
              </div>

              {/* Conversation Thread */}
              <div className="p-5 space-y-3 flex-1 max-h-[300px] overflow-y-auto bg-white">
                {loadingMessages ? (
                  <div className="text-xs text-slate-500 font-mono">Loading ticket conversation...</div>
                ) : messages.length === 0 ? (
                  <div className="text-xs text-slate-500">No messages recorded on this ticket yet.</div>
                ) : (
                  messages.map((m) => {
                    const isInternal = Boolean(m.internalNote);
                    const isStaff = String(m.senderRole ?? '').includes('PLATFORM_ADMIN');
                    return (
                      <div
                        key={String(m.id)}
                        className={`rounded-lg border p-3 text-xs space-y-1 ${
                          isInternal
                            ? 'bg-amber-50 border-amber-200'
                            : isStaff
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {isInternal && <Lock className="w-3 h-3 text-amber-700" />}
                            {String(m.senderEmail ?? '')}
                            <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700">
                              {isInternal ? 'INTERNAL NOTE' : String(m.senderRole ?? 'CUSTOMER')}
                            </span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {formatShortDate(String(m.createdAt ?? ''))}
                          </span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{String(m.body ?? '')}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Composer */}
              <form onSubmit={(e) => void handleSendReply(e)} className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
                <textarea
                  rows={3}
                  required
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={internalNote ? 'Write an internal engineering note (hidden from customer)...' : 'Write a response to the customer tenant...'}
                  className="opes-input text-xs"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={internalNote}
                        onChange={(e) => setInternalNote(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Internal note only
                    </label>
                    {!internalNote && (
                      <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={notifyRequester}
                          onChange={(e) => setNotifyRequester(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        Email reply to tenant owner
                      </label>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={sendingReply || !replyBody.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> {sendingReply ? 'Posting...' : internalNote ? 'Save Internal Note' : 'Send Reply'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Audited Impersonation Sessions Log */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-950">Audited Support Impersonation Sessions</h3>
            <p className="text-[11px] text-slate-500">Every entry into a customer tenant workspace is permanently logged with reason &amp; ticket reference.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#0F172A] text-white">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Session ID</th>
                <th className="px-4 py-2.5 text-left font-semibold">Super-Admin</th>
                <th className="px-4 py-2.5 text-left font-semibold">Target Tenant</th>
                <th className="px-4 py-2.5 text-left font-semibold">Reason / Ticket</th>
                <th className="px-4 py-2.5 text-left font-semibold">Started</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {impersonations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No support impersonation sessions recorded yet.
                  </td>
                </tr>
              ) : (
                impersonations.map((s) => (
                  <tr key={String(s.id)} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-slate-700">{String(s.id)}</td>
                    <td className="px-4 py-2.5 text-slate-800">{String(s.adminEmail ?? '')}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-950">{String(s.tenantName ?? s.tenantId ?? '')}</td>
                    <td className="px-4 py-2.5 text-slate-600">{String(s.reason ?? '')}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{formatShortDate(String(s.startedAt ?? ''))}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          String(s.status) === 'ACTIVE'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {String(s.status ?? 'ENDED')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Support Ticket Modal */}
      <FormModal
        open={newTicketOpen}
        onClose={() => setNewTicketOpen(false)}
        title="Log Customer Support Ticket"
        subtitle="Create a tracked SLA support case for a tenant workspace."
      >
        <form onSubmit={(e) => void handleCreateTicket(e)} className="space-y-4">
          <div>
            <label className="opes-label">Customer Tenant</label>
            <select value={ntTenantId} onChange={(e) => setNtTenantId(e.target.value)} required className="opes-input text-xs">
              {tenants.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>{String(t.name)} ({String(t.ownerEmail)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="opes-label">Subject</label>
            <input
              type="text"
              required
              value={ntSubject}
              onChange={(e) => setNtSubject(e.target.value)}
              placeholder="e.g. Orange Money callback verification or Edge Agent reconnect"
              className="opes-input text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Category</label>
              <select value={ntCategory} onChange={(e) => setNtCategory(e.target.value)} className="opes-input text-xs">
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Priority / SLA</label>
              <select value={ntPriority} onChange={(e) => setNtPriority(e.target.value)} className="opes-input text-xs">
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="opes-label">Issue Description</label>
            <textarea
              rows={4}
              required
              value={ntDescription}
              onChange={(e) => setNtDescription(e.target.value)}
              placeholder="Describe the reported problem, station code, error details..."
              className="opes-input text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setNewTicketOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={creatingTicket} className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50">
              {creatingTicket ? 'Creating...' : 'Create Support Ticket'}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Start Audited Impersonation Modal */}
      <FormModal
        open={impOpen}
        onClose={() => setImpOpen(false)}
        title="Launch Audited Tenant Support Session"
        subtitle="Super-Admin access to a tenant's petrol station console is recorded in the immutable security audit log."
      >
        <form onSubmit={(e) => void handleConfirmImpersonation(e)} className="space-y-4">
          <div>
            <label className="opes-label">Target Customer Tenant</label>
            <select value={impTenantId} onChange={(e) => setImpTenantId(e.target.value)} required className="opes-input text-xs">
              {tenants.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>{String(t.name)} ({String(t.id)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="opes-label">Mandatory Support Justification / Reason</label>
            <textarea
              rows={3}
              required
              value={impReason}
              onChange={(e) => setImpReason(e.target.value)}
              placeholder="e.g. Diagnosing shift variance / verifying MTN MoMo webhook on ticket SUP-2026-0101"
              className="opes-input text-xs"
            />
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
            A persistent <strong>Support Impersonation Active</strong> banner will be displayed at the top of the workspace until you end the session.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setImpOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={startingImp || !impReason.trim()} className="px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50">
              {startingImp ? 'Starting...' : 'Enter Tenant Support View'}
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
