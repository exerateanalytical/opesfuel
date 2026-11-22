import { formatFcfa, formatLitres, gradeLabel } from '../domain/formatters';
import { FuelGrade } from '../domain/types';
import { getCompanyBranding } from './companyBranding';

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildBrandedThermalHeader(stationName: string, receiptType: string): string {
  const b = getCompanyBranding();
  const logoHtml = b.logoDataUrl
    ? `<div class="center" style="margin-bottom:6px;"><img src="${b.logoDataUrl}" alt="Logo" style="max-height:44px;max-width:160px;object-fit:contain;filter:grayscale(100%) contrast(130%);" /></div>`
    : '';
  const legalMeta = [
    b.taxIdNiu ? `NIU: ${escapeHtml(b.taxIdNiu)}` : '',
    b.rccmNumber ? `RCCM: ${escapeHtml(b.rccmNumber)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return `
    ${logoHtml}
    <div class="center bold" style="font-size:13px;">${escapeHtml(b.legalName || 'OpesFuel Station')}</div>
    <div class="center" style="font-size:10px;">${escapeHtml(stationName)}</div>
    ${b.address || b.city ? `<div class="center" style="font-size:9px;">${escapeHtml([b.address, b.city].filter(Boolean).join(', '))}</div>` : ''}
    ${b.phone ? `<div class="center" style="font-size:9px;">Tel: ${escapeHtml(b.phone)}</div>` : ''}
    ${legalMeta ? `<div class="center" style="font-size:9px;">${legalMeta}</div>` : ''}
    ${b.receiptHeaderNote ? `<div class="center" style="font-size:9px;margin-top:2px;">${escapeHtml(b.receiptHeaderNote)}</div>` : ''}
    <div class="center bold" style="font-size:10px;margin-top:4px;">${escapeHtml(receiptType)}</div>
  `;
}

function buildBrandedThermalFooter(): string {
  const b = getCompanyBranding();
  return `
    <div class="center" style="margin-top:10px;font-size:9px;">${escapeHtml(b.receiptFooterNote || 'Thank you for fueling with us!')}</div>
    ${b.website ? `<div class="center" style="font-size:9px;">${escapeHtml(b.website)}</div>` : ''}
  `;
}

function openThermalPrintWindow(title: string, htmlBody: string): void {
  const win = window.open('', '_blank', 'width=360,height=640');
  if (!win) {
    window.print();
    return;
  }
  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body {
      font-family: "IBM Plex Mono", ui-monospace, Menlo, monospace;
      width: 72mm;
      margin: 0 auto;
      color: #0f172a;
      font-size: 11px;
      line-height: 1.45;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .hr { border-top: 1px dashed #334155; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .sig { margin-top: 18px; border-top: 1px solid #475569; padding-top: 4px; font-size: 10px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  ${htmlBody}
  <div class="no-print" style="margin-top:16px;text-align:center;">
    <button onclick="window.print()" style="padding:8px 14px;background:#0f172a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
      Print 80mm Receipt
    </button>
  </div>
</body>
</html>`);
  win.document.close();
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // user may print manually
    }
  }, 250);
}

export function printBrandedSampleThermalReceipt(stationName: string): void {
  const b = getCompanyBranding();
  const body = `
    ${buildBrandedThermalHeader(stationName, `${b.receiptPrefix || 'RCP-'}SAMPLE TEST RECEIPT (80mm)`)}
    <div class="hr"></div>
    <div class="row"><span>Receipt #:</span><span class="bold">${escapeHtml(b.receiptPrefix || 'RCP-')}2026-0001</span></div>
    <div class="row"><span>Date:</span><span>${new Date().toLocaleString()}</span></div>
    <div class="row"><span>Pump:</span><span>P01 — Super Unleaded</span></div>
    <div class="row"><span>Volume:</span><span class="bold">35.0 L x 840</span></div>
    <div class="hr"></div>
    <div class="row bold" style="font-size:13px;"><span>TOTAL (${escapeHtml(b.defaultCurrency)}):</span><span>29 400 ${escapeHtml(b.defaultCurrency)}</span></div>
    <div class="row"><span>VAT (${b.vatRatePct}%):</span><span>Included</span></div>
    <div class="row"><span>Payment:</span><span>CASH</span></div>
    <div class="hr"></div>
    ${buildBrandedThermalFooter()}
  `;
  openThermalPrintWindow(`Sample Branded 80mm Receipt`, body);
}

