import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Download, FileSpreadsheet, FileText, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { CHART_OF_ACCOUNTS, OpesFuelApiEngine } from '../../api/opesfuelClient';
import { canPerformAction } from '../../auth/auth0';
import { formatFcfa, formatShortDate } from '../../domain/formatters';
import {
  FinancialReportBundle,
  JournalEntry,
  ShiftRecord,
  StationExpense,
  TreasuryDeposit,
  UserRole,
} from '../../domain/types';
import {
  exportAccountantAuditWorkbookExcel,
  printDailyZReportPdf,
  printJournalVoucherPdf,
  printStatutoryVatTaxPackPdf,
} from '../../utils/documentTemplates';
import { exportAccountingExcel, exportAccountingPdf } from '../../utils/exportReports';
import { FormModal } from '../shared/FormModal';
import { AccountingAdvancedPanel } from './AccountingAdvancedPanel';

interface AccountingSectionProps {
  engine: OpesFuelApiEngine;
  role: UserRole;
  stationId: string;
  defaultStationId: string;
  report: FinancialReportBundle;
  shifts?: ShiftRecord[];
  journals: JournalEntry[];
  expenses: StationExpense[];
  deposits: TreasuryDeposit[];
  onRecordExpense: (input: {
    stationId: string;
    category: StationExpense['category'];
    description: string;
    amountFcfa: number;
    paymentSource: StationExpense['paymentSource'];
  }) => void;
  onDeleteExpense: (expenseId: string) => void;
  onRecordDeposit: (input: {
    stationId: string;
    sourceAccount: TreasuryDeposit['sourceAccount'];
    bankName: string;
    slipReference: string;
    amountFcfa: number;
  }) => void;
  onDeleteDeposit: (depositId: string) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
  vaultSlot?: React.ReactNode;
}

