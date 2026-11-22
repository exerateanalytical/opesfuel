import React, { useState } from 'react';
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  Flame,
  Plus,
  Printer,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  FraudCaseItem,
  FuelQualitySampleItem,
  HseRecordItem,
} from '../../api/enterpriseModulesData';
import { formatFcfa, formatLitres, formatShortDate } from '../../domain/formatters';
import { FuelTank, ShiftRecord, TankDeliveryRecord, UserRole } from '../../domain/types';
import {
  printFraudCaseReportPdf,
  printFuelQualityCertPdf,
  printHseIncidentReportPdf,
} from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';

interface HseFraudQcSectionProps {
  role: UserRole;
  stationId: string;
  stationName: string;
  tanks: FuelTank[];
  shifts: ShiftRecord[];
  deliveries: TankDeliveryRecord[];
  hseRecords: HseRecordItem[];
  fraudCases: FraudCaseItem[];
  qualitySamples: FuelQualitySampleItem[];
  onCreateHseRecord: (rec: Omit<HseRecordItem, 'id' | 'status' | 'recordedAt'>) => void;
  onCreateFraudCase: (fc: Omit<FraudCaseItem, 'id' | 'recoveredFcfa' | 'disposition' | 'openedAt'>) => void;
  onUpdateFraudCase: (id: string, disposition: FraudCaseItem['disposition'], recoveredFcfa: number) => void;
  onCreateQualitySample: (qc: Omit<FuelQualitySampleItem, 'id' | 'quarantined' | 'testedAt'>) => void;
  onToggleQuarantine: (id: string, quarantined: boolean) => void;
}

