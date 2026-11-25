import React, { useState } from 'react';
import { Calculator, KeyRound, Plus, ShieldAlert, Tag, UserCheck } from 'lucide-react';
import { formatFcfa } from '../../domain/formatters';
import { UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';
import { useLiveApi, useLiveList } from '../../api/liveApi';

interface IamGovernanceAndBillingProPanelProps {
  role: UserRole;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const IamGovernanceAndBillingProPanel: React.FC<IamGovernanceAndBillingProPanelProps> = ({
  role,
  onNotify,
}) => {
  const [tab, setTab] = useState<'billing' | 'iam'>('billing');
  const [modal, setModal] = useState<'coupon' | 'credit' | 'delegation' | 'breakglass' | 'review' | null>(null);
  const canAdmin = role === 'OWNER' || role === 'PLATFORM_ADMIN';
  const api = useLiveApi();
  const failed = (e: unknown) => onNotify('error', e instanceof Error ? e.message : 'Request failed.');
  const quarterLabel = () => { const d = new Date(); return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`; };
  const inOneYear = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };

  // M03 State
  const [currentFee, setCurrentFee] = useState('25000');
  const [targetFee, setTargetFee] = useState('55000');
  const [daysLeft, setDaysLeft] = useState('15');
  const seed_coupons = [
    { id: 'cpn_01', code: 'CEMAC20', type: 'PERCENT', value: 20, used: 4, max: 100, expiresAt: '2027-12-31' },
    { id: 'cpn_02', code: 'PARTNER10K', type: 'FIXED_FCFA', value: 10000, used: 2, max: 50, expiresAt: '2027-06-30' },
  ];
  const { items: coupons, setItems: setCoupons, reload: reload_coupons } = useLiveList<any, (typeof seed_coupons)[number]>('/enterprise/billing/coupons', seed_coupons, (r) => (({ id: r.id, code: r.code, type: r.discount_type, value: Number(r.discount_value), used: Number(r.redemptions_used), max: Number(r.max_redemptions), expiresAt: String(r.expires_at) })));
  const seed_creditNotes = [
    { id: 'cn_01', number: 'CN-2026-4812', invoiceId: 'INV-2026-10', amountFcfa: 12500, reason: 'Mid-month station consolidation proration' },
  ];
  const { items: creditNotes, setItems: setCreditNotes, reload: reload_creditNotes } = useLiveList<any, (typeof seed_creditNotes)[number]>('/enterprise/billing/credit-notes', seed_creditNotes, (r) => (({ id: r.id, number: r.credit_note_number, invoiceId: r.invoice_id, amountFcfa: Number(r.amount_fcfa), reason: r.reason })));

  // M05 State
  const seed_delegations = [
    { id: 'dlg_01', grantee: 'manager@opesfuel.cm', scope: 'APPROVE_PO_UP_TO_5M', reason: 'Owner travel cover', expiresAt: '2026-12-15', status: 'ACTIVE' },
  ];
  const { items: delegations, setItems: setDelegations, reload: reload_delegations } = useLiveList<any, (typeof seed_delegations)[number]>('/enterprise/iam/delegations', seed_delegations, (r) => (({ id: r.id, grantee: r.grantee_email, scope: r.permission_scope, reason: r.reason, expiresAt: String(r.expires_at).slice(0, 10), status: r.status })));
  const seed_breakGlass = [
    { id: 'bg_01', actor: 'manager@opesfuel.cm', elevatedRole: 'OWNER', ticket: 'INC-2026-409', justification: 'Emergency night tank quarantine release after drain', reviewStatus: 'REVIEWED_OK' },
  ];
  const { items: breakGlass, setItems: setBreakGlass, reload: reload_breakGlass } = useLiveList<any, (typeof seed_breakGlass)[number]>('/enterprise/iam/break-glass', seed_breakGlass, (r) => (({ id: r.id, actor: r.actor_sub, elevatedRole: r.elevated_role, ticket: r.incident_ticket, justification: r.justification, reviewStatus: r.review_status })));
  const seed_reviews = [
    { id: 'rev_01', cycle: '2026-Q4', email: 'finance@opesfuel.cm', role: 'ACCOUNTANT', decision: 'CERTIFIED', notes: 'Active chief accountant confirmed' },
  ];
  const { items: reviews, setItems: setReviews, reload: reload_reviews } = useLiveList<any, (typeof seed_reviews)[number]>('/enterprise/iam/access-reviews', seed_reviews, (r) => (({ id: r.id, cycle: r.cycle_label, email: r.target_user_email, role: r.assigned_role, decision: r.decision, notes: r.notes ?? '' })));

  // Form states
  const [cpnCode, setCpnCode] = useState('');
  const [cpnVal, setCpnVal] = useState('15');
  const [cnInv, setCnInv] = useState('INV-2026-11');
  const [cnAmt, setCnAmt] = useState('15000');
  const [cnReason, setCnReason] = useState('');

  const [dlgEmail, setDlgEmail] = useState('');
  const [dlgScope, setDlgScope] = useState('APPROVE_PO_UP_TO_5M');
  const [dlgReason, setDlgReason] = useState('');
  const [dlgExp, setDlgExp] = useState('2026-12-31');

  const [bgTicket, setBgTicket] = useState('INC-2026-');
  const [bgReason, setBgReason] = useState('');

  const [revEmail, setRevEmail] = useState('');
  const [revRole, setRevRole] = useState('MANAGER');
  const [revDecision, setRevDecision] = useState<'CERTIFIED' | 'REVOKED'>('CERTIFIED');

  const ratio = Math.min(1, (Number(daysLeft) || 15) / 30);
  const proratedDelta = Math.round(((Number(targetFee) || 0) - (Number(currentFee) || 0)) * ratio);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950">
            SaaS Proration, Credit Notes &amp; Coupons (M03) · IAM Governance &amp; Break-Glass (M05)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Plan upgrade proration math, promotional coupons, subscription credit notes, time-bound delegated permissions, and emergency break-glass audits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('billing')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
              tab === 'billing' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" /> Billing Pro (M03)
          </button>
          <button
            type="button"
            onClick={() => setTab('iam')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
              tab === 'iam' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" /> IAM Governance (M05)
          </button>
        </div>
      </div>

      {tab === 'billing' ? (
        <div className="space-y-5">
          {/* Live Plan Proration Calculator */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-950">
              <Calculator className="w-4 h-4 text-amber-600" />
              Mid-Cycle Plan Upgrade / Downgrade Proration Calculator
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="opes-label">Current Fee (FCFA)</label>
                <input type="number" value={currentFee} onChange={(e) => setCurrentFee(e.target.value)} className="opes-input font-mono text-xs" />
              </div>
              <div>
                <label className="opes-label">Target Plan Fee (FCFA)</label>
                <input type="number" value={targetFee} onChange={(e) => setTargetFee(e.target.value)} className="opes-input font-mono text-xs" />
              </div>
              <div>
                <label className="opes-label">Days Left / 30</label>
                <input type="number" min={1} max={30} value={daysLeft} onChange={(e) => setDaysLeft(e.target.value)} className="opes-input font-mono text-xs" />
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 text-white text-right">
                <div className="text-[10px] text-slate-300 font-mono">
                  {proratedDelta >= 0 ? 'PRORATED UPGRADE DUE' : 'PRORATED CREDIT NOTE'}
                </div>
                <div className="font-mono text-sm font-bold text-amber-400">
                  {proratedDelta >= 0 ? `+${formatFcfa(proratedDelta)}` : formatFcfa(proratedDelta)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="font-display text-sm font-bold text-slate-900">Promo &amp; Referral Coupons</span>
                {canAdmin && (
                  <button type="button" onClick={() => setModal('coupon')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 text-white text-xs font-semibold">
                    <Plus className="w-3 h-3" /> Add Coupon
                  </button>
                )}
              </div>
              <div className="overflow-x-auto"><table className="w-full text-xs text-left">
                <thead>
                  <tr>
                    <th className="px-3 py-2.5">Code</th>
                    <th className="px-3 py-2.5">Discount</th>
                    <th className="px-3 py-2.5">Usage</th>
                    <th className="px-3 py-2.5">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2.5 font-mono font-bold text-amber-700">{c.code}</td>
                      <td className="px-3 py-2.5 font-mono">{c.type === 'PERCENT' ? `${c.value}% OFF` : `${formatFcfa(c.value)} OFF`}</td>
                      <td className="px-3 py-2.5 font-mono">{c.used} / {c.max}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-500">{c.expiresAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="font-display text-sm font-bold text-slate-900">Subscription Credit Notes</span>
                {canAdmin && (
                  <button type="button" onClick={() => setModal('credit')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0F172A] text-white text-xs font-semibold">
                    <Plus className="w-3 h-3" /> Issue Credit Note
                  </button>
                )}
              </div>
              <div className="overflow-x-auto"><table className="w-full text-xs text-left">
                <thead>
                  <tr>
                    <th className="px-3 py-2.5">Credit Note #</th>
                    <th className="px-3 py-2.5">Invoice</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {creditNotes.map((cn) => (
                    <tr key={cn.id}>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{cn.number}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">{cn.invoiceId}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">{formatFcfa(cn.amountFcfa)}</td>
                      <td className="px-3 py-2.5 text-slate-600">{cn.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {canAdmin && (
              <>
                <button type="button" onClick={() => setModal('delegation')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold">
                  <Plus className="w-3.5 h-3.5" /> Grant Temporary Delegation
                </button>
                <button type="button" onClick={() => setModal('review')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-semibold">
                  <UserCheck className="w-3.5 h-3.5" /> Log Access Recertification
                </button>
              </>
            )}
            <button type="button" onClick={() => setModal('breakglass')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" /> Emergency Break-Glass Elevation
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 font-display text-sm font-bold text-slate-900">
                Time-Bound Delegated Authority Grants
              </div>
              <div className="overflow-x-auto"><table className="w-full text-xs text-left">
                <thead>
                  <tr>
                    <th className="px-3 py-2.5">Grantee</th>
                    <th className="px-3 py-2.5">Scope</th>
                    <th className="px-3 py-2.5">Expires</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {delegations.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{d.grantee}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-700">{d.scope}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-500">{d.expiresAt}</td>
                      <td className="px-3 py-2.5 text-right">
                        {d.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (api.live) {
                                try { await api.send('PATCH', `/enterprise/iam/delegations/${d.id}/revoke`); await reload_delegations(); } catch (err) { failed(err); return; }
                              } else {
                                setDelegations((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: 'REVOKED' } : x)));
                              }
                              onNotify('success', `Revoked delegated grant for ${d.grantee}.`);
                            }}
                            className="px-2 py-1 rounded border border-red-200 text-red-700 text-[11px] font-semibold"
                          >
                            Revoke
                          </button>
                        ) : (
                          <span className="font-mono text-slate-400">REVOKED</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 font-display text-sm font-bold text-slate-900">
                Break-Glass &amp; Periodic Access Recertification Log
              </div>
              <div className="divide-y divide-slate-200 text-xs">
                {breakGlass.map((b) => (
                  <div key={b.id} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono font-bold text-red-700">BREAK-GLASS · {b.ticket} → {b.elevatedRole}</div>
                      <div className="text-slate-700 mt-0.5">{b.justification} ({b.actor})</div>
                    </div>
                    <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">{b.reviewStatus}</span>
                  </div>
                ))}
                {reviews.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">{r.cycle} Review · {r.email} ({r.role})</div>
                      <div className="text-slate-500">{r.notes}</div>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-emerald-700">{r.decision}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup Modals */}
      <FormModal open={modal === 'coupon'} title="Create Promotional / Referral Coupon" subtitle="Generates an active SaaS discount coupon code." onClose={() => setModal(null)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!cpnCode.trim()) return;
            if (api.live) {
              try {
                await api.send('POST', '/enterprise/billing/coupons', { code: cpnCode.trim().toUpperCase(), discountType: 'PERCENT', discountValue: Math.min(100, Math.max(1, Number(cpnVal) || 10)), maxRedemptions: 100, expiresAt: inOneYear() });
                await reload_coupons();
              } catch (err) { failed(err); return; }
            } else {
              setCoupons((prev) => [{ id: `cpn_${Date.now()}`, code: cpnCode.trim().toUpperCase(), type: 'PERCENT', value: Number(cpnVal) || 10, used: 0, max: 100, expiresAt: '2027-12-31' }, ...prev]);
            }
            setCpnCode('');
            setModal(null);
            onNotify('success', `Created coupon code ${cpnCode.trim().toUpperCase()}.`);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="opes-label">Coupon Code</label><input value={cpnCode} onChange={(e) => setCpnCode(e.target.value)} placeholder="e.g. LAUNCH25" className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Percent Discount (%)</label><input type="number" min={1} max={100} value={cpnVal} onChange={(e) => setCpnVal(e.target.value)} className="opes-input font-mono" required /></div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold">Save Coupon</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'credit'} title="Issue Subscription Credit Note" subtitle="Credits a tenant invoice for plan proration or SLA adjustments." onClose={() => setModal(null)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!cnReason.trim()) return;
            let num = `CN-2026-${Math.floor(1000 + Math.random() * 8999)}`;
            if (api.live) {
              try {
                const r = await api.send<{ creditNoteNumber?: string; number?: string }>('POST', '/enterprise/billing/credit-notes', { invoiceId: cnInv.trim(), amountFcfa: Math.max(1, Number(cnAmt) || 0), reason: cnReason.trim() });
                num = r?.creditNoteNumber ?? r?.number ?? num;
                await reload_creditNotes();
              } catch (err) { failed(err); return; }
            } else {
              setCreditNotes((prev) => [{ id: `cn_${Date.now()}`, number: num, invoiceId: cnInv.trim(), amountFcfa: Number(cnAmt) || 0, reason: cnReason.trim() }, ...prev]);
            }
            setCnReason('');
            setModal(null);
            onNotify('success', `Issued credit note ${num}.`);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="opes-label">Linked Invoice #</label><input value={cnInv} onChange={(e) => setCnInv(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Credit Amount (FCFA)</label><input type="number" min={1} value={cnAmt} onChange={(e) => setCnAmt(e.target.value)} className="opes-input font-mono" required /></div>
            <div className="sm:col-span-2"><label className="opes-label">Reason</label><input value={cnReason} onChange={(e) => setCnReason(e.target.value)} className="opes-input" required /></div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold">Issue Credit Note</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'delegation'} title="Grant Time-Bound Delegated Authority" subtitle="Temporarily delegates a specific approval scope with automatic expiry." onClose={() => setModal(null)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!dlgEmail.trim()) return;
            if (api.live) {
              try {
                await api.send('POST', '/enterprise/iam/delegations', { granteeEmail: dlgEmail.trim(), permissionScope: dlgScope.trim(), reason: dlgReason.trim() || 'Temporary cover', expiresAt: dlgExp });
                await reload_delegations();
              } catch (err) { failed(err); return; }
            } else {
              setDelegations((prev) => [{ id: `dlg_${Date.now()}`, grantee: dlgEmail.trim(), scope: dlgScope, reason: dlgReason.trim() || 'Temporary cover', expiresAt: dlgExp, status: 'ACTIVE' }, ...prev]);
            }
            setDlgEmail('');
            setDlgReason('');
            setModal(null);
            onNotify('success', `Granted temporary delegation ${dlgScope}.`);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="opes-label">Grantee Email</label><input type="email" value={dlgEmail} onChange={(e) => setDlgEmail(e.target.value)} className="opes-input" required /></div>
            <div><label className="opes-label">Permission Scope</label><input value={dlgScope} onChange={(e) => setDlgScope(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Expires On</label><input type="date" value={dlgExp} onChange={(e) => setDlgExp(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Reason</label><input value={dlgReason} onChange={(e) => setDlgReason(e.target.value)} className="opes-input" required /></div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold">Grant Delegation</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'breakglass'} title="Trigger Logged Break-Glass Elevation (2-Hour TTL)" subtitle="Every emergency elevation is recorded in the immutable security audit trail for mandatory review." onClose={() => setModal(null)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!bgReason.trim()) return;
            if (api.live) {
              try {
                await api.send('POST', '/enterprise/iam/break-glass', { elevatedRole: 'OWNER', incidentTicket: bgTicket.trim(), justification: bgReason.trim() });
                await reload_breakGlass();
              } catch (err) { failed(err); return; }
            } else {
              setBreakGlass((prev) => [{ id: `bg_${Date.now()}`, actor: `${role.toLowerCase()}@demo`, elevatedRole: 'OWNER', ticket: bgTicket.trim(), justification: bgReason.trim(), reviewStatus: 'PENDING_AUDIT' }, ...prev]);
            }
            setBgReason('');
            setModal(null);
            onNotify('success', `Break-glass elevation logged under incident ${bgTicket} (2-hour TTL).`);
          }}
          className="space-y-4"
        >
          <div><label className="opes-label">Incident Ticket #</label><input value={bgTicket} onChange={(e) => setBgTicket(e.target.value)} className="opes-input font-mono" required /></div>
          <div><label className="opes-label">Mandatory Emergency Justification</label><textarea rows={3} value={bgReason} onChange={(e) => setBgReason(e.target.value)} className="opes-input" required /></div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold">Activate Audited Break-Glass</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'review'} title="Record Periodic User Access Recertification" subtitle="Certifies or revokes staff account privileges during quarterly security reviews." onClose={() => setModal(null)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!revEmail.trim()) return;
            if (api.live) {
              try {
                await api.send('POST', '/enterprise/iam/access-reviews', { cycleLabel: quarterLabel(), targetUserEmail: revEmail.trim(), assignedRole: revRole.trim(), decision: revDecision, notes: 'Quarterly IAM recertification' });
                await reload_reviews();
              } catch (err) { failed(err); return; }
            } else {
              setReviews((prev) => [{ id: `rev_${Date.now()}`, cycle: '2026-Q4', email: revEmail.trim(), role: revRole, decision: revDecision, notes: 'Quarterly IAM recertification' }, ...prev]);
            }
            setRevEmail('');
            setModal(null);
            onNotify('success', `Recorded access recertification (${revDecision}) for ${revEmail}.`);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="opes-label">User Email</label><input type="email" value={revEmail} onChange={(e) => setRevEmail(e.target.value)} className="opes-input" required /></div>
            <div><label className="opes-label">Assigned Role</label><input value={revRole} onChange={(e) => setRevRole(e.target.value)} className="opes-input font-mono" required /></div>
            <div>
              <label className="opes-label">Decision</label>
              <select value={revDecision} onChange={(e) => setRevDecision(e.target.value as 'CERTIFIED' | 'REVOKED')} className="opes-input">
                <option value="CERTIFIED">CERTIFIED (Keep Active)</option>
                <option value="REVOKED">REVOKED (Flag for removal — recorded in audit trail)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold">Save Recertification</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
