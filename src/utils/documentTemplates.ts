/**
 * Complete Printable Document & Report Templates Engine for OpesFuel
 * Follows DESIGN_SPEC.md: Obsidian Navy (#0F172A) headers, Brand Amber (#D97706) accent bar,
 * pure crisp white layout, official signature blocks, and tabular numerals.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  CashVaultEntryItem,
  HrContractItem,
  PumpCalibrationItem,
} from '../api/demoDataset1000';
import {
  Employee,
  FinancialReportBundle,
  FleetAccount,
  FleetTransaction,
  PurchaseOrder,
  ShiftRecord,
  TankDeliveryRecord,
} from '../domain/types';

import { getCompanyBranding, hexToRgb } from './companyBranding';
import { printSecurityLicenseCertificatePdf } from './securityGuilloche';

type JsPdfAuto = jsPDF & { lastAutoTable?: { finalY: number } };

function pdfMoney(amount: number, currency = 'FCFA'): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${digits} ${currency}`;
}

function pdfLitres(litres: number): string {
  const rounded = Number(litres.toFixed(1));
  const sign = rounded < 0 ? '-' : '';
  const parts = Math.abs(rounded).toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${parts.join('.')} L`;
}

function drawDocumentHeader(
  doc: jsPDF,
  docType: string,
  subtitle: string,
  metaLine: string
): number {
  const b = getCompanyBranding();
  const [pr, pg, pb] = hexToRgb(b.primaryColorHex, [15, 23, 42]);
  const [ar, ag, ab] = hexToRgb(b.accentColorHex, [217, 119, 6]);
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, w, 36, 'F');
  doc.setFillColor(ar, ag, ab);
  doc.rect(0, 36, w, 1.8, 'F');

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
  doc.text(docType, w - 14, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(226, 232, 240);
  const legalLine = [
    b.taxIdNiu ? `NIU: ${b.taxIdNiu}` : '',
    b.rccmNumber ? `RCCM: ${b.rccmNumber}` : '',
    b.phone || '',
    b.email || '',
  ]
    .filter(Boolean)
    .join('  |  ');
  doc.text(legalLine || b.tagline || subtitle, leftX, 18);

  const addrLine = [b.address, b.city, b.website].filter(Boolean).join(' · ');
  if (addrLine) {
    doc.text(addrLine, leftX, 23.5);
  }
  doc.text(`${subtitle}  —  ${metaLine}`, leftX, 30.5);

  doc.setTextColor(15, 23, 42);
  return 45;
}

function drawSignatureFooter(doc: JsPdfAuto, leftLabel: string, rightLabel: string): void {
  const b = getCompanyBranding();
  const pageH = doc.internal.pageSize.getHeight();
  const w = doc.internal.pageSize.getWidth();
  const y = Math.min(pageH - 34, (doc.lastAutoTable?.finalY ?? 180) + 18);

  if (b.stampDataUrl) {
    try {
      doc.addImage(b.stampDataUrl, 'PNG', w - 62, y - 16, 26, 15);
    } catch {
      // ignore invalid stamp
    }
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(14, y, 86, y);
  doc.line(w - 86, y, w - 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(leftLabel, 14, y + 5);
  doc.text(b.signatoryName ? `${b.signatoryName} — ${b.signatoryTitle || rightLabel}` : rightLabel, w - 86, y + 5);

  const bankLine = [b.bankName, b.bankAccountIban ? `IBAN/RIB: ${b.bankAccountIban}` : '', b.mobileMoneyMerchant]
    .filter(Boolean)
    .join('  |  ');
  doc.setFontSize(7);
  if (bankLine) {
    doc.text(bankLine, 14, y + 11.5);
  }
  doc.text(
    `${b.letterheadFooter || 'Official company document.'}  ·  Issued ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    14,
    y + 16.5
  );
}

/** Branded Official Company Letterhead & Invoice Sample PDF */
export function printBrandedLetterheadSamplePdf(): void {
  const b = getCompanyBranding();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    `${b.invoicePrefix || 'INV-'}OFFICIAL LETTERHEAD`,
    b.tradingName || b.legalName,
    `Country: ${b.countryCode} | Currency: ${b.defaultCurrency} | VAT: ${b.vatRatePct}%`
  );

  autoTable(doc, {
    startY: y,
    head: [['Company Letterhead Profile Field', 'Configured Official Value']],
    body: [
      ['Legal Entity Name', b.legalName],
      ['Trading / Brand Name', b.tradingName],
      ['Tax ID / NIU', b.taxIdNiu || '—'],
      ['Commercial Register / RCCM', b.rccmNumber || '—'],
      ['CNPS / Social Security Employer ID', b.cnpsEmployerId || '—'],
      ['Head Office Address', [b.address, b.city].filter(Boolean).join(', ') || '—'],
      ['Contact & Website', [b.phone, b.email, b.website].filter(Boolean).join(' · ') || '—'],
      ['Bank Settlement Account', [b.bankName, b.bankAccountIban].filter(Boolean).join(' — ') || '—'],
      ['Mobile Money Merchant', b.mobileMoneyMerchant || '—'],
      ['Default Payment Terms', b.paymentTerms || '—'],
      ['Document Numbering Prefixes', `Invoice: ${b.invoicePrefix} | PO: ${b.poPrefix} | Receipt: ${b.receiptPrefix}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: hexToRgb(b.primaryColorHex, [15, 23, 42]), textColor: 255, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 3 },
  });

  drawSignatureFooter(doc, 'Prepared & Verified By', b.signatoryTitle || 'Authorized Signatory');
  doc.save(`${(b.tradingName || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-official-letterhead.pdf`);
}

/** 1. Official Daily Station Z-Report PDF */
export function printDailyZReportPdf(params: {
  stationName: string;
  dateLabel: string;
  shifts: ShiftRecord[];
  report: FinancialReportBundle;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  let y = drawDocumentHeader(
    doc,
    'OFFICIAL DAILY Z-REPORT',
    `${params.stationName} · End-of-Day Meter, Tender & Tax Reconciliation`,
    `Date: ${params.dateLabel} | Closed Shifts: ${params.shifts.filter((s) => s.status === 'CLOSED').length} | Currency: FCFA`
  );

  const closed = params.shifts.filter((s) => s.status === 'CLOSED');
  const totalLitres = closed.reduce((a, s) => a + s.litresSold, 0);
  const totalCash = closed.reduce((a, s) => a + s.cashFcfa, 0);
  const totalMoMo = closed.reduce((a, s) => a + s.mobileMoneyFcfa, 0);
  const totalCard = closed.reduce((a, s) => a + s.cardFcfa, 0);
  const totalFleet = closed.reduce((a, s) => a + s.fleetCreditFcfa, 0);
  const totalExpected = closed.reduce((a, s) => a + s.expectedRevenueFcfa, 0);
  const totalVariance = closed.reduce((a, s) => a + s.varianceFcfa, 0);

  autoTable(doc, {
    startY: y,
    head: [['Z-Report Metric', 'Verified Total']],
    body: [
      ['Total Fuel Metered & Dispensed', pdfLitres(totalLitres)],
      ['Expected Gross Fuel Revenue', pdfMoney(totalExpected)],
      ['Cash Collected at Forecourt', pdfMoney(totalCash)],
      ['Mobile Money (Orange Money / MTN MoMo)', pdfMoney(totalMoMo)],
      ['Bank Card / TPE Settlements', pdfMoney(totalCard)],
      ['Corporate Fleet Credit Vouchers', pdfMoney(totalFleet)],
      ['Net Cash Over / Short Variance', pdfMoney(totalVariance)],
      ['Estimated VAT Collected (19.25%)', pdfMoney(params.report.vatPayableFcfa)],
      ['Trial Balance Status', params.report.trialBalanceBalanced ? 'BALANCED (DEBIT = CREDIT)' : 'REVIEW REQUIRED'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 8;
  autoTable(doc, {
    startY: y,
    head: [['Pump', 'Grade', 'Attendant', 'Opening (L)', 'Closing (L)', 'Sold (L)', 'Variance']],
    body:
      closed.length > 0
        ? closed.slice(0, 20).map((s) => [
            s.pumpCode,
            s.grade,
            s.attendantName,
            pdfLitres(s.openingMeterLitres),
            pdfLitres(s.closingMeterLitres ?? s.openingMeterLitres),
            pdfLitres(s.litresSold),
            pdfMoney(s.varianceFcfa),
          ])
        : [['-', '-', 'No closed shifts in selected period', '-', '-', '-', '-']],
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
  });

  drawSignatureFooter(doc, 'Station Manager Signature & Stamp', 'Owner / Chief Accountant Sign-Off');
  doc.save(`opesfuel-z-report-${params.dateLabel}.pdf`);
}

/** 2. Printable Employee Monthly Payslip PDF */
export function printEmployeePayslipPdf(params: {
  stationName: string;
  periodLabel: string;
  employee: Employee;
  contract?: HrContractItem;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'OFFICIAL EMPLOYEE PAYSLIP',
    `${params.stationName} · Payroll Statement (${params.periodLabel})`,
    `Employee: ${params.employee.fullName} | Role: ${params.employee.role} | CNPS: ${params.contract?.cnpsNumber ?? 'CNPS-PENDING'}`
  );

  const base = params.contract?.baseSalaryFcfa ?? params.employee.baseSalaryFcfa;
  const transport = params.contract?.transportAllowanceFcfa ?? 25000;
  const housing = params.contract?.housingAllowanceFcfa ?? 0;
  const gross = base + transport + housing;
  const cnpsEmployee = Math.round(base * 0.042);
  const shortageDeduction = Math.max(0, params.employee.cumulativeVarianceFcfa);
  const netPay = Math.max(0, gross - cnpsEmployee - shortageDeduction);

  autoTable(doc, {
    startY: y,
    head: [['Earnings & Deductions Line Item', 'Category', 'Amount (FCFA)']],
    body: [
      ['Monthly Base Salary', 'Earning', pdfMoney(base)],
      ['Transport Allowance', 'Earning', pdfMoney(transport)],
      ['Housing Allowance', 'Earning', pdfMoney(housing)],
      ['GROSS PAY', 'Subtotal', pdfMoney(gross)],
      ['CNPS Social Security Contribution (4.2%)', 'Statutory Deduction', `-${pdfMoney(cnpsEmployee)}`],
      ['Verified Forecourt Shift Shortage Deduction', 'Shortage-Only Rule', `-${pdfMoney(shortageDeduction)}`],
      ['NET SALARY PAYABLE', 'Net Disbursement', pdfMoney(netPay)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
  });

  drawSignatureFooter(doc, `Employee Signature (${params.employee.fullName})`, 'Employer / HR Manager Stamp');
  doc.save(`opesfuel-payslip-${params.employee.fullName.toLowerCase().replace(/\s+/g, '-')}-${params.periodLabel}.pdf`);
}

/** 3. Printable Full Station Payroll Register PDF */
export function printPayrollRegisterPdf(params: {
  stationName: string;
  periodLabel: string;
  employees: Employee[];
}): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'MONTHLY PAYROLL REGISTER',
    `${params.stationName} · Complete Workforce Disbursement Schedule`,
    `Period: ${params.periodLabel} | Headcount: ${params.employees.length} Staff | Currency: FCFA`
  );

  const rows = params.employees.map((e) => {
    const cnps = Math.round(e.baseSalaryFcfa * 0.042);
    const shortDed = Math.max(0, e.cumulativeVarianceFcfa);
    const net = Math.max(0, e.baseSalaryFcfa - cnps - shortDed);
    return [
      e.fullName,
      e.role,
      e.phone,
      pdfMoney(e.baseSalaryFcfa),
      pdfMoney(cnps),
      pdfMoney(shortDed),
      pdfMoney(net),
    ];
  });
  const totalNet = params.employees.reduce(
    (s, e) => s + Math.max(0, e.baseSalaryFcfa - Math.round(e.baseSalaryFcfa * 0.042) - Math.max(0, e.cumulativeVarianceFcfa)),
    0
  );

  autoTable(doc, {
    startY: y,
    head: [['Full Name', 'Role', 'Phone', 'Base Salary', 'CNPS (4.2%)', 'Shortage Ded.', 'Net Payable']],
    body: [...rows, ['TOTAL', `${params.employees.length} Staff`, '-', '-', '-', '-', pdfMoney(totalNet)]],
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
  });

  drawSignatureFooter(doc, 'Prepared By (HR / Accountant)', 'Approved For Disbursement (Owner)');
  doc.save(`opesfuel-payroll-register-${params.periodLabel}.pdf`);
}

/** 4. Printable HR Employment Contract Summary PDF */
export function printHrContractPdf(stationName: string, contract: HrContractItem): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'EMPLOYMENT CONTRACT CERTIFICATE',
    `${stationName} · Human Resources & CNPS Compliance Record`,
    `Contract ID: ${contract.id} | Type: ${contract.contractType} | Start Date: ${contract.startDate}`
  );

  autoTable(doc, {
    startY: y,
    head: [['Contract Field', 'Registered Terms']],
    body: [
      ['Employee Full Name', contract.employeeName],
      ['Contract Classification', `${contract.contractType} (${contract.status})`],
      ['CNPS Social Insurance Number', contract.cnpsNumber],
      ['Effective Start Date', contract.startDate],
      ['Monthly Base Salary', pdfMoney(contract.baseSalaryFcfa)],
      ['Monthly Transport Allowance', pdfMoney(contract.transportAllowanceFcfa)],
      ['Monthly Housing Allowance', pdfMoney(contract.housingAllowanceFcfa)],
      ['Total Monthly Gross Package', pdfMoney(contract.baseSalaryFcfa + contract.transportAllowanceFcfa + contract.housingAllowanceFcfa)],
      ['Emergency Contact', `${contract.emergencyContactName} (${contract.emergencyContactPhone})`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 9 },
  });

  drawSignatureFooter(doc, `Employee Signature (${contract.employeeName})`, 'Station Director Signature & Seal');
  doc.save(`opesfuel-hr-contract-${contract.employeeName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

/** 5. Printable Corporate Fleet Monthly Statement & Tax Invoice PDF */
export function printFleetStatementPdf(params: {
  stationName: string;
  account: FleetAccount;
  transactions: FleetTransaction[];
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  let y = drawDocumentHeader(
    doc,
    'CORPORATE FLEET STATEMENT & TAX INVOICE',
    `${params.stationName} · Postpaid Fuel Credit Billing`,
    `Client: ${params.account.companyName} | Tax ID (NIU): ${params.account.taxId} | Status: ${params.account.status}`
  );

  const subtotalExclVat = Math.round(params.account.balanceOwedFcfa / 1.1925);
  const vatAmount = params.account.balanceOwedFcfa - subtotalExclVat;

  autoTable(doc, {
    startY: y,
    head: [['Account Summary', 'FCFA']],
    body: [
      ['Approved Credit Limit', pdfMoney(params.account.creditLimitFcfa)],
      ['Subtotal Fuel Consumed (Excl. VAT)', pdfMoney(subtotalExclVat)],
      ['VAT (19.25%)', pdfMoney(vatAmount)],
      ['TOTAL BALANCE DUE', pdfMoney(params.account.balanceOwedFcfa)],
      ['Remaining Available Credit', pdfMoney(Math.max(0, params.account.creditLimitFcfa - params.account.balanceOwedFcfa))],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 8;
  autoTable(doc, {
    startY: y,
    head: [['Date', 'Vehicle Plate', 'Driver', 'Fuel Grade', 'Litres', 'Amount (FCFA)']],
    body:
      params.transactions.length > 0
        ? params.transactions.map((tx) => [
            tx.createdAt.slice(0, 10),
            tx.vehiclePlate,
            tx.driverName,
            tx.grade,
            pdfLitres(tx.litres),
            pdfMoney(tx.amountFcfa),
          ])
        : [['-', '-', 'No fuel vouchers in current billing window', '-', '-', '-']],
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
  });

  drawSignatureFooter(doc, 'Station Accounts Receivable', `Acknowledged By (${params.account.companyName})`);
  doc.save(`opesfuel-fleet-statement-${params.account.companyName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

/** 6. Printable Fuel Supplier Purchase Order (PO) PDF */
export function printPurchaseOrderPdf(stationName: string, po: PurchaseOrder): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'OFFICIAL FUEL PURCHASE ORDER',
    `${stationName} · Bulk Fuel Replenishment Order`,
    `PO Ref: ${po.id} | Supplier: ${po.supplierName} | Status: ${po.status}`
  );

  const total = po.orderedLitres * po.unitCostFcfa;
  autoTable(doc, {
    startY: y,
    head: [['Fuel Product', 'Ordered Volume', 'Agreed Unit Cost', 'Total Order Value (FCFA)']],
    body: [[po.grade, pdfLitres(po.orderedLitres), `${pdfMoney(po.unitCostFcfa)} / L`, pdfMoney(total)]],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9.5 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
  });

  drawSignatureFooter(doc, 'Authorized Station Purchaser', `Supplier Dispatch Stamp (${po.supplierName})`);
  doc.save(`opesfuel-po-${po.id}.pdf`);
}

/** 7. Printable Tanker Delivery Goods Received Note (GRN) PDF */
export function printDeliveryGrnPdf(stationName: string, del: TankDeliveryRecord): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'TANKER DELIVERY GOODS RECEIVED NOTE (GRN)',
    `${stationName} · Offloading Verification & Variance Certificate`,
    `GRN Ref: ${del.id} | Tank: ${del.tankName} | Supplier: ${del.supplierName}`
  );

  const variance = del.actualReceivedLitres - del.bolLitres;
  autoTable(doc, {
    startY: y,
    head: [['Delivery Verification Field', 'Measured Value']],
    body: [
      ['Destination Underground Tank', del.tankName],
      ['Fuel Supplier / Depot', del.supplierName],
      ['Bill of Lading (BOL) Volume', pdfLitres(del.bolLitres)],
      ['Actual Volume Received in Tank', pdfLitres(del.actualReceivedLitres)],
      ['Transit / Offloading Variance', `${variance >= 0 ? '+' : ''}${pdfLitres(variance)}`],
      ['Unit Landed Cost', `${pdfMoney(del.unitCostFcfa)} / L`],
      ['Total Supplier Invoice Value', pdfMoney(del.totalInvoiceFcfa)],
      ['Offloaded Timestamp', del.receivedAt.slice(0, 16).replace('T', ' ')],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 9 },
  });

  drawSignatureFooter(doc, 'Tanker Driver Signature', 'Station Manager Offload Verification');
  doc.save(`opesfuel-grn-${del.id}.pdf`);
}

/** 8. Printable Cash Safe / Vault Custody Handover Receipt PDF */
export function printCashVaultSlipPdf(stationName: string, entry: CashVaultEntryItem): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'CASH SAFE / VAULT CUSTODY RECEIPT',
    `${stationName} · Physical Cash Control & Armored Pickup Voucher`,
    `Ref: ${entry.referenceCode} | Movement: ${entry.entryType} | Timestamp: ${entry.recordedAt.slice(0, 16).replace('T', ' ')}`
  );

  autoTable(doc, {
    startY: y,
    head: [['Custody Register Detail', 'Verified Record']],
    body: [
      ['Movement Type', entry.entryType.replace(/_/g, ' ')],
      ['Amount Transferred', pdfMoney(entry.amountFcfa)],
      ['Running Physical Safe Balance After Entry', pdfMoney(entry.runningBalanceFcfa)],
      ['Handed Over By', entry.handedBy],
      ['Received / Verified By', entry.receivedBy],
      ['Seal / Bag / Slip Reference', entry.referenceCode],
      ['Notes', entry.notes || 'Standard safe custody transfer'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 9 },
  });

  drawSignatureFooter(doc, `Handed By (${entry.handedBy})`, `Received By (${entry.receivedBy})`);
  doc.save(`opesfuel-vault-slip-${entry.referenceCode}.pdf`);
}

/** 9. Printable 20L Pump Calibration Certificate PDF */
export function printCalibrationCertPdf(stationName: string, cal: PumpCalibrationItem): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    '20L PUMP CALIBRATION CERTIFICATE',
    `${stationName} · Metrology & Return-to-Tank Verification`,
    `Cert ID: ${cal.id} | Pump: ${cal.pumpCode} | Inspector: ${cal.inspectorName}`
  );

  autoTable(doc, {
    startY: y,
    head: [['Calibration Parameter', 'Certified Reading']],
    body: [
      ['Dispenser Nozzle Code', cal.pumpCode],
      ['Test Can Volume Pumped', pdfLitres(cal.testLitres)],
      ['Returned to Underground Tank', cal.returnedToTank ? 'YES — Zero Attendant Shortage' : 'NO — Expensed as Sample'],
      ['Opening Totalizer Reading', pdfLitres(cal.openingTotalizer)],
      ['Closing Totalizer Reading', pdfLitres(cal.closingTotalizer)],
      ['Inspector / Metrology Official', cal.inspectorName],
      ['Inspection Notes', cal.notes],
      ['Test Timestamp', cal.testedAt.slice(0, 16).replace('T', ' ')],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 9 },
  });

  drawSignatureFooter(doc, `Inspector (${cal.inspectorName})`, 'Station Manager Verification');
  doc.save(`opesfuel-calibration-${cal.pumpCode}-${cal.id}.pdf`);
}

/** 10. Printable Official OpesFuel SaaS Subscription Tax Invoice PDF (Multi-Currency Ready) */
export function printSaasInvoicePdf(params: {
  invoiceNumber: string;
  organizationName: string;
  periodLabel: string;
  totalFcfa: number;
  paidFcfa: number;
  status: string;
  displayTotalFormatted?: string;
  usdEquivalent?: string;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'SAAS SUBSCRIPTION TAX INVOICE',
    'OpesWare Technologies · OpesFuel Cloud Platform Billing',
    `Invoice #: ${params.invoiceNumber} | Billing Period: ${params.periodLabel} | Status: ${params.status}`
  );

  const exclVat = Math.round(params.totalFcfa / 1.1925);
  const vat = params.totalFcfa - exclVat;
  const balance = Math.max(0, params.totalFcfa - params.paidFcfa);

  autoTable(doc, {
    startY: y,
    head: [['Billing Line Item', 'Amount (FCFA)', 'International Equiv.']],
    body: [
      [`OpesFuel Station SaaS Subscription (${params.organizationName})`, pdfMoney(exclVat), params.usdEquivalent ?? '-'],
      ['VAT (19.25%)', pdfMoney(vat), '-'],
      ['TOTAL INVOICE AMOUNT', pdfMoney(params.totalFcfa), params.displayTotalFormatted ?? params.usdEquivalent ?? '-'],
      ['Amount Paid / Settled', pdfMoney(params.paidFcfa), '-'],
      ['OUTSTANDING BALANCE', pdfMoney(balance), balance === 0 ? 'PAID IN FULL' : 'DUE'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right' } },
  });

  drawSignatureFooter(doc, 'OpesWare Billing Desk (billing@opesware.com)', `Customer: ${params.organizationName}`);
  doc.save(`opesfuel-saas-invoice-${params.invoiceNumber}.pdf`);
}

/** 11. Printable Official Enterprise Software License Certificate PDF (Sovereign Guilloche + Watermark + Verification QR) */
export function printEnterpriseLicensePdf(params: {
  licenseKey: string;
  organizationName: string;
  tierName: string;
  maxStations: number;
  expiresAt: string;
  feeLabel: string;
}): void {
  const numericFee = Number(params.feeLabel.replace(/[^0-9]/g, '')) || 5000000;
  printSecurityLicenseCertificatePdf({
    licenseKey: params.licenseKey,
    organizationName: params.organizationName,
    tierName: params.tierName,
    maxStations: params.maxStations,
    annualFeeFcfa: numericFee,
    expiresAt: params.expiresAt,
  });
}

/** 12. Export Forecourt Shifts Ledger to Excel (.xlsx) */
export function exportShiftsExcel(shifts: ShiftRecord[], stationLabel: string): void {
  const wb = XLSX.utils.book_new();
  const rows = shifts.map((s) => ({
    'Shift ID': s.id,
    Pump: s.pumpCode,
    Grade: s.grade,
    Attendant: s.attendantName,
    'Opening Meter (L)': s.openingMeterLitres,
    'Closing Meter (L)': s.closingMeterLitres ?? '',
    'Litres Sold': s.litresSold,
    'Expected Revenue (FCFA)': s.expectedRevenueFcfa,
    'Cash (FCFA)': s.cashFcfa,
    'Mobile Money (FCFA)': s.mobileMoneyFcfa,
    'Card (FCFA)': s.cardFcfa,
    'Fleet Credit (FCFA)': s.fleetCreditFcfa,
    'Variance (FCFA)': s.varianceFcfa,
    Status: s.status,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Forecourt Shifts');
  XLSX.writeFile(wb, `opesfuel-shifts-${stationLabel.toLowerCase().replace(/\s+/g, '-')}.xlsx`);
}

/** 13. Export SaaS Global Revenue & Tenant Directory to Excel (.xlsx) */
export function exportSaasGlobalExcel(
  tenants: Array<Record<string, unknown>>,
  leads: Array<Record<string, unknown>>
): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tenants), 'SaaS Tenants');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leads), 'Onboarding Leads');
  XLSX.writeFile(wb, `opesfuel-saas-control-plane-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** 14. Printable HSE Safety, Environmental & Incident Report PDF (M38) */
export function printHseIncidentReportPdf(params: {
  stationName: string;
  record: {
    id: string;
    recordType: string;
    severity: string;
    title: string;
    details: string;
    inspectorOrReporter: string;
    nextDueDate: string;
    capaAction: string;
    status: string;
    recordedAt: string;
  };
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'HSE SAFETY & COMPLIANCE RECORD',
    `${params.stationName} · Health, Safety, Fire & Environmental Control`,
    `Ref: ${params.record.id} | Category: ${params.record.recordType} | Severity: ${params.record.severity}`
  );
  autoTable(doc, {
    startY: y,
    head: [['HSE Field', 'Verified Record']],
    body: [
      ['Subject / Title', params.record.title],
      ['Record Type', params.record.recordType.replace(/_/g, ' ')],
      ['Severity / Risk Level', params.record.severity],
      ['Current Status', params.record.status],
      ['Inspector / Reporter', params.record.inspectorOrReporter],
      ['Observation / Incident Details', params.record.details],
      ['Corrective & Preventive Action (CAPA)', params.record.capaAction || 'Standard monitoring'],
      ['Next Inspection / Renewal Due', params.record.nextDueDate || 'N/A'],
      ['Logged Timestamp', params.record.recordedAt.slice(0, 16).replace('T', ' ')],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 9 },
  });
  drawSignatureFooter(doc, `HSE Officer (${params.record.inspectorOrReporter})`, 'Station Manager Sign-Off');
  doc.save(`opesfuel-hse-${params.record.id}.pdf`);
}

/** 15. Printable Fraud & Loss Prevention Investigation Case PDF (M39) */
export function printFraudCaseReportPdf(params: {
  stationName: string;
  fraudCase: {
    id: string;
    anomalyType: string;
    severity: string;
    subjectRef: string;
    suspectedLossFcfa: number;
    recoveredFcfa: number;
    investigator: string;
    findings: string;
    disposition: string;
    openedAt: string;
  };
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'LOSS PREVENTION & FRAUD CASE DOSSIER',
    `${params.stationName} · Confidential Audit Investigation Record`,
    `Case ID: ${params.fraudCase.id} | Type: ${params.fraudCase.anomalyType} | Disposition: ${params.fraudCase.disposition}`
  );
  autoTable(doc, {
    startY: y,
    head: [['Investigation Field', 'Case Evidence']],
    body: [
      ['Linked Transaction / Subject Ref', params.fraudCase.subjectRef],
      ['Anomaly Classification', params.fraudCase.anomalyType.replace(/_/g, ' ')],
      ['Risk Severity', params.fraudCase.severity],
      ['Estimated Financial Exposure', pdfMoney(params.fraudCase.suspectedLossFcfa)],
      ['Amount Recovered to Date', pdfMoney(params.fraudCase.recoveredFcfa)],
      ['Net Unrecovered Variance', pdfMoney(Math.max(0, params.fraudCase.suspectedLossFcfa - params.fraudCase.recoveredFcfa))],
      ['Lead Investigator', params.fraudCase.investigator],
      ['Audit Findings & Evidence', params.fraudCase.findings],
      ['Case Disposition', params.fraudCase.disposition.replace(/_/g, ' ')],
      ['Opened At', params.fraudCase.openedAt.slice(0, 16).replace('T', ' ')],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 9 },
  });
  drawSignatureFooter(doc, `Lead Investigator (${params.fraudCase.investigator})`, 'Owner / Chief Auditor Approval');
  doc.save(`opesfuel-fraud-case-${params.fraudCase.id}.pdf`);
}

/** 16. Printable Fuel Quality Control & Water-Paste Test Certificate PDF (M55) */
export function printFuelQualityCertPdf(params: {
  stationName: string;
  sample: {
    id: string;
    tankName: string;
    fuelGrade: string;
    batchCoaRef: string;
    densityKgM3: number;
    temperatureC: number;
    waterPasteDetected: boolean;
    quarantined: boolean;
    testedBy: string;
    notes: string;
    testedAt: string;
  };
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'FUEL QUALITY & SAMPLING CERTIFICATE',
    `${params.stationName} · Density, Water-Paste & Quarantine Verification`,
    `QC Ref: ${params.sample.id} | Batch COA: ${params.sample.batchCoaRef} | Grade: ${params.sample.fuelGrade}`
  );
  autoTable(doc, {
    startY: y,
    head: [['Quality Parameter', 'Measured Value']],
    body: [
      ['Underground Tank', params.sample.tankName],
      ['Fuel Grade', params.sample.fuelGrade],
      ['Supplier Batch COA Reference', params.sample.batchCoaRef],
      ['Measured Density', `${params.sample.densityKgM3} kg/m3`],
      ['Sample Temperature', `${params.sample.temperatureC} °C`],
      ['Water-Finding Paste Test', params.sample.waterPasteDetected ? 'POSITIVE — WATER DETECTED' : 'NEGATIVE — CLEAN'],
      ['Tank Quarantine / Stop-Sale', params.sample.quarantined ? 'ACTIVE QUARANTINE (STOP SALE)' : 'CLEARED FOR SALE'],
      ['Tested By', params.sample.testedBy],
      ['Inspector Notes', params.sample.notes || 'Standard batch verification'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 9 },
  });
  drawSignatureFooter(doc, `QC Technician (${params.sample.testedBy})`, 'Station Quality Release Sign-Off');
  doc.save(`opesfuel-fuel-qc-${params.sample.id}.pdf`);
}

/** 17. Printable Inter-Station Fuel Transfer Manifest PDF (M25) */
export function printInterstationTransferPdf(transfer: {
  id: string;
  fromStationName: string;
  toStationName: string;
  fuelGrade: string;
  dispatchedLitres: number;
  receivedLitres: number | null;
  sealNumber: string;
  tankerPlate: string;
  driverName: string;
  status: string;
  dispatchedAt: string;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'INTER-STATION FUEL TRANSFER MANIFEST',
    'OpesFuel Network Logistics · Sealed Tanker Dispatch & Custody Note',
    `Manifest #: ${transfer.id} | Seal #: ${transfer.sealNumber} | Status: ${transfer.status}`
  );
  const delta = transfer.receivedLitres !== null ? transfer.receivedLitres - transfer.dispatchedLitres : null;
  autoTable(doc, {
    startY: y,
    head: [['Transfer Field', 'Custody Value']],
    body: [
      ['Origin Dispatch Station', transfer.fromStationName],
      ['Destination Receiving Station', transfer.toStationName],
      ['Fuel Grade', transfer.fuelGrade],
      ['Dispatched Volume', pdfLitres(transfer.dispatchedLitres)],
      ['Received Volume at Destination', transfer.receivedLitres !== null ? pdfLitres(transfer.receivedLitres) : 'Pending Offload'],
      ['Transit Variance', delta !== null ? `${delta >= 0 ? '+' : ''}${pdfLitres(delta)}` : 'In Transit'],
      ['Tanker Plate & Seal #', `${transfer.tankerPlate} · Seal ${transfer.sealNumber}`],
      ['Authorized Driver', transfer.driverName],
      ['Dispatched Timestamp', transfer.dispatchedAt.slice(0, 16).replace('T', ' ')],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 9 },
  });
  drawSignatureFooter(doc, `Dispatching Station / Driver (${transfer.driverName})`, `Receiving Station (${transfer.toStationName})`);
  doc.save(`opesfuel-transfer-${transfer.id}.pdf`);
}

/** 18. Printable Fixed Assets & Depreciation Register PDF (M36 — SYSCOHADA Class 2) */
export function printFixedAssetsRegisterPdf(params: {
  stationName: string;
  assets: Array<{
    assetTag: string;
    assetName: string;
    category: string;
    acquisitionDate: string;
    acquisitionCostFcfa: number;
    usefulLifeYears: number;
    custodian: string;
  }>;
}): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'FIXED ASSETS & DEPRECIATION REGISTER',
    `${params.stationName} · SYSCOHADA Class 2 Straight-Line Valuation`,
    `Assets Count: ${params.assets.length} | Generated: ${new Date().toISOString().slice(0, 10)}`
  );
  const nowYear = new Date().getFullYear();
  const rows = params.assets.map((a) => {
    const acqYear = Number(a.acquisitionDate.slice(0, 4)) || nowYear;
    const elapsed = Math.max(0, Math.min(a.usefulLifeYears, nowYear - acqYear));
    const annualDep = Math.round(a.acquisitionCostFcfa / Math.max(1, a.usefulLifeYears));
    const accumDep = Math.min(a.acquisitionCostFcfa, annualDep * elapsed);
    const nbv = Math.max(0, a.acquisitionCostFcfa - accumDep);
    return [
      a.assetTag,
      a.assetName,
      a.category,
      a.acquisitionDate,
      pdfMoney(a.acquisitionCostFcfa),
      pdfMoney(annualDep),
      pdfMoney(nbv),
    ];
  });
  autoTable(doc, {
    startY: y,
    head: [['Tag', 'Asset Description', 'Category', 'Acquired', 'Cost (FCFA)', 'Annual Dep.', 'Net Book Value']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
  });
  drawSignatureFooter(doc, 'Station Accountant', 'Owner / Statutory Auditor');
  doc.save(`opesfuel-fixed-assets-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** 19. Printable Statutory Audit Evidence Pack PDF (M56) */
export function printAuditEvidencePackPdf(params: {
  organizationName: string;
  stationScope: string;
  summaryRows: Array<[string, string]>;
  recentAuditLogs: Array<{ createdAt: string; actorEmail: string; action: string; entityType: string; summary: string }>;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  let y = drawDocumentHeader(
    doc,
    'STATUTORY AUDIT EVIDENCE PACKAGE',
    `${params.organizationName} · Immutable Compliance & Financial Verification`,
    `Scope: ${params.stationScope} | Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`
  );
  autoTable(doc, {
    startY: y,
    head: [['Control Domain / Verification Metric', 'Certified Value']],
    body: params.summaryRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;
  autoTable(doc, {
    startY: y,
    head: [['Timestamp', 'Actor', 'Action', 'Entity', 'Audit Summary']],
    body: params.recentAuditLogs.slice(0, 20).map((l) => [
      l.createdAt.slice(0, 16).replace('T', ' '),
      l.actorEmail,
      l.action,
      l.entityType,
      l.summary,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
    bodyStyles: { fontSize: 7 },
  });
  drawSignatureFooter(doc, 'Compliance Officer / Accountant', 'External Statutory Auditor');
  doc.save(`opesfuel-audit-evidence-pack-${new Date().toISOString().slice(0, 10)}.pdf`);
}