export const HseFraudQcSection: React.FC<HseFraudQcSectionProps> = ({
  role,
  stationId,
  stationName,
  tanks,
  shifts,
  deliveries,
  hseRecords,
  fraudCases,
  qualitySamples,
  onCreateHseRecord,
  onCreateFraudCase,
  onUpdateFraudCase,
  onCreateQualitySample,
  onToggleQuarantine,
}) => {
  const [tab, setTab] = useState<'hse' | 'fraud' | 'qc'>('hse');
  const [modal, setModal] = useState<'hse' | 'fraud' | 'qc' | null>(null);
  const canManage = role === 'OWNER' || role === 'MANAGER' || role === 'ACCOUNTANT' || role === 'PLATFORM_ADMIN';

  // Live automated loss-prevention anomaly correlation (M39-F001 / F002 / F008)
  const shortageShifts = shifts.filter((s) => s.status === 'CLOSED' && s.varianceFcfa < -5000);
  const shrinkageTanks = tanks.filter((t) => Math.abs(t.varianceLitres) > 100);
  const shortDeliveries = deliveries.filter((d) => d.actualReceivedLitres - d.bolLitres < -50);

  // HSE Form State
  const [hseType, setHseType] = useState<HseRecordItem['recordType']>('FIRE_EXTINGUISHER');
  const [hseSeverity, setHseSeverity] = useState<HseRecordItem['severity']>('LOW');
  const [hseTitle, setHseTitle] = useState('');
  const [hseDetails, setHseDetails] = useState('');
  const [hseInspector, setHseInspector] = useState('HSE Officer Paul M.');
  const [hseDue, setHseDue] = useState('2027-06-01');
  const [hseCapa, setHseCapa] = useState('');

  // Fraud Case Form State
  const [frdType, setFrdType] = useState<FraudCaseItem['anomalyType']>('SHIFT_SHORTAGE');
  const [frdSev, setFrdSev] = useState<FraudCaseItem['severity']>('HIGH');
  const [frdRef, setFrdRef] = useState('');
  const [frdLoss, setFrdLoss] = useState('45000');
  const [frdInv, setFrdInv] = useState('Chief Auditor');
  const [frdFindings, setFrdFindings] = useState('');

  // Fuel QC Form State
  const [qcTankId, setQcTankId] = useState(tanks[0]?.id ?? 'tk_01');
  const [qcBatch, setQcBatch] = useState('SCDP-COA-2026-');
  const [qcDensity, setQcDensity] = useState('745.0');
  const [qcTemp, setQcTemp] = useState('27.5');
  const [qcWater, setQcWater] = useState(false);
  const [qcTester, setQcTester] = useState('Station Manager');
  const [qcNotes, setQcNotes] = useState('Clear visual test & water-paste dip verified');

  const activeQuarantines = qualitySamples.filter((q) => q.quarantined).length;
  const openFraudCount = fraudCases.filter((f) => f.disposition === 'UNDER_INVESTIGATION').length;
  const totalSuspectedLoss = fraudCases.reduce((s, f) => s + f.suspectedLossFcfa, 0);
  const totalRecovered = fraudCases.reduce((s, f) => s + f.recoveredFcfa, 0);

  return (
    <div className="space-y-6">
      {/* Executive Compliance Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="font-mono text-[11px] font-bold text-amber-700 tracking-wide">
              M38 HSE SAFETY · M39 LOSS PREVENTION · M55 FUEL QUALITY CONTROL
            </div>
            <h2 className="font-display text-xl font-bold text-slate-950 mt-0.5">
              HSE Safety, Fraud Prevention &amp; Fuel Quality Assurance
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fire extinguishers, spill incidents, automated shortage/shrinkage investigations, water-paste dip tests &amp; tank quarantine controls.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModal('hse')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Log HSE / Fire Record
            </button>
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => setModal('fraud')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Open Fraud Investigation
                </button>
                <button
                  type="button"
                  onClick={() => setModal('qc')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Record Fuel Quality Test
                </button>
              </>
            )}
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs text-slate-500">HSE Inspections &amp; Permits</div>
            <div className="font-mono text-2xl font-bold text-slate-950 mt-1">{hseRecords.length}</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs text-slate-500">Live Detected Anomalies</div>
            <div className="font-mono text-2xl font-bold text-slate-950 mt-1">
              {shortageShifts.length + shrinkageTanks.length + shortDeliveries.length}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs text-slate-500">Loss Recovery Rate</div>
            <div className="font-mono text-lg font-bold text-slate-950 mt-1">
              {formatFcfa(totalRecovered)} <span className="text-xs text-slate-400">/ {formatFcfa(totalSuspectedLoss)}</span>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs text-slate-500">Quarantined Fuel Tanks</div>
            <div className={`font-mono text-2xl font-bold mt-1 ${activeQuarantines > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {activeQuarantines} {activeQuarantines === 0 ? 'Clear' : 'STOP-SALE'}
            </div>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'hse', label: `HSE Safety & Permits (${hseRecords.length})`, icon: Flame },
              { id: 'fraud', label: `Fraud & Loss Prevention (${openFraudCount} Open)`, icon: ShieldAlert },
              { id: 'qc', label: `Fuel Quality & Quarantine (${qualitySamples.length})`, icon: Beaker },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  tab === t.id
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
      </div>

      {/* TAB 1: HSE SAFETY & ENVIRONMENTAL (M38) */}
      {tab === 'hse' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                HSE Policy, Fire Equipment, Spills, Sump Checks &amp; Regulatory Permits
              </h3>
              <p className="text-xs text-slate-500">Every HSE record generates a signed A4 PDF compliance dossier.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Title &amp; CAPA</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Inspector</th>
                  <th className="px-4 py-3">Next Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Dossier PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {hseRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-500">{formatShortDate(rec.recordedAt)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{rec.recordType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{rec.title}</div>
                      <div className="text-slate-500 mt-0.5">{rec.capaAction || rec.details}</div>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">{rec.severity}</td>
                    <td className="px-4 py-3 text-slate-700">{rec.inspectorOrReporter}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{rec.nextDueDate || '—'}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{rec.status}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => printHseIncidentReportPdf({ stationName, record: rec })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
                      >
                        <Printer className="w-3 h-3" /> HSE PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FRAUD & LOSS PREVENTION WORKBENCH (M39) */}
      {tab === 'fraud' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="font-display text-sm font-bold text-slate-950 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Automated Forecourt, Tank &amp; Delivery Exception Detector
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <div className="font-mono font-bold text-slate-900">Shift Shortages (&gt; 5,000 FCFA)</div>
                <div className="text-slate-600 mt-1">
                  {shortageShifts.length} flagged shift(s) across station scope.
                </div>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <div className="font-mono font-bold text-slate-900">Tank Dipstick Shrinkage (&gt; 100 L)</div>
                <div className="text-slate-600 mt-1">
                  {shrinkageTanks.length} underground tank(s) exceeding variance threshold.
                </div>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <div className="font-mono font-bold text-slate-900">Supplier Short Deliveries (&gt; 50 L)</div>
                <div className="text-slate-600 mt-1">
                  {shortDeliveries.length} tanker offloading shortfall(s) vs. BOL.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900">
                Loss Prevention Investigation Case Register
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="px-4 py-3">Case ID</th>
                    <th className="px-4 py-3">Anomaly &amp; Subject</th>
                    <th className="px-4 py-3 text-right">Exposure</th>
                    <th className="px-4 py-3 text-right">Recovered</th>
                    <th className="px-4 py-3">Disposition</th>
                    <th className="px-4 py-3 text-right">Actions &amp; PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {fraudCases.map((fc) => (
                    <tr key={fc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">{fc.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-950">
                          {fc.anomalyType.replace(/_/g, ' ')} · <span className="font-mono text-amber-700">{fc.subjectRef}</span>
                        </div>
                        <div className="text-slate-500 mt-0.5">{fc.findings}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-red-700">
                        {formatFcfa(fc.suspectedLossFcfa)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                        {formatFcfa(fc.recoveredFcfa)}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold">{fc.disposition.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {fc.disposition === 'UNDER_INVESTIGATION' && canManage && (
                            <button
                              type="button"
                              onClick={() => onUpdateFraudCase(fc.id, 'RECOVERED_CLOSED', fc.suspectedLossFcfa)}
                              className="px-2 py-1 rounded bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-semibold"
                            >
                              Mark Recovered
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => printFraudCaseReportPdf({ stationName, fraudCase: fc })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
                          >
                            <Printer className="w-3 h-3" /> Case PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FUEL QUALITY CONTROL & QUARANTINE (M55) */}
      {tab === 'qc' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-900">
              Fuel Batch COA, Density, Water-Paste Sampling &amp; Tank Quarantine Control
            </h3>
            <p className="text-xs text-slate-500">
              Water detection triggers automatic stop-sale quarantine until drained and released by management.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Tank &amp; Grade</th>
                  <th className="px-4 py-3">Batch COA</th>
                  <th className="px-4 py-3 text-right">Density / Temp</th>
                  <th className="px-4 py-3">Water Paste</th>
                  <th className="px-4 py-3">Sale Status</th>
                  <th className="px-4 py-3 text-right">Quarantine &amp; Cert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {qualitySamples.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-500">{formatShortDate(q.testedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{q.tankName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{q.fuelGrade}</div>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{q.batchCoaRef}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {q.densityKgM3} kg/m³ · {q.temperatureC}°C
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {q.waterPasteDetected ? (
                        <span className="text-red-600">WATER DETECTED</span>
                      ) : (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Clean
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold">
                      {q.quarantined ? (
                        <span className="text-red-600">QUARANTINED</span>
                      ) : (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Cleared
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => onToggleQuarantine(q.id, !q.quarantined)}
                            className={`px-2 py-1 rounded text-[11px] font-semibold border ${
                              q.quarantined
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'border-red-300 text-red-700 bg-white hover:bg-red-50'
                            }`}
                          >
                            {q.quarantined ? 'Release Tank' : 'Quarantine'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => printFuelQualityCertPdf({ stationName, sample: q })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
                        >
                          <Printer className="w-3 h-3" /> QC PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Popup Modals */}
      <FormModal
        open={modal === 'hse'}
        title="Log HSE Safety, Fire Equipment or Spill Record"
        subtitle="Records safety inspection, spill incident, sump check, or environmental permit."
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!hseTitle.trim()) return;
            onCreateHseRecord({
              stationId,
              recordType: hseType,
              severity: hseSeverity,
              title: hseTitle.trim(),
              details: hseDetails.trim() || hseTitle.trim(),
              inspectorOrReporter: hseInspector.trim(),
              nextDueDate: hseDue,
              capaAction: hseCapa.trim() || 'Verified per station HSE protocol',
            });
            setHseTitle('');
            setHseDetails('');
            setHseCapa('');
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">HSE Category</label>
              <select value={hseType} onChange={(e) => setHseType(e.target.value as HseRecordItem['recordType'])} className="opes-input">
                <option value="FIRE_EXTINGUISHER">Fire Extinguisher Inspection</option>
                <option value="INCIDENT_SPILL">Spill / Near-Miss Incident</option>
                <option value="TANK_LEAK_CHECK">Underground Tank Leak / Sump Check</option>
                <option value="SAFETY_DRILL">Emergency Shutoff &amp; Evacuation Drill</option>
                <option value="WASTE_OIL">Waste Oil Disposal Manifest</option>
                <option value="PERMIT">Regulatory / Environmental Permit</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Risk Severity</label>
              <select value={hseSeverity} onChange={(e) => setHseSeverity(e.target.value as HseRecordItem['severity'])} className="opes-input">
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Record Title</label>
              <input value={hseTitle} onChange={(e) => setHseTitle(e.target.value)} placeholder="e.g. Monthly Fire Extinguisher & Emergency Stop Test" className="opes-input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Inspection / Incident Details</label>
              <textarea rows={2} value={hseDetails} onChange={(e) => setHseDetails(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Inspector / Reporter</label>
              <input value={hseInspector} onChange={(e) => setHseInspector(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Next Inspection / Renewal Due</label>
              <input type="date" value={hseDue} onChange={(e) => setHseDue(e.target.value)} className="opes-input font-mono" />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">CAPA (Corrective / Preventive Action)</label>
              <input value={hseCapa} onChange={(e) => setHseCapa(e.target.value)} placeholder="Action taken or scheduled follow-up" className="opes-input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">Save HSE Record</button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={modal === 'fraud'}
        title="Open Fraud & Loss Prevention Investigation Case"
        subtitle="Creates an auditable loss investigation dossier with financial exposure & recovery tracking."
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!frdRef.trim() || !frdFindings.trim()) return;
            onCreateFraudCase({
              stationId,
              anomalyType: frdType,
              severity: frdSev,
              subjectRef: frdRef.trim(),
              suspectedLossFcfa: Number(frdLoss) || 0,
              investigator: frdInv.trim(),
              findings: frdFindings.trim(),
            });
            setFrdRef('');
            setFrdFindings('');
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Anomaly Classification</label>
              <select value={frdType} onChange={(e) => setFrdType(e.target.value as FraudCaseItem['anomalyType'])} className="opes-input">
                <option value="SHIFT_SHORTAGE">Repeated Shift Cash Shortage</option>
                <option value="TANK_SHRINKAGE">Underground Tank Shrinkage</option>
                <option value="SHORT_DELIVERY">Supplier Tanker Short Delivery</option>
                <option value="METER_TAMPER">Off-Shift Meter Movement</option>
                <option value="FLEET_VELOCITY">Fleet Card Velocity Anomaly</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Severity</label>
              <select value={frdSev} onChange={(e) => setFrdSev(e.target.value as FraudCaseItem['severity'])} className="opes-input">
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Linked Reference (Shift / Tank / Delivery)</label>
              <input value={frdRef} onChange={(e) => setFrdRef(e.target.value)} placeholder="e.g. SHF-2026-114" className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Estimated Exposure (FCFA)</label>
              <input type="number" min={0} value={frdLoss} onChange={(e) => setFrdLoss(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Lead Investigator</label>
              <input value={frdInv} onChange={(e) => setFrdInv(e.target.value)} className="opes-input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Evidence &amp; Initial Findings</label>
              <textarea rows={3} value={frdFindings} onChange={(e) => setFrdFindings(e.target.value)} className="opes-input" required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Open Investigation Case</button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={modal === 'qc'}
        title="Record Fuel Quality Sample & Water-Paste Test"
        subtitle="Logs density, temperature, and water-finding paste result; auto-quarantines tank if water is detected."
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const tk = tanks.find((t) => t.id === qcTankId) ?? tanks[0];
            onCreateQualitySample({
              stationId,
              tankId: tk?.id ?? 'tk_01',
              tankName: tk?.name ?? 'Underground Tank',
              fuelGrade: tk?.grade ?? 'SUPER',
              batchCoaRef: qcBatch.trim() || `COA-${Date.now().toString().slice(-5)}`,
              densityKgM3: Number(qcDensity) || 745,
              temperatureC: Number(qcTemp) || 27.5,
              waterPasteDetected: qcWater,
              testedBy: qcTester.trim(),
              notes: qcNotes.trim(),
            });
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="opes-label">Underground Tank</label>
              <select value={qcTankId} onChange={(e) => setQcTankId(e.target.value)} className="opes-input">
                {tanks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.grade} · {formatLitres(t.bookVolumeLitres)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Supplier Batch COA #</label>
              <input value={qcBatch} onChange={(e) => setQcBatch(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Tested By</label>
              <input value={qcTester} onChange={(e) => setQcTester(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Density (kg/m³)</label>
              <input type="number" step="0.1" value={qcDensity} onChange={(e) => setQcDensity(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Temperature (°C)</label>
              <input type="number" step="0.1" value={qcTemp} onChange={(e) => setQcTemp(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input id="qc-water" type="checkbox" checked={qcWater} onChange={(e) => setQcWater(e.target.checked)} className="w-4 h-4 accent-red-600" />
              <label htmlFor="qc-water" className="text-xs font-semibold text-red-700">
                Water detected on paste dipstick (automatically places tank in STOP-SALE Quarantine)
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Lab / Visual Notes</label>
              <input value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} className="opes-input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">Save Fuel QC Certificate</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
