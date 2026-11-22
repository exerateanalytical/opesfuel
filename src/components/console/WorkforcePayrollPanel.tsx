import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, Clock, FileCheck2, PlayCircle, X } from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { formatFcfa, formatShortDate } from '../../domain/formatters';
import { Employee, UserRole } from '../../domain/types';
import { printEmployeePayslipPdf } from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';

interface WorkforcePayrollPanelProps {
  engine: OpesFuelApiEngine;
  role: UserRole;
  stationId: string;
  effectiveStationId: string;
  employees: Employee[];
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const WorkforcePayrollPanel: React.FC<WorkforcePayrollPanelProps> = ({
  engine,
  role,
  stationId,
  effectiveStationId,
  employees,
  onNotify,
}) => {
  const canRunPayroll = role === 'OWNER' || role === 'ACCOUNTANT' || role === 'PLATFORM_ADMIN';
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [periodLabel, setPeriodLabel] = useState(() => new Date().toISOString().slice(0, 7));
  const [paymentSource, setPaymentSource] = useState<'CASH_SAFE' | 'BANK'>('BANK');
  const [payrollRuns, setPayrollRuns] = useState<Array<Record<string, unknown>>>([]);
  const [running, setRunning] = useState(false);

  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id ?? '');
  const [payslip, setPayslip] = useState<Record<string, unknown> | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<Array<Record<string, unknown>> | null>(null);

  const loadRuns = useCallback(async () => {
    const runs = await engine.listPayrollRuns(stationId).catch(() => []);
    setPayrollRuns(Array.isArray(runs) ? runs : []);
  }, [engine, stationId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (employees.length > 0 && !employees.some((e) => e.id === selectedEmpId)) {
      setSelectedEmpId(employees[0].id);
      setPayslip(null);
      setAttendanceLogs(null);
    }
  }, [employees, selectedEmpId]);

