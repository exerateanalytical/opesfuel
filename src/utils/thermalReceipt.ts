import { formatFcfa, formatLitres, gradeLabel } from '../domain/formatters';
import { FuelGrade } from '../domain/types';

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
  <title>${title}</title>
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
    <div class="center bold" style="font-size:13px;">OPESFUEL STATION OS</div>
    <div class="center">${params.stationName}</div>
    <div class="center" style="font-size:10px;">SHIFT HANDOVER RECEIPT (80mm)</div>
    <div class="hr"></div>
    <div class="row"><span>Shift ID:</span><span class="bold">${params.shiftId}</span></div>
    <div class="row"><span>Pump:</span><span class="bold">${params.pumpCode} (${gradeLabel(params.grade)})</span></div>
    <div class="row"><span>Attendant:</span><span>${params.attendantName}</span></div>
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
    <div class="center" style="margin-top:10px;font-size:9px;">Audit-Verified by OpesFuel · SYSCOHADA Ready</div>
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
    <div class="center bold" style="font-size:13px;">OPESFUEL FLEET VOUCHER</div>
    <div class="center">${params.stationName}</div>
    <div class="center" style="font-size:10px;">CORPORATE CREDIT RECEIPT (80mm)</div>
    <div class="hr"></div>
    <div class="row"><span>Voucher #:</span><span class="bold">${params.voucherId}</span></div>
    <div class="row"><span>Date:</span><span>${new Date(params.createdAt).toLocaleString()}</span></div>
    <div class="row"><span>Company:</span><span class="bold">${params.companyName}</span></div>
    <div class="row"><span>Vehicle Plate:</span><span class="bold">${params.vehiclePlate}</span></div>
    <div class="row"><span>Driver:</span><span>${params.driverName}</span></div>
    <div class="hr"></div>
    <div class="row"><span>Fuel Grade:</span><span>${gradeLabel(params.grade)}</span></div>
    <div class="row bold"><span>Volume:</span><span>${formatLitres(params.litres)}</span></div>
    <div class="row bold" style="font-size:13px;"><span>Total Billed:</span><span>${formatFcfa(params.amountFcfa)}</span></div>
    <div class="hr"></div>
    <div class="sig">Driver Signature: __________________________</div>
    <div class="sig">Attendant Initials: ________________________</div>
    <div class="center" style="margin-top:10px;font-size:9px;">Posted to Corporate Statement · OpesFuel</div>
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
    <div class="center bold" style="font-size:13px;">OPESFUEL SHOP POS</div>
    <div class="center">${params.stationName}</div>
    <div class="center" style="font-size:10px;">LUBRICANT &amp; SHOP RECEIPT (80mm)</div>
    <div class="hr"></div>
    <div class="row"><span>Date:</span><span>${new Date().toLocaleString()}</span></div>
    <div class="row"><span>SKU:</span><span class="bold">${params.sku}</span></div>
    <div class="row"><span>Item:</span><span>${params.itemName}</span></div>
    <div class="row"><span>Qty x Price:</span><span>${params.quantity} x ${formatFcfa(params.unitPriceFcfa)}</span></div>
    <div class="hr"></div>
    <div class="row bold" style="font-size:13px;"><span>TOTAL PAID:</span><span>${formatFcfa(total)}</span></div>
    <div class="row"><span>Tender:</span><span>${params.paymentMethod}</span></div>
    <div class="hr"></div>
    <div class="center" style="margin-top:10px;font-size:9px;">Thank you for fueling with us · OpesFuel</div>
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
    <div class="center bold" style="font-size:13px;">OPESFUEL SERVICE BAY</div>
    <div class="center">${params.stationName}</div>
    <div class="center" style="font-size:10px;">CAR WASH &amp; LUBE PIT RECEIPT (80mm)</div>
    <div class="hr"></div>
    <div class="row"><span>Ticket #:</span><span class="bold">${params.ticketId}</span></div>
    <div class="row"><span>Date:</span><span>${new Date().toLocaleString()}</span></div>
    <div class="row"><span>Service:</span><span class="bold">${params.serviceCategory.replace(/_/g, ' ')}</span></div>
    <div class="row"><span>Vehicle:</span><span class="bold">${params.vehiclePlate}</span></div>
    <div class="row"><span>Customer:</span><span>${params.customerName}</span></div>
    <div class="row"><span>Technician:</span><span>${params.technicianName}</span></div>
    <div class="hr"></div>
    <div class="row bold" style="font-size:13px;"><span>TOTAL PAID:</span><span>${formatFcfa(params.amountFcfa)}</span></div>
    <div class="row"><span>Tender:</span><span>${params.paymentMethod}</span></div>
    <div class="hr"></div>
    <div class="center" style="margin-top:10px;font-size:9px;">Posted to Ancillary Revenue · OpesFuel</div>
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
    <div class="center bold" style="font-size:13px;">OPESFUEL PREPAID VOUCHER</div>
    <div class="center">${params.stationName}</div>
    <div class="center" style="font-size:10px;">LOYALTY &amp; FUEL CREDIT SLIP (80mm)</div>
    <div class="hr"></div>
    <div class="center bold" style="font-size:16px;letter-spacing:2px;margin:6px 0;">${params.voucherCode}</div>
    <div class="hr"></div>
    <div class="row"><span>Holder:</span><span class="bold">${params.customerName}</span></div>
    <div class="row"><span>Original Value:</span><span>${formatFcfa(params.issuedFcfa)}</span></div>
    <div class="row bold" style="font-size:13px;"><span>Remaining Bal:</span><span>${formatFcfa(params.balanceFcfa)}</span></div>
    <div class="row"><span>Loyalty Points:</span><span class="bold">${params.loyaltyPoints} pts</span></div>
    <div class="hr"></div>
    <div class="center" style="margin-top:10px;font-size:9px;">Present code at any OpesFuel pump island</div>
  `;
  openThermalPrintWindow(`Fuel Voucher ${params.voucherCode}`, body);
}