export function printShiftThermalSlip(params: {
  stationName: string;
  shiftId: string;
  pumpCode: string;
  grade: FuelGrade;
  attendantName: string;
  openingMeter: number;
  closingMeter: number;
  litresDispensed: number;
  unitPriceFcfa: number;
  expectedFcfa: number;
  cashFcfa: number;
  mobileMoneyFcfa: number;
  cardFcfa: number;
  fleetCreditFcfa: number;
  varianceFcfa: number;
  closedAt: string;
}): void {
  const body = `
    ${buildBrandedThermalHeader(params.stationName, 'SHIFT HANDOVER RECEIPT (80mm)')}
    <div class="hr"></div>
    <div class="row"><span>Shift ID:</span><span class="bold">${escapeHtml(params.shiftId)}</span></div>
    <div class="row"><span>Pump:</span><span class="bold">${escapeHtml(params.pumpCode)} (${escapeHtml(gradeLabel(params.grade))})</span></div>
    <div class="row"><span>Attendant:</span><span>${escapeHtml(params.attendantName)}</span></div>
    <div class="row"><span>Closed:</span><span>${new Date(params.closedAt).toLocaleString()}</span></div>
    <div class="hr"></div>
    <div class="row"><span>Opening Meter:</span><span>${formatLitres(params.openingMeter)}</span></div>
    <div class="row"><span>Closing Meter:</span><span>${formatLitres(params.closingMeter)}</span></div>
    <div class="row bold"><span>Litres Sold:</span><span>${formatLitres(params.litresDispensed)}</span></div>
    <div class="row"><span>Unit Price:</span><span>${formatFcfa(params.unitPriceFcfa)}/L</span></div>
    <div class="row bold"><span>Expected Sales:</span><span>${formatFcfa(params.expectedFcfa)}</span></div>
    <div class="hr"></div>
    <div class="row"><span>Cash Handed Over:</span><span>${formatFcfa(params.cashFcfa)}</span></div>
    <div class="row"><span>Orange/MTN MoMo:</span><span>${formatFcfa(params.mobileMoneyFcfa)}</span></div>
    <div class="row"><span>Bank Card POS:</span><span>${formatFcfa(params.cardFcfa)}</span></div>
    <div class="row"><span>Fleet Vouchers:</span><span>${formatFcfa(params.fleetCreditFcfa)}</span></div>
    <div class="hr"></div>
    <div class="row bold"><span>Shift Variance:</span><span>${formatFcfa(params.varianceFcfa)}</span></div>
    <div class="sig">Attendant Signature: _______________________</div>
    <div class="sig">Manager Verification: ______________________</div>
    ${buildBrandedThermalFooter()}
  `;
  openThermalPrintWindow(`Shift Slip ${params.shiftId}`, body);
}

export function printFleetVoucherSlip(params: {
  stationName: string;
  voucherId: string;
  companyName: string;
  vehiclePlate: string;
  driverName: string;
  grade: FuelGrade;
  litres: number;
  amountFcfa: number;
  createdAt: string;
}): void {
  const body = `
    ${buildBrandedThermalHeader(params.stationName, 'CORPORATE FLEET VOUCHER (80mm)')}
    <div class="hr"></div>
    <div class="row"><span>Voucher #:</span><span class="bold">${escapeHtml(params.voucherId)}</span></div>
    <div class="row"><span>Date:</span><span>${new Date(params.createdAt).toLocaleString()}</span></div>
    <div class="row"><span>Company:</span><span class="bold">${escapeHtml(params.companyName)}</span></div>
    <div class="row"><span>Vehicle Plate:</span><span class="bold">${escapeHtml(params.vehiclePlate)}</span></div>
    <div class="row"><span>Driver:</span><span>${escapeHtml(params.driverName)}</span></div>
    <div class="hr"></div>
    <div class="row"><span>Fuel Grade:</span><span>${escapeHtml(gradeLabel(params.grade))}</span></div>
    <div class="row bold"><span>Volume:</span><span>${formatLitres(params.litres)}</span></div>
    <div class="row bold" style="font-size:13px;"><span>Total Billed:</span><span>${formatFcfa(params.amountFcfa)}</span></div>
    <div class="hr"></div>
    <div class="sig">Driver Signature: __________________________</div>
    <div class="sig">Attendant Initials: ________________________</div>
    ${buildBrandedThermalFooter()}
  `;
  openThermalPrintWindow(`Fleet Voucher ${params.voucherId}`, body);
}

