import { useEffect, useState } from 'react';

export interface CompanyBrandingProfile {
  legalName: string;
  tradingName: string;
  tagline: string;
  taxIdNiu: string;
  rccmNumber: string;
  cnpsEmployerId: string;
  countryCode: string;
  defaultCurrency: string;
  vatRatePct: number;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  bankName: string;
  bankAccountIban: string;
  mobileMoneyMerchant: string;
  primaryColorHex: string;
  accentColorHex: string;
  invoicePrefix: string;
  poPrefix: string;
  receiptPrefix: string;
  paymentTerms: string;
  letterheadFooter: string;
  receiptHeaderNote: string;
  receiptFooterNote: string;
  signatoryName: string;
  signatoryTitle: string;
  logoDataUrl: string | null;
  stampDataUrl: string | null;
  updatedAt: string;
}

const STORAGE_KEY = 'opesfuel.company.branding.v1';
const CHANGE_EVENT = 'opesfuel:branding-updated';

export const DEFAULT_COMPANY_BRANDING: CompanyBrandingProfile = {
  legalName: 'OpesFuel Demo Petroleum SA',
  tradingName: 'OpesFuel Stations',
  tagline: 'Licensed Fuel Distribution & Forecourt Retail Operations',
  taxIdNiu: 'M041200918442K',
  rccmNumber: 'RC/DLA/2022/B/1842',
  cnpsEmployerId: '341-0192844-000-A',
  countryCode: 'CM',
  defaultCurrency: 'FCFA',
  vatRatePct: 19.25,
  address: 'Boulevard de la Liberte, Immeuble Bonanjo',
  city: 'Douala, Cameroon',
  phone: '+237 233 42 18 90',
  email: 'billing@yourstation.com',
  website: 'https://www.yourstation.com',
  bankName: 'Afriland First Bank — Douala Corporate',
  bankAccountIban: 'CM21 10005 00001 04582910011 48',
  mobileMoneyMerchant: 'MTN MoMo *126# / Orange Money #150# — Code 448912',
  primaryColorHex: '#0F172A',
  accentColorHex: '#D97706',
  invoicePrefix: 'INV-',
  poPrefix: 'PO-',
  receiptPrefix: 'RCP-',
  paymentTerms: 'Net 15 Days · Late settlement subject to 1.5%/month statutory interest',
  letterheadFooter: 'Official commercial & statutory accounting document. Retain for OHADA / Tax inspection.',
  receiptHeaderNote: '24/7 Quality-Certified Fuel & Lubricants',
  receiptFooterNote: 'Thank you for fueling with us! Keep this receipt for VAT / Fleet claims.',
  signatoryName: 'Station General Manager',
  signatoryTitle: 'Authorized Signatory & Managing Director',
  logoDataUrl: null,
  stampDataUrl: null,
  updatedAt: new Date().toISOString(),
};

export function getCompanyBranding(fallbackOrgName?: string): CompanyBrandingProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CompanyBrandingProfile>;
      return {
        ...DEFAULT_COMPANY_BRANDING,
        ...parsed,
      };
    }
  } catch {
    // ignore storage read issues
  }
  if (fallbackOrgName && fallbackOrgName.trim()) {
    return {
      ...DEFAULT_COMPANY_BRANDING,
      legalName: fallbackOrgName.trim(),
      tradingName: fallbackOrgName.trim(),
    };
  }
  return { ...DEFAULT_COMPANY_BRANDING };
}

export function saveCompanyBranding(profile: CompanyBrandingProfile): CompanyBrandingProfile {
  const next: CompanyBrandingProfile = {
    ...DEFAULT_COMPANY_BRANDING,
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  return next;
}

export function resetCompanyBranding(fallbackOrgName?: string): CompanyBrandingProfile {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  const next = getCompanyBranding(fallbackOrgName);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  return next;
}

export function useCompanyBranding(fallbackOrgName?: string): CompanyBrandingProfile {
  const [branding, setBranding] = useState<CompanyBrandingProfile>(() =>
    getCompanyBranding(fallbackOrgName)
  );

  useEffect(() => {
    const onUpdate = () => setBranding(getCompanyBranding(fallbackOrgName));
    window.addEventListener(CHANGE_EVENT, onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, [fallbackOrgName]);

  return branding;
}

export function hexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  const clean = (hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Resizes an uploaded PNG/JPG/WebP logo or stamp file onto an offscreen canvas
 * so it embeds crisply in jsPDF (PNG format) without blowing up localStorage or DB limits.
 */
export function compressImageFileToPngDataUrl(file: File, maxDim = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
