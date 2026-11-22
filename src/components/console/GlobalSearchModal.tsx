import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Search, X } from 'lucide-react';
import { AuditLogItem } from '../../api/demoDataset1000';
import { formatFcfa, formatLitres } from '../../domain/formatters';
import {
  Employee,
  FinancialReportBundle,
  FleetAccount,
  FuelTank,
  JournalEntry,
  Pump,
  PurchaseOrder,
  ShiftRecord,
  ShopItem,
} from '../../domain/types';
import { printAuditEvidencePackPdf } from '../../utils/documentTemplates';

interface SearchResultItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  section:
    | 'overview'
    | 'forecourt'
    | 'inventory'
    | 'fleet'
    | 'workforce'
    | 'accounting'
    | 'hse-fraud'
    | 'enterprise-ops'
    | 'admin';
}

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  organizationName: string;
  stationScope: string;
  pumps: Pump[];
  tanks: FuelTank[];
  shifts: ShiftRecord[];
  employees: Employee[];
  fleetAccounts: FleetAccount[];
  shopItems: ShopItem[];
  purchaseOrders: PurchaseOrder[];
  journals: JournalEntry[];
  auditLogs: AuditLogItem[];
  report: FinancialReportBundle;
  onNavigateSection: (section: SearchResultItem['section']) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  open,
  onClose,
  organizationName,
  stationScope,
  pumps,
  tanks,
  shifts,
  employees,
  fleetAccounts,
  shopItems,
  purchaseOrders,
  journals,
  auditLogs,
  report,
  onNavigateSection,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const index = useMemo<SearchResultItem[]>(() => {
    const items: SearchResultItem[] = [];
    for (const p of pumps) {
      items.push({
        id: `pump-${p.id}`,
        category: 'PUMP',
        title: `${p.code} (${p.grade})`,
        subtitle: `Totalizer ${formatLitres(p.totalizerLitres)} · ${formatFcfa(p.unitPriceFcfa)}/L · ${p.status}`,
        section: 'forecourt',
      });
    }
    for (const t of tanks) {
      items.push({
        id: `tank-${t.id}`,
        category: 'TANK',
        title: t.name,
        subtitle: `${t.grade} · Book ${formatLitres(t.bookVolumeLitres)} / ${formatLitres(t.capacityLitres)} · ${t.status}`,
        section: 'inventory',
      });
    }
    for (const s of shifts.slice(0, 40)) {
      items.push({
        id: `shift-${s.id}`,
        category: 'SHIFT',
        title: `${s.id} · ${s.pumpCode} (${s.attendantName})`,
        subtitle: `${formatLitres(s.litresSold)} sold · Expected ${formatFcfa(s.expectedRevenueFcfa)} · ${s.status}`,
        section: 'forecourt',
      });
    }
    for (const e of employees) {
      items.push({
        id: `emp-${e.id}`,
        category: 'EMPLOYEE',
        title: `${e.fullName} (${e.role})`,
        subtitle: `${e.phone} · Base ${formatFcfa(e.baseSalaryFcfa)} · Shift ${e.shiftWindow}`,
        section: 'workforce',
      });
    }
    for (const f of fleetAccounts) {
      items.push({
        id: `fleet-${f.id}`,
        category: 'FLEET',
        title: f.companyName,
        subtitle: `NIU ${f.taxId} · Balance ${formatFcfa(f.balanceOwedFcfa)} / Limit ${formatFcfa(f.creditLimitFcfa)}`,
        section: 'fleet',
      });
    }
    for (const i of shopItems) {
      items.push({
        id: `sku-${i.id}`,
        category: 'SHOP SKU',
        title: `${i.sku} — ${i.name}`,
        subtitle: `${i.category} · Stock ${i.stockQty} · ${formatFcfa(i.unitPriceFcfa)}`,
        section: 'fleet',
      });
    }
    for (const po of purchaseOrders) {
      items.push({
        id: `po-${po.id}`,
        category: 'PO',
        title: `${po.id} · ${po.supplierName}`,
        subtitle: `${po.grade} · ${formatLitres(po.orderedLitres)} · ${po.status}`,
        section: 'inventory',
      });
    }
    for (const j of journals.slice(0, 30)) {
      items.push({
        id: `jr-${j.id}`,
        category: 'JOURNAL',
        title: `${j.reference} — ${j.description}`,
        subtitle: `${j.sourceEvent} · ${j.lines.length} double-entry lines`,
        section: 'accounting',
      });
    }
    return items;
  }, [employees, fleetAccounts, journals, pumps, purchaseOrders, shifts, shopItems, tanks]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const matches = q
    ? index.filter((item) => `${item.category} ${item.title} ${item.subtitle}`.toLowerCase().includes(q)).slice(0, 20)
    : index.slice(0, 12);

  const exportAuditJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      organizationName,
      stationScope,
      financialSummary: {
        totalRevenueFcfa: report.totalRevenueFcfa,
        netIncomeFcfa: report.netIncomeFcfa,
        vatPayableFcfa: report.vatPayableFcfa,
        trialBalanceBalanced: report.trialBalanceBalanced,
      },
      counts: {
        pumps: pumps.length,
        tanks: tanks.length,
        shifts: shifts.length,
        employees: employees.length,
        fleetAccounts: fleetAccounts.length,
        journals: journals.length,
        auditLogs: auditLogs.length,
      },
      auditLogs: auditLogs.slice(0, 100),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opesfuel-audit-evidence-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-start justify-center p-4 sm:pt-16">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shifts, pumps, tanks, employees, fleet NIU, POs, or journal vouchers..."
            className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Close global search">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {matches.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigateSection(item.section);
                onClose();
              }}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                    {item.category}
                  </span>
                  <span className="text-xs font-semibold text-slate-950 truncate">{item.title}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">{item.subtitle}</div>
              </div>
              <span className="text-[11px] font-mono text-amber-700 shrink-0">Open →</span>
            </button>
          ))}
          {matches.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-slate-500">
              No station records matched &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 font-mono">M56 Universal Search &amp; Audit Evidence</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                printAuditEvidencePackPdf({
                  organizationName,
                  stationScope,
                  summaryRows: [
                    ['Total Fuel & Shop Revenue', formatFcfa(report.totalRevenueFcfa)],
                    ['Net Profit (Current Period)', formatFcfa(report.netIncomeFcfa)],
                    ['VAT Payable (19.25%)', formatFcfa(report.vatPayableFcfa)],
                    ['Trial Balance Integrity', report.trialBalanceBalanced ? 'BALANCED' : 'REVIEW'],
                    ['Indexed Pumps / Tanks / Shifts', `${pumps.length} / ${tanks.length} / ${shifts.length}`],
                    ['Immutable Audit Log Entries', String(auditLogs.length)],
                  ],
                  recentAuditLogs: auditLogs,
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-semibold"
            >
              <FileText className="w-3 h-3 text-amber-400" /> Audit Evidence PDF
            </button>
            <button
              type="button"
              onClick={exportAuditJson}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
            >
              <Download className="w-3 h-3" /> Evidence JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