  const handleRunPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    try {
      await engine.executePayrollRun({
        stationId: effectiveStationId,
        periodLabel: periodLabel.trim(),
        paymentSource,
      });
      onNotify('success', `Executed monthly payroll for ${periodLabel} and posted DR 6100 Salaries journal.`);
      setPayrollModalOpen(false);
      await loadRuns();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Payroll execution failed.');
    } finally {
      setRunning(false);
    }
  };

  const handleInspectPayslip = async () => {
    const targetId = selectedEmpId || employees[0]?.id;
    if (!targetId) return;
    try {
      const data = await engine.fetchEmployeePayslip(targetId);
      setPayslip(data);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to fetch payslip.');
    }
  };

  const handleInspectAttendance = async () => {
    const targetId = selectedEmpId || employees[0]?.id;
    if (!targetId) return;
    try {
      const logs = await engine.fetchAttendanceLogs(targetId);
      setAttendanceLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to fetch attendance logs.');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-slate-900" />
            Payroll Execution, Payslips &amp; Timesheet Audit Logs
          </h3>
          <p className="text-xs text-slate-500">
            Shortage-only shift deductions · Posts <span className="font-mono">DR 6100 Salaries / CR 1030 Bank or 1010 Cash</span>
          </p>
        </div>
        {canRunPayroll && (
          <button
            type="button"
            onClick={() => setPayrollModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
          >
            <PlayCircle className="w-4 h-4" />
            Execute Monthly Payroll
          </button>
        )}
      </div>

      <FormModal
        open={payrollModalOpen}
        onClose={() => setPayrollModalOpen(false)}
        title="Execute Monthly Station Payroll"
        subtitle="Calculates net salaries with shift shortage deductions and posts DR 6100 Salaries journal."
      >
        <form onSubmit={(e) => void handleRunPayroll(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Payroll Period</label>
              <input
                type="month"
                required
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                className="opes-input font-mono"
              />
            </div>
            <div>
              <label className="opes-label">Disbursement Source</label>
              <select
                value={paymentSource}
                onChange={(e) => setPaymentSource(e.target.value as 'CASH_SAFE' | 'BANK')}
                className="opes-input"
              >
                <option value="BANK">Bank Transfer (1030)</option>
                <option value="CASH_SAFE">Station Cash Safe (1010)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPayrollModalOpen(false)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={running}
              className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-semibold"
            >
              {running ? 'Posting Payroll Journal…' : `Run Payroll (${periodLabel})`}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Payslip & Timesheet Inspector */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={selectedEmpId || employees[0]?.id || ''}
          onChange={(e) => setSelectedEmpId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs min-w-[220px]"
        >
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.fullName} ({emp.role})
            </option>
          ))}
        </select>
        {canRunPayroll && (
          <button
            type="button"
            onClick={() => void handleInspectPayslip()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-slate-700" /> View Employee Payslip
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleInspectAttendance()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800"
        >
          <Clock className="w-3.5 h-3.5 text-slate-700" /> View Clock-In/Out Logs
        </button>
      </div>

      {payslip && canRunPayroll && (
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-900">
              Payslip — {String(payslip.fullName ?? '')} ({String(payslip.role ?? '')})
            </span>
            <div className="flex items-center gap-2">
              {(() => {
                const matchedEmp = employees.find((e) => e.id === (selectedEmpId || employees[0]?.id));
                return matchedEmp ? (
                  <button
                    type="button"
                    onClick={() =>
                      printEmployeePayslipPdf({
                        stationName: stationId === 'ALL' ? 'OpesFuel Station Network' : stationId,
                        periodLabel,
                        employee: matchedEmp,
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-semibold"
                  >
                    Print Payslip PDF
                  </button>
                ) : null;
              })()}
              <button type="button" onClick={() => setPayslip(null)} className="text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <div className="text-slate-500">Base Salary</div>
              <div className="font-mono font-bold">{formatFcfa(Number(payslip.baseSalaryFcfa ?? 0))}</div>
            </div>
            <div>
              <div className="text-slate-500">Shortage Deduction</div>
              <div className="font-mono font-bold text-red-700">
                -{formatFcfa(Number(payslip.shortageDeductionFcfa ?? 0))}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Net Payable</div>
              <div className="font-mono font-bold text-emerald-800">
                {formatFcfa(Number(payslip.netPayableFcfa ?? 0))}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Station</div>
              <div className="font-mono">{String(payslip.stationId ?? '-')}</div>
            </div>
          </div>
        </div>
      )}

      {attendanceLogs && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900">Attendance Timesheet History ({attendanceLogs.length})</span>
            <button type="button" onClick={() => setAttendanceLogs(null)} className="text-slate-500 hover:text-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-slate-200 max-h-44 overflow-y-auto">
            {attendanceLogs.length === 0 ? (
              <div className="py-2 text-slate-500">No clock-in/out logs recorded yet.</div>
            ) : (
              attendanceLogs.map((log, idx) => (
                <div key={String(log.id ?? idx)} className="py-1.5 flex items-center justify-between font-mono">
                  <span className="font-semibold text-slate-900">{String(log.action ?? log.eventType ?? 'PUNCH')}</span>
                  <span className="text-slate-500">
                    {log.recordedAt ? formatShortDate(String(log.recordedAt)) : '-'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Payroll Run History Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3 font-semibold">Period</th>
              <th className="py-2 pr-3 font-semibold">Staff Count</th>
              <th className="py-2 pr-3 font-semibold text-right">Gross</th>
              <th className="py-2 pr-3 font-semibold text-right">Shortage Deductions</th>
              <th className="py-2 pr-3 font-semibold text-right">Net Disbursed</th>
              <th className="py-2 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payrollRuns.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-500">
                  No payroll runs executed yet for this station scope.
                </td>
              </tr>
            ) : (
              payrollRuns.map((run) => (
                <tr key={String(run.id)}>
                  <td className="py-2 pr-3 font-mono font-semibold">{String(run.periodLabel)}</td>
                  <td className="py-2 pr-3 font-mono">{String(run.employeeCount ?? '-')}</td>
                  <td className="py-2 pr-3 text-right font-mono">{formatFcfa(Number(run.grossFcfa ?? run.totalGrossFcfa ?? 0))}</td>
                  <td className="py-2 pr-3 text-right font-mono text-red-700">
                    {formatFcfa(Number(run.deductionsFcfa ?? run.totalDeductionsFcfa ?? 0))}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono font-bold text-emerald-700">
                    {formatFcfa(Number(run.netPaidFcfa ?? run.totalNetPayableFcfa ?? 0))}
                  </td>
                  <td className="py-2 font-mono">{String(run.paymentSource ?? 'BANK')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
