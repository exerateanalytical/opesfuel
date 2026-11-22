import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { gradeLabel } from '../domain/formatters';
import {
  DipstickReadingRecord,
  FinancialReportBundle,
  FuelTank,
  JournalEntry,
  PurchaseOrder,
  StationExpense,
  TankDeliveryRecord,
  TreasuryDeposit,
} from '../domain/types';

import { getCompanyBranding, hexToRgb } from './companyBranding';

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

// Use plain ASCII spaces instead of narrow non-breaking spaces so Helvetica PDF renders cleanly
function pdfFcfa(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${digits} FCFA`;
}

function pdfLitres(litres: number): string {
  const rounded = Number(litres.toFixed(1));
  const sign = rounded < 0 ? '-' : '';
  const parts = Math.abs(rounded).toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${parts.join('.')} L`;
}

function formatDateIsoShort(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
  } catch {
    return iso;
  }
}

function addPdfHeader(doc: jsPDF, title: string, subtitle: string, stationLabel: string): number {
  const b = getCompanyBranding();
  const [pr, pg, pb] = hexToRgb(b.primaryColorHex, [15, 23, 42]);
  const [ar, ag, ab] = hexToRgb(b.accentColorHex, [217, 119, 6]);
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setFillColor(ar, ag, ab);
  doc.rect(0, 35, pageWidth, 1.8, 'F');

  let leftX = 14;
  if (b.logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 5, 24, 24, 2, 2, 'F');
      doc.addImage(b.logoDataUrl, 'PNG', 13.5, 6.5, 21, 21);
      leftX = 41;
    } catch {
      leftX = 14;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text(b.legalName || 'OpesFuel', leftX, 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(253, 186, 116);
  doc.text(title, pageWidth - 14, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  const legal = [b.taxIdNiu ? `NIU: ${b.taxIdNiu}` : '', b.rccmNumber ? `RCCM: ${b.rccmNumber}` : '', b.city || '']
    .filter(Boolean)
    .join('  |  ');
  doc.text(legal || subtitle, leftX, 18.5);
  doc.text(subtitle, leftX, 24);
  doc.text(
    `Scope: ${stationLabel} | Currency: ${b.defaultCurrency || 'FCFA'} | Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    leftX,
    29.5
  );

  doc.setTextColor(15, 23, 42);
  return 44;
}

function nextSectionY(doc: JsPdfWithAutoTable, fallbackY: number): number {
  const lastY = doc.lastAutoTable?.finalY ?? fallbackY;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (lastY > pageHeight - 42) {
    doc.addPage();
    return 18;
  }
  return lastY + 10;
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, y);
  return y + 3;
}

export function exportAccountingPdf(
  report: FinancialReportBundle,
  journals: JournalEntry[],
  expenses: StationExpense[],
  deposits: TreasuryDeposit[],
  stationLabel: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable;
  let y = addPdfHeader(
    doc,
    'End-of-Month Financial Statements & Double-Entry Audit Trail',
    'SYSCOHADA / IFRS Compliant Station General Ledger Reconciliation',
    stationLabel
  );

  const totalAssets =
    report.cashOnHandFcfa +
    report.mobileMoneyClearingFcfa +
    report.bankBalanceFcfa +
    report.fleetReceivablesFcfa +
    report.inventoryAssetFcfa;
  const totalLiabilities = report.accountsPayableFcfa + report.vatPayableFcfa;

  // 1. Income Statement (P&L)
  y = addSectionTitle(doc, '1. Income Statement (Profit & Loss)', y);
  autoTable(doc, {
    startY: y,
    head: [['Line Item', 'Amount (FCFA)']],
    body: [
      ['Fuel & Non-Fuel Sales Revenue (Excl. VAT)', pdfFcfa(report.totalRevenueFcfa)],
      ['  - Lubricants & Shop Non-Fuel Revenue (4020)', pdfFcfa(report.nonFuelRevenueFcfa)],
      ['Cost of Goods Sold (COGS · 5010)', `-${pdfFcfa(report.cogsFcfa)}`],
      ['Gross Operating Margin', pdfFcfa(report.grossProfitFcfa)],
      ['Station Operating Expenses (6010)', `-${pdfFcfa(report.operatingExpensesFcfa)}`],
      ['Forecourt Cash Over / Short Variance (6100)', `-${pdfFcfa(report.cashVarianceFcfa)}`],
      ['Net Profit Before Income Tax', pdfFcfa(report.netIncomeFcfa)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  // 2. Balance Sheet Summary
  y = nextSectionY(doc, y);
  y = addSectionTitle(doc, '2. Balance Sheet Position', y);
  autoTable(doc, {
    startY: y,
    head: [['Assets / Liabilities & Equity', 'Account Code', 'Balance (FCFA)']],
    body: [
      ['Cash on Hand & Safe', '1010', pdfFcfa(report.cashOnHandFcfa)],
      ['Mobile Money Clearing (OM/MoMo)', '1020', pdfFcfa(report.mobileMoneyClearingFcfa)],
      ['Bank Operating Account', '1030', pdfFcfa(report.bankBalanceFcfa)],
      ['Fleet Accounts Receivable', '1100', pdfFcfa(report.fleetReceivablesFcfa)],
      ['Fuel & Lubricant Inventory', '1200', pdfFcfa(report.inventoryAssetFcfa)],
      ['TOTAL ASSETS', '1000-1999', pdfFcfa(totalAssets)],
      ['Supplier Accounts Payable', '2010', pdfFcfa(report.accountsPayableFcfa)],
      ['Fuel VAT & Excise Payable (19.25%)', '2200', pdfFcfa(report.vatPayableFcfa)],
      ['Total Liabilities', '2000-2999', pdfFcfa(totalLiabilities)],
      ['Retained Earnings & Net Income', '3010', pdfFcfa(report.netIncomeFcfa)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 2: { halign: 'right' } },
  });

  // 3. Trial Balance
  y = nextSectionY(doc, y);
  y = addSectionTitle(
    doc,
    `3. Trial Balance (${report.trialBalanceBalanced ? 'Balanced: Debit = Credit' : 'Imbalance Detected'})`,
    y
  );
  const totalDebit = report.trialBalance.reduce((s, r) => s + r.debitTotalFcfa, 0);
  const totalCredit = report.trialBalance.reduce((s, r) => s + r.creditTotalFcfa, 0);
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Account Title', 'Type', 'Debit (FCFA)', 'Credit (FCFA)', 'Net Balance']],
    body: [
      ...report.trialBalance.map((r) => [
        r.accountCode,
        r.accountName,
        r.accountType,
        pdfFcfa(r.debitTotalFcfa),
        pdfFcfa(r.creditTotalFcfa),
        pdfFcfa(r.netBalanceFcfa),
      ]),
      ['TOTAL', 'Trial Balance Verification', '-', pdfFcfa(totalDebit), pdfFcfa(totalCredit), '0 FCFA'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
  });

  // 4. Double-Entry Journal Audit Trail
  y = nextSectionY(doc, y);
  y = addSectionTitle(doc, `4. Double-Entry Journal Audit Trail (${journals.length} Vouchers)`, y);
  const journalRows: string[][] = [];
  for (const je of journals) {
    for (const line of je.lines) {
      journalRows.push([
        je.reference,
        formatDateIsoShort(je.postedAt),
        je.sourceEvent,
        `${line.accountCode} ${line.accountName}`,
        line.debitFcfa > 0 ? pdfFcfa(line.debitFcfa) : '-',
        line.creditFcfa > 0 ? pdfFcfa(line.creditFcfa) : '-',
      ]);
    }
  }
  autoTable(doc, {
    startY: y,
    head: [['Voucher', 'Posted At', 'Source Event', 'Account Line', 'Debit', 'Credit']],
    body: journalRows.length > 0 ? journalRows : [['-', '-', '-', 'No journal entries recorded.', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
    bodyStyles: { fontSize: 7 },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
  });

  // 5. Operating Expenses & Treasury Deposits Reconciliation
  if (expenses.length > 0 || deposits.length > 0) {
    y = nextSectionY(doc, y);
    y = addSectionTitle(doc, '5. Operating Expenses & Bank Treasury Deposits', y);
    const cashMovements: string[][] = [
      ...expenses.map((ex) => [
        'EXPENSE',
        ex.category,
        `${ex.description} (${ex.paymentSource})`,
        formatDateIsoShort(ex.createdAt),
        `-${pdfFcfa(ex.amountFcfa)}`,
      ]),
      ...deposits.map((dep) => [
        'DEPOSIT',
        dep.sourceAccount,
        `${dep.bankName} (Slip ${dep.slipReference})`,
        formatDateIsoShort(dep.depositedAt),
        pdfFcfa(dep.amountFcfa),
      ]),
    ];
    autoTable(doc, {
      startY: y,
      head: [['Type', 'Category / Source', 'Description / Reference', 'Timestamp', 'Amount (FCFA)']],
      body: cashMovements,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
    });
  }

  const slug = stationLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`opesfuel-accounting-reconciliation-${slug}.pdf`);
}

export function exportAccountingExcel(
  report: FinancialReportBundle,
  journals: JournalEntry[],
  expenses: StationExpense[],
  deposits: TreasuryDeposit[],
  stationLabel: string
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: P&L Summary
  const pnlSheet = XLSX.utils.json_to_sheet([
    { 'Statement Line': 'Fuel & Non-Fuel Revenue (Excl. VAT)', 'Amount (FCFA)': report.totalRevenueFcfa },
    { 'Statement Line': 'Non-Fuel & Lubricants Revenue (4020)', 'Amount (FCFA)': report.nonFuelRevenueFcfa },
    { 'Statement Line': 'Cost of Goods Sold (5010)', 'Amount (FCFA)': -report.cogsFcfa },
    { 'Statement Line': 'Gross Operating Margin', 'Amount (FCFA)': report.grossProfitFcfa },
    { 'Statement Line': 'Station Operating Expenses (6010)', 'Amount (FCFA)': -report.operatingExpensesFcfa },
    { 'Statement Line': 'Cash Over / Short Variance (6100)', 'Amount (FCFA)': -report.cashVarianceFcfa },
    { 'Statement Line': 'Net Profit Before Tax', 'Amount (FCFA)': report.netIncomeFcfa },
    { 'Statement Line': 'VAT Payable (2200)', 'Amount (FCFA)': report.vatPayableFcfa },
  ]);
  XLSX.utils.book_append_sheet(wb, pnlSheet, 'PnL Summary');

  // Sheet 2: Balance Sheet
  const bsSheet = XLSX.utils.json_to_sheet([
    { Section: 'Asset', Code: '1010', Account: 'Cash on Hand & Safe', 'Balance (FCFA)': report.cashOnHandFcfa },
    { Section: 'Asset', Code: '1020', Account: 'Mobile Money Clearing', 'Balance (FCFA)': report.mobileMoneyClearingFcfa },
    { Section: 'Asset', Code: '1030', Account: 'Bank Operating Account', 'Balance (FCFA)': report.bankBalanceFcfa },
    { Section: 'Asset', Code: '1100', Account: 'Fleet Accounts Receivable', 'Balance (FCFA)': report.fleetReceivablesFcfa },
    { Section: 'Asset', Code: '1200', Account: 'Fuel & Lubricant Inventory', 'Balance (FCFA)': report.inventoryAssetFcfa },
    { Section: 'Liability', Code: '2010', Account: 'Supplier Accounts Payable', 'Balance (FCFA)': report.accountsPayableFcfa },
    { Section: 'Liability', Code: '2200', Account: 'Fuel VAT & Excise Payable', 'Balance (FCFA)': report.vatPayableFcfa },
    { Section: 'Equity', Code: '3010', Account: 'Current Period Net Income', 'Balance (FCFA)': report.netIncomeFcfa },
  ]);
  XLSX.utils.book_append_sheet(wb, bsSheet, 'Balance Sheet');

  // Sheet 3: Trial Balance
  const tbSheet = XLSX.utils.json_to_sheet(
    report.trialBalance.map((row) => ({
      'Account Code': row.accountCode,
      'Account Title': row.accountName,
      Classification: row.accountType,
      'Debit (FCFA)': row.debitTotalFcfa,
      'Credit (FCFA)': row.creditTotalFcfa,
      'Net Balance (FCFA)': row.netBalanceFcfa,
    }))
  );
  XLSX.utils.book_append_sheet(wb, tbSheet, 'Trial Balance');

  // Sheet 4: Journal Audit Trail
  const jeRows = journals.flatMap((je) =>
    je.lines.map((line) => ({
      'Journal ID': je.id,
      Reference: je.reference,
      'Station ID': je.stationId,
      'Source Event': je.sourceEvent,
      Description: je.description,
      'Posted At': formatDateIsoShort(je.postedAt),
      'Account Code': line.accountCode,
      'Account Name': line.accountName,
      'Debit (FCFA)': line.debitFcfa,
      'Credit (FCFA)': line.creditFcfa,
    }))
  );
  const jeSheet = XLSX.utils.json_to_sheet(
    jeRows.length > 0 ? jeRows : [{ Reference: 'NONE', Description: 'No journal entries posted yet.' }]
  );
  XLSX.utils.book_append_sheet(wb, jeSheet, 'Journal Audit Trail');

  // Sheet 5: Expenses & Deposits
  const cashRows = [
    ...expenses.map((ex) => ({
      Type: 'OPERATING_EXPENSE',
      ID: ex.id,
      'Category / Source': ex.category,
      Reference: ex.paymentSource,
      Details: ex.description,
      'Amount (FCFA)': ex.amountFcfa,
      Timestamp: formatDateIsoShort(ex.createdAt),
    })),
    ...deposits.map((dep) => ({
      Type: 'TREASURY_DEPOSIT',
      ID: dep.id,
      'Category / Source': dep.sourceAccount,
      Reference: dep.slipReference,
      Details: dep.bankName,
      'Amount (FCFA)': dep.amountFcfa,
      Timestamp: formatDateIsoShort(dep.depositedAt),
    })),
  ];
  const cashSheet = XLSX.utils.json_to_sheet(
    cashRows.length > 0 ? cashRows : [{ Type: 'NONE', Details: 'No expenses or deposits recorded.' }]
  );
  XLSX.utils.book_append_sheet(wb, cashSheet, 'Expenses & Deposits');

  const slug = stationLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  XLSX.writeFile(wb, `opesfuel-accounting-reconciliation-${slug}.xlsx`);
}

export function exportInventoryPdf(
  tanks: FuelTank[],
  deliveries: TankDeliveryRecord[],
  dipsticks: DipstickReadingRecord[],
  purchaseOrders: PurchaseOrder[],
  stationLabel: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable;
  let y = addPdfHeader(
    doc,
    'End-of-Month Fuel Inventory Reconciliation & Audit Trail',
    'Underground Tank Stock Valuation (WAC), Tanker BoL Receipts & Dipstick Calibration Log',
    stationLabel
  );

  // 1. Tank Stock & WAC Valuation
  y = addSectionTitle(doc, `1. Underground Fuel Tanks & WAC Valuation (${tanks.length} Tanks)`, y);
  const totalBook = tanks.reduce((s, t) => s + t.bookVolumeLitres, 0);
  const totalCapacity = tanks.reduce((s, t) => s + t.capacityLitres, 0);
  const totalWacValue = tanks.reduce((s, t) => s + Math.round(t.bookVolumeLitres * t.unitCostFcfa), 0);

  autoTable(doc, {
    startY: y,
    head: [['Tank', 'Grade', 'Capacity', 'Book Stock', 'Last Dip', 'Variance', 'WAC / L', 'Valuation (FCFA)', 'Health']],
    body: [
      ...tanks.map((t) => [
        t.name,
        gradeLabel(t.grade),
        pdfLitres(t.capacityLitres),
        pdfLitres(t.bookVolumeLitres),
        pdfLitres(t.lastDipLitres),
        `${t.varianceLitres > 0 ? '+' : ''}${t.varianceLitres} L`,
        pdfFcfa(t.unitCostFcfa),
        pdfFcfa(Math.round(t.bookVolumeLitres * t.unitCostFcfa)),
        t.status,
      ]),
      [
        'TOTAL NETWORK',
        '-',
        pdfLitres(totalCapacity),
        pdfLitres(totalBook),
        '-',
        '-',
        '-',
        pdfFcfa(totalWacValue),
        '-',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
    },
  });

  // 2. Tanker Deliveries
  y = nextSectionY(doc, y);
  y = addSectionTitle(doc, `2. Tanker Delivery Audit (${deliveries.length} Receipts)`, y);
  autoTable(doc, {
    startY: y,
    head: [['Tank', 'Supplier', 'BoL (L)', 'Actual (L)', 'Transit Delta', 'Invoice (FCFA)', 'Received']],
    body:
      deliveries.length > 0
        ? deliveries.map((d) => {
            const delta = d.actualReceivedLitres - d.bolLitres;
            return [
              d.tankName,
              d.supplierName,
              pdfLitres(d.bolLitres),
              pdfLitres(d.actualReceivedLitres),
              `${delta > 0 ? '+' : ''}${delta} L`,
              pdfFcfa(d.totalInvoiceFcfa),
              formatDateIsoShort(d.receivedAt),
            ];
          })
        : [['No tanker deliveries recorded.', '-', '-', '-', '-', '-', '-']],
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
  });

  // 3. Dipstick Calibration Log
  y = nextSectionY(doc, y);
  y = addSectionTitle(doc, `3. Physical Dipstick Calibration Audit Log (${dipsticks.length} Checks)`, y);
  autoTable(doc, {
    startY: y,
    head: [['Tank', 'Book Volume (L)', 'Measured Dip (L)', 'Variance (L)', 'Flag (>100L)', 'Recorded At']],
    body:
      dipsticks.length > 0
        ? dipsticks.map((dip) => [
            dip.tankName,
            pdfLitres(dip.bookLitres),
            pdfLitres(dip.measuredLitres),
            `${dip.varianceLitres > 0 ? '+' : ''}${dip.varianceLitres} L`,
            Math.abs(dip.varianceLitres) > 100 ? 'VARIANCE ALERT' : 'NOMINAL',
            formatDateIsoShort(dip.recordedAt),
          ])
        : [['No dipstick calibrations recorded.', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
  });

  // 4. Purchase Orders
  if (purchaseOrders.length > 0) {
    y = nextSectionY(doc, y);
    y = addSectionTitle(doc, `4. Supplier Purchase Orders (${purchaseOrders.length})`, y);
    autoTable(doc, {
      startY: y,
      head: [['PO ID', 'Supplier', 'Grade', 'Ordered (L)', 'Cost/L (FCFA)', 'Status', 'Created']],
      body: purchaseOrders.map((po) => [
        po.id,
        po.supplierName,
        gradeLabel(po.grade),
        pdfLitres(po.orderedLitres),
        pdfFcfa(po.unitCostFcfa),
        po.status,
        formatDateIsoShort(po.createdAt),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
  }

  const slug = stationLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`opesfuel-inventory-audit-${slug}.pdf`);
}

export function exportInventoryExcel(
  tanks: FuelTank[],
  deliveries: TankDeliveryRecord[],
  dipsticks: DipstickReadingRecord[],
  purchaseOrders: PurchaseOrder[],
  stationLabel: string
): void {
  const wb = XLSX.utils.book_new();

  const tankSheet = XLSX.utils.json_to_sheet(
    tanks.length > 0
      ? tanks.map((t) => ({
          'Tank ID': t.id,
          'Tank Name': t.name,
          Grade: gradeLabel(t.grade),
          'Capacity (L)': t.capacityLitres,
          'Book Stock (L)': t.bookVolumeLitres,
          'Fill %': Math.round((t.bookVolumeLitres / Math.max(1, t.capacityLitres)) * 100),
          'Last Dipstick (L)': t.lastDipLitres,
          'Variance (L)': t.varianceLitres,
          'WAC Unit Cost (FCFA/L)': t.unitCostFcfa,
          'Stock Valuation (FCFA)': Math.round(t.bookVolumeLitres * t.unitCostFcfa),
          Health: t.status,
        }))
      : [{ 'Tank Name': 'No underground fuel tanks provisioned.' }]
  );
  XLSX.utils.book_append_sheet(wb, tankSheet, 'Tank Stock & WAC');

  const delSheet = XLSX.utils.json_to_sheet(
    deliveries.length > 0
      ? deliveries.map((d) => ({
          'Delivery ID': d.id,
          Tank: d.tankName,
          Supplier: d.supplierName,
          'BoL Litres': d.bolLitres,
          'Actual Received (L)': d.actualReceivedLitres,
          'Transit Delta (L)': d.actualReceivedLitres - d.bolLitres,
          'Unit Cost (FCFA/L)': d.unitCostFcfa,
          'Total Invoice (FCFA)': d.totalInvoiceFcfa,
          'Received At': formatDateIsoShort(d.receivedAt),
        }))
      : [{ Tank: 'No tanker deliveries recorded.' }]
  );
  XLSX.utils.book_append_sheet(wb, delSheet, 'Tanker Deliveries');

  const dipSheet = XLSX.utils.json_to_sheet(
    dipsticks.length > 0
      ? dipsticks.map((dip) => ({
          'Dipstick ID': dip.id,
          Tank: dip.tankName,
          'Book Volume (L)': dip.bookLitres,
          'Measured Volume (L)': dip.measuredLitres,
          'Variance (L)': dip.varianceLitres,
          Status: Math.abs(dip.varianceLitres) > 100 ? 'VARIANCE_ALERT' : 'NOMINAL',
          'Recorded At': formatDateIsoShort(dip.recordedAt),
        }))
      : [{ Tank: 'No dipstick calibrations recorded.' }]
  );
  XLSX.utils.book_append_sheet(wb, dipSheet, 'Dipstick Audit Trail');

  const poSheet = XLSX.utils.json_to_sheet(
    purchaseOrders.length > 0
      ? purchaseOrders.map((po) => ({
          'PO ID': po.id,
          Supplier: po.supplierName,
          Grade: gradeLabel(po.grade),
          'Ordered (L)': po.orderedLitres,
          'Unit Cost (FCFA/L)': po.unitCostFcfa,
          'Total Est. (FCFA)': Math.round(po.orderedLitres * po.unitCostFcfa),
          Status: po.status,
          'Created At': formatDateIsoShort(po.createdAt),
        }))
      : [{ 'PO ID': 'NONE', Supplier: 'No purchase orders recorded.' }]
  );
  XLSX.utils.book_append_sheet(wb, poSheet, 'Purchase Orders');

  const slug = stationLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  XLSX.writeFile(wb, `opesfuel-inventory-audit-${slug}.xlsx`);
}
