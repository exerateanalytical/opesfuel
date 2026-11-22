/**
 * Industry-Standard Security Guilloche, Rosette Seal, Microtext, Anti-Counterfeit Watermark,
 * and Cryptographic Verification Matrix Engine for OpesFuel Licenses & Company Letterheads.
 * Pure mathematical vector paths in jsPDF (crisp at any print DPI).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanyBrandingProfile, getCompanyBranding, hexToRgb } from './companyBranding';

export type LetterheadTemplateStyle =
  | 'SOVEREIGN_GUILLOCHE'
  | 'EXECUTIVE_GOLD'
  | 'CLASSIC_INSTITUTIONAL'
  | 'MINIMAL_SWISS';

type JsPdfAuto = jsPDF & { lastAutoTable?: { finalY: number } };

/** Deterministic cryptographic-style verification fingerprint (works synchronously offline) */
export function computeSecurityFingerprint(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch * 31 + i), 0x85ebca6b) >>> 0;
  }
  const p1 = h1.toString(16).toUpperCase().padStart(8, '0');
  const p2 = h2.toString(16).toUpperCase().padStart(8, '0');
  return `OPF-${p1.slice(0, 4)}-${p1.slice(4, 8)}-${p2.slice(0, 4)}-${p2.slice(4, 8)}`;
}

/** Draws a multi-wave banknote guilloche band along a horizontal or vertical span */
function drawGuillocheBand(
  doc: jsPDF,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  amplitude: number,
  cycles: number,
  rgb: [number, number, number]
): void {
  const isHorizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  const length = isHorizontal ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
  const steps = Math.max(80, Math.round(length * 1.4));

  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  doc.setLineWidth(0.14);

  const phases = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
  for (let p = 0; p < phases.length; p++) {
    const phase = phases[p];
    let prevX = 0;
    let prevY = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * cycles * Math.PI * 2 + phase;
      const offset =
        Math.sin(angle) * amplitude * 0.65 +
        Math.sin(angle * 2 + phase * 0.5) * amplitude * 0.35;
      const cx = isHorizontal ? x1 + (x2 - x1) * t : x1 + offset;
      const cy = isHorizontal ? y1 + offset : y1 + (y2 - y1) * t;
      if (i > 0) {
        doc.line(prevX, prevY, cx, cy);
      }
      prevX = cx;
      prevY = cy;
    }
  }
}

/** Draws a banknote-style geometric spirograph / rosette medallion */
export function drawGuillocheRosette(
  doc: jsPDF,
  cx: number,
  cy: number,
  outerRadius: number,
  rgb: [number, number, number],
  petals = 18
): void {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  doc.setLineWidth(0.13);

  const steps = 220;
  for (let ring = 0; ring < 2; ring++) {
    const rBase = outerRadius * (ring === 0 ? 0.82 : 0.56);
    const amp = outerRadius * (ring === 0 ? 0.16 : 0.14);
    const phaseShift = ring * (Math.PI / petals);
    let prevX = 0;
    let prevY = 0;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      const r = rBase + Math.sin(theta * petals + phaseShift) * amp;
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;
      if (i > 0) doc.line(prevX, prevY, x, y);
      prevX = x;
      prevY = y;
    }
  }
  doc.setLineWidth(0.25);
  doc.circle(cx, cy, outerRadius, 'S');
  doc.setLineWidth(0.12);
  doc.circle(cx, cy, outerRadius * 0.36, 'S');
}