export function printShopPosThermalSlip(params: {
  stationName: string;
  sku: string;
  itemName: string;
  quantity: number;
  unitPriceFcfa: number;
  paymentMethod: string;
}): void {
  const total = params.quantity * params.unitPriceFcfa;
  const body = `
    ${buildBrandedThermalHeader(params.stationName, 'LUBRICANT & SHOP RECEIPT (80mm)')}
    <div class="hr"></div>
    <div class="row"><span>Date:</span><span>${new Date().toLocaleString()}</span></div>
    <div class="row"><span>SKU:</span><span class="bold">${escapeHtml(params.sku)}</span></div>
    <div class="row"><span>Item:</span><span>${escapeHtml(params.itemName)}</span></div>
    <div class="row"><span>Qty x Price:</span><span>${params.quantity} x ${formatFcfa(params.unitPriceFcfa)}</span></div>
    <div class="hr"></div>
    <div class="row bold" style="font-size:13px;"><span>TOTAL PAID:</span><span>${formatFcfa(total)}</span></div>
    <div class="row"><span>Tender:</span><span>${escapeHtml(params.paymentMethod)}</span></div>
    <div class="hr"></div>
    ${buildBrandedThermalFooter()}
  `;
  openThermalPrintWindow(`Shop Receipt ${params.sku}`, body);
}

export function printServiceBayThermalSlip(params: {
  stationName: string;
  ticketId: string;
  serviceCategory: string;
  vehiclePlate: string;
  customerName: string;
  technicianName: string;
  amountFcfa: number;
  paymentMethod: string;
}): void {
  const body = `
    ${buildBrandedThermalHeader(params.stationName, 'CAR WASH & LUBE PIT RECEIPT (80mm)')}
    <div class="hr"></div>
    <div class="row"><span>Ticket #:</span><span class="bold">${escapeHtml(params.ticketId)}</span></div>
    <div class="row"><span>Date:</span><span>${new Date().toLocaleString()}</span></div>
    <div class="row"><span>Service:</span><span class="bold">${escapeHtml(params.serviceCategory.replace(/_/g, ' '))}</span></div>
    <div class="row"><span>Vehicle:</span><span class="bold">${escapeHtml(params.vehiclePlate)}</span></div>
    <div class="row"><span>Customer:</span><span>${escapeHtml(params.customerName)}</span></div>
    <div class="row"><span>Technician:</span><span>${escapeHtml(params.technicianName)}</span></div>
    <div class="hr"></div>
    <div class="row bold" style="font-size:13px;"><span>TOTAL PAID:</span><span>${formatFcfa(params.amountFcfa)}</span></div>
    <div class="row"><span>Tender:</span><span>${escapeHtml(params.paymentMethod)}</span></div>
    <div class="hr"></div>
    ${buildBrandedThermalFooter()}
  `;
  openThermalPrintWindow(`Service Bay ${params.ticketId}`, body);
}

export function printPrepaidVoucherThermalSlip(params: {
  stationName: string;
  voucherCode: string;
  customerName: string;
  issuedFcfa: number;
  balanceFcfa: number;
  loyaltyPoints: number;
}): void {
  const body = `
    ${buildBrandedThermalHeader(params.stationName, 'LOYALTY & PREPAID FUEL SLIP (80mm)')}
    <div class="hr"></div>
    <div class="center bold" style="font-size:16px;letter-spacing:2px;margin:6px 0;">${escapeHtml(params.voucherCode)}</div>
    <div class="hr"></div>
    <div class="row"><span>Holder:</span><span class="bold">${escapeHtml(params.customerName)}</span></div>
    <div class="row"><span>Original Value:</span><span>${formatFcfa(params.issuedFcfa)}</span></div>
    <div class="row bold" style="font-size:13px;"><span>Remaining Bal:</span><span>${formatFcfa(params.balanceFcfa)}</span></div>
    <div class="row"><span>Loyalty Points:</span><span class="bold">${params.loyaltyPoints} pts</span></div>
    <div class="hr"></div>
    ${buildBrandedThermalFooter()}
  `;
  openThermalPrintWindow(`Fuel Voucher ${params.voucherCode}`, body);
}

