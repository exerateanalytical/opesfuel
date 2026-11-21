import React, { useCallback, useEffect, useState } from 'react';
import { BookMarked, Download, FileBarChart2, Landmark, Lock, ReceiptText } from 'lucide-react';
import { CHART_OF_ACCOUNTS, OpesFuelApiEngine } from '../../api/opesfuelClient';
import { formatFcfa, formatLitres, formatShortDate } from '../../domain/formatters';
import { FinancialReportBundle, JournalEntry, UserRole } from '../../domain/types';

interface AccountingAdvancedPanelProps {
  engine: OpesFuelApiEngine;
  role: UserRole;
  stationId: string;
  effectiveStationId: string;
  report: FinancialReportBundle;
  journals: JournalEntry[];
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const AccountingAdvancedPanel: React.FC<AccountingAdvancedPanelProps> = ({
  engine,
  role,
  stationId,
  effectiveStationId,
  report,
  journals,
  onNotify,
}) => {
  const canPost = role === 'OWNER' || role === 'ACCOUNTANT' || role === 'MANAGER';
  const canLockPeriod = role === 'OWNER' || role === 'ACCOUNTANT';

  const [activeTool, setActiveTool] = useState<'ap' | 'vat' | 'manual' | 'periods' | 'zreport'>('ap');

  // AP payment
  const [apSupplier, setApSupplier] = useState('SCDP Depot Douala');
  const [apRef, setApRef] = useState(`AP-${Date.now().toString().slice(-5)}`);
  const [apAmount, setApAmount] = useState('500000');
  const [apSource, setApSource] = useState<'CASH_SAFE' | 'BANK'>('BANK');

  // VAT remittance
  const [vatPeriod, setVatPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [vatRef, setVatRef] = useState(`DGI-VAT-${new Date().toISOString().slice(0, 7)}`);
  const [vatAmount, setVatAmount] = useState('150000');
  const [vatSource, setVatSource] = useState<'CASH_SAFE' | 'BANK'>('BANK');

  // Manual journal
  const [mjRef, setMjRef] = useState(`MJ-${Date.now().toString().slice(-5)}`);
  const [mjDesc, setMjDesc] = useState('Month-end accrual adjustment');
  const [mjDebitAcc, setMjDebitAcc] = useState('6300');
  const [mjCreditAcc, setMjCreditAcc] = useState('1030');
  const [mjAmount, setMjAmount] = useState('25000');

  // Fiscal periods
  const [periods, setPeriods] = useState<Array<Record<string, unknown>>>([]);
  const [closePeriodKey, setClosePeriodKey] = useState(() => new Date().toISOString().slice(0, 7));

  // Daily Z-Report
  const [zDate, setZDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [zReport, setZReport] = useState<Record<string, unknown> | null>(null);

  const loadPeriodsAndZ = useCallback(async () => {
    const [pList, zData] = await Promise.all([
      engine.listFiscalPeriods(stationId).catch(() => []),
      engine.fetchDailyZReport(stationId, zDate).catch(() => null),
    ]);
    setPeriods(Array.isArray(pList) ? pList : []);
    setZReport(zData);
  }, [engine, stationId, zDate]);

  useEffect(() => {
    void loadPeriodsAndZ();
  }, [loadPeriodsAndZ]);

  const handleApPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await engine.recordApPayment({
        stationId: effectiveStationId,
        supplierName: apSupplier.trim(),
        reference: apRef.trim(),
        amountFcfa: Number(apAmount) || 0,
        paymentSource: apSource,
      });
      onNotify('success', `Recorded Supplier AP settlement of ${formatFcfa(Number(apAmount) || 0)} (DR 2010 / CR ${apSource === 'BANK' ? '1030' : '1010'}).`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to post AP payment.');
    }
  };

  const handleVatRemittance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await engine.recordVatRemittance({
        stationId: effectiveStationId,
        periodLabel: vatPeriod.trim(),
        reference: vatRef.trim(),
        amountFcfa: Number(vatAmount) || 0,
        paymentSource: vatSource,
      });
      onNotify('success', `Recorded VAT tax remittance of ${formatFcfa(Number(vatAmount) || 0)} for ${vatPeriod}.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to post VAT remittance.');
    }
  };

  const handleManualJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(mjAmount) || 0;
    if (amt <= 0 || mjDebitAcc === mjCreditAcc) {
      onNotify('error', 'Choose distinct debit/credit accounts and a positive FCFA amount.');
      return;
    }
    try {
      await engine.postManualJournal({
        stationId: effectiveStationId,
        reference: mjRef.trim(),
        description: mjDesc.trim(),
        lines: [
          { accountCode: mjDebitAcc, debitFcfa: amt, creditFcfa: 0 },
          { accountCode: mjCreditAcc, debitFcfa: 0, creditFcfa: amt },
        ],
      });
      onNotify('success', `Posted balanced manual journal ${mjRef.trim()} (${formatFcfa(amt)}).`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to post manual journal.');
    }
  };

  const handleClosePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !window.confirm(
        `Close and permanently lock fiscal period ${closePeriodKey}? No further shifts, expenses, or manual journals can be posted into a locked period.`
      )
    ) {
      return;
    }
    try {
      await engine.closeFiscalPeriod(effectiveStationId, closePeriodKey.trim());
      onNotify('success', `Locked fiscal period ${closePeriodKey}. Future postings into this period will be blocked.`);
      await loadPeriodsAndZ();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to lock fiscal period.');
    }
  };

  const handleServerTrialBalanceCsv = async () => {
    const fallback = [
      'Account Code,Account Name,Type,Debit (FCFA),Credit (FCFA),Net Balance (FCFA)',
      ...report.trialBalance.map((r) => `${r.accountCode},"${r.accountName}",${r.accountType},${r.debitTotalFcfa},${r.creditTotalFcfa},${r.netBalanceFcfa}`),
    ].join('\n');
    try {
      await engine.downloadAuthenticatedCsv(
        `/reporting/export/trial-balance.csv?stationId=${encodeURIComponent(stationId)}`,
        `opesfuel-trial-balance-${stationId.toLowerCase()}.csv`,
        fallback
      );
      onNotify('success', 'Downloaded Trial Balance CSV from Reporting service.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'CSV export failed.');
    }
  };

  const handleServerJournalsCsv = async () => {
    const fallback = [
      'Journal ID,Station,Reference,Source Event,Posted At,Description',
      ...journals.map((j) => `${j.id},${j.stationId},"${j.reference}",${j.sourceEvent},${j.postedAt},"${j.description}"`),
    ].join('\n');
    try {
      await engine.downloadAuthenticatedCsv(
        `/reporting/export/journals.csv?stationId=${encodeURIComponent(stationId)}`,
        `opesfuel-journals-${stationId.toLowerCase()}.csv`,
        fallback
      );
      onNotify('success', 'Downloaded Double-Entry Journals CSV from Reporting service.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'CSV export failed.');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900">
            SYSCOHADA Treasury, Tax, Fiscal Period Lock &amp; Z-Report
          </h3>
          <p className="text-xs text-slate-500">
            Direct Spring Boot accounting &amp; reporting endpoints (<span className="font-mono">/api/v1/accounting/*</span> &amp;{' '}
            <span className="font-mono">/api/v1/reporting/*</span>)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleServerTrialBalanceCsv()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-800"
          >
            <Download className="w-3.5 h-3.5" /> Server Trial Balance CSV
          </button>
          <button
            type="button"
            onClick={() => void handleServerJournalsCsv()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-800"
          >
            <Download className="w-3.5 h-3.5" /> Server Journals CSV
          </button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
        {[
          { id: 'ap', label: 'Pay Supplier AP', icon: Landmark },
          { id: 'vat', label: 'Remit VAT (19.25%)', icon: ReceiptText },
          { id: 'manual', label: 'Manual Journal', icon: BookMarked },
          { id: 'periods', label: 'Fiscal Period Lock', icon: Lock },
          { id: 'zreport', label: 'Daily Z-Report', icon: FileBarChart2 },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTool(t.id as typeof activeTool)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {activeTool === 'ap' && (
        <form onSubmit={(e) => void handleApPayment(e)} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <input
            type="text"
            required
            placeholder="Supplier Name"
            value={apSupplier}
            onChange={(e) => setApSupplier(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
          />
          <input
            type="text"
            required
            placeholder="Payment Ref"
            value={apRef}
            onChange={(e) => setApRef(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
          />
          <input
            type="number"
            min={1}
            required
            placeholder="Amount FCFA"
            value={apAmount}
            onChange={(e) => setApAmount(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
          />
          <select
            value={apSource}
            onChange={(e) => setApSource(e.target.value as 'CASH_SAFE' | 'BANK')}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
          >
            <option value="BANK">Bank Account (1030)</option>
            <option value="CASH_SAFE">Cash Safe (1010)</option>
          </select>
          <button
            type="submit"
            disabled={!canPost}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold"
          >
            Post AP Payment
          </button>
        </form>
      )}

      {activeTool === 'vat' && (
        <form onSubmit={(e) => void handleVatRemittance(e)} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <input
            type="month"
            required
            value={vatPeriod}
            onChange={(e) => setVatPeriod(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
          />
          <input
            type="text"
            required
            placeholder="Tax Receipt Ref"
            value={vatRef}
            onChange={(e) => setVatRef(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
          />
          <input
            type="number"
            min={1}
            required
            placeholder="VAT FCFA"
            value={vatAmount}
            onChange={(e) => setVatAmount(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
          />
          <select
            value={vatSource}
            onChange={(e) => setVatSource(e.target.value as 'CASH_SAFE' | 'BANK')}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
          >
            <option value="BANK">Bank Account (1030)</option>
            <option value="CASH_SAFE">Cash Safe (1010)</option>
          </select>
          <button
            type="submit"
            disabled={!canPost}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold"
          >
            Post VAT Remittance
          </button>
        </form>
      )}

      {activeTool === 'manual' && (
        <form onSubmit={(e) => void handleManualJournal(e)} className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <input
            type="text"
            required
            placeholder="Ref (e.g. MJ-01)"
            value={mjRef}
            onChange={(e) => setMjRef(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
          />
          <input
            type="text"
            required
            placeholder="Narration"
            value={mjDesc}
            onChange={(e) => setMjDesc(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
          />
          <select
            value={mjDebitAcc}
            onChange={(e) => setMjDebitAcc(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
          >
            {CHART_OF_ACCOUNTS.map((a) => (
              <option key={a.code} value={a.code}>
                DR {a.code} {a.name}
              </option>
            ))}
          </select>
          <select
            value={mjCreditAcc}
            onChange={(e) => setMjCreditAcc(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
          >
            {CHART_OF_ACCOUNTS.map((a) => (
              <option key={a.code} value={a.code}>
                CR {a.code} {a.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            required
            placeholder="Amount FCFA"
            value={mjAmount}
            onChange={(e) => setMjAmount(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
          />
          <button
            type="submit"
            disabled={!canLockPeriod}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold"
          >
            Post Journal
          </button>
        </form>
      )}

      {activeTool === 'periods' && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleClosePeriod(e)} className="flex flex-wrap items-center gap-3">
            <input
              type="month"
              value={closePeriodKey}
              onChange={(e) => setClosePeriodKey(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
            />
            <button
              type="submit"
              disabled={!canLockPeriod}
              className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-semibold"
            >
              Close &amp; Lock Fiscal Period
            </button>
          </form>
          <div className="divide-y divide-slate-100 text-xs">
            {periods.length === 0 ? (
              <div className="text-slate-500 py-2">No fiscal periods locked yet for this station scope.</div>
            ) : (
              periods.map((p) => (
                <div key={String(p.id)} className="py-2 flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">{String(p.periodKey)}</span>
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-mono text-[10px] font-bold">
                    {String(p.status ?? 'CLOSED')}
                  </span>
                  <span className="text-slate-500">
                    Closed {p.closedAt ? formatShortDate(String(p.closedAt)) : '-'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTool === 'zreport' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={zDate}
              onChange={(e) => setZDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => void loadPeriodsAndZ()}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
            >
              Refresh Z-Report
            </button>
          </div>
          {zReport && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-500">Closed Shifts</div>
                <div className="font-mono text-base font-bold text-slate-900">{String(zReport.closedShiftsCount ?? 0)}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-500">Litres Dispensed</div>
                <div className="font-mono text-base font-bold text-slate-900">
                  {formatLitres(Number(zReport.totalLitresDispensed ?? 0))}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-500">Expected Revenue</div>
                <div className="font-mono text-base font-bold text-emerald-700">
                  {formatFcfa(Number(zReport.expectedRevenueFcfa ?? 0))}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-500">Total Cash Variance</div>
                <div className="font-mono text-base font-bold text-amber-700">
                  {formatFcfa(Number(zReport.totalVarianceFcfa ?? 0))}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <div className="text-slate-500">Cash Tender</div>
                <div className="font-mono font-semibold">{formatFcfa(Number(zReport.cashCollectedFcfa ?? 0))}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <div className="text-slate-500">Mobile Money</div>
                <div className="font-mono font-semibold">{formatFcfa(Number(zReport.mobileMoneyCollectedFcfa ?? 0))}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <div className="text-slate-500">Card POS</div>
                <div className="font-mono font-semibold">{formatFcfa(Number(zReport.cardCollectedFcfa ?? 0))}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <div className="text-slate-500">Fleet Credit AR</div>
                <div className="font-mono font-semibold">{formatFcfa(Number(zReport.fleetCreditFcfa ?? 0))}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
