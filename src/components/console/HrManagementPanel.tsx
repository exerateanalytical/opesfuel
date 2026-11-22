import React, { useState } from 'react';
import { Award, CalendarDays, FileText, Plus, ShieldAlert } from 'lucide-react';
import {
  HrCertItem,
  HrContractItem,
  HrDisciplinaryItem,
  HrLeaveItem,
} from '../../api/demoDataset1000';
import { formatFcfa, formatShortDate } from '../../domain/formatters';
import { Employee, UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

interface HrManagementPanelProps {
  stationId: string;
  employees: Employee[];
  role: UserRole;
  contracts: HrContractItem[];
  leaves: HrLeaveItem[];
  certs: HrCertItem[];
  disciplinary: HrDisciplinaryItem[];
  onCreateContract: (c: Omit<HrContractItem, 'id' | 'status'>) => void;
  onCreateLeave: (l: Omit<HrLeaveItem, 'id' | 'status'>) => void;
  onDecideLeave: (leaveId: string, status: 'APPROVED' | 'REJECTED') => void;
  onCreateCert: (cert: Omit<HrCertItem, 'id' | 'status'>) => void;
  onCreateDisciplinary: (rec: Omit<HrDisciplinaryItem, 'id' | 'recordedAt'>) => void;
}

export const HrManagementPanel: React.FC<HrManagementPanelProps> = ({
  stationId,
  employees,
  role,
  contracts,
  leaves,
  certs,
  disciplinary,
  onCreateContract,
  onCreateLeave,
  onDecideLeave,
  onCreateCert,
  onCreateDisciplinary,
}) => {
  const [tab, setTab] = useState<'contracts' | 'leaves' | 'certs' | 'disciplinary'>('contracts');
  const [modal, setModal] = useState<'contract' | 'leave' | 'cert' | 'disciplinary' | null>(null);

  const canManage = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN';
  const defaultEmp = employees[0];

  // Contract form state
  const [cEmpId, setCEmpId] = useState(defaultEmp?.id ?? 'emp_01');
  const [cType, setCType] = useState<'CDI' | 'CDD' | 'PROBATION'>('CDI');
  const [cCnps, setCCnps] = useState('CNPS-CM-2026-');
  const [cBase, setCBase] = useState('150000');
  const [cTransport, setCTransport] = useState('25000');
  const [cHousing, setCHousing] = useState('35000');
  const [cEmgName, setCEmgName] = useState('');
  const [cEmgPhone, setCEmgPhone] = useState('');
  const [cStart, setCStart] = useState(new Date().toISOString().slice(0, 10));

  // Leave form state
  const [lEmpId, setLEmpId] = useState(defaultEmp?.id ?? 'emp_01');
  const [lType, setLType] = useState<'ANNUAL' | 'SICK' | 'MATERNITY' | 'UNPAID'>('ANNUAL');
  const [lStart, setLStart] = useState(new Date().toISOString().slice(0, 10));
  const [lEnd, setLEnd] = useState(new Date().toISOString().slice(0, 10));
  const [lDays, setLDays] = useState('3');
  const [lReason, setLReason] = useState('');

  // Certification form state
  const [certEmpId, setCertEmpId] = useState(defaultEmp?.id ?? 'emp_01');
  const [certName, setCertName] = useState('Forecourt Fire Extinguisher & Spill Response');
  const [certIssuer, setCertIssuer] = useState('Cameroon Civil Protection HSE');
  const [certIssued, setCertIssued] = useState(new Date().toISOString().slice(0, 10));
  const [certExpires, setCertExpires] = useState('2027-12-31');

  // Disciplinary form state
  const [dEmpId, setDEmpId] = useState(defaultEmp?.id ?? 'emp_01');
  const [dCat, setDCat] = useState<'CASH_SHORTAGE' | 'LATENESS' | 'SAFETY_VIOLATION' | 'COMMENDATION'>('CASH_SHORTAGE');
  const [dSev, setDSev] = useState<'INFO' | 'WARNING' | 'FINAL_WARNING'>('WARNING');
  const [dSummary, setDSummary] = useState('');
  const [dAmt, setDAmt] = useState('0');

  const empNameFor = (id: string) => employees.find((e) => e.id === id)?.fullName ?? 'Station Staff';
  const pendingLeavesCount = leaves.filter((l) => l.status === 'PENDING').length;
  const expiringCertsCount = certs.filter((c) => c.status !== 'VALID').length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-950">
            Human Resources (HR), Contracts, Leave &amp; HSE Safety
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage CNPS contracts, staff leave approvals, mandatory fire-safety certificates, and conduct records.
          </p>
        </div>

        {/* Action Buttons Only — Forms Pop Up Cleanly in FormModal */}
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => setModal('contract')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add HR Contract
            </button>
          )}
          <button
            type="button"
            onClick={() => setModal('leave')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Request Leave
          </button>
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setModal('cert')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Log Safety Cert
              </button>
              <button
                type="button"
                onClick={() => setModal('disciplinary')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Log HR Notice
              </button>
            </>
          )}
        </div>
      </div>

      {/* Compact HR KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs text-slate-500">Active HR Contracts</div>
          <div className="font-mono text-xl font-bold text-slate-950 mt-1">{contracts.length}</div>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs text-slate-500">Pending Leave Requests</div>
          <div className="font-mono text-xl font-bold text-slate-950 mt-1">{pendingLeavesCount}</div>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs text-slate-500">HSE Safety Certificates</div>
          <div className="font-mono text-xl font-bold text-slate-950 mt-1">
            {certs.length}{' '}
            {expiringCertsCount > 0 && (
              <span className="text-xs font-sans font-semibold text-amber-700">({expiringCertsCount} renewing)</span>
            )}
          </div>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs text-slate-500">Conduct &amp; Commendations</div>
          <div className="font-mono text-xl font-bold text-slate-950 mt-1">{disciplinary.length}</div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { id: 'contracts', label: `Contracts & CNPS (${contracts.length})`, icon: FileText },
            { id: 'leaves', label: `Leave Requests (${leaves.length})`, icon: CalendarDays },
            { id: 'certs', label: `Safety & Fire Certs (${certs.length})`, icon: Award },
            { id: 'disciplinary', label: `Conduct & Reviews (${disciplinary.length})`, icon: ShieldAlert },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                active
                  ? 'bg-[#0F172A] text-white border-[#0F172A]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Tables (Consistent Obsidian Navy Headers) */}
      {tab === 'contracts' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">CNPS #</th>
                <th className="px-4 py-3 text-right">Base Salary</th>
                <th className="px-4 py-3 text-right">Allowances</th>
                <th className="px-4 py-3">Emergency Contact</th>
                <th className="px-4 py-3">Start</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{c.employeeName}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-700">{c.contractType}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{c.cnpsNumber || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {formatFcfa(c.baseSalaryFcfa)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                    {formatFcfa(c.transportAllowanceFcfa + c.housingAllowanceFcfa)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.emergencyContactName} ({c.emergencyContactPhone})
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">{c.startDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'leaves' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Leave Type</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3 text-right">Days</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                {canManage && <th className="px-4 py-3 text-right">Decision</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{l.employeeName}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{l.leaveType}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {l.startDate} → {l.endDate}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">{l.daysCount}</td>
                  <td className="px-4 py-3 text-slate-600">{l.reason || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded border text-[11px] font-mono font-semibold ${
                        l.status === 'APPROVED'
                          ? 'border-emerald-300 text-emerald-800 bg-white'
                          : l.status === 'REJECTED'
                          ? 'border-red-300 text-red-700 bg-white'
                          : 'border-amber-400 text-amber-800 bg-white'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                      {l.status === 'PENDING' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onDecideLeave(l.id, 'APPROVED')}
                            className="px-2.5 py-1 rounded bg-[#0F172A] hover:bg-slate-800 text-white font-semibold"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onDecideLeave(l.id, 'REJECTED')}
                            className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-400">Reviewed</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'certs' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Certification</th>
                <th className="px-4 py-3">Issuing Body</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {certs.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{c.employeeName}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{c.certName}</td>
                  <td className="px-4 py-3 text-slate-600">{c.issuer}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{c.issuedDate}</td>
                  <td className="px-4 py-3 font-mono text-slate-900 font-semibold">{c.expiresDate}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded border text-[11px] font-mono font-semibold ${
                        c.status === 'VALID'
                          ? 'border-emerald-300 text-emerald-800 bg-white'
                          : 'border-amber-400 text-amber-800 bg-white'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'disciplinary' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {disciplinary.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-mono text-slate-500">{formatShortDate(d.recordedAt)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{d.employeeName}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{d.category}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">{d.severity}</td>
                  <td className="px-4 py-3 text-slate-700">{d.summary}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {d.amountFcfa > 0 ? formatFcfa(d.amountFcfa) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* POPUP MODALS — Clean, Gap-Free, Auto-Close on Save */}
      <FormModal
        open={modal === 'contract'}
        title="Add Employee HR Contract & CNPS"
        subtitle="Record employment terms, monthly allowances, and emergency contact."
        onClose={() => setModal(null)}
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreateContract({
              stationId,
              employeeId: cEmpId,
              employeeName: empNameFor(cEmpId),
              contractType: cType,
              cnpsNumber: cCnps.trim(),
              baseSalaryFcfa: Number(cBase) || 0,
              transportAllowanceFcfa: Number(cTransport) || 0,
              housingAllowanceFcfa: Number(cHousing) || 0,
              emergencyContactName: cEmgName.trim() || 'Family Contact',
              emergencyContactPhone: cEmgPhone.trim() || '+237 6XX XXX XXX',
              startDate: cStart,
            });
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Employee</label>
              <select value={cEmpId} onChange={(e) => setCEmpId(e.target.value)} className="opes-input">
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName} ({e.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Contract Type</label>
              <select value={cType} onChange={(e) => setCType(e.target.value as 'CDI' | 'CDD' | 'PROBATION')} className="opes-input">
                <option value="CDI">CDI (Permanent)</option>
                <option value="CDD">CDD (Fixed Term)</option>
                <option value="PROBATION">Probation</option>
              </select>
            </div>
            <div>
              <label className="opes-label">CNPS Social Security #</label>
              <input value={cCnps} onChange={(e) => setCCnps(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Start Date</label>
              <input type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Base Salary (FCFA)</label>
              <input type="number" min={0} value={cBase} onChange={(e) => setCBase(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Transport Allowance (FCFA)</label>
              <input type="number" min={0} value={cTransport} onChange={(e) => setCTransport(e.target.value)} className="opes-input font-mono" />
            </div>
            <div>
              <label className="opes-label">Housing Allowance (FCFA)</label>
              <input type="number" min={0} value={cHousing} onChange={(e) => setCHousing(e.target.value)} className="opes-input font-mono" />
            </div>
            <div>
              <label className="opes-label">Emergency Contact Name</label>
              <input value={cEmgName} onChange={(e) => setCEmgName(e.target.value)} placeholder="e.g. Marie Tchoupo" className="opes-input" />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Emergency Contact Phone</label>
              <input value={cEmgPhone} onChange={(e) => setCEmgPhone(e.target.value)} placeholder="+237 6XX XXX XXX" className="opes-input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              Save HR Contract
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={modal === 'leave'}
        title="Submit Staff Leave Request"
        subtitle="Request annual, sick, maternity, or unpaid leave for manager approval."
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreateLeave({
              stationId,
              employeeId: lEmpId,
              employeeName: empNameFor(lEmpId),
              leaveType: lType,
              startDate: lStart,
              endDate: lEnd,
              daysCount: Math.max(1, Number(lDays) || 1),
              reason: lReason.trim() || 'Scheduled leave',
            });
            setLReason('');
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Employee</label>
              <select value={lEmpId} onChange={(e) => setLEmpId(e.target.value)} className="opes-input">
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Leave Type</label>
              <select value={lType} onChange={(e) => setLType(e.target.value as HrLeaveItem['leaveType'])} className="opes-input">
                <option value="ANNUAL">Annual Leave</option>
                <option value="SICK">Sick Leave</option>
                <option value="MATERNITY">Maternity Leave</option>
                <option value="UNPAID">Unpaid Leave</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Start Date</label>
              <input type="date" value={lStart} onChange={(e) => setLStart(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">End Date</label>
              <input type="date" value={lEnd} onChange={(e) => setLEnd(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Total Days</label>
              <input type="number" min={1} value={lDays} onChange={(e) => setLDays(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Reason</label>
              <input value={lReason} onChange={(e) => setLReason(e.target.value)} placeholder="Brief reason" className="opes-input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              Submit Leave Request
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={modal === 'cert'}
        title="Log HSE / Fire Safety Certification"
        subtitle="Track mandatory petrol station safety and LPG handling qualifications."
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreateCert({
              stationId,
              employeeId: certEmpId,
              employeeName: empNameFor(certEmpId),
              certName: certName.trim(),
              issuer: certIssuer.trim(),
              issuedDate: certIssued,
              expiresDate: certExpires,
            });
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="opes-label">Employee</label>
              <select value={certEmpId} onChange={(e) => setCertEmpId(e.target.value)} className="opes-input">
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Certification Name</label>
              <input value={certName} onChange={(e) => setCertName(e.target.value)} className="opes-input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Issuing Authority</label>
              <input value={certIssuer} onChange={(e) => setCertIssuer(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Issued Date</label>
              <input type="date" value={certIssued} onChange={(e) => setCertIssued(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Expiry Date</label>
              <input type="date" value={certExpires} onChange={(e) => setCertExpires(e.target.value)} className="opes-input font-mono" required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">
              Save Certificate
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={modal === 'disciplinary'}
        title="Log Staff Conduct / Commendation Notice"
        subtitle="Record cash shortage warnings, safety notices, or zero-variance commendations."
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!dSummary.trim()) return;
            onCreateDisciplinary({
              stationId,
              employeeId: dEmpId,
              employeeName: empNameFor(dEmpId),
              category: dCat,
              severity: dSev,
              summary: dSummary.trim(),
              amountFcfa: Number(dAmt) || 0,
              recordedBy: role,
            });
            setDSummary('');
            setDAmt('0');
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Employee</label>
              <select value={dEmpId} onChange={(e) => setDEmpId(e.target.value)} className="opes-input">
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Category</label>
              <select value={dCat} onChange={(e) => setDCat(e.target.value as HrDisciplinaryItem['category'])} className="opes-input">
                <option value="CASH_SHORTAGE">Cash Shortage</option>
                <option value="LATENESS">Lateness / Absence</option>
                <option value="SAFETY_VIOLATION">Safety Violation</option>
                <option value="COMMENDATION">Commendation</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Severity</label>
              <select value={dSev} onChange={(e) => setDSev(e.target.value as HrDisciplinaryItem['severity'])} className="opes-input">
                <option value="INFO">Info / Recognition</option>
                <option value="WARNING">Written Warning</option>
                <option value="FINAL_WARNING">Final Warning</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Related Amount (FCFA)</label>
              <input type="number" min={0} value={dAmt} onChange={(e) => setDAmt(e.target.value)} className="opes-input font-mono" />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Summary / Notes</label>
              <input value={dSummary} onChange={(e) => setDSummary(e.target.value)} placeholder="Describe the event clearly" className="opes-input" required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">
              Save HR Notice
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
