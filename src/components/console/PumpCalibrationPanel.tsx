import React, { useState } from 'react';
import { Gauge, Plus, Printer, Wrench } from 'lucide-react';
import { PumpCalibrationItem, PumpMaintenanceItem } from '../../api/demoDataset1000';
import { formatFcfa, formatLitres, formatShortDate } from '../../domain/formatters';
import { Pump } from '../../domain/types';
import { printCalibrationCertPdf } from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';

interface PumpCalibrationPanelProps {
  stationId: string;
  stationName?: string;
  pumps: Pump[];
  canManage: boolean;
  calibrations: PumpCalibrationItem[];
  maintenance: PumpMaintenanceItem[];
  onRecordCalibration: (item: Omit<PumpCalibrationItem, 'id' | 'testedAt'>) => void;
  onRecordMaintenance: (item: Omit<PumpMaintenanceItem, 'id' | 'loggedAt'>) => void;
}

export const PumpCalibrationPanel: React.FC<PumpCalibrationPanelProps> = ({
  stationId,
  stationName = 'OpesFuel Station',
  pumps,
  canManage,
  calibrations,
  maintenance,
  onRecordCalibration,
  onRecordMaintenance,
}) => {
  const [modal, setModal] = useState<'cal' | 'mnt' | null>(null);
  const [tab, setTab] = useState<'cal' | 'mnt'>('cal');

  const firstPump = pumps[0];
  const [calPumpId, setCalPumpId] = useState(firstPump?.id ?? '');
  const [testLitres, setTestLitres] = useState('20');
  const [returnedToTank, setReturnedToTank] = useState(true);
  const [inspector, setInspector] = useState('Inspector M. Ndongo');
  const [calNotes, setCalNotes] = useState('20L Ministry calibration can verified — returned to tank');

  const [mntPumpId, setMntPumpId] = useState(firstPump?.id ?? '');
  const [mntType, setMntType] = useState('NOZZLE_SEAL_SERVICE');
  const [mntDesc, setMntDesc] = useState('');
  const [mntCost, setMntCost] = useState('35000');
  const [mntTech, setMntTech] = useState('Tech. Eric Biloa');
  const [mntOut, setMntOut] = useState(false);
  const [mntNext, setMntNext] = useState('2027-03-01');

  const selectedCalPump = pumps.find((p) => p.id === calPumpId) ?? firstPump;
  const selectedMntPump = pumps.find((p) => p.id === mntPumpId) ?? firstPump;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-950">
            Pump Calibration (20L Return-to-Tank) &amp; Dispenser Maintenance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Advance nozzle totalizers during meter calibration tests without creating false attendant cash shortages.
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModal('cal')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Record 20L Calibration Test
            </button>
            <button
              type="button"
              onClick={() => setModal('mnt')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Log Dispenser Maintenance
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('cal')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
            tab === 'cal' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Gauge className="w-3.5 h-3.5" /> Calibration Tests ({calibrations.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('mnt')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
            tab === 'mnt' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" /> Maintenance Logs ({maintenance.length})
        </button>
      </div>

      {tab === 'cal' ? (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Pump</th>
                <th className="px-4 py-3 text-right">Test Volume</th>
                <th className="px-4 py-3 text-right">Meter Advance</th>
                <th className="px-4 py-3">Returned to Tank</th>
                <th className="px-4 py-3">Inspector</th>
                <th className="px-4 py-3 text-right">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {calibrations.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono text-slate-500">{formatShortDate(c.testedAt)}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{c.pumpCode}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">{formatLitres(c.testLitres)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                    {formatLitres(c.openingTotalizer)} → {formatLitres(c.closingTotalizer)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">
                    {c.returnedToTank ? 'Yes (Zero Tank Loss)' : 'Sample Retained'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.inspectorName}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => printCalibrationCertPdf(stationName, c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold"
                    >
                      <Printer className="w-3 h-3" /> Cert PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Pump</th>
                <th className="px-4 py-3">Service Type</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3">Next Service</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {maintenance.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-mono text-slate-500">{formatShortDate(m.loggedAt)}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{m.pumpCode}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{m.maintenanceType}</td>
                  <td className="px-4 py-3 text-slate-600">{m.technician}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">{formatFcfa(m.costFcfa)}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{m.nextDueDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Popup Modals */}
      <FormModal
        open={modal === 'cal'}
        title="Record 20L Pump Calibration (Return-to-Tank)"
        subtitle="Logs official meter test volume so shift cash stays 100% accurate."
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedCalPump) return;
            const vol = Math.max(0.5, Number(testLitres) || 20);
            onRecordCalibration({
              stationId: selectedCalPump.stationId || stationId,
              pumpId: selectedCalPump.id,
              pumpCode: selectedCalPump.code,
              tankId: selectedCalPump.tankId,
              testLitres: vol,
              returnedToTank,
              openingTotalizer: selectedCalPump.totalizerLitres,
              closingTotalizer: selectedCalPump.totalizerLitres + vol,
              inspectorName: inspector.trim(),
              notes: calNotes.trim(),
            });
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Dispenser Nozzle</label>
              <select value={selectedCalPump?.id ?? ''} onChange={(e) => setCalPumpId(e.target.value)} className="opes-input">
                {pumps.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} ({p.grade})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Test Volume (Litres)</label>
              <input type="number" step="0.5" min={0.5} value={testLitres} onChange={(e) => setTestLitres(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Inspector / Supervisor Name</label>
              <input value={inspector} onChange={(e) => setInspector(e.target.value)} className="opes-input" required />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2.5 pt-1">
              <input
                id="ret-tank-chk"
                type="checkbox"
                checked={returnedToTank}
                onChange={(e) => setReturnedToTank(e.target.checked)}
                className="w-4 h-4 accent-amber-600"
              />
              <label htmlFor="ret-tank-chk" className="text-xs font-medium text-slate-700">
                Fuel poured back into underground tank (do not deduct tank book stock)
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Verification Notes</label>
              <input value={calNotes} onChange={(e) => setCalNotes(e.target.value)} className="opes-input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              Save Calibration Test
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={modal === 'mnt'}
        title="Log Dispenser Maintenance & Seal Service"
        subtitle="Track nozzle repairs, filter changes, and technician costs."
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedMntPump || !mntDesc.trim()) return;
            onRecordMaintenance({
              stationId: selectedMntPump.stationId || stationId,
              pumpId: selectedMntPump.id,
              pumpCode: selectedMntPump.code,
              maintenanceType: mntType,
              description: mntDesc.trim(),
              costFcfa: Number(mntCost) || 0,
              technician: mntTech.trim(),
              outOfService: mntOut,
              nextDueDate: mntNext,
            });
            setMntDesc('');
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Dispenser</label>
              <select value={selectedMntPump?.id ?? ''} onChange={(e) => setMntPumpId(e.target.value)} className="opes-input">
                {pumps.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} ({p.grade})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Maintenance Type</label>
              <select value={mntType} onChange={(e) => setMntType(e.target.value)} className="opes-input">
                <option value="NOZZLE_SEAL_SERVICE">Nozzle &amp; Seal Service</option>
                <option value="HOSE_REPLACEMENT">Hose Replacement</option>
                <option value="FILTER_REPLACEMENT">Fuel Filter Change</option>
                <option value="METER_CALIBRATION_REPAIR">Flow Meter Repair</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Service Cost (FCFA)</label>
              <input type="number" min={0} value={mntCost} onChange={(e) => setMntCost(e.target.value)} className="opes-input font-mono" required />
            </div>
            <div>
              <label className="opes-label">Technician</label>
              <input value={mntTech} onChange={(e) => setMntTech(e.target.value)} className="opes-input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Work Performed</label>
              <input value={mntDesc} onChange={(e) => setMntDesc(e.target.value)} placeholder="Replaced automatic shutoff nozzle & swivel" className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Next Service Due</label>
              <input type="date" value={mntNext} onChange={(e) => setMntNext(e.target.value)} className="opes-input font-mono" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input id="mnt-oos" type="checkbox" checked={mntOut} onChange={(e) => setMntOut(e.target.checked)} className="w-4 h-4 accent-amber-600" />
              <label htmlFor="mnt-oos" className="text-xs font-medium text-slate-700">Pump temporarily out of service</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">
              Save Maintenance Log
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
