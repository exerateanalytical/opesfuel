import React, { useState } from 'react';
import { Award, ExternalLink, Gift, MessageCircle, Plus, Sparkles } from 'lucide-react';
import { formatFcfa } from '../../domain/formatters';
import { UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

interface LoyaltyMember {
  id: string;
  phone: string;
  fullName: string;
  passToken: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: string;
}

interface LoyaltyCampaign {
  id: string;
  name: string;
  campaignType: 'HAPPY_HOUR' | 'FLEET_REBATE';
  discountPct: number;
  fuelGrade: string;
  windowLabel: string;
  active: boolean;
}

interface LoyaltyCampaignsPanelProps {
  role: UserRole;
  stationName: string;
  onPostBackend: (path: string, method: 'POST' | 'PATCH' | 'PUT', body?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const LoyaltyCampaignsPanel: React.FC<LoyaltyCampaignsPanelProps> = ({
  role,
  stationName,
  onPostBackend,
  onNotify,
}) => {
  const canManage = role === 'PLATFORM_ADMIN' || role === 'OWNER' || role === 'MANAGER';

  const [members, setMembers] = useState<LoyaltyMember[]>([
    { id: 'loy_01', phone: '+237677998877', fullName: 'Jean-Marie Kamga', passToken: 'pass_cameroon01demo', pointsBalance: 640, lifetimePoints: 1850, tier: 'GOLD' },
    { id: 'loy_02', phone: '+237699443322', fullName: 'Nadine Tchatchoua', passToken: 'pass_cameroon02demo', pointsBalance: 210, lifetimePoints: 490, tier: 'SILVER' },
  ]);

  const [campaigns, setCampaigns] = useState<LoyaltyCampaign[]>([
    { id: 'cmp_01', name: 'Early Bird Happy Hour', campaignType: 'HAPPY_HOUR', discountPct: 3, fuelGrade: 'SUPER', windowLabel: '06:00–09:00 UTC', active: true },
    { id: 'cmp_02', name: 'Transport Fleet Gasoil Rebate', campaignType: 'FLEET_REBATE', discountPct: 2.5, fuelGrade: 'GASOIL', windowLabel: 'All Day', active: true },
  ]);

  const [earnModalOpen, setEarnModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  const [phone, setPhone] = useState('+237677998877');
  const [grade, setGrade] = useState('SUPER');
  const [litres, setLitres] = useState('45');
  const [amountXaf, setAmountXaf] = useState('37800');
  const [receiptChannel, setReceiptChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP');

  const [cmpName, setCmpName] = useState('');
  const [cmpType, setCmpType] = useState<'HAPPY_HOUR' | 'FLEET_REBATE'>('HAPPY_HOUR');
  const [cmpPct, setCmpPct] = useState('3');
  const [cmpGrade, setCmpGrade] = useState('SUPER');

  const handleEarn = async (e: React.FormEvent) => {
    e.preventDefault();
    const l = Number(litres);
    const amt = Number(amountXaf);
    const remote = await onPostBackend('/api/v1/loyalty/earn', 'POST', {
      phone,
      fuelGrade: grade,
      litres: l,
      amountXaf: amt,
      reference: `POS-${Date.now().toString().slice(-5)}`,
    });
    const earned = Number(remote?.earnedPoints ?? Math.max(1, Math.round(l * 2)));
    setMembers((prev) => {
      const idx = prev.findIndex((m) => m.phone === phone);
      if (idx >= 0) {
        const copy = [...prev];
        const lt = copy[idx].lifetimePoints + earned;
        copy[idx] = {
          ...copy[idx],
          pointsBalance: copy[idx].pointsBalance + earned,
          lifetimePoints: lt,
          tier: lt >= 5000 ? 'PLATINUM' : lt >= 1500 ? 'GOLD' : lt >= 400 ? 'SILVER' : 'BRONZE',
        };
        return copy;
      }
      return [
        {
          id: String(remote?.memberId ?? `loy_${Date.now()}`),
          phone,
          fullName: 'Registered Driver',
          passToken: String(remote?.passToken ?? `pass_${Date.now().toString(36)}`),
          pointsBalance: earned,
          lifetimePoints: earned,
          tier: earned >= 400 ? 'SILVER' : 'BRONZE',
        },
        ...prev,
      ];
    });
    setEarnModalOpen(false);
    onNotify('success', `Awarded +${earned} loyalty points to ${phone}.`);
  };

  const handleSendReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const remote = await onPostBackend('/api/v1/loyalty/receipts/send', 'POST', {
      channel: receiptChannel,
      recipientPhone: phone,
      stationName,
      fuelGrade: grade,
      litres: Number(litres),
      totalFcfa: Number(amountXaf),
    });
    setReceiptModalOpen(false);
    onNotify(
      'success',
      `Dispatched ${receiptChannel} digital fuel receipt (${String(remote?.receiptNo ?? 'RCP')}) to ${phone} via ${String(remote?.provider ?? 'messaging gateway')}.`
    );
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmpName.trim()) return;
    const remote = await onPostBackend('/api/v1/loyalty/campaigns', 'POST', {
      name: cmpName.trim(),
      campaignType: cmpType,
      discountPct: Number(cmpPct),
      fuelGrade: cmpGrade,
      startHour: cmpType === 'HAPPY_HOUR' ? 6 : undefined,
      endHour: cmpType === 'HAPPY_HOUR' ? 10 : undefined,
    });
    setCampaigns((prev) => [
      {
        id: String(remote?.id ?? `cmp_${Date.now()}`),
        name: cmpName.trim(),
        campaignType: cmpType,
        discountPct: Number(cmpPct),
        fuelGrade: cmpGrade,
        windowLabel: cmpType === 'HAPPY_HOUR' ? '06:00–10:00 UTC' : 'All Day',
        active: true,
      },
      ...prev,
    ]);
    setCmpName('');
    setCampaignModalOpen(false);
    onNotify('success', `Activated loyalty promotion "${cmpName.trim()}".`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            Driver Loyalty Pass, Promotions &amp; WhatsApp Receipts
          </h3>
          <p className="text-xs text-slate-500">
            Phone-based loyalty tiers, happy-hour &amp; fleet rebate campaigns, public driver pass URLs, and Meta WhatsApp / SMS digital receipts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setReceiptModalOpen(true)} className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-700" /> Send WhatsApp / SMS Receipt
          </button>
          <button type="button" onClick={() => setEarnModalOpen(true)} className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5" /> Award / Enroll Driver Points
          </button>
          {canManage && (
            <button type="button" onClick={() => setCampaignModalOpen(true)} className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> New Campaign
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white text-xs font-bold">Enrolled Drivers &amp; Public Digital Pass</div>
          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-slate-900">{m.fullName} <span className="font-mono text-amber-700">[{m.tier}]</span></div>
                  <div className="font-mono text-[11px] text-slate-500">{m.phone}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900">{m.pointsBalance.toLocaleString()} pts</div>
                  <a
                    href={`#/loyalty/${m.passToken}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline"
                  >
                    Open Public Pass <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Active Campaigns (Happy Hour &amp; Fleet Rebates)
          </div>
          <div className="divide-y divide-slate-100">
            {campaigns.map((c) => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-900">{c.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{c.campaignType} · {c.fuelGrade} · {c.windowLabel}</div>
                </div>
                <span className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-900 font-mono font-bold">
                  -{c.discountPct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FormModal open={earnModalOpen} onClose={() => setEarnModalOpen(false)} title="Award Loyalty Points at Forecourt POS">
        <form onSubmit={(e) => void handleEarn(e)} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Driver Phone (+237)</label>
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Grade</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                <option value="SUPER">SUPER</option>
                <option value="GASOIL">GASOIL</option>
                <option value="LPG_BULK">LPG_BULK</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Litres</label>
              <input type="number" step="0.1" required value={litres} onChange={(e) => setLitres(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Amount (FCFA)</label>
              <input type="number" required value={amountXaf} onChange={(e) => setAmountXaf(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEarnModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Credit Points</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={receiptModalOpen} onClose={() => setReceiptModalOpen(false)} title="Send Digital Fuel Receipt via WhatsApp / SMS">
        <form onSubmit={(e) => void handleSendReceipt(e)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Channel</label>
              <select value={receiptChannel} onChange={(e) => setReceiptChannel(e.target.value as 'WHATSAPP' | 'SMS')} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                <option value="WHATSAPP">WhatsApp Cloud API</option>
                <option value="SMS">SMS (Africa&apos;s Talking / Twilio)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Recipient Phone</label>
              <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
            Preview: {stationName} Receipt — {litres} L {grade} = {formatFcfa(Number(amountXaf || 0))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setReceiptModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Dispatch Receipt</button>
          </div>
        </form>
      </FormModal>

      <FormModal open={campaignModalOpen} onClose={() => setCampaignModalOpen(false)} title="Create Promotional Campaign">
        <form onSubmit={(e) => void handleCreateCampaign(e)} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Campaign Name</label>
            <input type="text" required value={cmpName} onChange={(e) => setCmpName(e.target.value)} placeholder="e.g. Weekend Diesel Bonus" className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Type</label>
              <select value={cmpType} onChange={(e) => setCmpType(e.target.value as 'HAPPY_HOUR' | 'FLEET_REBATE')} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                <option value="HAPPY_HOUR">HAPPY_HOUR</option>
                <option value="FLEET_REBATE">FLEET_REBATE</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Discount %</label>
              <input type="number" step="0.5" min="0.5" max="25" value={cmpPct} onChange={(e) => setCmpPct(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Fuel Grade</label>
              <select value={cmpGrade} onChange={(e) => setCmpGrade(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                <option value="SUPER">SUPER</option>
                <option value="GASOIL">GASOIL</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCampaignModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Launch Campaign</button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
