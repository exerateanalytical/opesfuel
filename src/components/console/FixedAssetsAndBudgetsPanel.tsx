import React, { useState } from 'react';
import { CheckCircle2, Landmark, PiggyBank, Plus, Printer, ShieldCheck } from 'lucide-react';
import {
  FixedAssetItem,
  MakerCheckerApprovalItem,
  StationBudgetItem,
} from '../../api/enterpriseModulesData';
import { formatFcfa, formatShortDate } from '../../domain/formatters';
import { UserRole } from '../../domain/types';
import { printFixedAssetsRegisterPdf } from '../../utils/documentTemplates';
import { FormModal } from '../shared/FormModal';

interface FixedAssetsAndBudgetsPanelProps {
  role: UserRole;
  stationId: string;
  stationName: string;
  assets: FixedAssetItem[];
  budgets: StationBudgetItem[];
  approvals: MakerCheckerApprovalItem[];
  onCreateAsset: (a: Omit<FixedAssetItem, 'id' | 'status'>) => void;
  onCreateBudget: (b: Omit<StationBudgetItem, 'id'>) => void;
  onCreateApproval: (a: Omit<MakerCheckerApprovalItem, 'id' | 'status' | 'createdAt'>) => void;
  onDecideApproval: (id: string, status: 'APPROVED' | 'REJECTED') => void;
}

