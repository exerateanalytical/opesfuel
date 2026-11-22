import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Lock, Plus, ShieldAlert, Wallet } from 'lucide-react';
import { formatFcfa } from '../../domain/formatters';
import { UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

const PAYROLL_STAGES = [
  'OPEN',
  'CALCULATED',
  'REVIEWED',
  'APPROVED',
  'POSTED',
  'PAYMENT_PENDING',
  'PAID',
  'CLOSED',
] as const;

type PayrollStage = (typeof PAYROLL_STAGES)[number];

interface PayrollWorkflowBatch {
  id: string;
  stationId: string;
  periodLabel: string;
  headcount: number;
  grossFcfa: number;
  deductionsFcfa: number;
  netPayableFcfa: number;
  status: PayrollStage;
  preparedBy: string;
  approvedBy?: string;
  updatedAt: string;
}

interface PayrollWorkflowStepperPanelProps {
  role: UserRole;
  stationId: string;
  stationName: string;
  currentActorEmail: string;
  defaultHeadcount: number;
  onPostBackend: (path: string, method: 'POST' | 'PATCH', body?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const PayrollWorkflowStepperPanel: React.FC<PayrollWorkflowStepperPanelProps> = ({
  role,
  stationId,
  stationName,
  currentActorEmail,
  defaultHeadcount,
  onPostBackend,
  onNotify,
}) => {
  const canOperatePayroll = role === 'PLATFORM_ADMIN' || role === 'OWNER' || role === 'ACCOUNTANT';

  const [batches, setBatches] = useState<PayrollWorkflowBatch[]>([
    {
      id: 'prw_2026_11',
      stationId,
      periodLabel: '2026-11 Monthly Payroll',
      headcount: Math.max(6, defaultHeadcount),
      grossFcfa: 2_850_000,
      deductionsFcfa: 412_500,
      netPayableFcfa: 2_437_500,
      status: 'REVIEWED',
      preparedBy: 'finance@opesfuel.cm',
      updatedAt: new Date(Date.now() - 3_600_000).toISOString(),
    },
    {
      id: 'prw_2026_10',
      stationId,
      periodLabel: '2026-10 Monthly Payroll',
      headcount: Math.max(6, defaultHeadcount),
      grossFcfa: 2_790_000,
      deductionsFcfa: 405_000,
      netPayableFcfa: 2_385_000,
      status: 'CLOSED',
      preparedBy: 'finance@opesfuel.cm',
      approvedBy: 'owner@opesfuel.cm',
      updatedAt: new Date(Date.now() - 86_400_000 * 20).toISOString(),
    },
  ]);

  const [selectedBatchId, setSelectedBatchId] = useState<string>('prw_2026_11');
  const [modalOpen, setModalOpen] = useState(false);

  // Create batch form
  const [periodLabel, setPeriodLabel] = useState('2026-12 Monthly Payroll');
  const [headcount, setHeadcount] = useState(String(Math.max(4, defaultHeadcount)));
  const [grossFcfa, setGrossFcfa] = useState('2950000');
  const [deductionsFcfa, setDeductionsFcfa] = useState('425000');

  if (!canOperatePayroll) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-3 text-xs text-slate-600">
        <Lock className="w-4 h-4 text-slate-900 shrink-0" />
        <span>
          <strong className="text-slate-950">Payroll Confidentiality Guard (T004 · M34):</strong> Only authorized Owner, Accountant, or Platform Admin roles can inspect or advance statutory payroll runs.
        </span>
      </div>
    );
  }

  const activeBatch = batches.find((b) => b.id === selectedBatchId) ?? batches[0];
  const activeStageIdx = activeBatch ? PAYROLL_STAGES.indexOf(activeBatch.status) : 0;

  const getNextStage = (stage: PayrollStage): PayrollStage | null => {
    const idx = PAYROLL_STAGES.indexOf(stage);
    return idx >= 0 && idx < PAYROLL_STAGES.length - 1 ? PAYROLL_STAGES[idx + 1] : null;
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const hc = Math.max(1, Number(headcount) || 1);
    const gross = Math.max(0, Number(grossFcfa) || 0);
    const ded = Math.max(0, Number(deductionsFcfa) || 0);
    const payload = {
      stationId,
      periodLabel: periodLabel.trim(),
      headcount: hc,
      grossFcfa: gross,
      deductionsFcfa: ded,
    };
    const remote = await onPostBackend('/api/v1/enterprise/payroll-workflows', 'POST', payload);
    const id = String(remote?.id ?? `prw_${Date.now().toString(36)}`);
    const nextBatch: PayrollWorkflowBatch = {
      id,
      stationId,
      periodLabel: payload.periodLabel,
      headcount: hc,
      grossFcfa: gross,
      deductionsFcfa: ded,
      netPayableFcfa: Math.max(0, gross - ded),
      status: 'OPEN',
      preparedBy: currentActorEmail,
      updatedAt: new Date().toISOString(),
    };
    setBatches((prev) => [nextBatch, ...prev]);
    setSelectedBatchId(id);
    setModalOpen(false);
    onNotify('success', `Opened payroll workflow batch "${payload.periodLabel}" in OPEN state.`);
  };

  const handleAdvanceBatch = async (batch: PayrollWorkflowBatch) => {
    const next = getNextStage(batch.status);
    if (!next) return;

    if (next === 'APPROVED' && batch.preparedBy.toLowerCase() === currentActorEmail.toLowerCase()) {
      onNotify(
        'error',
        `Maker-Checker Enforcement (M34): Preparer (${batch.preparedBy}) cannot self-approve this payroll batch. Switch to another Owner/Accountant role to approve.`
      );
      return;
    }

    await onPostBackend(`/api/v1/enterprise/payroll-workflows/${encodeURIComponent(batch.id)}/advance`, 'PATCH', {
      nextStatus: next,
    });

    setBatches((prev) =>
      prev.map((item) =>
        item.id === batch.id
          ? {
              ...item,
              status: next,
              approvedBy: next === 'APPROVED' ? currentActorEmail : item.approvedBy,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
    onNotify('success', `Advanced payroll batch "${batch.periodLabel}" from ${batch.status} → ${next}.`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-slate-900" />
            <h3 className="font-display text-lg font-bold text-slate-950">
              8-Stage Statutory Payroll State Machine (M34 · Maker-Checker)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Strict sequential payroll lifecycle for {stationName}: OPEN → CALCULATED → REVIEWED → APPROVED → POSTED → PAYMENT_PENDING → PAID → CLOSED. Self-approval is blocked at REVIEWED → APPROVED.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5" /> Start Payroll Batch
        </button>
      </div>

      {/* Visual 8-Stage Stepper for Selected Batch */}
      {activeBatch && (
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-slate-950">
              Active Batch: {activeBatch.periodLabel}{' '}
              <span className="font-mono text-slate-500 font-normal">({activeBatch.id})</span>
            </div>
            <div className="text-xs font-mono text-slate-600">
              Net Payable: <strong className="text-slate-950">{formatFcfa(activeBatch.netPayableFcfa)}</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {PAYROLL_STAGES.map((stage, idx) => {
              const completed = idx < activeStageIdx;
              const current = idx === activeStageIdx;
              return (
                <div
                  key={stage}
                  className={`px-2.5 py-2 rounded-lg border text-center ${
                    current
                      ? 'bg-[#0F172A] text-white border-[#0F172A]'
                      : completed
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-white text-slate-400 border-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-mono font-bold">0{idx + 1}</div>
                  <div className="text-[10px] font-semibold mt-0.5 truncate">{stage.replace('_', ' ')}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payroll Batches Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#0F172A] text-white font-mono text-[11px] uppercase">
              <th className="py-2.5 px-3">Period</th>
              <th className="py-2.5 px-3">Staff</th>
              <th className="py-2.5 px-3 text-right">Gross</th>
              <th className="py-2.5 px-3 text-right">CNPS / Tax</th>
              <th className="py-2.5 px-3 text-right">Net Payable</th>
              <th className="py-2.5 px-3">Prepared / Approved</th>
              <th className="py-2.5 px-3">Stage</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {batches.map((b) => {
              const next = getNextStage(b.status);
              const selfApprovalBlocked =
                next === 'APPROVED' && b.preparedBy.toLowerCase() === currentActorEmail.toLowerCase();
              return (
                <tr
                  key={b.id}
                  onClick={() => setSelectedBatchId(b.id)}
                  className={`cursor-pointer hover:bg-slate-50 ${selectedBatchId === b.id ? 'bg-slate-50' : ''}`}
                >
                  <td className="py-2.5 px-3 font-semibold text-slate-950">{b.periodLabel}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">{b.headcount}</td>
                  <td className="py-2.5 px-3 font-mono text-right text-slate-700">{formatFcfa(b.grossFcfa)}</td>
                  <td className="py-2.5 px-3 font-mono text-right text-slate-600">{formatFcfa(b.deductionsFcfa)}</td>
                  <td className="py-2.5 px-3 font-mono text-right font-bold text-slate-950">
                    {formatFcfa(b.netPayableFcfa)}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-600">
                    <div>Prep: {b.preparedBy}</div>
                    {b.approvedBy && <div className="text-emerald-700">Appr: {b.approvedBy}</div>}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-[11px] font-semibold ${
                        b.status === 'CLOSED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {b.status === 'CLOSED' && <CheckCircle2 className="w-3 h-3" />}
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {next ? (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          void handleAdvanceBatch(b);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border ${
                          selfApprovalBlocked
                            ? 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                            : 'bg-[#0F172A] text-white border-[#0F172A] hover:bg-slate-800'
                        }`}
                      >
                        {selfApprovalBlocked && <ShieldAlert className="w-3 h-3" />}
                        Advance to {next.replace('_', ' ')} <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-400">FINALIZED</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FormModal
        open={modalOpen}
        title="Start Statutory Payroll Workflow Batch"
        subtitle={`Create a new payroll run in OPEN state for ${stationName} (prepared by ${currentActorEmail}).`}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={(e) => void handleCreateBatch(e)} className="space-y-4">
          <div>
            <label className="opes-label">Payroll Period Label</label>
            <input
              required
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="opes-input text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="opes-label">Headcount</label>
              <input
                type="number"
                min={1}
                required
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Gross Salaries (FCFA)</label>
              <input
                type="number"
                min={0}
                required
                value={grossFcfa}
                onChange={(e) => setGrossFcfa(e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="opes-label">CNPS &amp; IRPP Deductions</label>
              <input
                type="number"
                min={0}
                required
                value={deductionsFcfa}
                onChange={(e) => setDeductionsFcfa(e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Create Payroll Batch
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
