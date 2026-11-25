import { useLiveApi } from '../../api/liveApi';
import React, { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Cog, Plus, Wrench, Zap } from 'lucide-react';
import { formatFcfa } from '../../domain/formatters';
import { UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

interface WorkOrder {
  id: string;
  assetName: string;
  orderType: 'CORRECTIVE' | 'PREVENTIVE';
  priority: string;
  title: string;
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'DONE' | 'VERIFIED';
  assignedTechnician: string;
  laborCostFcfa: number;
  partsCostFcfa: number;
}

interface GeneratorLog {
  id: string;
  generatorName: string;
  hoursStart: number;
  hoursEnd: number;
  runtimeHours: number;
  fuelLitres: number;
  fuelCostFcfa: number;
  powerOutageReason: string;
  loggedAt: string;
}

interface SparePart {
  id: string;
  partCode: string;
  partName: string;
  category: string;
  stockQty: number;
  reorderLevel: number;
  unitCostFcfa: number;
}

interface MaintenanceCmmsPanelProps {
  role: UserRole;
  stationId: string;
  stationName: string;
  onPostBackend: (path: string, method: 'POST' | 'PATCH' | 'PUT', body?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const NEXT_STATE: Record<WorkOrder['status'], WorkOrder['status'] | null> = {
  OPEN: 'ASSIGNED',
  ASSIGNED: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  ON_HOLD: 'IN_PROGRESS',
  DONE: 'VERIFIED',
  VERIFIED: null,
};

export const MaintenanceCmmsPanel: React.FC<MaintenanceCmmsPanelProps> = ({
  role,
  stationId,
  stationName,
  onPostBackend,
  onNotify,
}) => {
  const canEdit = role === 'PLATFORM_ADMIN' || role === 'OWNER' || role === 'MANAGER';
  const [tab, setTab] = useState<'work-orders' | 'generator' | 'parts'>('work-orders');

  const liveData = useLiveApi().live; // real customers never see built-in sample rows
  const seed_workOrders: WorkOrder[] = [
    { id: 'wo_01', assetName: 'Perkins 250kVA Standby Generator', orderType: 'PREVENTIVE', priority: 'HIGH', title: '250-Hour Oil, Fuel Filter & Belt Service', status: 'IN_PROGRESS', assignedTechnician: 'Tech Jean-Luc', laborCostFcfa: 45000, partsCostFcfa: 68000 },
    { id: 'wo_02', assetName: 'Tokheim Dispenser Bay 2', orderType: 'CORRECTIVE', priority: 'MEDIUM', title: 'Replace Super Nozzle Breakaway Coupling', status: 'OPEN', assignedTechnician: 'Unassigned', laborCostFcfa: 0, partsCostFcfa: 0 },
  ];
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(liveData ? [] : seed_workOrders);

  const seed_genLogs: GeneratorLog[] = [
    { id: 'gen_01', generatorName: 'Perkins 250kVA Standby Generator', hoursStart: 1240.5, hoursEnd: 1246.5, runtimeHours: 6.0, fuelLitres: 48, fuelCostFcfa: 39744, powerOutageReason: 'ENEO feeder maintenance outage', loggedAt: new Date(Date.now() - 7200_000).toISOString() },
  ];
  const [genLogs, setGenLogs] = useState<GeneratorLog[]>(liveData ? [] : seed_genLogs);

  const seed_parts: SparePart[] = [
    { id: 'prt_01', partCode: 'AVR-SX460', partName: 'Generator AVR Module SX460', category: 'GENERATOR', stockQty: 2, reorderLevel: 1, unitCostFcfa: 45000 },
    { id: 'prt_02', partCode: 'NOZ-ZVA25', partName: 'ZVA Automatic Fuel Nozzle 3/4"', category: 'DISPENSER', stockQty: 4, reorderLevel: 2, unitCostFcfa: 62000 },
    { id: 'prt_03', partCode: 'FLT-PRK250', partName: 'Perkins Fuel/Water Separator Filter', category: 'GENERATOR', stockQty: 1, reorderLevel: 2, unitCostFcfa: 18500 },
  ];
  const [parts, setParts] = useState<SparePart[]>(liveData ? [] : seed_parts);

  // Modals
  const [woModalOpen, setWoModalOpen] = useState(false);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [issuePart, setIssuePart] = useState<SparePart | null>(null);

  const [woAsset, setWoAsset] = useState('Perkins 250kVA Standby Generator');
  const [woType, setWoType] = useState<'CORRECTIVE' | 'PREVENTIVE'>('CORRECTIVE');
  const [woPriority, setWoPriority] = useState('HIGH');
  const [woTitle, setWoTitle] = useState('');
  const [woTech, setWoTech] = useState('');

  const [genName, setGenName] = useState('Perkins 250kVA Standby Generator');
  const [hoursStart, setHoursStart] = useState('1246.5');
  const [hoursEnd, setHoursEnd] = useState('1251.0');
  const [fuelLitres, setFuelLitres] = useState('36');
  const [outageReason, setOutageReason] = useState('ENEO grid outage');
  const [deductDiesel, setDeductDiesel] = useState(true);

  const [issueWoId, setIssueWoId] = useState('wo_01');
  const [issueQty, setIssueQty] = useState(1);

  const totalMaintenanceFcfa = useMemo(
    () => workOrders.reduce((s, w) => s + w.laborCostFcfa + w.partsCostFcfa, 0),
    [workOrders]
  );
  const totalGenHours = useMemo(() => genLogs.reduce((s, g) => s + g.runtimeHours, 0), [genLogs]);
  const totalGenFuel = useMemo(() => genLogs.reduce((s, g) => s + g.fuelLitres, 0), [genLogs]);

  const handleCreateWo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!woTitle.trim()) return;
    const remote = await onPostBackend('/api/v1/cmms/work-orders', 'POST', {
      stationId,
      assetName: woAsset,
      orderType: woType,
      priority: woPriority,
      title: woTitle.trim(),
      assignedTechnician: woTech.trim() || undefined,
    });
    setWorkOrders((prev) => [
      {
        id: String(remote?.id ?? `wo_${Date.now().toString(36)}`),
        assetName: woAsset,
        orderType: woType,
        priority: woPriority,
        title: woTitle.trim(),
        status: woTech.trim() ? 'ASSIGNED' : 'OPEN',
        assignedTechnician: woTech.trim() || 'Unassigned',
        laborCostFcfa: 0,
        partsCostFcfa: 0,
      },
      ...prev,
    ]);
    setWoTitle('');
    setWoTech('');
    setWoModalOpen(false);
    onNotify('success', `Created ${woType} CMMS work order.`);
  };

  const advanceWorkOrder = async (wo: WorkOrder) => {
    const next = NEXT_STATE[wo.status];
    if (!next) return;
    await onPostBackend(`/api/v1/cmms/work-orders/${encodeURIComponent(wo.id)}/transition`, 'PATCH', {
      nextStatus: next,
      laborCostFcfa: next === 'DONE' && wo.laborCostFcfa === 0 ? 25000 : wo.laborCostFcfa,
    });
    setWorkOrders((prev) =>
      prev.map((w) =>
        w.id === wo.id
          ? { ...w, status: next, laborCostFcfa: next === 'DONE' && w.laborCostFcfa === 0 ? 25000 : w.laborCostFcfa }
          : w
      )
    );
    onNotify('success', `Work order "${wo.title}" transitioned to ${next}.`);
  };

  const handleLogGenerator = async (e: React.FormEvent) => {
    e.preventDefault();
    const hs = Number(hoursStart);
    const he = Number(hoursEnd);
    const fl = Number(fuelLitres);
    if (he <= hs || fl <= 0) {
      onNotify('error', 'Closing meter hours must exceed opening hours and fuel litres must be positive.');
      return;
    }
    const runtime = Math.round((he - hs) * 100) / 100;
    const cost = Math.round(fl * 828);
    const remote = await onPostBackend('/api/v1/cmms/generator-logs', 'POST', {
      stationId,
      generatorName: genName,
      hoursStart: hs,
      hoursEnd: he,
      fuelLitres: fl,
      fuelSource: 'INTERNAL_DIESEL_TANK',
      fuelCostFcfa: cost,
      powerOutageReason: outageReason,
      deductInternalDieselTank: deductDiesel,
    });
    setGenLogs((prev) => [
      {
        id: String(remote?.id ?? `gen_${Date.now()}`),
        generatorName: genName,
        hoursStart: hs,
        hoursEnd: he,
        runtimeHours: runtime,
        fuelLitres: fl,
        fuelCostFcfa: cost,
        powerOutageReason: outageReason,
        loggedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setHoursStart(String(he));
    setGenModalOpen(false);
    onNotify('success', `Logged ${runtime}h standby generator run (${fl} L Gasoil, ${(fl / runtime).toFixed(1)} L/h).`);
  };

  const handleIssuePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issuePart) return;
    if (issuePart.stockQty < issueQty) {
      onNotify('error', 'Insufficient spare part stock.');
      return;
    }
    await onPostBackend(`/api/v1/cmms/spare-parts/${encodeURIComponent(issuePart.id)}/issue`, 'POST', {
      workOrderId: issueWoId,
      quantity: issueQty,
    });
    const addedCost = issuePart.unitCostFcfa * issueQty;
    setParts((prev) => prev.map((p) => (p.id === issuePart.id ? { ...p, stockQty: p.stockQty - issueQty } : p)));
    setWorkOrders((prev) => prev.map((w) => (w.id === issueWoId ? { ...w, partsCostFcfa: w.partsCostFcfa + addedCost } : w)));
    setIssuePart(null);
    setIssueQty(1);
    onNotify('success', `Issued ${issueQty}× ${issuePart.partCode} to work order (${formatFcfa(addedCost)}).`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-slate-900" />
            Station CMMS, Standby Generator Runtime &amp; Spare Parts
          </h3>
          <p className="text-xs text-slate-500">
            Corrective &amp; preventive work orders, ENEO outage diesel generator logs, and spare parts cost rollup for {stationName}.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setGenModalOpen(true)} className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600" /> Log Generator Run
            </button>
            <button type="button" onClick={() => setWoModalOpen(true)} className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> New Work Order
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] uppercase font-semibold text-slate-500">Open / Active WOs</div>
          <div className="font-mono text-2xl font-bold text-slate-900">{workOrders.filter((w) => w.status !== 'VERIFIED').length}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] uppercase font-semibold text-slate-500">Maintenance Cost Rollup</div>
          <div className="font-mono text-lg font-bold text-slate-900">{formatFcfa(totalMaintenanceFcfa)}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] uppercase font-semibold text-slate-500">Generator Runtime</div>
          <div className="font-mono text-2xl font-bold text-amber-700">{totalGenHours.toFixed(1)} h</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] uppercase font-semibold text-slate-500">Generator Diesel Burn</div>
          <div className="font-mono text-2xl font-bold text-slate-900">{totalGenFuel.toFixed(0)} L</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { id: 'work-orders', label: 'Work Orders & PM', icon: CalendarClock },
            { id: 'generator', label: 'Standby Generator Log', icon: Zap },
            { id: 'parts', label: 'Spare Parts Inventory', icon: Cog },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                tab === t.id ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'work-orders' && (
        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-white text-left">
              <tr>
                <th className="px-4 py-3">Asset &amp; Task</th>
                <th className="px-4 py-3">Type / Priority</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Labor + Parts</th>
                <th className="px-4 py-3 text-right">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workOrders.map((wo) => (
                <tr key={wo.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{wo.title}</div>
                    <div className="text-[11px] text-slate-500">{wo.assetName}</div>
                  </td>
                  <td className="px-4 py-3 font-mono">{wo.orderType} · {wo.priority}</td>
                  <td className="px-4 py-3">{wo.assignedTechnician}</td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{wo.status}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{formatFcfa(wo.laborCostFcfa + wo.partsCostFcfa)}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && NEXT_STATE[wo.status] ? (
                      <button
                        type="button"
                        onClick={() => void advanceWorkOrder(wo)}
                        className="px-2.5 py-1 rounded bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800"
                      >
                        Advance → {NEXT_STATE[wo.status]}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'generator' && (
        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-white text-left">
              <tr>
                <th className="px-4 py-3">Generator</th>
                <th className="px-4 py-3">Meter (Start → End)</th>
                <th className="px-4 py-3 text-right">Runtime</th>
                <th className="px-4 py-3 text-right">Diesel Drawn</th>
                <th className="px-4 py-3 text-right">L / hr</th>
                <th className="px-4 py-3">Outage Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {genLogs.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{g.generatorName}</td>
                  <td className="px-4 py-3 font-mono">{g.hoursStart} → {g.hoursEnd} h</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{g.runtimeHours.toFixed(1)} h</td>
                  <td className="px-4 py-3 text-right font-mono">{g.fuelLitres} L ({formatFcfa(g.fuelCostFcfa)})</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-700 font-bold">{(g.fuelLitres / g.runtimeHours).toFixed(1)}</td>
                  <td className="px-4 py-3 text-slate-600">{g.powerOutageReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'parts' && (
        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-white text-left">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Spare Part</th>
                <th className="px-4 py-3 text-right">On Hand</th>
                <th className="px-4 py-3 text-right">Reorder At</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-right">Issue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold">{p.partCode}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{p.partName}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${p.stockQty <= p.reorderLevel ? 'text-red-700' : 'text-emerald-700'}`}>
                    {p.stockQty} {p.stockQty <= p.reorderLevel ? '(LOW)' : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{p.reorderLevel}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatFcfa(p.unitCostFcfa)}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <button type="button" onClick={() => setIssuePart(p)} className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 font-semibold">
                        Issue to WO
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormModal open={woModalOpen} onClose={() => setWoModalOpen(false)} title="Create CMMS Work Order">
        <form onSubmit={(e) => void handleCreateWo(e)} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Asset / Equipment</label>
            <input type="text" required value={woAsset} onChange={(e) => setWoAsset(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Order Type</label>
              <select value={woType} onChange={(e) => setWoType(e.target.value as 'CORRECTIVE' | 'PREVENTIVE')} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                <option value="CORRECTIVE">Corrective (Repair)</option>
                <option value="PREVENTIVE">Preventive (Scheduled PM)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Priority</label>
              <select value={woPriority} onChange={(e) => setWoPriority(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Work Description</label>
            <input type="text" required value={woTitle} onChange={(e) => setWoTitle(e.target.value)} placeholder="e.g. Dispenser meter pulse sensor replacement" className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Assign Technician (optional)</label>
            <input type="text" value={woTech} onChange={(e) => setWoTech(e.target.value)} placeholder="Technician name" className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setWoModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Create Work Order</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={genModalOpen} onClose={() => setGenModalOpen(false)} title="Log Standby Diesel Generator Runtime">
        <form onSubmit={(e) => void handleLogGenerator(e)} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Generator Unit</label>
            <input type="text" required value={genName} onChange={(e) => setGenName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Start Hours</label>
              <input type="number" step="0.1" required value={hoursStart} onChange={(e) => setHoursStart(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">End Hours</label>
              <input type="number" step="0.1" required value={hoursEnd} onChange={(e) => setHoursEnd(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Diesel (Litres)</label>
              <input type="number" step="0.5" required value={fuelLitres} onChange={(e) => setFuelLitres(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Outage / Run Reason</label>
            <input type="text" value={outageReason} onChange={(e) => setOutageReason(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={deductDiesel} onChange={(e) => setDeductDiesel(e.target.checked)} />
            Automatically deduct drawn diesel from station internal GASOIL tank book stock
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setGenModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Log Runtime &amp; Fuel</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={Boolean(issuePart)} onClose={() => setIssuePart(null)} title={`Issue Spare Part — ${issuePart?.partCode || ''}`}>
        <form onSubmit={(e) => void handleIssuePart(e)} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Target Work Order</label>
            <select value={issueWoId} onChange={(e) => setIssueWoId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
              {workOrders.map((w) => (
                <option key={w.id} value={w.id}>{w.title} ({w.assetName})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Quantity (Available: {issuePart?.stockQty})</label>
            <input type="number" min={1} max={issuePart?.stockQty || 1} value={issueQty} onChange={(e) => setIssueQty(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIssuePart(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Issue Part &amp; Roll Up Cost</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
