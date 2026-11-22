import React, { useRef, useState } from 'react';
import {
  Award,
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  Image as ImageIcon,
  Landmark,
  Palette,
  Printer,
  RotateCcw,
  Save,
  ShieldCheck,
  Stamp,
  Trash2,
  Upload,
} from 'lucide-react';
import { UserRole } from '../../domain/types';
import {
  CompanyBrandingProfile,
  compressImageFileToPngDataUrl,
  getCompanyBranding,
  resetCompanyBranding,
  saveCompanyBranding,
} from '../../utils/companyBranding';
import { printBrandedLetterheadSamplePdf } from '../../utils/documentTemplates';
import {
  computeSecurityFingerprint,
  LetterheadTemplateStyle,
  printDealerAuthorizationCertificatePdf,
  printExecutiveSecurityLetterheadPdf,
  printSecurityLicenseCertificatePdf,
  printStationComplianceCertificatePdf,
} from '../../utils/securityGuilloche';
import { printBrandedSampleThermalReceipt } from '../../utils/thermalReceipt';

interface CompanyBrandingAndLetterheadPanelProps {
  role: UserRole;
  organizationName: string;
  stationName: string;
  onSyncBackend?: (profile: CompanyBrandingProfile) => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const COUNTRY_PRESETS: Record<string, { currency: string; vat: number; label: string }> = {
  CM: { currency: 'FCFA', vat: 19.25, label: 'Cameroon (CEMAC · XAF · 19.25% VAT)' },
  NE: { currency: 'XOF', vat: 19.0, label: 'Niger (UEMOA · XOF · 19.0% VAT)' },
  SN: { currency: 'XOF', vat: 18.0, label: 'Senegal (UEMOA · XOF · 18.0% VAT)' },
  CI: { currency: 'XOF', vat: 18.0, label: "Cote d'Ivoire (UEMOA · XOF · 18.0% VAT)" },
  GA: { currency: 'FCFA', vat: 18.0, label: 'Gabon (CEMAC · XAF · 18.0% VAT)' },
  NG: { currency: 'NGN', vat: 7.5, label: 'Nigeria (NGN · 7.5% VAT)' },
  GH: { currency: 'GHS', vat: 15.0, label: 'Ghana (GHS · 15.0% VAT)' },
  KE: { currency: 'KES', vat: 16.0, label: 'Kenya (KES · 16.0% VAT)' },
  US: { currency: 'USD', vat: 0.0, label: 'International / USD (0% Export)' },
};

const COLOR_PRESETS = [
  { name: 'Obsidian & Amber', primary: '#0F172A', accent: '#D97706' },
  { name: 'Royal Navy & Gold', primary: '#1E3A5F', accent: '#CA8A04' },
  { name: 'Petroleum Slate & Emerald', primary: '#111827', accent: '#059669' },
  { name: 'Crimson Energy & Charcoal', primary: '#18181B', accent: '#B91C1C' },
];

export const CompanyBrandingAndLetterheadPanel: React.FC<CompanyBrandingAndLetterheadPanelProps> = ({
  role,
  organizationName,
  stationName,
  onSyncBackend,
  onNotify,
}) => {
  const canEdit = role === 'PLATFORM_ADMIN' || role === 'OWNER' || role === 'MANAGER';
  const [tab, setTab] = useState<'identity' | 'documents' | 'preview' | 'security'>('identity');
  const [draft, setDraft] = useState<CompanyBrandingProfile>(() => getCompanyBranding(organizationName));
  const [saving, setSaving] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<LetterheadTemplateStyle>('SOVEREIGN_GUILLOCHE');
  const [customWatermark, setCustomWatermark] = useState('ORIGINAL CERTIFIED COPY');

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const stampInputRef = useRef<HTMLInputElement | null>(null);

  const updateField = <K extends keyof CompanyBrandingProfile>(key: K, value: CompanyBrandingProfile[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleUploadImage = async (file: File | undefined, target: 'logoDataUrl' | 'stampDataUrl') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onNotify('error', 'Please select a PNG, JPG, or WebP image file.');
      return;
    }
    try {
      const dataUrl = await compressImageFileToPngDataUrl(file, target === 'logoDataUrl' ? 320 : 280);
      updateField(target, dataUrl);
      onNotify(
        'success',
        target === 'logoDataUrl'
          ? 'Company logo loaded — click "Save Branding & Letterhead" to apply across all PDFs, receipts, and sidebar.'
          : 'Official stamp / signature image loaded — click "Save Branding & Letterhead" to apply.'
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to process image file.');
    }
  };

  const handleSave = async () => {
    if (!draft.legalName.trim()) {
      onNotify('error', 'Legal Company Name is required for official invoices and tax documents.');
      return;
    }
    setSaving(true);
    try {
      const saved = saveCompanyBranding(draft);
      setDraft(saved);
      if (onSyncBackend) {
        await onSyncBackend(saved);
      }
      onNotify(
        'success',
        `Saved company logo & official letterhead for ${saved.legalName}. All 24 PDFs, 80mm thermal receipts, and sidebar branding updated immediately.`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const next = resetCompanyBranding(organizationName);
    setDraft(next);
    onNotify('success', 'Reset company branding & letterhead to default template.');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-950" />
            <h3 className="font-display text-lg font-bold text-slate-950">
              Company Logo, Official Letterhead &amp; Printable Document Branding
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Upload your company logo and stamp, configure NIU / RCCM / Bank IBAN / VAT settings, and customize headers &amp; footers across all 24 A4 PDF templates, 80mm thermal receipts, and the workspace sidebar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              saveCompanyBranding(draft);
              printBrandedLetterheadSamplePdf();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-900"
          >
            <FileText className="w-3.5 h-3.5" /> Test Letterhead PDF
          </button>
          <button
            type="button"
            onClick={() => {
              saveCompanyBranding(draft);
              printBrandedSampleThermalReceipt(stationName);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-900"
          >
            <Printer className="w-3.5 h-3.5" /> Test 80mm Receipt
          </button>
          {canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Branding & Letterhead'}
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('identity')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
            tab === 'identity' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" /> 1. Logo, Stamp &amp; Legal Identity
        </button>
        <button
          type="button"
          onClick={() => setTab('documents')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
            tab === 'documents' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" /> 2. Bank, Colors, Prefixes &amp; Footers
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
            tab === 'preview' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" /> 3. Live A4 &amp; 80mm Preview
        </button>
        <button
          type="button"
          onClick={() => setTab('security')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
            tab === 'security' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5" /> 4. Guilloché Letterheads &amp; Licenses
        </button>
      </div>

      {/* TAB 1: LOGO, STAMP & LEGAL ENTITY */}
      {tab === 'identity' && (
        <div className="space-y-6">
          {/* Logo & Official Stamp Uploaders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-950">
                  <ImageIcon className="w-4 h-4 text-amber-600" /> Company Logo (Header, PDFs &amp; 80mm Receipts)
                </div>
                {draft.logoDataUrl && canEdit && (
                  <button
                    type="button"
                    onClick={() => updateField('logoDataUrl', null)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  {draft.logoDataUrl ? (
                    <img src={draft.logoDataUrl} alt="Company logo" className="w-full h-full object-contain p-1.5" />
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400 text-center px-2">NO LOGO</span>
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  <p className="text-[11px] text-slate-500">
                    Upload a crisp transparent PNG or JPG (recommended 320×320px). Appears on all A4 letterheads, invoices, payslips, thermal slips, and the console sidebar.
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => void handleUploadImage(e.target.files?.[0], 'logoDataUrl')}
                  />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-900"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload Company Logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-950">
                  <Stamp className="w-4 h-4 text-amber-600" /> Official Company Stamp / Authorized Signature
                </div>
                {draft.stampDataUrl && canEdit && (
                  <button
                    type="button"
                    onClick={() => updateField('stampDataUrl', null)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  {draft.stampDataUrl ? (
                    <img src={draft.stampDataUrl} alt="Company stamp" className="w-full h-full object-contain p-1.5" />
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400 text-center px-2">NO STAMP</span>
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  <p className="text-[11px] text-slate-500">
                    Optional digital stamp or director signature (PNG with transparent background). Automatically placed above the signatory line on official PDFs.
                  </p>
                  <input
                    ref={stampInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => void handleUploadImage(e.target.files?.[0], 'stampDataUrl')}
                  />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => stampInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-900"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload Stamp / Signature
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Legal Entity Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="opes-label">Legal Company Name *</label>
              <input
                disabled={!canEdit}
                value={draft.legalName}
                onChange={(e) => updateField('legalName', e.target.value)}
                placeholder="e.g. SOCOMAR PETROLEUM SA"
                className="opes-input text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Trading / Station Network Brand Name *</label>
              <input
                disabled={!canEdit}
                value={draft.tradingName}
                onChange={(e) => updateField('tradingName', e.target.value)}
                placeholder="e.g. Socomar Stations"
                className="opes-input text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Letterhead Tagline</label>
              <input
                disabled={!canEdit}
                value={draft.tagline}
                onChange={(e) => updateField('tagline', e.target.value)}
                className="opes-input text-xs"
              />
            </div>

            <div>
              <label className="opes-label">Tax ID / NIU / TIN</label>
              <input
                disabled={!canEdit}
                value={draft.taxIdNiu}
                onChange={(e) => updateField('taxIdNiu', e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Commercial Register (RCCM / Reg No.)</label>
              <input
                disabled={!canEdit}
                value={draft.rccmNumber}
                onChange={(e) => updateField('rccmNumber', e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="opes-label">CNPS / Social Security Employer ID</label>
              <input
                disabled={!canEdit}
                value={draft.cnpsEmployerId}
                onChange={(e) => updateField('cnpsEmployerId', e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="opes-label">Country Tax Jurisdiction</label>
              <select
                disabled={!canEdit}
                value={draft.countryCode}
                onChange={(e) => {
                  const code = e.target.value;
                  const preset = COUNTRY_PRESETS[code];
                  setDraft((prev) => ({
                    ...prev,
                    countryCode: code,
                    defaultCurrency: preset?.currency ?? prev.defaultCurrency,
                    vatRatePct: preset?.vat ?? prev.vatRatePct,
                  }));
                }}
                className="opes-input text-xs"
              >
                {Object.entries(COUNTRY_PRESETS).map(([code, meta]) => (
                  <option key={code} value={code}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="opes-label">Document Currency</label>
              <input
                disabled={!canEdit}
                value={draft.defaultCurrency}
                onChange={(e) => updateField('defaultCurrency', e.target.value.toUpperCase())}
                className="opes-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Standard VAT / TVA Rate (%)</label>
              <input
                type="number"
                step="0.05"
                min={0}
                max={40}
                disabled={!canEdit}
                value={draft.vatRatePct}
                onChange={(e) => updateField('vatRatePct', Number(e.target.value) || 0)}
                className="opes-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="opes-label">Head Office Street Address</label>
              <input
                disabled={!canEdit}
                value={draft.address}
                onChange={(e) => updateField('address', e.target.value)}
                className="opes-input text-xs"
              />
            </div>
            <div>
              <label className="opes-label">City &amp; Country</label>
              <input
                disabled={!canEdit}
                value={draft.city}
                onChange={(e) => updateField('city', e.target.value)}
                className="opes-input text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Official Phone</label>
              <input
                disabled={!canEdit}
                value={draft.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="opes-label">Billing &amp; Support Email</label>
              <input
                type="email"
                disabled={!canEdit}
                value={draft.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="opes-input text-xs"
              />
            </div>
            <div className="md:col-span-2">
              <label className="opes-label">Company Website</label>
              <input
                disabled={!canEdit}
                value={draft.website}
                onChange={(e) => updateField('website', e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BANK, BRAND COLORS, PREFIXES & FOOTERS */}
      {tab === 'documents' && (
        <div className="space-y-6">
          {/* Brand Palette Selector */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-950">
              <Palette className="w-4 h-4 text-amber-600" /> Letterhead Header &amp; Accent Colors
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  disabled={!canEdit}
                  value={draft.primaryColorHex}
                  onChange={(e) => updateField('primaryColorHex', e.target.value)}
                  className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900">Primary Header Bar</div>
                  <div className="font-mono text-[11px] text-slate-500">{draft.primaryColorHex}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  disabled={!canEdit}
                  value={draft.accentColorHex}
                  onChange={(e) => updateField('accentColorHex', e.target.value)}
                  className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900">Accent Rule &amp; Badges</div>
                  <div className="font-mono text-[11px] text-slate-500">{draft.accentColorHex}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                      updateField('primaryColorHex', p.primary);
                      updateField('accentColorHex', p.accent);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.primary }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.accent }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="opes-label">Bank Name &amp; Branch</label>
              <input
                disabled={!canEdit}
                value={draft.bankName}
                onChange={(e) => updateField('bankName', e.target.value)}
                className="opes-input text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Bank Account / RIB / IBAN</label>
              <input
                disabled={!canEdit}
                value={draft.bankAccountIban}
                onChange={(e) => updateField('bankAccountIban', e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Mobile Money Merchant Code</label>
              <input
                disabled={!canEdit}
                value={draft.mobileMoneyMerchant}
                onChange={(e) => updateField('mobileMoneyMerchant', e.target.value)}
                className="opes-input text-xs"
              />
            </div>

            <div>
              <label className="opes-label">Invoice Number Prefix</label>
              <input
                disabled={!canEdit}
                value={draft.invoicePrefix}
                onChange={(e) => updateField('invoicePrefix', e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Purchase Order Prefix</label>
              <input
                disabled={!canEdit}
                value={draft.poPrefix}
                onChange={(e) => updateField('poPrefix', e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Receipt Number Prefix</label>
              <input
                disabled={!canEdit}
                value={draft.receiptPrefix}
                onChange={(e) => updateField('receiptPrefix', e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="opes-label">Authorized Signatory Name</label>
              <input
                disabled={!canEdit}
                value={draft.signatoryName}
                onChange={(e) => updateField('signatoryName', e.target.value)}
                className="opes-input text-xs"
              />
            </div>
            <div className="md:col-span-2">
              <label className="opes-label">Authorized Signatory Title</label>
              <input
                disabled={!canEdit}
                value={draft.signatoryTitle}
                onChange={(e) => updateField('signatoryTitle', e.target.value)}
                className="opes-input text-xs"
              />
            </div>

            <div className="md:col-span-3">
              <label className="opes-label">Default Invoice Payment Terms</label>
              <input
                disabled={!canEdit}
                value={draft.paymentTerms}
                onChange={(e) => updateField('paymentTerms', e.target.value)}
                className="opes-input text-xs"
              />
            </div>

            <div className="md:col-span-3">
              <label className="opes-label">A4 Official Letterhead Legal Footer</label>
              <input
                disabled={!canEdit}
                value={draft.letterheadFooter}
                onChange={(e) => updateField('letterheadFooter', e.target.value)}
                className="opes-input text-xs"
              />
            </div>

            <div>
              <label className="opes-label">80mm Receipt Header Slogan</label>
              <input
                disabled={!canEdit}
                value={draft.receiptHeaderNote}
                onChange={(e) => updateField('receiptHeaderNote', e.target.value)}
                className="opes-input text-xs"
              />
            </div>
            <div className="md:col-span-2">
              <label className="opes-label">80mm Receipt Thank-You Footer</label>
              <input
                disabled={!canEdit}
                value={draft.receiptFooterNote}
                onChange={(e) => updateField('receiptFooterNote', e.target.value)}
                className="opes-input text-xs"
              />
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to Default Template
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE A4 LETTERHEAD & 80mm RECEIPT PREVIEW */}
      {tab === 'preview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* A4 Official Letterhead Preview */}
          <div className="lg:col-span-2 border border-slate-300 rounded-xl overflow-hidden bg-white">
            <div
              className="p-5 text-white flex items-start justify-between gap-4"
              style={{ backgroundColor: draft.primaryColorHex }}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                {draft.logoDataUrl ? (
                  <div className="w-14 h-14 rounded-lg bg-white p-1.5 flex items-center justify-center shrink-0">
                    <img src={draft.logoDataUrl} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-mono text-white/70 shrink-0">
                    LOGO
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-display text-base font-bold truncate">{draft.legalName || 'Your Company Name'}</div>
                  <div className="text-[11px] text-slate-200 mt-0.5">
                    {[draft.taxIdNiu ? `NIU: ${draft.taxIdNiu}` : '', draft.rccmNumber ? `RCCM: ${draft.rccmNumber}` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {[draft.address, draft.city, draft.phone].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-xs font-bold uppercase" style={{ color: '#FDBA74' }}>
                  {draft.invoicePrefix}2026-0042
                </div>
                <div className="text-[10px] text-slate-300 mt-1">Official Commercial Invoice</div>
              </div>
            </div>
            <div className="h-1.5" style={{ backgroundColor: draft.accentColorHex }} />

            <div className="p-5 space-y-4 text-xs">
              <div className="flex justify-between text-slate-600">
                <div>
                  <div className="font-bold text-slate-950">Billed To:</div>
                  <div>Bollore Transport Logistics SA</div>
                  <div className="font-mono text-[11px]">NIU: M09184420193</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-950">Station: {stationName}</div>
                  <div className="font-mono text-[11px]">VAT Rate: {draft.vatRatePct}% · {draft.defaultCurrency}</div>
                </div>
              </div>

              <table className="w-full border-collapse text-xs border border-slate-200">
                <thead>
                  <tr className="text-white font-mono text-[10px] uppercase" style={{ backgroundColor: draft.primaryColorHex }}>
                    <th className="py-2 px-3 text-left">Description</th>
                    <th className="py-2 px-3 text-right">Volume</th>
                    <th className="py-2 px-3 text-right">Total ({draft.defaultCurrency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2 px-3">Gasoil / Automotive Diesel — Fleet Vouchers</td>
                    <td className="py-2 px-3 text-right font-mono">1,500.0 L</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">1,242,000</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Total Quartz 5W30 Synthetic 4L</td>
                    <td className="py-2 px-3 text-right font-mono">4 units</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">74,000</td>
                  </tr>
                </tbody>
              </table>

              <div className="flex items-end justify-between pt-4 border-t border-slate-200 gap-4">
                <div className="space-y-1 text-[11px] text-slate-600">
                  <div className="font-semibold text-slate-900">Settlement Details</div>
                  <div>{draft.bankName} — <span className="font-mono">{draft.bankAccountIban}</span></div>
                  <div>{draft.mobileMoneyMerchant}</div>
                  <div className="text-[10px] text-slate-500 pt-1">{draft.paymentTerms}</div>
                </div>
                <div className="text-right shrink-0">
                  {draft.stampDataUrl && (
                    <img src={draft.stampDataUrl} alt="Official stamp" className="h-12 ml-auto mb-1 object-contain" />
                  )}
                  <div className="border-t border-slate-400 pt-1 text-[11px] font-semibold text-slate-900">
                    {draft.signatoryName || 'Authorized Signatory'}
                  </div>
                  <div className="text-[10px] text-slate-500">{draft.signatoryTitle}</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 border-t border-slate-100 pt-2">
                {draft.letterheadFooter}
              </div>
            </div>
          </div>

          {/* 80mm Thermal Receipt Preview */}
          <div className="border border-slate-300 rounded-xl p-5 bg-white font-mono text-[11px] text-slate-900 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-sans font-bold text-slate-500 uppercase pb-2 border-b border-slate-200">
              <span>80mm Thermal Slip Preview</span>
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" /> Live
              </span>
            </div>
            {draft.logoDataUrl && (
              <div className="flex justify-center py-1">
                <img
                  src={draft.logoDataUrl}
                  alt="Thermal logo"
                  className="max-h-10 object-contain grayscale contrast-125"
                />
              </div>
            )}
            <div className="text-center font-bold text-xs">{draft.legalName}</div>
            <div className="text-center text-[10px]">{stationName}</div>
            <div className="text-center text-[10px] text-slate-600">{draft.phone}</div>
            <div className="text-center text-[10px] text-slate-600">
              NIU: {draft.taxIdNiu || '—'} · RCCM: {draft.rccmNumber || '—'}
            </div>
            {draft.receiptHeaderNote && (
              <div className="text-center text-[10px] italic">{draft.receiptHeaderNote}</div>
            )}
            <div className="border-t border-dashed border-slate-400 my-2" />
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span className="font-bold">{draft.receiptPrefix}2026-0001</span>
            </div>
            <div className="flex justify-between">
              <span>Pump P01 (SUPER):</span>
              <span>35.0 L</span>
            </div>
            <div className="border-t border-dashed border-slate-400 my-2" />
            <div className="flex justify-between font-bold text-xs">
              <span>TOTAL ({draft.defaultCurrency}):</span>
              <span>29,400</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>VAT ({draft.vatRatePct}%):</span>
              <span>Included</span>
            </div>
            <div className="border-t border-dashed border-slate-400 my-2" />
            <div className="text-center text-[10px] text-slate-600">{draft.receiptFooterNote}</div>
            {draft.website && <div className="text-center text-[10px] text-slate-500">{draft.website}</div>}
          </div>
        </div>
      )}

      {/* TAB 4: BANKNOTE-GRADE GUILLOCHE LETTERHEADS, LICENSES & WATERMARK STUDIO */}
      {tab === 'security' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Style & Watermark Configurator */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-950">
                  <ShieldCheck className="w-4 h-4 text-amber-600" /> Security Letterhead Design Style
                </div>
                <div className="space-y-2">
                  {(
                    [
                      {
                        id: 'SOVEREIGN_GUILLOCHE',
                        title: 'Sovereign Guilloché Security Frame',
                        desc: '4-edge parametric banknote waves, 4 corner rosettes, continuous microtext strip, watermark & QR seal.',
                      },
                      {
                        id: 'EXECUTIVE_GOLD',
                        title: 'Executive Gold Double-Border',
                        desc: 'Double-ruled sovereign border with accent guilloché header wave, watermark & verification fingerprint.',
                      },
                      {
                        id: 'CLASSIC_INSTITUTIONAL',
                        title: 'Classic Institutional Navy Header',
                        desc: 'Full-bleed Obsidian/Primary brand header with logo crest, diagonal watermark & QR matrix.',
                      },
                      {
                        id: 'MINIMAL_SWISS',
                        title: 'Minimal Swiss Boardroom Stationery',
                        desc: 'Clean vertical accent bar, ultra-crisp Swiss typography, subtle rosette watermark & tamper hash.',
                      },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStyle(st.id)}
                      className={`w-full p-3 rounded-lg border text-left transition-colors ${
                        selectedStyle === st.id
                          ? 'border-[#0F172A] bg-slate-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-950">{st.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{st.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <label className="opes-label">Anti-Counterfeit Diagonal Watermark Text</label>
                <input
                  value={customWatermark}
                  onChange={(e) => setCustomWatermark(e.target.value)}
                  placeholder="ORIGINAL CERTIFIED COPY"
                  className="opes-input font-mono text-xs"
                />
                <p className="text-[11px] text-slate-500">
                  Embedded as a subtle translucent vector watermark plus a deterministic verification hash ({computeSecurityFingerprint(`${draft.legalName}|${draft.taxIdNiu}`)}).
                </p>
              </div>
            </div>

            {/* Live Vector Guilloche Preview + 1-Click Certificate Downloads */}
            <div className="lg:col-span-2 space-y-4">
              {/* Interactive SVG Guilloche Security Preview Card */}
              <div className="relative rounded-xl border-2 p-6 bg-white overflow-hidden" style={{ borderColor: draft.primaryColorHex }}>
                {/* Subtle SVG Guilloche wave strip top & bottom */}
                <svg
                  aria-hidden="true"
                  className="w-full h-5 mb-3 opacity-80"
                  viewBox="0 0 600 20"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,10 Q25,0 50,10 T100,10 T150,10 T200,10 T250,10 T300,10 T350,10 T400,10 T450,10 T500,10 T550,10 T600,10"
                    fill="none"
                    stroke={draft.primaryColorHex}
                    strokeWidth="0.9"
                  />
                  <path
                    d="M0,10 Q25,20 50,10 T100,10 T150,10 T200,10 T250,10 T300,10 T350,10 T400,10 T450,10 T500,10 T550,10 T600,10"
                    fill="none"
                    stroke={draft.accentColorHex}
                    strokeWidth="0.9"
                  />
                </svg>

                {/* Translucent Diagonal Watermark Preview */}
                <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center">
                  <div className="-rotate-12 text-2xl sm:text-3xl font-display font-bold tracking-widest text-slate-200/70 uppercase text-center px-6">
                    {customWatermark || draft.legalName}
                  </div>
                </div>

                <div className="relative z-10 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    {draft.logoDataUrl ? (
                      <img src={draft.logoDataUrl} alt="Logo" className="w-12 h-12 object-contain rounded border border-slate-200 p-1 bg-white" />
                    ) : (
                      <div className="w-12 h-12 rounded border border-dashed border-slate-300 flex items-center justify-center text-[10px] font-mono text-slate-400">
                        LOGO
                      </div>
                    )}
                    <div>
                      <div className="font-display text-base font-bold text-slate-950">{draft.legalName}</div>
                      <div className="text-[11px] text-slate-500">
                        NIU: {draft.taxIdNiu || '—'} · RCCM: {draft.rccmNumber || '—'} · {draft.city}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[10px]">
                    <div className="font-bold" style={{ color: draft.accentColorHex }}>
                      {selectedStyle.replace(/_/g, ' ')}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      {computeSecurityFingerprint(`${draft.legalName}|${draft.taxIdNiu}`)}
                    </div>
                  </div>
                </div>

                <div className="relative z-10 py-4 text-xs text-slate-700 space-y-2">
                  <div className="font-semibold text-slate-950">Embedded Anti-Counterfeit Security Layers (2400 DPI Vector PDF):</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> Parametric 4-Edge Banknote Guilloché Waves
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> 4 Corner Spirograph Rosette Medallions
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> Continuous 3.8pt Legal Microtext Seam
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> 2D Cryptographic Verification Matrix &amp; Seal
                    </div>
                  </div>
                </div>

                <svg
                  aria-hidden="true"
                  className="w-full h-5 mt-2 opacity-80"
                  viewBox="0 0 600 20"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,10 Q25,0 50,10 T100,10 T150,10 T200,10 T250,10 T300,10 T350,10 T400,10 T450,10 T500,10 T550,10 T600,10"
                    fill="none"
                    stroke={draft.primaryColorHex}
                    strokeWidth="0.9"
                  />
                  <path
                    d="M0,10 Q25,20 50,10 T100,10 T150,10 T200,10 T250,10 T300,10 T350,10 T400,10 T450,10 T500,10 T550,10 T600,10"
                    fill="none"
                    stroke={draft.accentColorHex}
                    strokeWidth="0.9"
                  />
                </svg>
              </div>

              {/* 4 One-Click Industry-Standard Security Document Generators */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    saveCompanyBranding(draft);
                    printExecutiveSecurityLetterheadPdf({
                      style: selectedStyle,
                      watermarkText: customWatermark,
                    });
                    onNotify('success', `Generated ${selectedStyle.replace(/_/g, ' ')} security letterhead PDF.`);
                  }}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-[#0F172A] text-left space-y-1 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-950">1. Official Security Letterhead PDF</span>
                    <FileText className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    A4 portrait stationery with your logo, guilloché frame, diagonal watermark, stamp &amp; verification QR.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    saveCompanyBranding(draft);
                    printStationComplianceCertificatePdf({
                      stationName,
                      stationCode: 'ST-01',
                      city: draft.city || 'Douala',
                      tankCount: 4,
                      pumpCount: 8,
                    });
                    onNotify('success', 'Generated Station Compliance & Metrology Guilloché Certificate PDF.');
                  }}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-[#0F172A] text-left space-y-1 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-950">2. Station Compliance Certificate PDF</span>
                    <Award className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Landscape banknote-grade HSE &amp; metrology certificate with rosette seal &amp; tamper hash.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    saveCompanyBranding(draft);
                    printDealerAuthorizationCertificatePdf({
                      dealerName: draft.tradingName || draft.legalName,
                      operatingModel: 'DODO',
                      stationName,
                      validUntil: '2028-12-31',
                    });
                    onNotify('success', 'Generated Authorized Dealer / Franchise Guilloché Certificate PDF.');
                  }}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-[#0F172A] text-left space-y-1 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-950">3. Authorized Dealer Certificate PDF</span>
                    <Stamp className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Landscape franchise/DODO brand authorization with corner rosettes, microtext &amp; licensor seal.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    saveCompanyBranding(draft);
                    printSecurityLicenseCertificatePdf({
                      licenseKey: 'OPF-ENT-2026-CM8842',
                      organizationName: draft.legalName,
                      tierName: 'Perpetual Multi-Station Enterprise License',
                      maxStations: 25,
                      annualFeeFcfa: 5000000,
                      expiresAt: '2027-12-31',
                      issuedToNiu: draft.taxIdNiu,
                    });
                    onNotify('success', 'Generated Sovereign Guilloché Enterprise Software License Certificate PDF.');
                  }}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-[#0F172A] text-left space-y-1 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-950">4. Enterprise License Certificate PDF</span>
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Full sovereign landscape license certificate with 4 corner rosettes, embossed seal &amp; QR matrix.
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
