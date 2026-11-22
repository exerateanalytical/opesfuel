import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Download, Edit3, FileText, Plus, Printer, Trash2, Users } from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { canPerformAction, ROLE_PROFILES } from '../../auth/auth0';
import { formatFcfa } from '../../domain/formatters';
import { Employee, UserRole } from '../../domain/types';
import { printEmployeePayslipPdf, printPayrollRegisterPdf } from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';
import { WorkforcePayrollPanel } from './WorkforcePayrollPanel';

interface WorkforceSectionProps {
  engine: OpesFuelApiEngine;
  role: UserRole;
  stationId: string;
  defaultStationId: string;
  employees: Employee[];
  onToggleAttendance: (employeeId: string) => void;
  onCreateEmployee: (input: {
    stationId: string;
    fullName: string;
    role: UserRole;
    phone: string;
    shiftWindow: string;
    baseSalaryFcfa: number;
  }) => void;
  onUpdateEmployee: (
    employeeId: string,
    input: {
      fullName: string;
      role: UserRole;
      phone: string;
      shiftWindow: string;
      baseSalaryFcfa: number;
    }
  ) => void;
  onDeleteEmployee: (employeeId: string) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
  hrSlot?: React.ReactNode;
}

export const WorkforceSection: React.FC<WorkforceSectionProps> = ({
  engine,
  role,
  stationId,
  defaultStationId,
  employees,
  onToggleAttendance,
  onCreateEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onNotify,
  hrSlot,
}) => {
  const canManage = canPerformAction(role, 'MANAGE_EMPLOYEES');
  const canRunPayroll = canPerformAction(role, 'RUN_PAYROLL');
  const visibleEmployees = employees.filter((e) => stationId === 'ALL' || e.stationId === stationId);
  const effectiveStation = stationId === 'ALL' ? defaultStationId : stationId;

  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('ATTENDANT');
  const [editPhone, setEditPhone] = useState('');
  const [editWindow, setEditWindow] = useState('');
  const [editSalary, setEditSalary] = useState('');

  const [fullName, setFullName] = useState('');
  const [empRole, setEmpRole] = useState<UserRole>('ATTENDANT');
  const [phone, setPhone] = useState('+237 677 ');
  const [shiftWindow, setShiftWindow] = useState('14:00 - 22:00');
  const [salary, setSalary] = useState('145000');

  const totalBaseSalaryFcfa = visibleEmployees.reduce((sum, e) => sum + e.baseSalaryFcfa, 0);
  const totalVarianceFcfa = visibleEmployees.reduce((sum, e) => sum + e.cumulativeVarianceFcfa, 0);
  const totalNetPayrollFcfa = totalBaseSalaryFcfa + totalVarianceFcfa;

  const beginEdit = (emp: Employee) => {
    setEditingEmployeeId(emp.id);
    setEditName(emp.fullName);
    setEditRole(emp.role);
    setEditPhone(emp.phone);
    setEditWindow(emp.shiftWindow);
    setEditSalary(String(emp.baseSalaryFcfa));
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployeeId || !editName.trim()) return;
    onUpdateEmployee(editingEmployeeId, {
      fullName: editName.trim(),
      role: editRole,
      phone: editPhone.trim(),
      shiftWindow: editWindow.trim(),
      baseSalaryFcfa: Number(editSalary) || 0,
    });
    setEditingEmployeeId(null);
  };

  const exportPayrollCsv = () => {
    const header = 'Employee,Role,Shift Window,Base Salary (FCFA),Shift Variance (FCFA),Net Payable (FCFA)\n';
    const rows = visibleEmployees
      .map((emp) => {
        const net = emp.baseSalaryFcfa + emp.cumulativeVarianceFcfa;
        return `"${emp.fullName}",${emp.role},"${emp.shiftWindow}",${emp.baseSalaryFcfa},${emp.cumulativeVarianceFcfa},${net}`;
      })
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opesfuel-payroll-${stationId.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    onCreateEmployee({
      stationId: effectiveStation,
      fullName: fullName.trim(),
      role: empRole,
      phone: phone.trim(),
      shiftWindow,
      baseSalaryFcfa: Number(salary) || 140000,
    });
    setFullName('');
  };

  // Dedicated Employee Profile & Payroll Detail Page
  const activeDetailEmp = detailEmployeeId ? employees.find((e) => e.id === detailEmployeeId) : null;
  if (activeDetailEmp) {
    const netPayFcfa = activeDetailEmp.baseSalaryFcfa + activeDetailEmp.cumulativeVarianceFcfa;
    const roleProfile = ROLE_PROFILES[activeDetailEmp.role];

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDetailEmployeeId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Staff &amp; Payroll Roster
          </button>
          <div className="flex items-center gap-2">
            {canRunPayroll && (
              <button
                type="button"
                onClick={() =>
                  printEmployeePayslipPdf({
                    stationName: stationId === 'ALL' ? 'OpesFuel Station' : stationId,
                    periodLabel: new Date().toISOString().slice(0, 7),
                    employee: activeDetailEmp,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" /> Print Payslip PDF
              </button>
            )}
            {canManage && (role !== 'MANAGER' || activeDetailEmp.role === 'ATTENDANT') && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    beginEdit(activeDetailEmp);
                    setDetailEmployeeId(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-semibold"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteEmployee(activeDetailEmp.id);
                    setDetailEmployeeId(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Employee
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg icon-glass text-slate-900 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">{activeDetailEmp.fullName}</h2>
                <p className="text-xs text-slate-500">
                  <span className="font-mono font-semibold text-amber-700">{activeDetailEmp.role}</span> ·{' '}
                  {activeDetailEmp.phone} · Shift {activeDetailEmp.shiftWindow}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {canPerformAction(role, 'OPEN_CLOSE_SHIFT') ? (
                <button
                  type="button"
                  onClick={() => onToggleAttendance(activeDetailEmp.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    activeDetailEmp.clockedIn
                      ? 'bg-white border-emerald-200 text-emerald-800'
                      : 'bg-slate-900 border-slate-900 text-white'
                  }`}
                >
                  {activeDetailEmp.clockedIn ? 'Currently Clocked In (Tap to Clock Out)' : 'Clock In for Shift'}
                </button>
              ) : (
                <span
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold border ${
                    activeDetailEmp.clockedIn
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {activeDetailEmp.clockedIn ? 'Currently Clocked In (Read-Only)' : 'Off Shift (Read-Only)'}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {canRunPayroll && (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Monthly Base Salary</div>
                <div className="font-mono tabular-nums text-lg font-bold text-slate-900 mt-1">
                  {formatFcfa(activeDetailEmp.baseSalaryFcfa)}
                </div>
              </div>
            )}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Cumulative Shift Variance</div>
              <div
                className={`font-mono tabular-nums text-lg font-bold mt-1 ${
                  activeDetailEmp.cumulativeVarianceFcfa < 0 ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {formatFcfa(activeDetailEmp.cumulativeVarianceFcfa)}
              </div>
            </div>
            {canRunPayroll && (
              <div className="p-4 rounded-lg bg-slate-900 text-white">
                <div className="text-xs text-slate-300">Net Disbursable Payroll</div>
                <div className="font-mono tabular-nums text-lg font-bold text-amber-400 mt-1">
                  {formatFcfa(netPayFcfa)}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg border border-slate-200 space-y-1.5">
            <div className="text-xs font-semibold text-slate-900">
              Auth0 RBAC Access Scope — {roleProfile.title}
            </div>
            <p className="text-xs text-slate-600">{roleProfile.summary}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {canRunPayroll ? 'Workforce Roster, Attendance & Payroll Variance' : 'Station Staff Roster & Shift Attendance'}
            </h2>
            <p className="text-xs text-slate-500">
              {canRunPayroll
                ? 'Staff accounts, shift schedules, clock-in state, and automated shift shortage adjustments in FCFA'
                : 'Manage station rosters, shift schedules, and daily clock-in attendance (payroll disbursements restricted to Owner & Accountant)'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 self-start sm:self-auto">
            {canManage && (
              <button
                type="button"
                onClick={() => setShowOnboardModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" /> Onboard Station Employee
              </button>
            )}
            {canRunPayroll && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    printPayrollRegisterPdf({
                      stationName: stationId === 'ALL' ? 'OpesFuel Station Network' : stationId,
                      periodLabel: new Date().toISOString().slice(0, 7),
                      employees: visibleEmployees,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" /> Print Payroll Register PDF
                </button>
                <button
                  type="button"
                  onClick={exportPayrollCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" /> Payroll CSV
                </button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Shift Window</th>
                {canRunPayroll && <th className="px-4 py-3 text-right">Base Salary</th>}
                <th className="px-4 py-3 text-right">Shift Variance</th>
                {canRunPayroll && <th className="px-4 py-3 text-right">Net Payroll</th>}
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3 text-right">{canRunPayroll ? 'Payslip & Actions' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleEmployees.map((emp) => {
                const netPay = emp.baseSalaryFcfa + emp.cumulativeVarianceFcfa;
                return (
                  <tr key={emp.id}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDetailEmployeeId(emp.id)}
                        className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-amber-700"
                      >
                        <span>{emp.fullName}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <div className="text-xs font-mono text-slate-500">{emp.phone}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{emp.role}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{emp.shiftWindow}</td>
                    {canRunPayroll && (
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{formatFcfa(emp.baseSalaryFcfa)}</td>
                    )}
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                        emp.cumulativeVarianceFcfa < 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {formatFcfa(emp.cumulativeVarianceFcfa)}
                    </td>
                    {canRunPayroll && (
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatFcfa(netPay)}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {canPerformAction(role, 'OPEN_CLOSE_SHIFT') ? (
                        <button
                          type="button"
                          onClick={() => onToggleAttendance(emp.id)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                            emp.clockedIn
                              ? 'bg-white border-emerald-400 text-emerald-800 hover:bg-slate-50'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {emp.clockedIn ? 'Clocked In' : 'Clock In'}
                        </button>
                      ) : (
                        <span
                          className={`inline-block px-2.5 py-1 rounded text-xs font-semibold border ${
                            emp.clockedIn
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          {emp.clockedIn ? 'Clocked In' : 'Off Shift'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {canRunPayroll && (
                          <button
                            type="button"
                            onClick={() =>
                              printEmployeePayslipPdf({
                                stationName: stationId === 'ALL' ? 'OpesFuel Station' : stationId,
                                periodLabel: new Date().toISOString().slice(0, 7),
                                employee: emp,
                              })
                            }
                            title={`Print Monthly Payslip PDF for ${emp.fullName}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
                          >
                            <Printer className="w-3 h-3" /> Payslip PDF
                          </button>
                        )}
                        {canManage && (role !== 'MANAGER' || emp.role === 'ATTENDANT') && (
                          <>
                            <button
                              type="button"
                              onClick={() => beginEdit(emp)}
                              aria-label={`Edit ${emp.fullName}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Remove employee "${emp.fullName}" from this station?`)) {
                                  onDeleteEmployee(emp.id);
                                }
                              }}
                              aria-label={`Delete ${emp.fullName}`}
                              className="p-1.5 text-slate-500 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleEmployees.length === 0 && (
                <tr>
                  <td colSpan={canRunPayroll ? 8 : 6} className="px-4 py-6 text-center text-xs text-slate-500">
                    No employees onboarded for this station scope yet.
                  </td>
                </tr>
              )}
            </tbody>
            {canRunPayroll && (
            <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-900">
              <tr>
                <td colSpan={3} className="px-4 py-3">
                  Monthly Payroll Total ({visibleEmployees.length} staff)
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{formatFcfa(totalBaseSalaryFcfa)}</td>
                <td
                  className={`px-4 py-3 text-right font-mono tabular-nums ${
                    totalVarianceFcfa < 0 ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {formatFcfa(totalVarianceFcfa)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-bold">
                  {formatFcfa(totalNetPayrollFcfa)}
                </td>
                <td colSpan={2} className="px-4 py-3 text-slate-500 font-normal">
                  Net Disbursable
                </td>
              </tr>
            </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Popup Modal: Onboard Station Employee */}
      <FormModal
        open={showOnboardModal}
        title="Onboard Station Employee"
        subtitle={
          canRunPayroll
            ? 'Create a staff member profile with station role, shift schedule, and monthly base salary.'
            : 'Create a pump island attendant profile and shift schedule (base salary configured by Owner / Accountant).'
        }
        onClose={() => setShowOnboardModal(false)}
      >
        <form
          onSubmit={(e) => {
            handleCreate(e);
            if (fullName.trim()) setShowOnboardModal(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="opes-label">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Samuel Tchoupo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="opes-input"
                required
              />
            </div>
            <div>
              <label className="opes-label">Station Role</label>
              <select
                value={role === 'MANAGER' ? 'ATTENDANT' : empRole}
                onChange={(e) => setEmpRole(e.target.value as UserRole)}
                className="opes-input"
              >
                <option value="ATTENDANT">Pump Attendant</option>
                {role !== 'MANAGER' && (
                  <>
                    <option value="MANAGER">Station Manager</option>
                    <option value="ACCOUNTANT">Station Accountant</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="opes-label">Phone / WhatsApp</label>
              <input
                type="text"
                placeholder="+237 677 XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="opes-input font-mono"
                required
              />
            </div>
            <div className={canRunPayroll ? '' : 'sm:col-span-2'}>
              <label className="opes-label">Shift Window</label>
              <input
                type="text"
                placeholder="06:00 - 14:00"
                value={shiftWindow}
                onChange={(e) => setShiftWindow(e.target.value)}
                className="opes-input font-mono"
                required
              />
            </div>
            {canRunPayroll && (
              <div>
                <label className="opes-label">Monthly Base Salary (FCFA)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="135000"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="opes-input font-mono tabular-nums"
                  required
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowOnboardModal(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Add Employee to Station
            </button>
          </div>
        </form>
      </FormModal>

      {/* Popup Modal: Edit Employee */}
      <FormModal
        open={Boolean(editingEmployeeId && canManage)}
        title="Edit Station Employee"
        subtitle={
          canRunPayroll
            ? 'Update role assignment, contact phone, shift schedule, or monthly salary.'
            : 'Update attendant contact phone and shift schedule (compensation restricted to Owner / Accountant).'
        }
        onClose={() => setEditingEmployeeId(null)}
      >
        <form onSubmit={handleEditSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="opes-label">Full Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Role</label>
              <select
                value={role === 'MANAGER' ? 'ATTENDANT' : editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="opes-input"
              >
                <option value="ATTENDANT">Pump Attendant</option>
                {role !== 'MANAGER' && (
                  <>
                    <option value="MANAGER">Station Manager</option>
                    <option value="ACCOUNTANT">Station Accountant</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="opes-label">Phone</label>
              <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div className={canRunPayroll ? '' : 'sm:col-span-2'}>
              <label className="opes-label">Shift Window</label>
              <input type="text" value={editWindow} onChange={(e) => setEditWindow(e.target.value)} className="opes-input font-mono" required />
            </div>
            {canRunPayroll && (
              <div>
                <label className="opes-label">Base Salary (FCFA)</label>
                <input type="number" value={editSalary} onChange={(e) => setEditSalary(e.target.value)} className="opes-input font-mono" required />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setEditingEmployeeId(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">
              Save Changes
            </button>
          </div>
        </form>
      </FormModal>

      {hrSlot}

      <WorkforcePayrollPanel
        engine={engine}
        role={role}
        stationId={stationId}
        effectiveStationId={effectiveStation}
        employees={visibleEmployees}
        onNotify={onNotify}
      />
    </div>
  );
};
