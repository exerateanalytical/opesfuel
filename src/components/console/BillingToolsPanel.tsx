import React, { useState } from 'react';
import { Calculator, Globe2, Receipt, Smartphone, BellRing } from 'lucide-react';
import { useLiveApi, useLiveList } from '../../api/liveApi';
import { formatFcfa } from '../../domain/formatters';
import type { UserRole } from '../../domain/types';

type Notify = (type: 'success' | 'error', message: string) => void;
type Row = Record<string, unknown>;
const s = (v: unknown) => (v === undefined || v === null ? '' : String(v));
const n = (v: unknown) => Number(v ?? 0);
const fieldCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
const STATES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE', 'RESTRICTED', 'CANCELLED', 'EXPIRED'];

const Table: React.FC<{ head: string[]; rows: React.ReactNode[][]; empty: string; loading?: boolean }> = ({ head, rows, empty, loading }) => (
  <div className="border border-slate-200 rounded-xl overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-slate-900 text-white text-left"><tr>{head.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r, i) => <tr key={i} className="hover:bg-slate-50">{r.map((c, j) => <td key={j} className="px-4 py-3">{c}</td>)}</tr>)}
        {rows.length === 0 && <tr><td colSpan={head.length} className="px-4 py-6 text-center text-slate-500">{loading ? 'Loading...' : empty}</td></tr>}
      </tbody>
    </table>
  </div>
);