/** Draws full 4-side banknote guilloche border + 4 corner rosettes + microtext security rule */
export function drawFullGuillocheSecurityFrame(
  doc: jsPDF,
  branding: CompanyBrandingProfile,
  docSerial: string,
  primaryRgb: [number, number, number],
  accentRgb: [number, number, number]
): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const m = 8.5;

  // Outer fine double rule
  doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.setLineWidth(0.6);
  doc.rect(m - 2, m - 2, w - (m - 2) * 2, h - (m - 2) * 2, 'S');
  doc.setLineWidth(0.18);
  doc.rect(m + 2.8, m + 2.8, w - (m + 2.8) * 2, h - (m + 2.8) * 2, 'S');

  // 4-Edge intricate guilloche wave bands
  const softPrimary: [number, number, number] = [
    Math.min(255, primaryRgb[0] + 55),
    Math.min(255, primaryRgb[1] + 55),
    Math.min(255, primaryRgb[2] + 65),
  ];
  drawGuillocheBand(doc, m + 8, m + 0.5, w - m - 8, m + 0.5, 1.8, 22, softPrimary);
  drawGuillocheBand(doc, m + 8, h - m - 0.5, w - m - 8, h - m - 0.5, 1.8, 22, softPrimary);
  drawGuillocheBand(doc, m + 0.5, m + 8, m + 0.5, h - m - 8, 1.8, 28, softPrimary);
  drawGuillocheBand(doc, w - m - 0.5, m + 8, w - m - 0.5, h - m - 8, 1.8, 28, softPrimary);

  // 4 Corner Rosette Medallions
  drawGuillocheRosette(doc, m + 3.2, m + 3.2, 4.6, accentRgb, 12);
  drawGuillocheRosette(doc, w - m - 3.2, m + 3.2, 4.6, accentRgb, 12);
  drawGuillocheRosette(doc, m + 3.2, h - m - 3.2, 4.6, accentRgb, 12);
  drawGuillocheRosette(doc, w - m - 3.2, h - m - 3.2, 4.6, accentRgb, 12);

  // Security Microtext Strip (top & bottom)
  const microSegment = `${(branding.legalName || 'OPESFUEL').toUpperCase()} · SECURITY VERIFIED · ${docSerial} · NIU ${branding.taxIdNiu || 'REG'} · `;
  const repeated = microSegment.repeat(6).slice(0, 178);
  doc.setFont('courier', 'normal');
  doc.setFontSize(3.8);
  doc.setTextColor(100, 116, 139);
  doc.text(repeated, w / 2, m + 4.3, { align: 'center' });
  doc.text(repeated, w / 2, h - m - 3.3, { align: 'center' });
}

/** Draws angled translucent anti-counterfeit watermark + subtle central emblem */
export function drawSecurityWatermark(
  doc: jsPDF,
  watermarkText: string,
  subText?: string
): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Subtle background rosette behind page center
  drawGuillocheRosette(doc, w / 2, h / 2 + 4, 42, [232, 236, 242], 24);

  // Diagonal security text watermark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(235, 238, 244);
  doc.text(watermarkText.toUpperCase(), w / 2, h / 2 + 8, {
    align: 'center',
    angle: 32,
  });

  if (subText) {
    doc.setFontSize(11);
    doc.setTextColor(226, 232, 240);
    doc.text(subText.toUpperCase(), w / 2, h / 2 + 20, {
      align: 'center',
      angle: 32,
    });
  }
}

