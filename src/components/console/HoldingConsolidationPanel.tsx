import React, { useMemo, useState } from 'react';
import { Building2, Download, Globe2, Layers, Scale } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

interface SubsidiaryRow {
  tenantId: string;
  name: string;
  country: string;
  functionalCurrency: 'XAF' | 'XOF' | 'USD';
  ownershipPct: number;
  revenue: number;
  cogs: number;
  opex: number;
  assets: number;
  liabilities: number;
  equity: number;
}

interface HoldingConsolidationPanelProps {
  role: UserRole;
  onPostBackend: (path: string, method: 'POST' | 'PATCH' | 'PUT', body?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const HoldingConsolidationPanel: React.FC<HoldingConsolidationPanelProps> = ({
  role,
  onPostBackend,
  onNotify,
}) => {
  const canEliminate = role === 'PLATFORM_ADMIN' || role === 'GROUP_CFO';
  const [groupName] = useState('OpesEnergy Central & West Africa Holding SA');
  const [reportingCcy, setReportingCcy] = useState<'XAF' | 'XOF' | 'USD'>('XAF');
  const [fxXafPerUsd, setFxXafPerUsd] = useState(605);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [intercoEliminatedXaf, setIntercoEliminatedXaf] = useState(14_500_000);
  const [addSubOpen, setAddSubOpen] = useState(false);

  const [subsidiaries, setSubsidiaries] = useState<SubsidiaryRow[]>([
    { tenantId: 'ten_opes_cm', name: 'OpesFuel Cameroun SA', country: 'CM (CEMAC)', functionalCurrency: 'XAF', ownershipPct: 100, revenue: 185_000_000, cogs: 148_000_000, opex: 16_500_000, assets: 420_000_000, liabilities: 155_000_000, equity: 265_000_000 },
    { tenantId: 'ten_opes_sn', name: 'OpesFuel Senegal SA', country: 'SN (UEMOA)', functionalCurrency: 'XOF', ownershipPct: 80, revenue: 94_000_000, cogs: 74_200_000, opex: 9_800_000, assets: 210_000_000, liabilities: 82_000_000, equity: 128_000_000 },
    { tenantId: 'ten_opes_lr', name: 'OpesFuel Liberia Corp', country: 'LR (USD)', functionalCurrency: 'USD', ownershipPct: 100, revenue: 112_000, cogs: 86_000, opex: 12_000, assets: 340_000, liabilities: 110_000, equity: 230_000 },
  ]);

  const [newSubId, setNewSubId] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCcy, setNewSubCcy] = useState<'XAF' | 'XOF' | 'USD'>('XOF');
  const [newSubOwn, setNewSubOwn] = useState('75');

  const convert = (amount: number, from: 'XAF' | 'XOF' | 'USD', to: 'XAF' | 'XOF' | 'USD') => {
    if (from === to) return amount;
    const inXaf = from === 'USD' ? amount * fxXafPerUsd : amount;
    return to === 'USD' ? inXaf / fxXafPerUsd : inXaf;
  };

  const fmt = (val: number) =>
    reportingCcy === 'USD'
      ? `$${Math.round(val).toLocaleString('en-US')}`
      : `${Math.round(val).toLocaleString('en-US').replace(/,/g, ' ')} ${reportingCcy}`;

  const summary = useMemo(() => {
    let grossRev = 0;
    let grossCogs = 0;
    let opex = 0;
    let assets = 0;
    let liab = 0;
    let equity = 0;
    let controllingNi = 0;
    let minorityNi = 0;
    let minorityEq = 0;

    for (const s of subsidiaries) {
      const r = convert(s.revenue, s.functionalCurrency, reportingCcy);
      const c = convert(s.cogs, s.functionalCurrency, reportingCcy);
      const o = convert(s.opex, s.functionalCurrency, reportingCcy);
      const a = convert(s.assets, s.functionalCurrency, reportingCcy);
      const l = convert(s.liabilities, s.functionalCurrency, reportingCcy);
      const e = convert(s.equity, s.functionalCurrency, reportingCcy);
      const ni = r - c - o;
      grossRev += r;
      grossCogs += c;
      opex += o;
      assets += a;
      liab += l;
      equity += e;
      controllingNi += ni * (s.ownershipPct / 100);
      minorityNi += ni * ((100 - s.ownershipPct) / 100);
      minorityEq += e * ((100 - s.ownershipPct) / 100);
    }

    const elim = convert(intercoEliminatedXaf, 'XAF', reportingCcy);
    const consolidatedRev = Math.max(0, grossRev - elim);
    const consolidatedCogs = Math.max(0, grossCogs - elim);
    const consolidatedNi = consolidatedRev - consolidatedCogs - opex;
    return { grossRev, elim, consolidatedRev, consolidatedCogs, opex, consolidatedNi, controllingNi, minorityNi, assets: assets - elim, liab: liab - elim, equity, minorityEq };
  }, [subsidiaries, reportingCcy, fxXafPerUsd, intercoEliminatedXaf]);

  const handleRunElimination = async () => {
    await onPostBackend(`/api/v1/consolidation/groups/hgrp_default/eliminate?period=${encodeURIComponent(period)}`, 'POST');
    setIntercoEliminatedXaf((v) => v + 2_500_000);
    onNotify('success', `Executed inter-company elimination entries for ${period} at ${fxXafPerUsd} XAF/USD.`);
  };

  const handleAddSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubId.trim() || !newSubName.trim()) return;
    await onPostBackend('/api/v1/consolidation/groups/hgrp_default/members', 'POST', {
      tenantId: newSubId.trim(),
      functionalCurrency: newSubCcy,
      ownershipPct: Number(newSubOwn),
    });
    setSubsidiaries((prev) => [
      ...prev,
      { tenantId: newSubId.trim(), name: newSubName.trim(), country: newSubCcy, functionalCurrency: newSubCcy, ownershipPct: Number(newSubOwn), revenue: 45_000_000, cogs: 35_000_000, opex: 4_000_000, assets: 90_000_000, liabilities: 30_000_000, equity: 60_000_000 },
    ]);
    setNewSubId('');
    setNewSubName('');
    setAddSubOpen(false);
    onNotify('success', `Linked subsidiary ${newSubName.trim()} (${newSubOwn}% ownership).`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${groupName} — Multi-Subsidiary Consolidated Financial Pack (${period})`, 14, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Reporting Currency: ${reportingCcy} · FX: 1 USD = ${fxXafPerUsd} XAF (XAF/XOF 1:1 CFA Parity) · Inter-Company Eliminations: ${fmt(summary.elim)}`, 14, 20);