export const FixedAssetsAndBudgetsPanel: React.FC<FixedAssetsAndBudgetsPanelProps> = ({
  role,
  stationId,
  stationName,
  assets,
  budgets,
  approvals,
  onCreateAsset,
  onCreateBudget,
  onCreateApproval,
  onDecideApproval,
}) => {
  const [tab, setTab] = useState<'assets' | 'budgets' | 'approvals'>('assets');
  const [modal, setModal] = useState<'asset' | 'budget' | 'approval' | null>(null);
  const canApprove = role === 'OWNER' || role === 'ACCOUNTANT' || role === 'PLATFORM_ADMIN';

  const [tag, setTag] = useState('FA-');
  const [name, setName] = useState('');
  const [cat, setCat] = useState<FixedAssetItem['category']>('FUEL_DISPENSER');
  const [acqDate, setAcqDate] = useState(new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState('12000000');
  const [life, setLife] = useState('10');
  const [custodian, setCustodian] = useState('Station Manager');
  const [insurance, setInsurance] = useState('AXA-CEMAC-2026');

  const [bPeriod, setBPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [bCat, setBCat] = useState('MAINTENANCE');
  const [bAmt, setBAmt] = useState('500000');
  const [bAct, setBAct] = useState('0');

  const [aType, setAType] = useState<MakerCheckerApprovalItem['requestType']>('CAPEX_EXPENSE');
  const [aTitle, setATitle] = useState('');
  const [aAmt, setAAmt] = useState('1500000');

  const nowYear = new Date().getFullYear();
  const totalGrossAssets = assets.reduce((s, a) => s + a.acquisitionCostFcfa, 0);
  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-950">
            Fixed Assets Register (M36), Station Budgets (M54) &amp; Maker-Checker Approvals (M05)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            SYSCOHADA Class 2 depreciation schedules, budget-vs-actual variance tracking, and dual-control financial approvals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => printFixedAssetsRegisterPdf({ stationName, assets })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" /> Fixed Assets PDF
          </button>
          <button
            type="button"
            onClick={() => setModal('asset')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Capitalize Asset
          </button>
          <button
            type="button"
            onClick={() => setModal('budget')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Add Budget Line
          </button>
          <button
            type="button"
            onClick={() => setModal('approval')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Request Approval
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'assets', label: `Fixed Assets (${assets.length} · ${formatFcfa(totalGrossAssets)})`, icon: Landmark },
            { id: 'budgets', label: `Station Budgets (${budgets.length})`, icon: PiggyBank },
            { id: 'approvals', label: `Maker-Checker Inbox (${pendingApprovals} Pending)`, icon: ShieldCheck },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
                tab === t.id ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'assets' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Asset Tag</th>
                <th className="px-4 py-3">Asset &amp; Insurance</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Acquisition Cost</th>
                <th className="px-4 py-3 text-right">Annual Dep.</th>
                <th className="px-4 py-3 text-right">Net Book Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {assets.map((a) => {
                const acqYear = Number(a.acquisitionDate.slice(0, 4)) || nowYear;
                const elapsed = Math.max(0, Math.min(a.usefulLifeYears, nowYear - acqYear));
                const annualDep = Math.round(a.acquisitionCostFcfa / Math.max(1, a.usefulLifeYears));
                const nbv = Math.max(0, a.acquisitionCostFcfa - annualDep * elapsed);
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{a.assetTag}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{a.assetName}</div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        Acquired {a.acquisitionDate} · Custodian: {a.custodian} · Policy {a.insurancePolicy}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{a.category.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatFcfa(a.acquisitionCostFcfa)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{formatFcfa(annualDep)}/yr</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{formatFcfa(nbv)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'budgets' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Cost Center / Category</th>
                <th className="px-4 py-3 text-right">Budget (FCFA)</th>
                <th className="px-4 py-3 text-right">Actual (FCFA)</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {budgets.map((b) => {
                const variance = b.budgetFcfa - b.actualFcfa;
                const pct = b.budgetFcfa > 0 ? Math.min(120, Math.round((b.actualFcfa / b.budgetFcfa) * 100)) : 0;
                return (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-mono text-slate-600">{b.periodLabel}</td>
                    <td className="px-4 py-3 font-semibold text-slate-950">{b.category.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatFcfa(b.budgetFcfa)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{formatFcfa(b.actualFcfa)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${variance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {variance >= 0 ? `+${formatFcfa(variance)}` : formatFcfa(variance)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct > 100 ? 'bg-red-600' : 'bg-[#0F172A]'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="font-mono text-[11px]">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'approvals' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Request Title &amp; Maker</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Checker Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {approvals.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-mono text-slate-500">{formatShortDate(a.createdAt)}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">{a.requestType.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-950">{a.title}</div>
                    <div className="text-[11px] text-slate-500">Requested by {a.requestedBy}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{formatFcfa(a.amountFcfa)}</td>
                  <td className="px-4 py-3 font-mono font-semibold">
                    {a.status === 'APPROVED' ? (
                      <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> APPROVED</span>
                    ) : a.status === 'REJECTED' ? (
                      <span className="text-red-600">REJECTED</span>
                    ) : (
                      <span className="text-amber-700">PENDING</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                    {a.status === 'PENDING' && canApprove ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onDecideApproval(a.id, 'APPROVED')}
                          className="px-2.5 py-1 rounded bg-[#0F172A] hover:bg-slate-800 text-white font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => onDecideApproval(a.id, 'REJECTED')}
                          className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400">{a.decidedBy ?? 'Locked'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Popup Modals */}
      <FormModal open={modal === 'asset'} title="Capitalize Station Fixed Asset" subtitle="Adds asset to SYSCOHADA Class 2 register with automatic straight-line depreciation." onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onCreateAsset({
              stationId,
              assetTag: tag.trim() || `FA-${Date.now().toString().slice(-4)}`,
              assetName: name.trim(),
              category: cat,
              acquisitionDate: acqDate,
              acquisitionCostFcfa: Number(cost) || 1000000,
              usefulLifeYears: Number(life) || 10,
              custodian: custodian.trim(),
              insurancePolicy: insurance.trim(),
            });
            setName('');
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="opes-label">Asset Tag</label><input value={tag} onChange={(e) => setTag(e.target.value)} className="opes-input font-mono" required /></div>
            <div>
              <label className="opes-label">Category</label>
              <select value={cat} onChange={(e) => setCat(e.target.value as FixedAssetItem['category'])} className="opes-input">
                <option value="UNDERGROUND_TANK">Underground Fuel Tank</option>
                <option value="FUEL_DISPENSER">Fuel Dispenser / Pump</option>
                <option value="GENERATOR">Standby Generator</option>
                <option value="CANOPY">Forecourt Canopy &amp; Civil Works</option>
                <option value="SOLAR">Solar &amp; Battery Backup</option>
                <option value="POS_IT">POS &amp; Forecourt IT</option>
              </select>
            </div>
            <div className="sm:col-span-2"><label className="opes-label">Asset Name</label><input value={name} onChange={(e) => setName(e.target.value)} className="opes-input" required /></div>
            <div><label className="opes-label">Acquisition Cost (FCFA)</label><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Useful Life (Years)</label><input type="number" min={1} value={life} onChange={(e) => setLife(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Acquisition Date</label><input type="date" value={acqDate} onChange={(e) => setAcqDate(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Custodian</label><input value={custodian} onChange={(e) => setCustodian(e.target.value)} className="opes-input" required /></div>
            <div className="sm:col-span-2"><label className="opes-label">Insurance Policy #</label><input value={insurance} onChange={(e) => setInsurance(e.target.value)} className="opes-input font-mono" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold">Save Fixed Asset</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'budget'} title="Add Monthly Station Budget Line" subtitle="Tracks budgeted vs. actual station expenditure by cost center." onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreateBudget({
              stationId,
              periodLabel: bPeriod,
              category: bCat.trim().toUpperCase(),
              budgetFcfa: Number(bAmt) || 0,
              actualFcfa: Number(bAct) || 0,
            });
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="opes-label">Billing Period</label><input type="month" value={bPeriod} onChange={(e) => setBPeriod(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Expense Category</label><input value={bCat} onChange={(e) => setBCat(e.target.value)} className="opes-input" required /></div>
            <div><label className="opes-label">Budget Limit (FCFA)</label><input type="number" min={0} value={bAmt} onChange={(e) => setBAmt(e.target.value)} className="opes-input font-mono" required /></div>
            <div><label className="opes-label">Actual Spent So Far (FCFA)</label><input type="number" min={0} value={bAct} onChange={(e) => setBAct(e.target.value)} className="opes-input font-mono" required /></div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold">Save Budget Line</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={modal === 'approval'} title="Submit Maker-Checker Approval Request" subtitle="Routes high-value POs, price updates, CAPEX, or credit limits to Owner/Accountant." onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!aTitle.trim()) return;
            onCreateApproval({
              stationId,
              requestType: aType,
              title: aTitle.trim(),
              amountFcfa: Number(aAmt) || 0,
              requestedBy: `${role.toLowerCase()}@opesfuel.cm`,
            });
            setATitle('');
            setModal(null);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Approval Type</label>
              <select value={aType} onChange={(e) => setAType(e.target.value as MakerCheckerApprovalItem['requestType'])} className="opes-input">
                <option value="PO_APPROVAL">Fuel Purchase Order Approval</option>
                <option value="CAPEX_EXPENSE">CAPEX / Equipment Expenditure</option>
                <option value="PRICE_CHANGE">Fuel Tariff Adjustment</option>
                <option value="CREDIT_LIMIT">Fleet Credit Limit Increase</option>
              </select>
            </div>
            <div><label className="opes-label">Value / Amount (FCFA)</label><input type="number" min={0} value={aAmt} onChange={(e) => setAAmt(e.target.value)} className="opes-input font-mono" required /></div>
            <div className="sm:col-span-2"><label className="opes-label">Request Summary</label><input value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder="e.g. Approve 20,000L Gasoil PO from SCDP" className="opes-input" required /></div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Submit for Approval</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