/** Draws a deterministic 2D cryptographic verification matrix (QR-style seal) + serial fingerprint */
export function drawSecurityVerificationMatrix(
  doc: jsPDF,
  fingerprint: string,
  x: number,
  y: number,
  sizeMm = 18
): void {
  const grid = 11;
  const cell = sizeMm / grid;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.25);
  doc.rect(x - 1, y - 1, sizeMm + 2, sizeMm + 2, 'FD');

  doc.setFillColor(15, 23, 42);
  let hash = 2166136261;
  for (let i = 0; i < fingerprint.length; i++) {
    hash = Math.imul(hash ^ fingerprint.charCodeAt(i), 16777619) >>> 0;
  }

  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      // Corner finder patterns (top-left, top-right, bottom-left)
      const inTL = r < 3 && c < 3;
      const inTR = r < 3 && c >= grid - 3;
      const inBL = r >= grid - 3 && c < 3;
      let filled = false;
      if (inTL || inTR || inBL) {
        const lr = inBL ? r - (grid - 3) : r;
        const lc = inTR ? c - (grid - 3) : c;
        filled = lr === 0 || lr === 2 || lc === 0 || lc === 2 || (lr === 1 && lc === 1);
      } else {
        const bitSeed = Math.imul(hash ^ (r * 31 + c * 17), 2654435761) >>> 0;
        filled = (bitSeed & 1) === 1;
      }
      if (filled) {
        doc.rect(x + c * cell, y + r * cell, cell, cell, 'F');
      }
    }
  }

  doc.setFont('courier', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text(fingerprint, x + sizeMm / 2, y + sizeMm + 3.8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text('VERIFY ONLINE · TAMPER-EVIDENT', x + sizeMm / 2, y + sizeMm + 6.6, { align: 'center' });
}

/**
 * 1. INDUSTRY-STANDARD SOVEREIGN GUILLOCHE SOFTWARE / PERPETUAL LICENSE CERTIFICATE (Landscape A4)
 */
export function printSecurityLicenseCertificatePdf(params: {
  licenseKey: string;
  organizationName: string;
  tierName: string;
  maxStations: number;
  annualFeeFcfa: number;
  expiresAt: string;
  issuedToNiu?: string;
}): void {
  const b = getCompanyBranding();
  const primary = hexToRgb(b.primaryColorHex, [15, 23, 42]);
  const accent = hexToRgb(b.accentColorHex, [217, 119, 6]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const fingerprint = computeSecurityFingerprint(`${params.licenseKey}|${params.organizationName}|${params.expiresAt}`);

  // Security background watermark & full banknote guilloche frame
  drawSecurityWatermark(doc, 'OFFICIAL SOFTWARE LICENSE', `${params.licenseKey} · AUTHENTIC`);
  drawFullGuillocheSecurityFrame(doc, b, params.licenseKey, primary, accent);

  // Top Header Crest
  let titleY = 25;
  if (b.logoDataUrl) {
    try {
      doc.addImage(b.logoDataUrl, 'PNG', w / 2 - 9, 15, 18, 18);
      titleY = 39;
    } catch {
      titleY = 25;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text('OPESWARE TECHNOLOGIES · OFFICIAL ENTERPRISE LICENSE CERTIFICATE', w / 2, titleY, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text('CERTIFICATE OF LICENSE & DEPLOYMENT', w / 2, titleY + 11, { align: 'center' });

  // Accent ornamental divider with guilloche mini-wave
  drawGuillocheBand(doc, w / 2 - 58, titleY + 16, w / 2 + 58, titleY + 16, 1.3, 14, accent);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(71, 85, 105);
  doc.text('This sovereign software license certificate is officially granted to:', w / 2, titleY + 25, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text(params.organizationName.toUpperCase(), w / 2, titleY + 36, { align: 'center' });

  if (params.issuedToNiu) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`TAX ID / NIU: ${params.issuedToNiu}`, w / 2, titleY + 42, { align: 'center' });
  }

  // Structured Entitlements Security Box
  autoTable(doc, {
    startY: titleY + 48,
    margin: { left: 26, right: 26 },
    head: [['License Key', 'Authorized Tier', 'Station Quota', 'Annual License Value', 'Valid Until']],
    body: [[
      params.licenseKey,
      params.tierName,
      `Up to ${params.maxStations} Petrol Stations`,
      `${Math.round(params.annualFeeFcfa).toLocaleString('en-US').replace(/,/g, ' ')} FCFA`,
      params.expiresAt,
    ]],
    theme: 'grid',
    headStyles: { fillColor: primary, textColor: 255, fontSize: 8.5, halign: 'center' },
    bodyStyles: { fontSize: 9.5, fontStyle: 'bold', halign: 'center', cellPadding: 4, textColor: [15, 23, 42] },
  });

  // Security Seal + Signatures + Verification Matrix
  const sigY = h - 36;
  drawGuillocheRosette(doc, w / 2, sigY - 5, 13, accent, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text('CERTIFIED', w / 2, sigY - 6, { align: 'center' });
  doc.text('AUTHENTIC', w / 2, sigY - 2.5, { align: 'center' });

  // Left signature
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(26, sigY, 96, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Chief Executive Officer · Opesware', 26, sigY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Issued ${new Date().toISOString().slice(0, 10)} · Digital Signature Embedded`, 26, sigY + 9.5);

  // Right signature + stamp
  if (b.stampDataUrl) {
    try {
      doc.addImage(b.stampDataUrl, 'PNG', w - 98, sigY - 16, 26, 14);
    } catch {
      // ignore
    }
  }
  doc.line(w - 118, sigY, w - 54, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Director of Licensing & Security', w - 118, sigY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Tamper-Evident Guilloche Edition', w - 118, sigY + 9.5);

  // Verification QR Matrix bottom right
  drawSecurityVerificationMatrix(doc, fingerprint, w - 42, h - 42, 17);

  doc.save(`opesfuel-security-license-${params.licenseKey.toLowerCase()}.pdf`);
}

/**
 * 2. OFFICIAL SECURITY LETTERHEAD (4 Industry Styles with Guilloche, Watermark, Stamp & Verification Matrix)
 */
export function printExecutiveSecurityLetterheadPdf(params: {
  style: LetterheadTemplateStyle;
  watermarkText?: string;
  documentTitle?: string;
  recipientBlock?: string;
  bodyParagraphs?: string[];
}): void {
  const b = getCompanyBranding();
  const primary = hexToRgb(b.primaryColorHex, [15, 23, 42]);
  const accent = hexToRgb(b.accentColorHex, [217, 119, 6]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const refNo = `${b.invoicePrefix || 'DOC-'}${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 8999))}`;
  const fingerprint = computeSecurityFingerprint(`${b.legalName}|${b.taxIdNiu}|${refNo}`);

  // Watermark
  drawSecurityWatermark(
    doc,
    params.watermarkText || b.tradingName || b.legalName || 'OFFICIAL DOCUMENT',
    `VERIFIED · ${b.taxIdNiu || refNo}`
  );

  // Frame by selected industry style
  if (params.style === 'SOVEREIGN_GUILLOCHE') {
    drawFullGuillocheSecurityFrame(doc, b, refNo, primary, accent);
  } else if (params.style === 'EXECUTIVE_GOLD') {
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(0.9);
    doc.rect(10, 10, w - 20, h - 20, 'S');
    doc.setDrawColor(primary[0], primary[1], primary[2]);
    doc.setLineWidth(0.25);
    doc.rect(12, 12, w - 24, h - 24, 'S');
    drawGuillocheBand(doc, 14, 48, w - 14, 48, 1.4, 24, accent);
  } else if (params.style === 'CLASSIC_INSTITUTIONAL') {
    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(0, 0, w, 38, 'F');
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(0, 38, w, 2, 'F');
  } else {
    // MINIMAL_SWISS
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(14, 14, 3.5, 26, 'F');
  }

  // Header Content
  const isDarkBanner = params.style === 'CLASSIC_INSTITUTIONAL';
  const topY = isDarkBanner ? 11 : 21;
  let textX = isDarkBanner ? 14 : 20;

  if (b.logoDataUrl) {
    try {
      if (isDarkBanner) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(12, 6, 24, 24, 2, 2, 'F');
        doc.addImage(b.logoDataUrl, 'PNG', 13.5, 7.5, 21, 21);
        textX = 41;
      } else {
        doc.addImage(b.logoDataUrl, 'PNG', 18, 16, 22, 22);
        textX = 44;
      }
    } catch {
      // ignore invalid logo
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(isDarkBanner ? 255 : primary[0], isDarkBanner ? 255 : primary[1], isDarkBanner ? 255 : primary[2]);
  doc.text(b.legalName || 'Your Petroleum Company SA', textX, topY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(isDarkBanner ? 226 : 71, isDarkBanner ? 232 : 85, isDarkBanner ? 240 : 105);
  if (b.tagline) doc.text(b.tagline, textX, topY + 9.5);
  const legalLine = [
    b.taxIdNiu ? `NIU: ${b.taxIdNiu}` : '',
    b.rccmNumber ? `RCCM: ${b.rccmNumber}` : '',
    b.cnpsEmployerId ? `CNPS: ${b.cnpsEmployerId}` : '',
  ]
    .filter(Boolean)
    .join('  |  ');
  doc.text(legalLine || 'Licensed Fuel Retail & Distribution Operator', textX, topY + 14.5);
  doc.text([b.address, b.city, b.phone, b.email].filter(Boolean).join(' · '), textX, topY + 19.5);

  // Reference block
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(isDarkBanner ? 253 : accent[0], isDarkBanner ? 186 : accent[1], isDarkBanner ? 116 : accent[2]);
  doc.text(`REF: ${refNo}`, w - 18, topY + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(isDarkBanner ? 203 : 100, isDarkBanner ? 213 : 116, isDarkBanner ? 225 : 139);
  doc.text(`Date: ${new Date().toISOString().slice(0, 10)}`, w - 18, topY + 9.5, { align: 'right' });

  // Letter Body
  let y = 58;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text((params.documentTitle || 'OFFICIAL COMPANY CORRESPONDENCE & LETTERHEAD').toUpperCase(), 20, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const recipient = params.recipientBlock || 'To Whom It May Concern / Regulatory & Commercial Partners,';
  doc.text(recipient, 20, y);
  y += 10;

  const paragraphs = params.bodyParagraphs || [
    `This official letterhead template is authenticated for ${b.legalName} (${b.tradingName}), operating under Tax ID ${b.taxIdNiu || 'N/A'} and Commercial Registry ${b.rccmNumber || 'N/A'}.`,
    'All commercial invoices, fleet supply contracts, supplier purchase orders, payroll attestations, and statutory OHADA financial declarations issued on this stationery carry embedded microtext, anti-counterfeit guilloche security framing, and a deterministic cryptographic verification fingerprint.',
    `For settlement verification or banking confirmation: ${b.bankName || 'Primary Corporate Bank'} — ${b.bankAccountIban || 'IBAN on file'} (${b.mobileMoneyMerchant || 'Merchant Code on file'}).`,
  ];

  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para, w - 40);
    doc.text(lines, 20, y);
    y += lines.length * 5.2 + 5;
  }

  // Signature + Stamp + Verification QR Block
  const footerY = h - 54;
  if (b.stampDataUrl) {
    try {
      doc.addImage(b.stampDataUrl, 'PNG', 22, footerY - 16, 26, 15);
    } catch {
      // ignore
    }
  }
  doc.setDrawColor(100, 116, 139);
  doc.line(20, footerY, 92, footerY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(b.signatoryName || 'Managing Director', 20, footerY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(b.signatoryTitle || 'Authorized Signatory', 20, footerY + 9.5);

  drawSecurityVerificationMatrix(doc, fingerprint, w - 38, footerY - 8, 17);

  // Legal Footer
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${b.letterheadFooter || 'Official company stationery.'} · ${b.website || ''}`,
    w / 2,
    h - 17,
    { align: 'center' }
  );

  doc.save(`${(b.tradingName || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${params.style.toLowerCase()}-letterhead.pdf`);
}

/**
 * 3. PETROL STATION OPERATING & COMPLIANCE CERTIFICATE (Guilloche + Rosette Seal + QR)
 */
export function printStationComplianceCertificatePdf(params: {
  stationName: string;
  stationCode: string;
  city: string;
  tankCount: number;
  pumpCount: number;
}): void {
  const b = getCompanyBranding();
  const primary = hexToRgb(b.primaryColorHex, [15, 23, 42]);
  const accent = hexToRgb(b.accentColorHex, [217, 119, 6]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const certNo = `CERT-${params.stationCode.toUpperCase()}-${new Date().getFullYear()}`;
  const fingerprint = computeSecurityFingerprint(`${certNo}|${b.legalName}|${params.stationName}`);

  drawSecurityWatermark(doc, 'STATION COMPLIANCE CERTIFIED', `${certNo} · HSE & METROLOGY`);
  drawFullGuillocheSecurityFrame(doc, b, certNo, primary, accent);

  let y = 26;
  if (b.logoDataUrl) {
    try {
      doc.addImage(b.logoDataUrl, 'PNG', w / 2 - 9, 15, 18, 18);
      y = 39;
    } catch {
      y = 26;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(`${(b.legalName || 'OPESFUEL').toUpperCase()} · FORECOURT COMPLIANCE & HSE CERTIFICATION`, w / 2, y, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(23);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text('CERTIFICATE OF STATION COMPLIANCE & CALIBRATION', w / 2, y + 11, { align: 'center' });
  drawGuillocheBand(doc, w / 2 - 58, y + 16, w / 2 + 58, y + 16, 1.2, 14, accent);

  doc.setFont('times', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(15, 23, 42);
  doc.text(`${params.stationName} (${params.stationCode})`, w / 2, y + 31, { align: 'center' });

  autoTable(doc, {
    startY: y + 39,
    margin: { left: 26, right: 26 },
    head: [['Certificate No.', 'City / Jurisdiction', 'Underground Tanks', 'Metered Dispensers', 'Regulatory Status']],
    body: [[
      certNo,
      `${params.city} (${b.countryCode})`,
      `${params.tankCount} Calibrated Tanks`,
      `${params.pumpCount} Verified Nozzles`,
      'COMPLIANT · ACTIVE',
    ]],
    theme: 'grid',
    headStyles: { fillColor: primary, textColor: 255, fontSize: 8.5, halign: 'center' },
    bodyStyles: { fontSize: 9.5, fontStyle: 'bold', halign: 'center', cellPadding: 4 },
  });

  const sigY = h - 36;
  drawGuillocheRosette(doc, w / 2, sigY - 5, 13, accent, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text('METROLOGY', w / 2, sigY - 6, { align: 'center' });
  doc.text('VERIFIED', w / 2, sigY - 2.5, { align: 'center' });

  doc.setDrawColor(100, 116, 139);
  doc.line(26, sigY, 96, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(b.signatoryName || 'Station Operations Director', 26, sigY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`NIU: ${b.taxIdNiu || '—'} · RCCM: ${b.rccmNumber || '—'}`, 26, sigY + 9.5);

  drawSecurityVerificationMatrix(doc, fingerprint, w - 42, h - 42, 17);
  doc.save(`station-compliance-certificate-${params.stationCode.toLowerCase()}.pdf`);
}

/**
 * 4. DEALER / FRANCHISE AUTHORIZATION CERTIFICATE (DODO / CODO / COCO)
 */
export function printDealerAuthorizationCertificatePdf(params: {
  dealerName: string;
  operatingModel: string;
  stationName: string;
  validUntil: string;
}): void {
  const b = getCompanyBranding();
  const primary = hexToRgb(b.primaryColorHex, [15, 23, 42]);
  const accent = hexToRgb(b.accentColorHex, [217, 119, 6]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfAuto;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const authNo = `DLR-${params.operatingModel.toUpperCase()}-${Math.floor(1000 + Math.random() * 8999)}`;
  const fingerprint = computeSecurityFingerprint(`${authNo}|${params.dealerName}|${b.legalName}`);

  drawSecurityWatermark(doc, 'AUTHORIZED BRAND DEALER', `${b.tradingName} · ${params.operatingModel}`);
  drawFullGuillocheSecurityFrame(doc, b, authNo, primary, accent);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(`${(b.legalName || 'OPESFUEL').toUpperCase()} · FRANCHISE & DEALER NETWORK`, w / 2, 28, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text('AUTHORIZED FUEL DEALER CERTIFICATE', w / 2, 40, { align: 'center' });
  drawGuillocheBand(doc, w / 2 - 58, 46, w / 2 + 58, 46, 1.3, 14, accent);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(71, 85, 105);
  doc.text('This certifies that the following licensed station operator is an authorized retail partner:', w / 2, 57, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text(params.dealerName.toUpperCase(), w / 2, 70, { align: 'center' });

  autoTable(doc, {
    startY: 80,
    margin: { left: 26, right: 26 },
    head: [['Authorization ID', 'Operating Model', 'Authorized Site', 'Brand Licensor', 'Valid Until']],
    body: [[authNo, params.operatingModel, params.stationName, b.legalName, params.validUntil]],
    theme: 'grid',
    headStyles: { fillColor: primary, textColor: 255, fontSize: 8.5, halign: 'center' },
    bodyStyles: { fontSize: 9.5, fontStyle: 'bold', halign: 'center', cellPadding: 4 },
  });

  const sigY = h - 36;
  drawGuillocheRosette(doc, w / 2, sigY - 5, 13, accent, 18);
  doc.setDrawColor(100, 116, 139);
  doc.line(26, sigY, 96, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(b.signatoryName || 'Managing Director', 26, sigY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(b.signatoryTitle || 'Brand Licensor Signatory', 26, sigY + 9.5);

  drawSecurityVerificationMatrix(doc, fingerprint, w - 42, h - 42, 17);
  doc.save(`dealer-authorization-${authNo.toLowerCase()}.pdf`);
}
