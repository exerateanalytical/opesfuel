import React, { useState } from 'react';
import { Plus, Printer, Vault } from 'lucide-react';
import { CashVaultEntryItem } from '../../api/demoDataset1000';
import { formatFcfa, formatShortDate } from '../../domain/formatters';
import { printCashVaultSlipPdf } from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';

interface CashVaultPanelProps {
  stationId: string;
  stationName?: string;
  entries: CashVaultEntryItem[];
  canRecord: boolean;
  onRecordEntry: (entry: {
    stationId: string;
    entryType: CashVaultEntryItem['entryType'];
    amountFcfa: number;
    handedBy: string;
    receivedBy: string;
    referenceCode: string;
    notes: string;
  }) => void;
}

export const CashVaultPanel: React.FC<CashVaultPanelProps> = ({
  stationId,
  stationName = 'OpesFuel Station',
  entries,
  canRecord,
  onRecordEntry,
}) => {
  const [open, setOpen] = useState(false);
  const [entryType, setEntryType] = useState<CashVaultEntryItem['entryType']>('SHIFT_DROP');
  const [amount, setAmount] = useState('');
  const [handedBy, setHandedBy] = useState('Samuel Tchoupo');
  const [receivedBy, setReceivedBy] = useState('Station Safe #1');
  const [refCode, setRefCode] = useState('');
  const [notes, setNotes] = useState('');

  const currentSafeBalance = entries[0]?.runningBalanceFcfa ?? 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg icon-glass flex items-center justify-center shrink-0">
            <Vault className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950">
              Station Cash Safe / Vault Ledger &amp; Custody Handovers
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Track every franc sitting physically inside the station safe between shift drops, petty cash, and armored bank pickups.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right px-4 py-2 rounded-lg border border-slate-200 bg-white">
            <div className="text-[11px] text-slate-500 uppercase font-mono">Current Cash in Safe</div>
            <div className="font-mono tabular-nums text-lg font-bold text-slate-950">
              {formatFcfa(currentSafeBalance)}
            </div>
          </div>
          {canRecord && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Record Safe Movement
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left">
          <thead>
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Movement Type</th>
              <th className="px-4 py-3">Handed By → Received By</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Safe Balance</th>
              <th className="px-4 py-3 text-right">Custody Slip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {entries.slice(0, 12).map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 font-mono text-slate-500">{formatShortDate(e.recordedAt)}</td>
                <td className="px-4 py-3 font-mono font-semibold text-slate-900">{e.referenceCode}</td>
                <td className="px-4 py-3 font-mono text-slate-700">{e.entryType}</td>
                <td className="px-4 py-3 text-slate-700">
                  {e.handedBy} → <span className="font-semibold text-slate-900">{e.receivedBy}</span>
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                    e.entryType === 'SHIFT_DROP' ? 'text-emerald-700' : 'text-slate-900'
                  }`}
                >
                  {e.entryType === 'SHIFT_DROP' ? '+' : e.entryType === 'MANAGER_HANDOVER' ? '' : '−'}
                  {formatFcfa(e.amountFcfa)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-950">
                  {formatFcfa(e.runningBalanceFcfa)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => printCashVaultSlipPdf(stationName, e)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
                  >
                    <Printer className="w-3 h-3" /> Slip PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormModal
        open={open}
        title="Record Cash Safe / Vault Movement"
        subtitle={`Available safe balance: ${formatFcfa(currentSafeBalance)}`}
        onClose={() => setOpen(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const amt = Number(amount) || 0;
            if (amt <= 0) return;
            onRecordEntry({
              stationId,
              entryType,
              amountFcfa: amt,
              handedBy: handedBy.trim(),
              receivedBy: receivedBy.trim(),
              referenceCode: refCode.trim() || `SAFE-${Math.floor(1000 + Math.random() * 9000)}`,
              notes: notes.trim(),
            });
            setAmount('');
            setRefCode('');
            setNotes('');
            setOpen(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Movement Type</label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as CashVaultEntryItem['entryType'])}
                className="opes-input"
              >
                <option value="SHIFT_DROP">Shift Cash Drop (+ Into Safe)</option>
                <option value="ARMORED_BANK_PICKUP">Armored Bank Pickup (− Out of Safe)</option>
                <option value="PETTY_CASH_OUT">Petty Cash Payout (− Out of Safe)</option>
                <option value="MANAGER_HANDOVER">Manager Custody Handover (Verify Count)</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Amount (FCFA)</label>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1500000"
                className="opes-input font-mono"
                required
              />
            </div>
            <div>
              <label className="opes-label">Handed Over By</label>
              <input value={handedBy} onChange={(e) => setHandedBy(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Received By</label>
              <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Seal / Slip Reference</label>
              <input value={refCode} onChange={(e) => setRefCode(e.target.value)} placeholder="Auto-generated if blank" className="opes-input font-mono" />
            </div>
            <div>
              <label className="opes-label">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Verified safe count" className="opes-input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              Save Safe Entry
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