export const AccountingSection: React.FC<AccountingSectionProps> = ({
  engine,
  role,
  stationId,
  defaultStationId,
  report,
  shifts = [],
  journals,
  expenses,
  deposits,
  onRecordExpense,
  onDeleteExpense,
  onRecordDeposit,
  onDeleteDeposit,
  onNotify,
  vaultSlot,
}) => {
  const canPost = canPerformAction(role, 'RECORD_EXPENSE_DEPOSIT');
  const effectiveStation = stationId === 'ALL' ? defaultStationId : stationId;

  const [reportTab, setReportTab] = useState<'pnl' | 'balance' | 'trial' | 'cashflow' | 'journals' | 'accounts'>('pnl');
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [drillAccountCode, setDrillAccountCode] = useState<string | null>(null);
  const [journalSearch, setJournalSearch] = useState('');
  const [journalEventFilter, setJournalEventFilter] = useState<string>('ALL');
  const [acctModal, setAcctModal] = useState<'expense' | 'deposit' | null>(null);

  const [expCat, setExpCat] = useState<StationExpense['category']>('MAINTENANCE');
  const [expDesc, setExpDesc] = useState('Dispenser hose seal replacement');
  const [expAmount, setExpAmount] = useState('45000');
  const [expSource, setExpSource] = useState<StationExpense['paymentSource']>('CASH_SAFE');

  const [depSource, setDepSource] = useState<TreasuryDeposit['sourceAccount']>('MOBILE_MONEY_CLEARING');
  const [depBank, setDepBank] = useState('Afriland First Bank');
  const [depSlip, setDepSlip] = useState('MOMO-CLR-2026');
  const [depAmount, setDepAmount] = useState('250000');

  const visibleJournals = journals.filter((j) => stationId === 'ALL' || j.stationId === stationId);
  const filteredJournals = visibleJournals.filter((j) => {
    const q = journalSearch.trim().toLowerCase();
    const matchesEvent = journalEventFilter === 'ALL' || j.sourceEvent.toUpperCase().includes(journalEventFilter);
    const matchesText =
      !q ||
      j.reference.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q) ||
      j.sourceEvent.toLowerCase().includes(q) ||
      j.lines.some((l) => l.accountCode.toLowerCase().includes(q) || l.accountName.toLowerCase().includes(q));
    return matchesEvent && matchesText;
  });
  const visibleExpenses = expenses.filter((ex) => stationId === 'ALL' || ex.stationId === stationId);
  const visibleDeposits = deposits.filter((dep) => stationId === 'ALL' || dep.stationId === stationId);
  const visibleShifts = shifts.filter((s) => stationId === 'ALL' || s.stationId === stationId);

  const exportCsv = () => {
    const header = 'Account Code,Account Name,Type,Debit (FCFA),Credit (FCFA),Net Balance (FCFA)\n';
    const rows = report.trialBalance
      .map(
        (r) =>
          `${r.accountCode},"${r.accountName}",${r.accountType},${r.debitTotalFcfa},${r.creditTotalFcfa},${r.netBalanceFcfa}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opesfuel-financial-report-${stationId.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim()) return;
    onRecordExpense({
      stationId: effectiveStation,
      category: expCat,
      description: expDesc.trim(),
      amountFcfa: Number(expAmount) || 0,
      paymentSource: expSource,
    });
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depBank.trim() || !depSlip.trim()) return;
    onRecordDeposit({
      stationId: effectiveStation,
      sourceAccount: depSource,
      bankName: depBank.trim(),
      slipReference: depSlip.trim(),
      amountFcfa: Number(depAmount) || 0,
    });
  };

  const totalAssets =
    report.cashOnHandFcfa +
    report.mobileMoneyClearingFcfa +
    report.bankBalanceFcfa +
    report.fleetReceivablesFcfa +
    report.inventoryAssetFcfa;
  const totalLiabilities = report.accountsPayableFcfa + report.vatPayableFcfa;

  // Dedicated Journal Voucher Detail View
  const activeDetailJournal = selectedJournalId ? journals.find((j) => j.id === selectedJournalId) : null;
  if (activeDetailJournal) {
    const debitSum = activeDetailJournal.lines.reduce((s, l) => s + l.debitFcfa, 0);
    const creditSum = activeDetailJournal.lines.reduce((s, l) => s + l.creditFcfa, 0);
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <button
            type="button"
            onClick={() => setSelectedJournalId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Accounting &amp; Journal Ledger
          </button>
          <button
            type="button"
            onClick={() =>
              printJournalVoucherPdf({
                stationName: stationId === 'ALL' ? 'Network Consolidated' : stationId,
                journal: activeDetailJournal,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" /> Download Voucher PDF
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="font-mono text-xs font-semibold text-amber-700">{activeDetailJournal.sourceEvent}</div>
              <h2 className="font-display text-xl font-bold text-slate-900 mt-1">
                Journal Voucher {activeDetailJournal.reference}
              </h2>
              <p className="text-xs text-slate-600 mt-1">{activeDetailJournal.description}</p>
            </div>
            <div className="text-right font-mono text-xs text-slate-500">
              <div>Voucher ID: {activeDetailJournal.id}</div>
              <div>Posted: {formatShortDate(activeDetailJournal.postedAt)}</div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Account Code</th>
                  <th className="px-4 py-3">Account Title (SYSCOHADA / IFRS)</th>
                  <th className="px-4 py-3 text-right">Debit (FCFA)</th>
                  <th className="px-4 py-3 text-right">Credit (FCFA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeDetailJournal.lines.map((line, i) => (
                  <tr key={`${activeDetailJournal.id}-detail-${i}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{line.accountCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{line.accountName}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {line.debitFcfa > 0 ? formatFcfa(line.debitFcfa) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {line.creditFcfa > 0 ? formatFcfa(line.creditFcfa) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-bold text-xs">
                <tr>
                  <td colSpan={2} className="px-4 py-3">
                    Voucher Totals ({debitSum === creditSum ? 'Balanced Double-Entry' : 'Imbalance'})
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-400">
                    {formatFcfa(debitSum)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-400">
                    {formatFcfa(creditSum)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Export Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Automated Financial Statements (FCFA)
            </h2>
            <p className="text-xs text-slate-500">
              SYSCOHADA / IFRS double-entry ledger auto-posted from Forecourt, Tank, Fleet &amp; Expense events
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <button
              type="button"
              onClick={() =>
                printDailyZReportPdf({
                  stationName: stationId === 'ALL' ? 'Network Consolidated' : stationId,
                  dateLabel: new Date().toISOString().slice(0, 10),
                  shifts: visibleShifts,
                  report,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" /> Daily Z-Report PDF
            </button>
            <button
              type="button"
              onClick={() =>
                exportAccountingPdf(
                  report,
                  visibleJournals,
                  visibleExpenses,
                  visibleDeposits,
                  stationId === 'ALL' ? 'Network Consolidated' : stationId
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" /> Statements PDF
            </button>
            <button
              type="button"
              onClick={() =>
                printStatutoryVatTaxPackPdf({
                  organizationName: 'OpesFuel Station Network',
                  stationLabel: stationId === 'ALL' ? 'Network Consolidated' : stationId,
                  periodLabel: new Date().toISOString().slice(0, 7),
                  report,
                  journalsCount: visibleJournals.length,
                  expensesTotalFcfa: visibleExpenses.reduce((s, e) => s + e.amountFcfa, 0),
                  depositsTotalFcfa: visibleDeposits.reduce((s, d) => s + d.amountFcfa, 0),
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5 text-amber-700" /> VAT (19.25%) Tax Pack PDF
            </button>
            <button
              type="button"
              onClick={() =>
                exportAccountantAuditWorkbookExcel({
                  stationLabel: stationId === 'ALL' ? 'Network Consolidated' : stationId,
                  report,
                  journals: visibleJournals,
                  expenses: visibleExpenses,
                  deposits: visibleDeposits,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Grand Livre Audit (.xlsx)
            </button>
            <button
              type="button"
              onClick={() =>
                exportAccountingExcel(
                  report,
                  visibleJournals,
                  visibleExpenses,
                  visibleDeposits,
                  stationId === 'ALL' ? 'Network Consolidated' : stationId
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>

        {/* Report Selector Tabs */}
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg w-fit no-print">
          {(
            [
              { id: 'pnl', label: 'Profit & Loss (P&L)' },
              { id: 'balance', label: 'Balance Sheet' },
              { id: 'trial', label: 'Trial Balance' },
              { id: 'cashflow', label: 'Cash Flow & VAT/Tax' },
              { id: 'journals', label: 'Journal Ledger' },
              { id: 'accounts', label: 'Chart of Accounts' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setReportTab(t.id)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                reportTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {reportTab === 'pnl' && (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-sm">
            <div className="px-5 py-3.5 flex justify-between">
              <span className="text-slate-700">Fuel &amp; Non-Fuel Sales Revenue (Excl. VAT)</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">{formatFcfa(report.totalRevenueFcfa)}</span>
            </div>
            <div className="px-5 py-3.5 flex justify-between">
              <span className="text-slate-700">Cost of Goods Sold (COGS)</span>
              <span className="font-mono tabular-nums text-slate-700">-{formatFcfa(report.cogsFcfa)}</span>
            </div>
            <div className="px-5 py-3.5 flex justify-between bg-slate-50 font-semibold">
              <span className="text-slate-900">Gross Operating Margin</span>
              <span className="font-mono tabular-nums text-slate-900">{formatFcfa(report.grossProfitFcfa)}</span>
            </div>
            <div className="px-5 py-3.5 flex justify-between">
              <span className="text-slate-700">Station Operating Expenses</span>
              <span className="font-mono tabular-nums text-slate-700">-{formatFcfa(report.operatingExpensesFcfa)}</span>
            </div>
            <div className="px-5 py-3.5 flex justify-between">
              <span className="text-slate-700">Forecourt Cash Over / Short Variance</span>
              <span className="font-mono tabular-nums text-slate-700">-{formatFcfa(report.cashVarianceFcfa)}</span>
            </div>
            <div className="px-5 py-4 flex justify-between bg-slate-900 text-white font-bold">
              <span>Net Profit Before Income Tax</span>
              <span className="font-mono tabular-nums text-amber-400">{formatFcfa(report.netIncomeFcfa)}</span>
            </div>
          </div>
        )}

        {reportTab === 'balance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-900">Assets</div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">1010 Cash on Hand &amp; Safe</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.cashOnHandFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">1020 Mobile Money Clearing</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.mobileMoneyClearingFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">1030 Bank Operating Account</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.bankBalanceFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">1100 Fleet Accounts Receivable</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.fleetReceivablesFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">1200 Fuel &amp; Lubricant Inventory</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.inventoryAssetFcfa)}</span>
              </div>
              <div className="px-4 py-3 bg-slate-900 text-white flex justify-between font-bold">
                <span>Total Assets</span>
                <span className="font-mono tabular-nums">{formatFcfa(totalAssets)}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-900">Liabilities &amp; Equity</div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">2010 Supplier Accounts Payable</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.accountsPayableFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">2200 Fuel VAT &amp; Excise Payable</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.vatPayableFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Total Liabilities</span>
                <span className="font-mono tabular-nums font-semibold">{formatFcfa(totalLiabilities)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Retained Net Income (Current Period)</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.netIncomeFcfa)}</span>
              </div>
              <div className="px-4 py-3 bg-slate-900 text-white flex justify-between font-bold">
                <span>Total Liabilities &amp; Net Equity</span>
                <span className="font-mono tabular-nums">{formatFcfa(totalAssets)}</span>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'trial' && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500">
              Click any account row to open its <strong className="text-slate-800">Grand Livre (General Ledger)</strong> posting history and running balance.
            </p>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Debit (FCFA)</th>
                    <th className="px-4 py-3 text-right">Credit (FCFA)</th>
                    <th className="px-4 py-3 text-right">Net Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.trialBalance.map((row) => (
                    <tr
                      key={row.accountCode}
                      onClick={() => setDrillAccountCode(row.accountCode)}
                      className="cursor-pointer hover:bg-amber-50/40 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-amber-800">{row.accountCode}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        <span className="inline-flex items-center gap-1">
                          {row.accountName} <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{row.accountType}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatFcfa(row.debitTotalFcfa)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatFcfa(row.creditTotalFcfa)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold">{formatFcfa(row.netBalanceFcfa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportTab === 'cashflow' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-900">Treasury &amp; Cash Position</div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Cash Safe on Hand (1010)</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.cashOnHandFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Orange Money / MTN MoMo Clearing (1020)</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.mobileMoneyClearingFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Bank Operating Account (1030)</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.bankBalanceFcfa)}</span>
              </div>
              <div className="px-4 py-3 bg-slate-900 text-white flex justify-between font-bold">
                <span>Total Liquid Treasury</span>
                <span className="font-mono tabular-nums text-amber-400">
                  {formatFcfa(report.cashOnHandFcfa + report.mobileMoneyClearingFcfa + report.bankBalanceFcfa)}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-900">VAT &amp; Regulatory Tax Summary</div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Taxable Sales Base (Excl. VAT)</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.totalRevenueFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Output VAT Collected (19.25% · 2200)</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">{formatFcfa(report.vatPayableFcfa)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Non-Fuel Shop &amp; Lubricant Sales (4020)</span>
                <span className="font-mono tabular-nums">{formatFcfa(report.nonFuelRevenueFcfa)}</span>
              </div>
              <div className="px-4 py-3 bg-slate-50 flex justify-between font-semibold">
                <span className="text-slate-900">Ledger Double-Entry Integrity</span>
                <span className="text-emerald-700">{report.trialBalanceBalanced ? 'Balanced (DR = CR)' : 'Check Required'}</span>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'journals' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5 pb-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={journalSearch}
                  onChange={(e) => setJournalSearch(e.target.value)}
                  placeholder="Search reference, account code (e.g. 2200), or narration..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <select
                aria-label="Filter journals by source event"
                value={journalEventFilter}
                onChange={(e) => setJournalEventFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800"
              >
                <option value="ALL">All Source Events ({visibleJournals.length})</option>
                <option value="SHIFT">Forecourt Shifts</option>
                <option value="DELIVERY">Tanker Deliveries</option>
                <option value="EXPENSE">Operating Expenses</option>
                <option value="DEPOSIT">Treasury Deposits</option>
                <option value="FLEET">Fleet AR / Settlements</option>
                <option value="PAYROLL">Payroll Runs</option>
                <option value="MANUAL">Manual Journals</option>
                <option value="VAT">VAT Remittances</option>
              </select>
              <span className="font-mono text-[11px] text-slate-500">
                Showing {filteredJournals.length} / {visibleJournals.length}
              </span>
            </div>
            {filteredJournals.map((je) => (
              <div key={je.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 text-xs">
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedJournalId(je.id)}
                      className="inline-flex items-center gap-1 font-mono font-bold text-slate-900 hover:text-amber-700"
                    >
                      <span>{je.reference}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>{' '}
                    <span className="text-slate-400">·</span>{' '}
                    <span className="font-mono text-amber-700">{je.sourceEvent}</span>{' '}
                    <span className="text-slate-400">·</span>{' '}
                    <span className="text-slate-700">{je.description}</span>
                  </div>
                  <span className="font-mono text-slate-500">{formatShortDate(je.postedAt)}</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {je.lines.map((line, idx) => (
                    <div key={`${je.id}-${idx}`} className="px-4 py-2 flex justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => setDrillAccountCode(line.accountCode)}
                        className="text-left text-slate-700 hover:text-amber-800"
                      >
                        <span className="font-mono text-slate-500">{line.accountCode}</span> {line.accountName}
                      </button>
                      <div className="flex gap-6 font-mono tabular-nums">
                        <span className="w-28 text-right">{line.debitFcfa > 0 ? `DR ${formatFcfa(line.debitFcfa)}` : ''}</span>
                        <span className="w-28 text-right">{line.creditFcfa > 0 ? `CR ${formatFcfa(line.creditFcfa)}` : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {filteredJournals.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500 border border-slate-200 rounded-lg">
                No double-entry journal vouchers match your search / event filter.
              </div>
            )}
          </div>
        )}

        {reportTab === 'accounts' && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500">
              Click any SYSCOHADA account to inspect its complete <strong className="text-slate-800">Grand Livre</strong> movement history.
            </p>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Account Code</th>
                    <th className="px-4 py-3">SYSCOHADA / IFRS Account Title</th>
                    <th className="px-4 py-3">Classification</th>
                    <th className="px-4 py-3 text-right">Current Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CHART_OF_ACCOUNTS.map((acc) => {
                    const row = report.trialBalance.find((r) => r.accountCode === acc.code);
                    return (
                      <tr
                        key={acc.code}
                        onClick={() => setDrillAccountCode(acc.code)}
                        className="cursor-pointer hover:bg-amber-50/40 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-amber-800">{acc.code}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          <span className="inline-flex items-center gap-1">
                            {acc.name} <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{acc.accountType}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatFcfa(row?.netBalanceFcfa ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Expenses & Treasury Actions — Clean Buttons Opening Popup Modals */}
      {canPost && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 no-print">
          <div>
            <h3 className="font-display text-base font-bold text-slate-950">
              Station Expenses &amp; Bank / Mobile Money Deposits
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Post daily operational bills or bank cash sweeps directly into your balanced SYSCOHADA ledger.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAcctModal('expense')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Post Operating Expense
            </button>
            <button
              type="button"
              onClick={() => setAcctModal('deposit')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Record Bank / MoMo Deposit
            </button>
          </div>
        </div>
      )}

      {vaultSlot}

      <FormModal
        open={acctModal === 'expense'}
        title="Post Station Operating Expense"
        subtitle="Debits 6010 Station Expenses and credits Cash Safe or Bank automatically."
        onClose={() => setAcctModal(null)}
      >
        <form
          onSubmit={(e) => {
            handleExpense(e);
            setAcctModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Expense Category</label>
              <select
                value={expCat}
                onChange={(e) => setExpCat(e.target.value as StationExpense['category'])}
                className="opes-input"
              >
                <option value="UTILITIES">Utilities / ENEO</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="GENERATOR_FUEL">Generator Fuel</option>
                <option value="SECURITY">Security</option>
                <option value="SUPPLIES">Station Supplies</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Paid From</label>
              <select
                value={expSource}
                onChange={(e) => setExpSource(e.target.value as StationExpense['paymentSource'])}
                className="opes-input"
              >
                <option value="CASH_SAFE">Cash Safe (1010)</option>
                <option value="BANK">Bank Account (1030)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Description</label>
              <input
                type="text"
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="Description"
                className="opes-input"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Amount (FCFA)</label>
              <input
                type="number"
                min={1}
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="FCFA"
                className="opes-input font-mono tabular-nums"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setAcctModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">
              Post Expense to Ledger
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={acctModal === 'deposit'}
        title="Record Bank &amp; Mobile Money Deposit"
        subtitle="Clears Cash Safe (1010) or Mobile Money (1020) into Bank Operating Account (1030)."
        onClose={() => setAcctModal(null)}
      >
        <form
          onSubmit={(e) => {
            handleDeposit(e);
            setAcctModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Source Account</label>
              <select
                value={depSource}
                onChange={(e) => setDepSource(e.target.value as TreasuryDeposit['sourceAccount'])}
                className="opes-input"
              >
                <option value="CASH_ON_HAND">Cash Safe (1010)</option>
                <option value="MOBILE_MONEY_CLEARING">Mobile Money (1020)</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Bank Name</label>
              <input
                type="text"
                value={depBank}
                onChange={(e) => setDepBank(e.target.value)}
                placeholder="Afriland First Bank"
                className="opes-input"
                required
              />
            </div>
            <div>
              <label className="opes-label">Deposit Slip Reference</label>
              <input
                type="text"
                value={depSlip}
                onChange={(e) => setDepSlip(e.target.value)}
                placeholder="SLIP-2026-001"
                className="opes-input font-mono"
                required
              />
            </div>
            <div>
              <label className="opes-label">Amount (FCFA)</label>
              <input
                type="number"
                min={1}
                value={depAmount}
                onChange={(e) => setDepAmount(e.target.value)}
                placeholder="250000"
                className="opes-input font-mono tabular-nums"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setAcctModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              Record Treasury Deposit
            </button>
          </div>
        </form>
      </FormModal>

      {/* Posted Operating Expenses & Treasury Deposits History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-900">Posted Operating Expenses</h3>
            <p className="text-xs text-slate-500">Station utilities, maintenance, security &amp; generator fuel</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Category / Description</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Posted</th>
                  {canPost && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleExpenses.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-slate-900">{ex.category}</div>
                      <div className="text-slate-600">{ex.description}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{ex.paymentSource}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatFcfa(ex.amountFcfa)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      {formatShortDate(ex.createdAt)}
                    </td>
                    {canPost && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Reverse & delete posted expense "${ex.description}" (${formatFcfa(ex.amountFcfa)})?`)) {
                              onDeleteExpense(ex.id);
                            }
                          }}
                          aria-label={`Delete expense ${ex.id}`}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {visibleExpenses.length === 0 && (
                  <tr>
                    <td colSpan={canPost ? 5 : 4} className="px-4 py-6 text-center text-slate-500">
                      No operating expenses posted for this station scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-900">Treasury Deposits History</h3>
            <p className="text-xs text-slate-500">Safe cash &amp; Mobile Money transfers cleared to bank accounts</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Bank &amp; Slip</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Deposited</th>
                  {canPost && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleDeposits.map((dep) => (
                  <tr key={dep.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{dep.bankName}</div>
                      <div className="font-mono text-slate-500">{dep.slipReference}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{dep.sourceAccount}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {formatFcfa(dep.amountFcfa)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      {formatShortDate(dep.depositedAt)}
                    </td>
                    {canPost && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Reverse & delete treasury deposit "${dep.slipReference}" (${formatFcfa(dep.amountFcfa)})?`)) {
                              onDeleteDeposit(dep.id);
                            }
                          }}
                          aria-label={`Delete deposit ${dep.id}`}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {visibleDeposits.length === 0 && (
                  <tr>
                    <td colSpan={canPost ? 5 : 4} className="px-4 py-6 text-center text-slate-500">
                      No treasury deposits recorded for this station scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AccountingAdvancedPanel
        engine={engine}
        role={role}
        stationId={stationId}
        effectiveStationId={effectiveStation}
        report={report}
        journals={visibleJournals}
        onNotify={onNotify}
      />

      {/* Interactive Grand Livre (General Ledger Account Drill-Down) Modal */}
      {(() => {
        const accountMeta = drillAccountCode
          ? CHART_OF_ACCOUNTS.find((a) => a.code === drillAccountCode)
          : null;
        const postings = drillAccountCode
          ? visibleJournals.flatMap((j) =>
              j.lines
                .filter((l) => l.accountCode === drillAccountCode)
                .map((l) => ({
                  journalId: j.id,
                  postedAt: j.postedAt,
                  reference: j.reference,
                  sourceEvent: j.sourceEvent,
                  description: j.description,
                  debitFcfa: l.debitFcfa,
                  creditFcfa: l.creditFcfa,
                }))
            )
          : [];
        const totalDr = postings.reduce((s, p) => s + p.debitFcfa, 0);
        const totalCr = postings.reduce((s, p) => s + p.creditFcfa, 0);
        return (
          <FormModal
            open={Boolean(drillAccountCode)}
            onClose={() => setDrillAccountCode(null)}
            title={
              accountMeta
                ? `Grand Livre — ${accountMeta.code} ${accountMeta.name}`
                : `Grand Livre — Account ${drillAccountCode ?? ''}`
            }
            subtitle={`SYSCOHADA Ledger Movements (${postings.length} postings) · Total DR ${formatFcfa(totalDr)} · Total CR ${formatFcfa(totalCr)}`}
          >
            <div className="space-y-4">
              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0F172A] text-white sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Voucher</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {postings.map((p, idx) => (
                      <tr key={`${p.journalId}-${idx}`} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">{formatShortDate(p.postedAt)}</td>
                        <td className="px-3 py-2 font-mono font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              setDrillAccountCode(null);
                              setSelectedJournalId(p.journalId);
                            }}
                            className="text-amber-800 hover:underline"
                          >
                            {p.reference}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{p.description}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{p.debitFcfa > 0 ? formatFcfa(p.debitFcfa) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{p.creditFcfa > 0 ? formatFcfa(p.creditFcfa) : '—'}</td>
                      </tr>
                    ))}
                    {postings.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                          No journal postings recorded on account {drillAccountCode} in this station scope yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setDrillAccountCode(null)}
                  className="px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold"
                >
                  Close Account Ledger
                </button>
              </div>
            </div>
          </FormModal>
        );
      })()}
    </div>
  );
};