const Badge: React.FC<{ v: string }> = ({ v }) => {
  const good = ['PAID', 'SUCCESS', 'SUCCESSFUL', 'SETTLED', 'COMPLETED', 'ACTIVE'].includes(v.toUpperCase());
  const bad = ['FAILED', 'REFUNDED', 'EXPIRED', 'CANCELLED'].includes(v.toUpperCase());
  return <span className={`px-2 py-0.5 rounded-full font-semibold ${good ? 'bg-emerald-100 text-emerald-800' : bad ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{v}</span>;
};

const PaymentsTab: React.FC = () => {
  const { items, loading, error } = useLiveList<Row, Row>('/billing/payments', [], (r) => r);
  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Table loading={loading} empty="No subscription payments yet." head={['Date', 'Invoice', 'Provider', 'Reference', 'Amount', 'Status']}
        rows={items.map((p) => [s(p.createdAt).slice(0, 10), s(p.invoiceId), s(p.provider), s(p.externalRef), <span className="font-mono">{formatFcfa(n(p.amountFcfa))}</span>, <Badge v={s(p.status)} />])} />
    </div>
  );
};

const MomoTab: React.FC<{ role: UserRole; notify: Notify }> = ({ role, notify }) => {
  const api = useLiveApi();
  const { items, loading, error, reload } = useLiveList<Row, Row>('/payments/momo', [], (r) => r);
  const [prov, setProv] = useState<Row | null>(null);
  React.useEffect(() => {
    if (!api.live) return;
    api.get<Row>('/payments/momo/providers/status').then(setProv).catch(() => setProv(null));
  }, [api]);
  const canRefund = role === 'OWNER' || role === 'PLATFORM_ADMIN';
  const refund = async (id: string) => {
    if (!window.confirm('Refund this MTN Mobile Money payment? This sends the money back to the customer.')) return;
    try { await api.send('POST', `/payments/momo/${encodeURIComponent(id)}/refund`); notify('success', 'Refund requested.'); await reload(); }
    catch (e) { notify('error', e instanceof Error ? e.message : 'Refund failed'); }
  };
  const provCard = (label: string, p: unknown) => {
    const o = (p ?? {}) as Row;
    return (
      <div className="rounded-xl border border-slate-200 p-3 text-xs">
        <div className="font-semibold text-slate-900">{label}</div>
        <div className={o.configured ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>{o.configured ? 'Connected' : 'Not configured yet'}</div>
        {o.environment ? <div className="text-slate-500">Environment: {s(o.environment)} · {s(o.currency)}</div> : null}
      </div>
    );
  };
  return (
    <div className="space-y-3">
      {prov && <div className="grid sm:grid-cols-2 gap-3">{provCard('MTN Mobile Money', prov.mtnMomo)}{provCard('Orange Money', prov.orangeMoney)}</div>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Table loading={loading} empty="No Mobile Money payments yet." head={['Date', 'Phone', 'Provider', 'For', 'Amount', 'Status', '']}
        rows={items.map((t) => [s(t.createdAt).slice(0, 16).replace('T', ' '), s(t.msisdn), s(t.provider), s(t.targetType), <span className="font-mono">{formatFcfa(n(t.amountFcfa))}</span>, <Badge v={s(t.status)} />,
          canRefund && s(t.provider) === 'MTN_MOMO' && ['SUCCESSFUL', 'SUCCESS', 'COMPLETED', 'SETTLED'].includes(s(t.status).toUpperCase())
            ? <button type="button" onClick={() => void refund(s(t.id))} className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 font-semibold">Refund</button> : null])} />
    </div>
  );
};

const DunningTab: React.FC<{ role: UserRole; notify: Notify }> = ({ role, notify }) => {
  const api = useLiveApi();
  const { items, loading, error, reload } = useLiveList<Row, Row>('/enterprise/billing/dunning', [], (r) => r);
  const [prev, setPrev] = useState('ACTIVE');
  const [next, setNext] = useState('PAST_DUE');
  const [channel, setChannel] = useState('EMAIL');
  const [note, setNote] = useState('');
  const canWrite = role === 'OWNER' || role === 'PLATFORM_ADMIN';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) { notify('error', 'Add a short note.'); return; }
    try { await api.send('POST', '/enterprise/billing/dunning', { previousState: prev, newState: next, channel, note: note.trim() }); setNote(''); notify('success', 'Recorded.'); await reload(); }
    catch (er) { notify('error', er instanceof Error ? er.message : 'Failed'); }
  };
  return (
    <div className="space-y-3">
      {canWrite && api.live && (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end rounded-xl border border-slate-200 p-4 bg-slate-50">
          <label className="text-xs font-semibold text-slate-600">From<select className={fieldCls} value={prev} onChange={(e) => setPrev(e.target.value)}>{STATES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">To<select className={fieldCls} value={next} onChange={(e) => setNext(e.target.value)}>{STATES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Channel<select className={fieldCls} value={channel} onChange={(e) => setChannel(e.target.value)}>{['EMAIL', 'SMS', 'WHATSAPP', 'CALL'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600 lg:col-span-1">Note<input className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reminder sent" /></label>
          <button className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Record</button>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Table loading={loading} empty="No subscription status changes recorded." head={['When', 'From', 'To', 'Channel', 'Note']}
        rows={items.map((d) => [s(d.recordedAt).slice(0, 16).replace('T', ' '), s(d.previousState), s(d.newState), s(d.channel), s(d.note)])} />
    </div>
  );
};

const ProrationTab: React.FC<{ notify: Notify }> = ({ notify }) => {
  const api = useLiveApi();
  const [cur, setCur] = useState('50000');
  const [target, setTarget] = useState('120000');
  const [left, setLeft] = useState('15');
  const [total, setTotal] = useState('30');
  const [res, setRes] = useState<Row | null>(null);
  const calc = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { currentMonthlyFeeFcfa: Number(cur), targetMonthlyFeeFcfa: Number(target), daysRemainingInCycle: Number(left), totalDaysInCycle: Number(total) };
    if (!api.live) { // same arithmetic as the server, so the demo can show it
      const ratio = Math.min(1, body.daysRemainingInCycle / Math.max(1, body.totalDaysInCycle));
      const unused = Math.round(body.currentMonthlyFeeFcfa * ratio); const prorated = Math.round(body.targetMonthlyFeeFcfa * ratio);
      setRes({ unusedCreditFcfa: unused, proratedTargetFcfa: prorated, netProratedDeltaFcfa: prorated - unused, action: prorated - unused >= 0 ? 'INVOICE_UPGRADE_DELTA' : 'ISSUE_CREDIT_NOTE' });
      return;
    }
    try { setRes(await api.send<Row>('POST', '/enterprise/billing/proration-preview', body)); }
    catch (er) { notify('error', er instanceof Error ? er.message : 'Failed'); }
  };
  const net = n(res?.netProratedDeltaFcfa);
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Shows what a customer owes (or is credited) when they change plan part-way through a billing cycle.</p>
      <form onSubmit={calc} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end rounded-xl border border-slate-200 p-4 bg-slate-50">
        <label className="text-xs font-semibold text-slate-600">Current monthly fee<input className={fieldCls} type="number" min="0" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-600">New monthly fee<input className={fieldCls} type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-600">Days left<input className={fieldCls} type="number" min="1" value={left} onChange={(e) => setLeft(e.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-600">Days in cycle<input className={fieldCls} type="number" min="1" value={total} onChange={(e) => setTotal(e.target.value)} /></label>
        <button className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Calculate</button>
      </form>
      {res && (
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-slate-500">Unused credit on current plan</div><div className="font-mono text-lg font-bold">{formatFcfa(n(res.unusedCreditFcfa))}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-slate-500">Cost of new plan for the rest of the cycle</div><div className="font-mono text-lg font-bold">{formatFcfa(n(res.proratedTargetFcfa))}</div></div>
          <div className={`rounded-xl border p-3 ${net >= 0 ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}><div className="text-slate-600">{net >= 0 ? 'Customer pays now' : 'Credit note to issue'}</div><div className="font-mono text-lg font-bold">{formatFcfa(Math.abs(net))}</div></div>
        </div>
      )}
    </div>
  );
};

