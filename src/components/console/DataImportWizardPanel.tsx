import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { FuelGrade, ShopItem, UserRole } from '../../domain/types';

type ImportEntity = 'tanks' | 'employees' | 'fleet' | 'shop';

interface DataImportWizardPanelProps {
  stationId: string;
  onImportTank: (input: {
    stationId: string;
    name: string;
    grade: FuelGrade;
    capacityLitres: number;
    bookVolumeLitres: number;
    unitCostFcfa: number;
  }) => void;
  onImportEmployee: (input: {
    stationId: string;
    fullName: string;
    role: UserRole;
    phone: string;
    shiftWindow: string;
    baseSalaryFcfa: number;
  }) => void;
  onImportFleet: (input: { companyName: string; taxId: string; creditLimitFcfa: number }) => void;
  onImportShop: (input: {
    stationId: string;
    sku: string;
    name: string;
    category: ShopItem['category'];
    stockQty: number;
    reorderLevel: number;
    unitPriceFcfa: number;
    unitCostFcfa: number;
  }) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const TEMPLATES: Record<ImportEntity, { label: string; headers: string; sample: string }> = {
  tanks: {
    label: 'Underground Tanks & Opening Stock',
    headers: 'name,grade,capacityLitres,bookVolumeLitres,unitCostFcfa',
    sample:
      'name,grade,capacityLitres,bookVolumeLitres,unitCostFcfa\nTank T-05 Super,SUPER,40000,18500,745\nTank T-06 Gasoil,GASOIL,50000,29000,715',
  },
  employees: {
    label: 'Employees & Payroll Master',
    headers: 'fullName,role,phone,shiftWindow,baseSalaryFcfa',
    sample:
      'fullName,role,phone,shiftWindow,baseSalaryFcfa\nClarisse Mvogo,ATTENDANT,+237 677 412 890,06:00 - 14:00,145000\nPatrick Onana,ATTENDANT,+237 699 310 224,14:00 - 22:00,145000',
  },
  fleet: {
    label: 'Corporate Fleet Credit Clients',
    headers: 'companyName,taxId,creditLimitFcfa',
    sample:
      'companyName,taxId,creditLimitFcfa\nBollore Transport Cameroun,M09184420193,12000000\nCimencam Distribution SA,M08219930411,8500000',
  },
  shop: {
    label: 'Lubricants, LPG & Shop SKUs',
    headers: 'sku,name,category,stockQty,unitPriceFcfa,unitCostFcfa',
    sample:
      'sku,name,category,stockQty,unitPriceFcfa,unitCostFcfa\nLUB-15W40-5L,Total Rubia 15W-40 (5L),LUBRICANT,30,19500,14200\nLPG-12KG,Cooking Gas Cylinder 12.5kg,LPG,45,6500,5600',
  },
};

export const DataImportWizardPanel: React.FC<DataImportWizardPanelProps> = ({
  stationId,
  onImportTank,
  onImportEmployee,
  onImportFleet,
  onImportShop,
  onNotify,
}) => {
  const [entity, setEntity] = useState<ImportEntity>('tanks');
  const [rawCsv, setRawCsv] = useState(TEMPLATES.tanks.sample);
  const [committedCount, setCommittedCount] = useState<number | null>(null);

  const lines = rawCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const headers = lines[0]?.split(',').map((h) => h.trim()) ?? [];
  const parsedRows = lines.slice(1).map((line, idx) => {
    const cols = line.split(',').map((c) => c.trim());
    const errors: string[] = [];
    if (cols.length < headers.length) {
      errors.push(`Expected ${headers.length} columns, found ${cols.length}`);
    }
    if (!cols[0]) errors.push('Primary name/code is required');
    return { rowNum: idx + 2, cols, errors };
  });

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const invalidRows = parsedRows.filter((r) => r.errors.length > 0);

  const downloadTemplate = () => {
    const tpl = TEMPLATES[entity];
    const blob = new Blob([tpl.sample + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opesfuel-import-template-${entity}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawCsv(reader.result);
        setCommittedCount(null);
      }
    };
    reader.readAsText(file);
  };

  const commitBatch = () => {
    if (validRows.length === 0) {
      onNotify('error', 'No valid rows available to import.');
      return;
    }
    let count = 0;
    for (const row of validRows) {
      const c = row.cols;
      if (entity === 'tanks') {
        onImportTank({
          stationId,
          name: c[0],
          grade: (c[1]?.toUpperCase() as FuelGrade) || 'SUPER',
          capacityLitres: Number(c[2]) || 35000,
          bookVolumeLitres: Number(c[3]) || 10000,
          unitCostFcfa: Number(c[4]) || 745,
        });
        count += 1;
      } else if (entity === 'employees') {
        onImportEmployee({
          stationId,
          fullName: c[0],
          role: (c[1]?.toUpperCase() as UserRole) || 'ATTENDANT',
          phone: c[2] || '+237 600 000 000',
          shiftWindow: c[3] || '06:00 - 14:00',
          baseSalaryFcfa: Number(c[4]) || 140000,
        });
        count += 1;
      } else if (entity === 'fleet') {
        onImportFleet({
          companyName: c[0],
          taxId: c[1] || `NIU-${Date.now().toString().slice(-6)}`,
          creditLimitFcfa: Number(c[2]) || 3000000,
        });
        count += 1;
      } else if (entity === 'shop') {
        onImportShop({
          stationId,
          sku: c[0],
          name: c[1] || c[0],
          category: (c[2]?.toUpperCase() as ShopItem['category']) || 'LUBRICANT',
          stockQty: Number(c[3]) || 10,
          reorderLevel: 5,
          unitPriceFcfa: Number(c[4]) || 5000,
          unitCostFcfa: Number(c[5]) || 3500,
        });
        count += 1;
      }
    }
    setCommittedCount(count);
    onNotify('success', `Committed ${count} validated ${entity} record(s) into live station workspace.`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-slate-900" />
            Bulk CSV / Excel Data Migration &amp; Import Wizard (M47)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Download standardized templates, dry-run validate rows before commit, and migrate existing station inventory, staff, fleet clients, and shop SKUs safely.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" /> Download CSV Template
          </button>
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Upload CSV File
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Dataset Selector */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TEMPLATES) as ImportEntity[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setEntity(key);
              setRawCsv(TEMPLATES[key].sample);
              setCommittedCount(null);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              entity === key ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {TEMPLATES[key].label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="opes-label">CSV Data Input (Paste or Upload)</label>
          <textarea
            rows={7}
            value={rawCsv}
            onChange={(e) => {
              setRawCsv(e.target.value);
              setCommittedCount(null);
            }}
            className="opes-input font-mono text-xs"
          />
          <div className="text-[11px] font-mono text-slate-500">Expected columns: {TEMPLATES[entity].headers}</div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">Dry-Run Validation Preview</span>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {validRows.length} Valid
              </span>
              {invalidRows.length > 0 && (
                <span className="text-red-600 font-semibold inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {invalidRows.length} Error(s)
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-48">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-2">Row</th>
                  {headers.slice(0, 4).map((h) => (
                    <th key={h} className="px-3 py-2">{h}</th>
                  ))}
                  <th className="px-3 py-2">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {parsedRows.map((r) => (
                  <tr key={r.rowNum}>
                    <td className="px-3 py-2 font-mono text-slate-500">#{r.rowNum}</td>
                    {headers.slice(0, 4).map((_, idx) => (
                      <td key={idx} className="px-3 py-2 font-mono text-slate-800">{r.cols[idx] ?? '—'}</td>
                    ))}
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {r.errors.length === 0 ? (
                        <span className="text-emerald-700 font-semibold">READY</span>
                      ) : (
                        <span className="text-red-600">{r.errors[0]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-1">
            {committedCount !== null ? (
              <span className="text-xs font-semibold text-emerald-700">
                Imported {committedCount} record(s) cleanly.
              </span>
            ) : (
              <span className="text-xs text-slate-500">Safe dry-run verified before commit.</span>
            )}
            <button
              type="button"
              disabled={validRows.length === 0}
              onClick={commitBatch}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold"
            >
              Commit {validRows.length} Valid Row(s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
