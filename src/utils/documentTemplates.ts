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
  FuelTank,
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

/** 20. SaaS Executive Monthly Performance & MRR Board Report PDF (PLATFORM_ADMIN) */
export function printSaasExecutiveBoardReportPdf(params: {
  mrrFcfa: number;
  arrFcfa: number;
  arpuFcfa: number;
  collectionRatePct: number;
  churnRatePct: number;
  activeTenants: number;
  totalTenants: number;
  trialTenants: number;
  totalStations: number;
  outstandingReceivablesFcfa: number;
  momoSettledVolumeFcfa: number;
  openSupportTickets: number;
  edgeDevicesOnline: number;
  edgeDevicesTotal: number;
  tierBreakdown: Array<{ planName: string; tenantCount: number; stationCount: number; mrrFcfa: number; sharePct: number }>;
  topTenants: Array<{ name: string; status: string; stationCount: number; monthlyMrrFcfa: number; planCode?: string }>;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  let y = drawDocumentHeader(
    doc,
    'SAAS EXECUTIVE PERFORMANCE & MRR BOARD REPORT',
    'OpesWare Technologies · Global Multi-Tenant Platform Intelligence',
    `Report Date: ${new Date().toISOString().slice(0, 10)} | Active Tenants: ${params.activeTenants}/${params.totalTenants} | Stations: ${params.totalStations}`
  );

  autoTable(doc, {
    startY: y,
    head: [['SaaS Executive KPI', 'Verified Platform Metric']],
    body: [
      ['Global Monthly Recurring Revenue (MRR)', pdfMoney(params.mrrFcfa)],
      ['Annualized Run Rate (ARR)', pdfMoney(params.arrFcfa)],
      ['Average Revenue Per Tenant (ARPU)', pdfMoney(params.arpuFcfa)],
      ['Active / Total Customer Tenants', `${params.activeTenants} active / ${params.totalTenants} total (${params.trialTenants} on trial)`],
      ['Provisioned Petrol Station Sites', `${params.totalStations} stations`],
      ['Billing Collection Rate / Overdue AR', `${params.collectionRatePct.toFixed(1)}% collected | AR: ${pdfMoney(params.outstandingReceivablesFcfa)}`],
      ['Cameroon MoMo Settled Volume (MTN + Orange)', pdfMoney(params.momoSettledVolumeFcfa)],
      ['Account Suspension / Churn Rate', `${params.churnRatePct.toFixed(1)}%`],
      ['Customer Support Queue', `${params.openSupportTickets} open ticket(s)`],
      ['On-Site Edge Agent Fleet Connectivity', `${params.edgeDevicesOnline} online / ${params.edgeDevicesTotal} registered`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 7;
  autoTable(doc, {
    startY: y,
    head: [['Subscription Plan Tier', 'Tenants', 'Stations', 'Monthly MRR (FCFA)', 'Revenue Share']],
    body: params.tierBreakdown.map((t) => [
      t.planName,
      String(t.tenantCount),
      String(t.stationCount),
      pdfMoney(t.mrrFcfa),
      `${t.sharePct.toFixed(1)}%`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' }, 4: { halign: 'right' } },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 7;
  autoTable(doc, {
    startY: y,
    head: [['Customer Tenant', 'Plan', 'Status', 'Stations', 'Monthly MRR (FCFA)']],
    body: params.topTenants.slice(0, 12).map((t) => [
      t.name,
      (t.planCode || 'growth').toUpperCase(),
      t.status,
      String(t.stationCount),
      pdfMoney(t.monthlyMrrFcfa),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.8 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
  });

  drawSignatureFooter(doc, 'OpesWare CEO / SaaS Super-Admin', 'Board of Directors / Finance Review');
  doc.save(`opesfuel-saas-executive-board-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** 21. Multi-Sheet Global SaaS Billing & MoMo Reconciliation Workbook (.xlsx) */
export function exportSaasGlobalReconciliationExcel(params: {
  tenants: Array<Record<string, unknown>>;
  leads: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  momoSettlements: Array<Record<string, unknown>>;
  licenses: Array<Record<string, unknown>>;
  tickets: Array<Record<string, unknown>>;
}): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.tenants.length ? params.tenants : [{ info: 'No tenants' }]), 'SaaS Tenants');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.invoices.length ? params.invoices : [{ info: 'No invoices' }]), 'Global Invoices');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.momoSettlements.length ? params.momoSettlements : [{ info: 'No MoMo transactions' }]), 'Cameroon MoMo Ledger');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.licenses.length ? params.licenses : [{ info: 'No licenses' }]), 'Enterprise Licenses');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.tickets.length ? params.tickets : [{ info: 'No support tickets' }]), 'Support Tickets');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.leads.length ? params.leads : [{ info: 'No leads' }]), 'Onboarding Leads');
  XLSX.writeFile(wb, `opesfuel-saas-global-reconciliation-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** 22. Super-Admin Security & Impersonation Audit Trail PDF & CSV */
export function printSaasAuditTrailPdf(
  logs: Array<{ createdAt?: string; tenantId?: string; actorEmail?: string; action?: string; entityType?: string; summary?: string }>
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const y = drawDocumentHeader(
    doc,
    'SAAS PLATFORM SECURITY & IMPERSONATION AUDIT TRAIL',
    'OpesWare Control Plane · Cross-Tenant Super-Admin Activity Register',
    `Exported: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC | Entries: ${logs.length}`
  );
  autoTable(doc, {
    startY: y,
    head: [['Timestamp (UTC)', 'Tenant Scope', 'Actor', 'Action', 'Entity', 'Summary']],
    body: logs.slice(0, 80).map((l) => [
      String(l.createdAt ?? '').slice(0, 19).replace('T', ' '),
      String(l.tenantId ?? 'PLATFORM'),
      String(l.actorEmail ?? 'superadmin'),
      String(l.action ?? ''),
      String(l.entityType ?? ''),
      String(l.summary ?? ''),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
    bodyStyles: { fontSize: 7 },
  });
  drawSignatureFooter(doc, 'Platform Security Officer', 'Chief Technology Officer');
  doc.save(`opesfuel-platform-audit-trail-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportSaasAuditCsv(
  logs: Array<{ createdAt?: string; tenantId?: string; actorEmail?: string; actorRole?: string; action?: string; entityType?: string; entityId?: string; summary?: string }>
): void {
  const headers = ['Timestamp', 'TenantId', 'ActorEmail', 'ActorRole', 'Action', 'EntityType', 'EntityId', 'Summary'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...logs.map((l) =>
      [l.createdAt, l.tenantId, l.actorEmail, l.actorRole, l.action, l.entityType, l.entityId, l.summary].map(esc).join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `opesfuel-platform-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 23. Branded Tenant Onboarding & SLA Welcome Dossier PDF */
export function printTenantWelcomeDossierPdf(params: {
  tenantId: string;
  organizationName: string;
  ownerEmail: string;
  planName: string;
  stationCount: number;
  monthlyMrrFcfa: number;
  trialEndsAt?: string | null;
  countryCode?: string;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  let y = drawDocumentHeader(
    doc,
    'TENANT ONBOARDING & SLA WELCOME DOSSIER',
    'OpesFuel SaaS Petrol Station Operating System · Provisioning Certificate',
    `Tenant ID: ${params.tenantId} | Issued: ${new Date().toISOString().slice(0, 10)} | Region: ${params.countryCode || 'CM'}`
  );
  autoTable(doc, {
    startY: y,
    head: [['Workspace Provisioning Detail', 'Authorized Value']],
    body: [
      ['Organization Legal / Workspace Name', params.organizationName],
      ['Primary Owner Account Email', params.ownerEmail],
      ['Subscribed SaaS Plan', params.planName],
      ['Provisioned Petrol Station Sites', String(params.stationCount)],
      ['Monthly Subscription Commitment', pdfMoney(params.monthlyMrrFcfa)],
      ['Trial Period Expiry', params.trialEndsAt ? params.trialEndsAt.slice(0, 10) : 'Active Paid Subscription'],
      ['Console Sign-In URL', 'https://app.opesfuel.com/#/login'],
      ['Public Verification Portal', 'https://app.opesfuel.com/#/verify'],
      ['Support Desk & SLA Guarantee', 'support@opesware.com · Urgent P1 SLA: 2 Hours · Uptime: 99.9%'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 1: { fontStyle: 'bold' } },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Onboarding Activation Checklist:', 14, y);
  const steps = [
    '1. Sign in with your Owner Email / Member ID and complete your Company Legal Branding (NIU, RCCM, CNPS, Logo).',
    '2. Configure your petrol station tanks, fuel grades, pumps, and opening meter totalizers.',
    '3. Invite Station Managers, Accountants, and Attendants via Staff & HR.',
    '4. Connect MTN MoMo / Orange Money Cameroon or on-site Edge Agent hardware via Admin & Billing.',
  ];
  steps.forEach((s, idx) => {
    doc.text(s, 14, y + 6 + idx * 5.5);
  });
  drawSignatureFooter(doc, 'OpesWare Onboarding & Success Desk', `Tenant Owner (${params.ownerEmail})`);
  doc.save(`opesfuel-welcome-dossier-${params.tenantId}.pdf`);
}

/** 24. Multi-Section Consolidated Financial Statements Board Pack PDF (GROUP_CFO) */
export function printConsolidatedFinancialStatementsPackPdf(params: {
  groupName: string;
  period: string;
  reportingCurrency: string;
  fxXafPerUsd: number;
  pnl: {
    grossRevenue: number;
    intercompanyRevenueElimination: number;
    consolidatedRevenue: number;
    consolidatedCogs: number;
    grossProfit: number;
    operatingExpenses: number;
    consolidatedNetIncome: number;
    controllingShareNetIncome: number;
    minorityInterestNetIncome: number;
  };
  balanceSheet: {
    grossAssets: number;
    intercompanyBalanceElimination: number;
    consolidatedAssets: number;
    consolidatedLiabilities: number;
    totalEquity: number;
    controllingEquity: number;
    minorityInterestEquity: number;
  };
  subsidiaries: Array<{
    entityName: string;
    tenantId: string;
    functionalCurrency: string;
    ownershipPct: number;
    minorityInterestPct: number;
    revenueReporting: number;
    cogsReporting: number;
    opexReporting: number;
    netIncomeReporting: number;
    assetsReporting: number;
    grossMarginPct: number;
    netMarginPct: number;
  }>;
  eliminations: Array<{
    id: string;
    intercompany_tx_id?: string;
    debit_account?: string;
    credit_account?: string;
    amount_reporting?: number;
  }>;
}): void {
  const fmtCcy = (v: number) =>
    params.reportingCurrency === 'USD'
      ? `$${Math.round(v).toLocaleString('en-US')}`
      : `${Math.round(v).toLocaleString('en-US').replace(/,/g, ' ')} ${params.reportingCurrency}`;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  let y = drawDocumentHeader(
    doc,
    'CONSOLIDATED GROUP FINANCIAL STATEMENTS (SYSCOHADA / IFRS)',
    `${params.groupName} · Multi-Subsidiary Consolidation Pack`,
    `Period: ${params.period} | Reporting CCY: ${params.reportingCurrency} | FX: 1 USD = ${params.fxXafPerUsd} XAF (XAF/XOF 1:1 Parity)`
  );

  autoTable(doc, {
    startY: y,
    head: [['Consolidated Income Statement (P&L)', `Amount (${params.reportingCurrency})`, 'Consolidated Balance Sheet', `Amount (${params.reportingCurrency})`]],
    body: [
      ['Gross Subsidiary Revenue', fmtCcy(params.pnl.grossRevenue), 'Gross Subsidiary Assets', fmtCcy(params.balanceSheet.grossAssets)],
      ['Less: Inter-Company Revenue Elimination', `(${fmtCcy(params.pnl.intercompanyRevenueElimination)})`, 'Less: Inter-Company AR/AP Elimination', `(${fmtCcy(params.balanceSheet.intercompanyBalanceElimination)})`],
      ['CONSOLIDATED REVENUE', fmtCcy(params.pnl.consolidatedRevenue), 'CONSOLIDATED TOTAL ASSETS', fmtCcy(params.balanceSheet.consolidatedAssets)],
      ['Consolidated Cost of Goods Sold (COGS)', `(${fmtCcy(params.pnl.consolidatedCogs)})`, 'Consolidated Liabilities', fmtCcy(params.balanceSheet.consolidatedLiabilities)],
      ['Consolidated Gross Profit', fmtCcy(params.pnl.grossProfit), 'Controlling Parent Equity', fmtCcy(params.balanceSheet.controllingEquity)],
      ['Operating Expenses (OpEx)', `(${fmtCcy(params.pnl.operatingExpenses)})`, 'Minority Interest (NCI) Equity', fmtCcy(params.balanceSheet.minorityInterestEquity)],
      ['CONSOLIDATED NET INCOME', fmtCcy(params.pnl.consolidatedNetIncome), 'TOTAL CONSOLIDATED EQUITY', fmtCcy(params.balanceSheet.totalEquity)],
      ['Attributable to Parent (Controlling Share)', fmtCcy(params.pnl.controllingShareNetIncome), 'Liabilities + Total Equity', fmtCcy(params.balanceSheet.consolidatedLiabilities + params.balanceSheet.totalEquity)],
      ['Attributable to Minority Interest (NCI)', fmtCcy(params.pnl.minorityInterestNetIncome), 'FX Translation Basis', `1 USD = ${params.fxXafPerUsd} XAF`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.8 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right', fontStyle: 'bold' } },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 7;
  autoTable(doc, {
    startY: y,
    head: [['Legal Subsidiary', 'Func. CCY', 'Own % / NCI %', `Revenue`, `Net Income`, `Total Assets`, 'Gross Margin', 'Net Margin']],
    body: params.subsidiaries.map((s) => [
      `${s.entityName} (${s.tenantId})`,
      s.functionalCurrency,
      `${s.ownershipPct}% / ${s.minorityInterestPct}%`,
      fmtCcy(s.revenueReporting),
      fmtCcy(s.netIncomeReporting),
      fmtCcy(s.assetsReporting),
      `${s.grossMarginPct.toFixed(1)}%`,
      `${s.netMarginPct.toFixed(1)}%`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.8 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
  });

  if (params.eliminations.length > 0) {
    y = (doc.lastAutoTable?.finalY ?? y) + 7;
    autoTable(doc, {
      startY: y,
      head: [['Elimination ID', 'Source Inter-Co TX', 'Debit Account', 'Credit Account', `Eliminated Amount (${params.reportingCurrency})`]],
      body: params.eliminations.map((e) => [
        String(e.id),
        String(e.intercompany_tx_id ?? '-'),
        String(e.debit_account ?? '701_INTERCO_REVENUE'),
        String(e.credit_account ?? '601_INTERCO_COGS'),
        fmtCcy(Number(e.amount_reporting ?? 0)),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.8 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
    });
  }

  drawSignatureFooter(doc, 'Group Chief Financial Officer (GROUP_CFO)', 'Statutory Group Auditor');
  doc.save(`opesfuel-consolidated-pack-${params.period}-${params.reportingCurrency.toLowerCase()}.pdf`);
}

/** 25. 5-Sheet Consolidated Group Excel Workbook (.xlsx) */
export function exportConsolidatedGroupExcel(params: {
  groupName: string;
  period: string;
  reportingCurrency: string;
  pnl: Record<string, unknown>;
  balanceSheet: Record<string, unknown>;
  subsidiaries: Array<Record<string, unknown>>;
  intercompanyTransactions: Array<Record<string, unknown>>;
  eliminations: Array<Record<string, unknown>>;
}): void {
  const wb = XLSX.utils.book_new();
  const pnlRows = Object.entries(params.pnl).map(([metric, val]) => ({
    Metric: metric,
    [`Amount (${params.reportingCurrency})`]: val,
  }));
  const bsRows = Object.entries(params.balanceSheet).map(([metric, val]) => ({
    Metric: metric,
    [`Amount (${params.reportingCurrency})`]: val,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pnlRows), 'Consolidated P&L');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bsRows), 'Consolidated Balance Sheet');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.subsidiaries.length ? params.subsidiaries : [{ info: 'No subsidiaries' }]), 'Subsidiaries');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.intercompanyTransactions.length ? params.intercompanyTransactions : [{ info: 'No inter-company transactions' }]), 'Inter-Company Tx');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.eliminations.length ? params.eliminations : [{ info: 'No elimination journals' }]), 'Elimination Journals');
  XLSX.writeFile(wb, `opesfuel-group-consolidation-${params.period}-${params.reportingCurrency.toLowerCase()}.xlsx`);
}

/** 26. Inter-Company Elimination & Statutory Consolidation Certificate PDF */
export function printIntercompanyEliminationCertificatePdf(params: {
  groupName: string;
  period: string;
  reportingCurrency: string;
  fxXafPerUsd: number;
  totalEliminatedReporting: number;
  pendingCount: number;
  eliminations: Array<{ id: string; intercompany_tx_id?: string; debit_account?: string; credit_account?: string; amount_reporting?: number; created_at?: string }>;
}): void {
  const fmtCcy = (v: number) =>
    params.reportingCurrency === 'USD'
      ? `$${Math.round(v).toLocaleString('en-US')}`
      : `${Math.round(v).toLocaleString('en-US').replace(/,/g, ' ')} ${params.reportingCurrency}`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  let y = drawDocumentHeader(
    doc,
    'INTER-COMPANY ELIMINATION & CONSOLIDATION CERTIFICATE',
    `${params.groupName} · OHADA / IFRS 10 Compliance Attestation`,
    `Period: ${params.period} | Reporting CCY: ${params.reportingCurrency} | FX: 1 USD = ${params.fxXafPerUsd} XAF`
  );
  autoTable(doc, {
    startY: y,
    head: [['Attestation Parameter', 'Verified Consolidation Value']],
    body: [
      ['Holding Group Entity', params.groupName],
      ['Consolidation Accounting Period', params.period],
      ['Total Inter-Company Revenue / COGS Eliminated', fmtCcy(params.totalEliminatedReporting)],
      ['Elimination Journal Entries Posted', String(params.eliminations.length)],
      ['Uneliminated Pending Inter-Company Transactions', params.pendingCount === 0 ? '0 (CLEAN — ZERO DOUBLE-COUNTING)' : `${params.pendingCount} PENDING`],
      ['Currency Parity & Translation Rule', `XAF/XOF 1:1 CFA Parity · 1 USD = ${params.fxXafPerUsd} XAF`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 1: { fontStyle: 'bold', halign: 'right' } },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;
  autoTable(doc, {
    startY: y,
    head: [['Entry ID', 'Inter-Co TX Ref', 'Debit Account', 'Credit Account', `Amount (${params.reportingCurrency})`]],
    body: params.eliminations.length
      ? params.eliminations.map((e) => [
          String(e.id),
          String(e.intercompany_tx_id ?? '-'),
          String(e.debit_account ?? '701_INTERCO_REVENUE'),
          String(e.credit_account ?? '601_INTERCO_COGS'),
          fmtCcy(Number(e.amount_reporting ?? 0)),
        ])
      : [['-', 'No elimination entries posted in this period', '-', '-', fmtCcy(0)]],
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.8 },
    columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
  });
  drawSignatureFooter(doc, 'Group CFO Certification', 'External Statutory Auditor');
  doc.save(`opesfuel-elimination-certificate-${params.period}.pdf`);
}

/** 27. Owner Multi-Station Executive Network Performance Report PDF (OWNER) */
export function printOwnerNetworkExecutivePdf(params: {
  organizationName: string;
  report: {
    totalRevenueFcfa: number;
    grossProfitFcfa: number;
    netIncomeFcfa: number;
    cashOnHandFcfa: number;
    mobileMoneyClearingFcfa: number;
    bankBalanceFcfa: number;
    fleetReceivablesFcfa: number;
    vatPayableFcfa: number;
    cashVarianceFcfa: number;
    trialBalanceBalanced: boolean;
  };
  stationScorecard: Array<{
    code: string;
    name: string;
    city: string;
    planName: string;
    litresSold: number;
    revenueFcfa: number;
    varianceFcfa: number;
    openShifts: number;
    closedShifts: number;
    tankFillPct: number;
  }>;
}): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  let y = drawDocumentHeader(
    doc,
    'OWNER MULTI-STATION NETWORK EXECUTIVE PERFORMANCE REPORT',
    `${params.organizationName} · Network Financial & Forecourt Scorecard`,
    `Generated: ${new Date().toISOString().slice(0, 10)} | Stations: ${params.stationScorecard.length} | Trial Balance: ${params.report.trialBalanceBalanced ? 'BALANCED' : 'ATTENTION'}`
  );

  autoTable(doc, {
    startY: y,
    head: [['Network Financial Metric', 'Amount (FCFA)', 'Treasury & Tax Position', 'Amount (FCFA)']],
    body: [
      ['Total Network Fuel & Shop Revenue', pdfMoney(params.report.totalRevenueFcfa), 'Cash Safe & Forecourt On Hand', pdfMoney(params.report.cashOnHandFcfa)],
      ['Network Gross Profit', pdfMoney(params.report.grossProfitFcfa), 'Mobile Money Clearing (MTN + Orange)', pdfMoney(params.report.mobileMoneyClearingFcfa)],
      ['Network Net Income', pdfMoney(params.report.netIncomeFcfa), 'Bank Balance', pdfMoney(params.report.bankBalanceFcfa)],
      ['Cumulative Shift Cash Variance', pdfMoney(-params.report.cashVarianceFcfa), 'Corporate Fleet AR / VAT Payable', `${pdfMoney(params.report.fleetReceivablesFcfa)} / ${pdfMoney(params.report.vatPayableFcfa)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.2 },
    bodyStyles: { fontSize: 8.2 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right', fontStyle: 'bold' } },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 7;
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Petrol Station', 'City', 'Plan', 'Closed / Open Shifts', 'Litres Sold', 'Station Revenue (FCFA)', 'Cash Variance', 'Tank Fill %']],
    body: params.stationScorecard.map((s) => [
      s.code,
      s.name,
      s.city,
      s.planName,
      `${s.closedShifts} / ${s.openShifts}`,
      `${Math.round(s.litresSold).toLocaleString('en-US')} L`,
      pdfMoney(s.revenueFcfa),
      pdfMoney(s.varianceFcfa),
      `${s.tankFillPct}%`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
  });

  drawSignatureFooter(doc, 'Station Network Owner / CEO', 'Chief Accountant / Auditor');
  doc.save(`opesfuel-owner-network-executive-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** 28. Multi-Station Network Executive Workbook (.xlsx, 4 sheets) */
export function exportOwnerNetworkExcel(params: {
  organizationName: string;
  summaryRows: Array<{ Metric: string; ValueFcfa: number | string }>;
  stationScorecard: Array<Record<string, unknown>>;
  priceHistory: Array<Record<string, unknown>>;
  tankReserves: Array<Record<string, unknown>>;
}): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.summaryRows), 'Network Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.stationScorecard.length ? params.stationScorecard : [{ info: 'No stations' }]), 'Station Scorecard');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.priceHistory.length ? params.priceHistory : [{ info: 'No price changes' }]), 'Fuel Price Audit');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.tankReserves.length ? params.tankReserves : [{ info: 'No tanks' }]), 'Tank Reserves');
  XLSX.writeFile(wb, `opesfuel-network-executive-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** 29. Station Manager End-of-Day Handover & Forecourt Operations Report PDF (Zero P&L / Salary Leakage) */
export function printManagerDailyHandoverPdf(params: {
  stationName: string;
  managerName: string;
  dateLabel: string;
  shifts: ShiftRecord[];
  tanks: FuelTank[];
  safeBalanceFcfa: number;
  recentVaultEntries: CashVaultEntryItem[];
  quarantinedTanksCount: number;
  pendingLeavesCount: number;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const closed = params.shifts.filter((s) => s.status === 'CLOSED');
  const open = params.shifts.filter((s) => s.status === 'OPEN');
  const totalLitres = closed.reduce((acc, s) => acc + s.litresSold, 0);
  const totalCashDrop = closed.reduce((acc, s) => acc + s.cashFcfa, 0);
  const totalMoMo = closed.reduce((acc, s) => acc + s.mobileMoneyFcfa, 0);
  const totalVariance = closed.reduce((acc, s) => acc + s.varianceFcfa, 0);

  let y = drawDocumentHeader(
    doc,
    'STATION MANAGER DAILY OPERATIONS & SHIFT HANDOVER REPORT',
    `${params.stationName} · Forecourt Custody, Wet-Stock Dipstick & Cash Safe Reconciliation`,
    `Date: ${params.dateLabel} | Manager: ${params.managerName} | Shifts: ${closed.length} Closed / ${open.length} Open`
  );

  autoTable(doc, {
    startY: y,
    head: [['Forecourt & Custody KPI', 'Value', 'Operational Status', 'Value']],
    body: [
      ['Metered Fuel Dispensed', `${Math.round(totalLitres).toLocaleString('en-US')} L`, 'Current Cash in Station Safe', pdfMoney(params.safeBalanceFcfa)],
      ['Closed Shift Cash Tenders', pdfMoney(totalCashDrop), 'Closed Shift MoMo Tenders', pdfMoney(totalMoMo)],
      ['Cumulative Shift Cash Variance', pdfMoney(totalVariance), 'Quarantined Fuel Tanks', `${params.quarantinedTanksCount} tank(s)`],
      ['Open Nozzle Shifts at Handover', `${open.length}`, 'Pending Staff Leave Requests', `${params.pendingLeavesCount}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.2 },
    bodyStyles: { fontSize: 8.2 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right', fontStyle: 'bold' } },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 6;
  autoTable(doc, {
    startY: y,
    head: [['Pump', 'Attendant', 'Grade', 'Status', 'Litres', 'Cash + MoMo', 'Variance (FCFA)']],
    body: params.shifts.slice(0, 14).map((s) => [
      s.pumpCode,
      s.attendantName,
      s.grade,
      s.status,
      `${Math.round(s.litresSold).toLocaleString('en-US')} L`,
      pdfMoney(s.cashFcfa + s.mobileMoneyFcfa),
      pdfMoney(s.varianceFcfa),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.8 },
    bodyStyles: { fontSize: 7.8 },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 6;
  autoTable(doc, {
    startY: y,
    head: [['Underground Tank', 'Grade', 'Book Stock (L)', 'Last Dipstick (L)', 'Variance (L)', 'Status']],
    body: params.tanks.map((t) => [
      t.name,
      t.grade,
      `${Math.round(t.bookVolumeLitres).toLocaleString('en-US')} L`,
      `${Math.round(t.lastDipLitres).toLocaleString('en-US')} L`,
      `${t.varianceLitres > 0 ? '+' : ''}${t.varianceLitres} L`,
      t.status,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.8 },
    bodyStyles: { fontSize: 7.8 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
  });

  if (params.recentVaultEntries.length > 0) {
    y = (doc.lastAutoTable?.finalY ?? y) + 6;
    autoTable(doc, {
      startY: y,
      head: [['Ref', 'Vault Movement', 'Handed By -> Received By', 'Amount (FCFA)', 'Safe Balance']],
      body: params.recentVaultEntries.slice(0, 6).map((v) => [
        v.referenceCode,
        v.entryType,
        `${v.handedBy} -> ${v.receivedBy}`,
        pdfMoney(v.amountFcfa),
        pdfMoney(v.runningBalanceFcfa),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.8 },
      bodyStyles: { fontSize: 7.8 },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    });
  }

  drawSignatureFooter(doc, `Outgoing Station Manager (${params.managerName})`, 'Incoming Shift Supervisor / Auditor');
  doc.save(`opesfuel-manager-handover-${params.dateLabel}.pdf`);
}

/** 30. Station Manager Daily Operations Pack (.xlsx, 4 operational sheets — zero salary/P&L columns) */
export function exportManagerDailyOpsExcel(params: {
  stationName: string;
  shifts: ShiftRecord[];
  vaultEntries: CashVaultEntryItem[];
  tanks: FuelTank[];
  employees: Employee[];
}): void {
  const wb = XLSX.utils.book_new();
  const shiftRows = params.shifts.map((s) => ({
    ShiftId: s.id,
    Pump: s.pumpCode,
    Grade: s.grade,
    Attendant: s.attendantName,
    Status: s.status,
    LitresSold: s.litresSold,
    CashFcfa: s.cashFcfa,
    MoMoFcfa: s.mobileMoneyFcfa,
    CardFcfa: s.cardFcfa,
    FleetCreditFcfa: s.fleetCreditFcfa,
    VarianceFcfa: s.varianceFcfa,
  }));
  const vaultRows = params.vaultEntries.map((v) => ({
    Reference: v.referenceCode,
    Type: v.entryType,
    HandedBy: v.handedBy,
    ReceivedBy: v.receivedBy,
    AmountFcfa: v.amountFcfa,
    RunningSafeBalanceFcfa: v.runningBalanceFcfa,
    RecordedAt: v.recordedAt,
  }));
  const tankRows = params.tanks.map((t) => ({
    Tank: t.name,
    Grade: t.grade,
    CapacityLitres: t.capacityLitres,
    BookLitres: t.bookVolumeLitres,
    LastDipstickLitres: t.lastDipLitres,
    VarianceLitres: t.varianceLitres,
    Status: t.status,
  }));
  const rosterRows = params.employees.map((e) => ({
    FullName: e.fullName,
    Role: e.role,
    Phone: e.phone,
    ShiftWindow: e.shiftWindow,
    ClockedIn: e.clockedIn ? 'YES' : 'NO',
    CumulativeShiftVarianceFcfa: e.cumulativeVarianceFcfa,
  }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shiftRows.length ? shiftRows : [{ info: 'No shifts' }]), 'Forecourt Shifts');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vaultRows.length ? vaultRows : [{ info: 'No safe entries' }]), 'Cash Safe Ledger');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tankRows.length ? tankRows : [{ info: 'No tanks' }]), 'Tanks & Dipsticks');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rosterRows.length ? rosterRows : [{ info: 'No staff' }]), 'Staff Attendance');
  const slug = params.stationName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  XLSX.writeFile(wb, `opesfuel-station-ops-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