const CountryPacksTab: React.FC = () => {
  const demo: Row[] = [{ countryCode: 'CM', countryName: 'Cameroon', zone: 'CEMAC', currency: 'XAF', vatRatePct: 19.25, socialAuthority: 'CNPS', employeeSocialPct: 4.2, employerSocialPct: 11.2, accountingStandard: 'SYSCOHADA' }];
  const { items, loading, error } = useLiveList<Row, Row>('/enterprise/country-packs', demo, (r) => r);
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Tax, payroll-contribution and accounting rules built in for each country we support.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Table loading={loading} empty="No country packs." head={['Country', 'Zone', 'Currency', 'VAT', 'Social authority', 'Employee / Employer', 'Accounting']}
        rows={items.map((c) => [<b>{s(c.countryName)} ({s(c.countryCode)})</b>, s(c.zone), s(c.currency), `${n(c.vatRatePct)}%`, s(c.socialAuthority), `${n(c.employeeSocialPct)}% / ${n(c.employerSocialPct)}%`, s(c.accountingStandard)])} />
    </div>
  );
};

type Tab = 'payments' | 'momo' | 'dunning' | 'proration' | 'packs';

export const BillingToolsPanel: React.FC<{ role: UserRole; onNotify: Notify }> = ({ role, onNotify }) => {
  const [tab, setTab] = useState<Tab>('payments');
  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'payments', label: 'Subscription payments', icon: Receipt },
    { id: 'momo', label: 'Mobile Money', icon: Smartphone },
    { id: 'dunning', label: 'Payment reminders', icon: BellRing },
    { id: 'proration', label: 'Plan change calculator', icon: Calculator },
    { id: 'packs', label: 'Country rules', icon: Globe2 },
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold text-slate-900">Payments, reminders &amp; country rules</h3>
        <p className="text-xs text-slate-500">Every payment received, Mobile Money refunds, overdue-payment history, plan-change maths and the rules for each country.</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((t) => { const Icon = t.icon; return (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${tab === t.id ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            <Icon className="w-3.5 h-3.5" /> {t.label}
          </button>); })}
      </div>
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'momo' && <MomoTab role={role} notify={onNotify} />}
      {tab === 'dunning' && <DunningTab role={role} notify={onNotify} />}
      {tab === 'proration' && <ProrationTab notify={onNotify} />}
      {tab === 'packs' && <CountryPacksTab />}
    </div>
  );
};