    autoTable(doc, {
      startY: 32,
      head: [['Subsidiary', 'Func. CCY', 'Ownership %', 'NCI %', `Revenue (${reportingCcy})`, `COGS (${reportingCcy})`, `OpEx (${reportingCcy})`, `Net Income (${reportingCcy})`]],
      body: subsidiaries.map((s) => {
        const r = convert(s.revenue, s.functionalCurrency, reportingCcy);
        const c = convert(s.cogs, s.functionalCurrency, reportingCcy);
        const o = convert(s.opex, s.functionalCurrency, reportingCcy);
        return [s.name, s.functionalCurrency, `${s.ownershipPct}%`, `${100 - s.ownershipPct}%`, fmt(r), fmt(c), fmt(o), fmt(r - c - o)];
      }),
      foot: [['CONSOLIDATED (NET OF ELIMINATIONS)', reportingCcy, 'GROUP', 'NCI ' + fmt(summary.minorityNi), fmt(summary.consolidatedRev), fmt(summary.consolidatedCogs), fmt(summary.opex), fmt(summary.consolidatedNi)]],
      headStyles: { fillColor: [15, 23, 42] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 8.5 },
    });
    doc.save(`consolidated-group-pack-${period}-${reportingCcy.toLowerCase()}.pdf`);
    onNotify('success', `Exported Consolidated Group Financial Pack PDF (${reportingCcy}).`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-slate-900" />
            Holding-Company Multi-Subsidiary Consolidation (CEMAC / UEMOA / USD)
          </h3>
          <p className="text-xs text-slate-500">
            {groupName} · Multi-currency translation (XAF/XOF 1:1 parity + platform USD FX), inter-company eliminations &amp; Minority Interest (NCI).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
          <select value={reportingCcy} onChange={(e) => setReportingCcy(e.target.value as 'XAF' | 'XOF' | 'USD')} className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white">
            <option value="XAF">Report in XAF</option>
            <option value="XOF">Report in XOF</option>
            <option value="USD">Report in USD</option>
          </select>
          <input
            type="number"
            value={fxXafPerUsd}
            onChange={(e) => setFxXafPerUsd(Math.max(100, Number(e.target.value) || 605))}
            title="Platform XAF per USD FX Rate"
            className="w-24 px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-mono"
          />
          {canEliminate && (
            <>
              <button type="button" onClick={() => setAddSubOpen(true)} className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50 inline-flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Add Subsidiary
              </button>
              <button type="button" onClick={() => void handleRunElimination()} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center gap-1">
                <Scale className="w-3.5 h-3.5" /> Run Eliminations
              </button>
            </>
          )}
          <button type="button" onClick={exportPdf} className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export Group PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] uppercase font-semibold text-slate-500">Consolidated Revenue</div>
          <div className="font-mono text-lg font-bold text-slate-900">{fmt(summary.consolidatedRev)}</div>
          <div className="text-[11px] text-slate-500">Eliminated: {fmt(summary.elim)}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] uppercase font-semibold text-slate-500">Consolidated Net Income</div>
          <div className="font-mono text-lg font-bold text-emerald-700">{fmt(summary.consolidatedNi)}</div>
          <div className="text-[11px] text-slate-500">Parent: {fmt(summary.controllingNi)}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] uppercase font-semibold text-slate-500">Minority Interest (NCI)</div>
          <div className="font-mono text-lg font-bold text-amber-700">{fmt(summary.minorityNi)}</div>
          <div className="text-[11px] text-slate-500">NCI Equity: {fmt(summary.minorityEq)}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] uppercase font-semibold text-slate-500">Consolidated Assets</div>
          <div className="font-mono text-lg font-bold text-slate-900">{fmt(summary.assets)}</div>
          <div className="text-[11px] text-slate-500">Liabilities: {fmt(summary.liab)}</div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-900 text-white text-left">
            <tr>
              <th className="px-4 py-3">Legal Subsidiary</th>
              <th className="px-4 py-3">Functional CCY</th>
              <th className="px-4 py-3 text-right">Ownership / NCI</th>
              <th className="px-4 py-3 text-right">Revenue ({reportingCcy})</th>
              <th className="px-4 py-3 text-right">Net Income ({reportingCcy})</th>
              <th className="px-4 py-3 text-right">Total Assets ({reportingCcy})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subsidiaries.map((s) => {
              const r = convert(s.revenue, s.functionalCurrency, reportingCcy);
              const ni = convert(s.revenue - s.cogs - s.opex, s.functionalCurrency, reportingCcy);
              const a = convert(s.assets, s.functionalCurrency, reportingCcy);
              return (
                <tr key={s.tenantId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="font-mono text-[11px] text-slate-500">{s.tenantId} · {s.country}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">{s.functionalCurrency}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.ownershipPct}% / {100 - s.ownershipPct}%</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(r)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{fmt(ni)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(a)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FormModal open={addSubOpen} onClose={() => setAddSubOpen(false)} title="Assign Subsidiary Tenant to Holding Group">
        <form onSubmit={(e) => void handleAddSub(e)} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Subsidiary Tenant ID</label>
            <input type="text" required value={newSubId} onChange={(e) => setNewSubId(e.target.value)} placeholder="ten_opes_ci" className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Legal Entity Name</label>
            <input type="text" required value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="OpesFuel Cote d'Ivoire SA" className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Functional Currency</label>
              <select value={newSubCcy} onChange={(e) => setNewSubCcy(e.target.value as 'XAF' | 'XOF' | 'USD')} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                <option value="XAF">XAF (CEMAC)</option>
                <option value="XOF">XOF (UEMOA)</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Parent Ownership %</label>
              <input type="number" min="1" max="100" required value={newSubOwn} onChange={(e) => setNewSubOwn(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddSubOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Link Subsidiary</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