export function printThermalReceipt(params: {
  title: string;
  stationName: string;
  receiptNo: string;
  dateIso: string;
  customerName?: string;
  lines: Array<{ label: string; amountFcfa: number }>;
  totalFcfa: number;
  footerNote?: string;
}): void {
  const rowsHtml = params.lines
    .map(
      (l) =>
        `<div class="row"><span>${escapeHtml(l.label)}</span><span class="bold">${escapeHtml(formatFcfa(l.amountFcfa))}</span></div>`
    )
    .join('');
  const body = `
    ${buildBrandedThermalHeader(params.stationName, params.title)}
    <div class="hr"></div>
    <div class="row"><span>Receipt #:</span><span class="bold">${escapeHtml(params.receiptNo)}</span></div>
    <div class="row"><span>Date:</span><span>${escapeHtml(params.dateIso.slice(0, 16).replace('T', ' '))}</span></div>
    ${params.customerName ? `<div class="row"><span>Customer:</span><span>${escapeHtml(params.customerName)}</span></div>` : ''}
    <div class="hr"></div>
    ${rowsHtml}
    <div class="hr"></div>
    <div class="row bold" style="font-size:12px;"><span>TOTAL</span><span>${escapeHtml(formatFcfa(params.totalFcfa))}</span></div>
    ${params.footerNote ? `<div class="center" style="margin-top:8px;font-size:9px;">${escapeHtml(params.footerNote)}</div>` : ''}
    ${buildBrandedThermalFooter()}
  `;
  openThermalPrintWindow(`${params.title} ${params.receiptNo}`, body);
}

export function printCustomerFuelThermalReceipt(params: {
  stationName: string;
  pumpCode: string;
  grade: string;
  litres: number;
  unitPriceFcfa: number;
  paymentMethod: 'CASH' | 'MOBILE_MONEY' | 'CARD';
  attendantName: string;
  vehiclePlate?: string;
}): void {
  const grossFcfa = Math.round(params.litres * params.unitPriceFcfa);
  const netExVatFcfa = Math.round(grossFcfa / 1.1925);
  const vatFcfa = grossFcfa - netExVatFcfa;
  const ref = `FUEL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const body = `
    ${buildBrandedThermalHeader(params.stationName, 'RETAIL FUEL TAX RECEIPT (80mm)')}
    <div class="hr"></div>
    <div class="row"><span>Receipt #:</span><span class="bold">${ref}</span></div>
    <div class="row"><span>Date:</span><span>${new Date().toLocaleString()}</span></div>
    <div class="row"><span>Pump / Grade:</span><span class="bold">${escapeHtml(params.pumpCode)} · ${escapeHtml(params.grade)}</span></div>
    <div class="row"><span>Attendant:</span><span>${escapeHtml(params.attendantName)}</span></div>
    ${params.vehiclePlate ? `<div class="row"><span>Vehicle Plate:</span><span class="bold">${escapeHtml(params.vehiclePlate.toUpperCase())}</span></div>` : ''}
    <div class="hr"></div>
    <div class="row"><span>Volume Dispensed:</span><span class="bold">${params.litres.toFixed(2)} L</span></div>
    <div class="row"><span>Unit Tariff:</span><span>${formatFcfa(params.unitPriceFcfa)} / L</span></div>
    <div class="row"><span>Subtotal (Excl. TVA):</span><span>${formatFcfa(netExVatFcfa)}</span></div>
    <div class="row"><span>TVA (19.25%):</span><span>${formatFcfa(vatFcfa)}</span></div>
    <div class="hr"></div>
    <div class="row bold" style="font-size:13px;"><span>TOTAL PAID:</span><span>${formatFcfa(grossFcfa)}</span></div>
    <div class="row"><span>Payment Tender:</span><span class="bold">${escapeHtml(params.paymentMethod)}</span></div>
    <div class="hr"></div>
    <div class="center" style="font-size:9px;">Thank you for fueling with us · Verify Ref ${ref}</div>
    ${buildBrandedThermalFooter()}
  `;
  openThermalPrintWindow(`Fuel Receipt ${ref}`, body);
}
