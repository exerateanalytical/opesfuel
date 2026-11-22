import React, { useCallback, useEffect, useState } from 'react';
import { Car, FileSpreadsheet, PauseCircle, PlayCircle, Plus, Receipt, Trash2, X } from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { ALL_FUEL_GRADES, formatFcfa, formatLitres, formatShortDate, gradeLabel } from '../../domain/formatters';
import { FleetAccount, FuelGrade, UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

interface FleetShopAdvancedPanelProps {
  engine: OpesFuelApiEngine;
  role: UserRole;
  stationId: string;
  fleetAccounts: FleetAccount[];
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const FleetShopAdvancedPanel: React.FC<FleetShopAdvancedPanelProps> = ({
  engine,
  role,
  stationId,
  fleetAccounts,
  onNotify,
}) => {
  const canManage =
    role === 'OWNER' ||
    role === 'MANAGER' ||
    role === 'ACCOUNTANT' ||
    role === 'GROUP_CFO' ||
    role === 'PLATFORM_ADMIN';
  const [selectedAccountId, setSelectedAccountId] = useState(fleetAccounts[0]?.id ?? '');
  const activeAccountId = selectedAccountId || fleetAccounts[0]?.id || '';
  const activeAccount = fleetAccounts.find((a) => a.id === activeAccountId);

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Array<Record<string, unknown>>>([]);
  const [plateNumber, setPlateNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [allowedGrade, setAllowedGrade] = useState<FuelGrade>('GASOIL');
  const [monthlyCap, setMonthlyCap] = useState('3500');

  const [statement, setStatement] = useState<Record<string, unknown> | null>(null);
  const [shopSales, setShopSales] = useState<Array<Record<string, unknown>>>([]);

  const loadVehiclesAndShop = useCallback(async () => {
    const [vList, sList] = await Promise.all([
      activeAccountId ? engine.listFleetVehicles(activeAccountId).catch(() => []) : Promise.resolve([]),
      engine.listShopSales(stationId).catch(() => []),
    ]);
    setVehicles(Array.isArray(vList) ? vList : []);
    setShopSales(Array.isArray(sList) ? sList : []);
  }, [engine, activeAccountId, stationId]);

  useEffect(() => {
    void loadVehiclesAndShop();
  }, [loadVehiclesAndShop]);

  useEffect(() => {
    if (fleetAccounts.length > 0 && !fleetAccounts.some((a) => a.id === selectedAccountId)) {
      setSelectedAccountId(fleetAccounts[0].id);
      setStatement(null);
    }
  }, [fleetAccounts, selectedAccountId]);

  const handleToggleHold = async (acc: FleetAccount) => {
    const nextStatus = acc.status === 'HOLD' ? 'ACTIVE' : 'HOLD';
    try {
      await engine.updateFleetAccountStatus(acc.id, nextStatus);
      onNotify('success', `Fleet account ${acc.companyName} status updated to ${nextStatus}.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update fleet account status.');
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId || !plateNumber.trim() || !driverName.trim()) return;
    try {
      await engine.registerFleetVehicle(activeAccountId, {
        plateNumber: plateNumber.trim().toUpperCase(),
        driverName: driverName.trim(),
        allowedGrade,
        monthlyLitreCap: Number(monthlyCap) || 3500,
      });
      onNotify('success', `Registered fleet vehicle ${plateNumber.trim().toUpperCase()}.`);
      setPlateNumber('');
      setDriverName('');
      setVehicleModalOpen(false);
      await loadVehiclesAndShop();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to register vehicle.');
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!activeAccountId) return;
    try {
      await engine.deleteFleetVehicle(activeAccountId, vehicleId);
      onNotify('success', 'Removed vehicle from corporate fleet whitelist.');
      await loadVehiclesAndShop();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to delete vehicle.');
    }
  };

  const handleLoadStatement = async () => {
    if (!activeAccountId) return;
    try {
      const data = await engine.fetchFleetStatement(activeAccountId);
      setStatement(data);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to load corporate statement.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Corporate Fleet Controls, Vehicle Registry & Statements */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              <Car className="w-5 h-5 text-slate-900" />
              Corporate Fleet Vehicles, Credit Hold &amp; Statements
            </h3>
            <p className="text-xs text-slate-500">
              Manage authorized vehicle plates, credit holds, and corporate statements.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setStatement(null);
              }}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium"
            >
              {fleetAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.companyName} ({a.status})
                </option>
              ))}
            </select>
            {canManage && activeAccountId && (
              <button
                type="button"
                onClick={() => setVehicleModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Register Fleet Vehicle
              </button>
            )}
            {activeAccount && canManage && (
              <button
                type="button"
                onClick={() => void handleToggleHold(activeAccount)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border bg-white ${
                  activeAccount.status === 'HOLD'
                    ? 'border-emerald-300 text-emerald-800 hover:bg-slate-50'
                    : 'border-red-300 text-red-800 hover:bg-slate-50'
                }`}
              >
                {activeAccount.status === 'HOLD' ? (
                  <>
                    <PlayCircle className="w-3.5 h-3.5" /> Release Credit Hold
                  </>
                ) : (
                  <>
                    <PauseCircle className="w-3.5 h-3.5" /> Place on Credit Hold
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              disabled={!activeAccountId}
              onClick={() => void handleLoadStatement()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> View Statement
            </button>
          </div>
        </div>

        {statement && (
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">
                Corporate Statement — {String(statement.companyName ?? '')} (NIU: {String(statement.taxId ?? '-')})
              </span>
              <button type="button" onClick={() => setStatement(null)} className="text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <div className="text-slate-500">Credit Limit</div>
                <div className="font-mono font-bold">{formatFcfa(Number(statement.creditLimitFcfa ?? 0))}</div>
              </div>
              <div>
                <div className="text-slate-500">Balance Owed</div>
                <div className="font-mono font-bold text-red-700">{formatFcfa(Number(statement.balanceOwedFcfa ?? 0))}</div>
              </div>
              <div>
                <div className="text-slate-500">Available Credit</div>
                <div className="font-mono font-bold text-emerald-700">{formatFcfa(Number(statement.availableCreditFcfa ?? 0))}</div>
              </div>
              <div>
                <div className="text-slate-500">Litres Consumed</div>
                <div className="font-mono font-bold">{formatLitres(Number(statement.totalLitresConsumed ?? 0))}</div>
              </div>
            </div>
          </div>
        )}

        <FormModal
          open={vehicleModalOpen}
          onClose={() => setVehicleModalOpen(false)}
          title="Register Authorized Fleet Vehicle"
          subtitle={activeAccount ? `Account: ${activeAccount.companyName}` : undefined}
        >
          <form onSubmit={(e) => void handleAddVehicle(e)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="opes-label">Vehicle Plate Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LT-445-AB"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="opes-input font-mono uppercase"
                />
              </div>
              <div>
                <label className="opes-label">Authorized Driver Name</label>
                <input
                  type="text"
                  required
                  placeholder="Driver full name"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="opes-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="opes-label">Allowed Fuel Grade</label>
                <select
                  value={allowedGrade}
                  onChange={(e) => setAllowedGrade(e.target.value as FuelGrade)}
                  className="opes-input"
                >
                  {ALL_FUEL_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {gradeLabel(g)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="opes-label">Monthly Fuel Cap (Litres)</label>
                <input
                  type="number"
                  min={100}
                  value={monthlyCap}
                  onChange={(e) => setMonthlyCap(e.target.value)}
                  className="opes-input font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setVehicleModalOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                Save Vehicle
              </button>
            </div>
          </form>
        </FormModal>

        <div className="divide-y divide-slate-100 text-xs">
          {vehicles.length === 0 ? (
            <div className="py-3 text-slate-500">No whitelisted vehicles registered for this corporate account yet.</div>
          ) : (
            vehicles.map((v) => (
              <div key={String(v.id)} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-slate-900">{String(v.plateNumber)}</span> ·{' '}
                  <span className="text-slate-700">{String(v.driverName)}</span> ·{' '}
                  <span className="font-mono text-amber-700">{String(v.allowedGrade ?? 'ANY')}</span> (Cap:{' '}
                  {formatLitres(Number(v.monthlyLitreCap ?? 0))})
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteVehicle(String(v.id))}
                    className="p-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50"
                    aria-label="Remove fleet vehicle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Shop & Lubricants Sales Receipt Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-600" />
            Shop &amp; Lubricants Sales Receipt Ledger
          </h3>
          <p className="text-xs text-slate-500">
            Authoritative non-fuel POS receipts with COGS from <span className="font-mono">GET /api/v1/shop/sales</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-semibold">SKU / Item</th>
                <th className="py-2 pr-3 font-semibold text-right">Qty</th>
                <th className="py-2 pr-3 font-semibold text-right">Revenue</th>
                <th className="py-2 pr-3 font-semibold text-right">COGS</th>
                <th className="py-2 pr-3 font-semibold">Tender</th>
                <th className="py-2 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shopSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500">
                    No shop POS receipts recorded yet. Record a sale above to inspect live receipts.
                  </td>
                </tr>
              ) : (
                shopSales.map((s) => (
                  <tr key={String(s.id)}>
                    <td className="py-2 pr-3 font-medium text-slate-900">
                      <span className="font-mono text-slate-500">{String(s.sku ?? '')}</span> {String(s.itemName ?? s.itemId ?? '')}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{String(s.quantity ?? 0)}</td>
                    <td className="py-2 pr-3 text-right font-mono font-semibold text-emerald-700">
                      {formatFcfa(Number(s.totalRevenueFcfa ?? 0))}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-600">
                      {formatFcfa(Number(s.totalCogsFcfa ?? 0))}
                    </td>
                    <td className="py-2 pr-3 font-mono">{String(s.paymentMethod ?? 'CASH')}</td>
                    <td className="py-2 text-slate-500">{s.soldAt ? formatShortDate(String(s.soldAt)) : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
