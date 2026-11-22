import React, { useState } from 'react';
import { Database, Mail, Plus, Search, Shield, UserCheck } from 'lucide-react';
import {
  AuditLogItem,
  OutboundMessageItem,
  UserAccountItem,
} from '../../api/demoDataset1000';
import { formatShortDate } from '../../domain/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import { FormModal } from '../shared/FormModal';

interface SecurityAuditAndProfilePanelProps {
  accounts: UserAccountItem[];
  auditLogs: AuditLogItem[];
  outboundMessages: OutboundMessageItem[];
  totalDemoRecords: number;
  onSeed1000Demo: () => void;
  onSendOutbound: (msg: {
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
    recipient: string;
    subject: string;
    body: string;
  }) => void;
  onUpdateProfile: (profile: {
    fullName: string;
    phone: string;
    preferredLanguage: 'en' | 'fr';
    emailAlertsEnabled: boolean;
  }) => void;
}

export const SecurityAuditAndProfilePanel: React.FC<SecurityAuditAndProfilePanelProps> = ({
  accounts,
  auditLogs,
  outboundMessages,
  totalDemoRecords,
  onSeed1000Demo,
  onSendOutbound,
  onUpdateProfile,
}) => {
  const { lang, setLang } = useLanguage();
  const [tab, setTab] = useState<'audit' | 'accounts' | 'messages'>('audit');
  const [auditQuery, setAuditQuery] = useState('');
  const [msgModal, setMsgModal] = useState(false);
  const [profileModal, setProfileModal] = useState(false);

  const [channel, setChannel] = useState<'EMAIL' | 'SMS' | 'WHATSAPP'>('EMAIL');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [pName, setPName] = useState(accounts[1]?.fullName ?? 'Jean-Paul Nkomo');
  const [pPhone, setPPhone] = useState(accounts[1]?.phone ?? '+237 699 112 233');
  const [pLang, setPLang] = useState<'en' | 'fr'>(lang);
  const [pAlerts, setPAlerts] = useState(true);

  const filteredLogs = auditLogs.filter(
    (l) =>
      !auditQuery.trim() ||
      l.action.toLowerCase().includes(auditQuery.toLowerCase()) ||
      l.actorEmail.toLowerCase().includes(auditQuery.toLowerCase()) ||
      l.summary.toLowerCase().includes(auditQuery.toLowerCase())
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-950">
            Security Audit Trail, 5-Role Accounts, Email/WhatsApp &amp; 1,000+ Demo Seeder
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track every sensitive station action, verify all 5 user account types, dispatch statements, and load the full 1,000+ demo petrol station dataset.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setProfileModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold"
          >
            <UserCheck className="w-3.5 h-3.5" /> My Profile &amp; Language
          </button>
          <button
            type="button"
            onClick={() => setMsgModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Send Email / WhatsApp
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Load or refresh the flagship 1,300+ record Demo Petrol Station dataset (shifts, tanks, deliveries, fleets, HR, vault, and balanced SYSCOHADA journals)?'
                )
              ) {
                onSeed1000Demo();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
          >
            <Database className="w-3.5 h-3.5" /> Seed 1,300+ Demo Data ({totalDemoRecords})
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
              tab === 'audit' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Security Audit Trail ({auditLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('accounts')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
              tab === 'accounts' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> All 5 Account Types ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('messages')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
              tab === 'messages' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Outbound Email / WhatsApp ({outboundMessages.length})
          </button>
        </div>

        {tab === 'audit' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={auditQuery}
              onChange={(e) => setAuditQuery(e.target.value)}
              placeholder="Filter actor or action..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
            />
          </div>
        )}
      </div>

      {tab === 'audit' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">{formatShortDate(l.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-slate-900">{l.actorEmail}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-700">{l.actorRole}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{l.action}</td>
                  <td className="px-4 py-3 text-slate-600">{l.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'accounts' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Role Account Type</th>
                <th className="px-4 py-3">Login Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{a.fullName}</td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{a.role}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{a.email}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{a.phone}</td>
                  <td className="px-4 py-3 font-mono uppercase">{a.preferredLanguage}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'messages' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Sent At</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {outboundMessages.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-mono text-slate-500">{formatShortDate(m.createdAt)}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{m.channel}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{m.recipient}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{m.subject}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Popup Modals */}
      <FormModal
        open={msgModal}
        title="Dispatch Transactional Email / SMS / WhatsApp"
        subtitle="Send staff invitations, monthly fleet statements, or low-tank alerts."
        onClose={() => setMsgModal(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!recipient.trim() || !subject.trim() || !body.trim()) return;
            onSendOutbound({ channel, recipient: recipient.trim(), subject: subject.trim(), body: body.trim() });
            setRecipient('');
            setSubject('');
            setBody('');
            setMsgModal(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value as 'EMAIL' | 'SMS' | 'WHATSAPP')} className="opes-input">
                <option value="EMAIL">Email (Resend / SMTP)</option>
                <option value="WHATSAPP">WhatsApp Alert</option>
                <option value="SMS">SMS Notification</option>
              </select>
            </div>
            <div>
              <label className="opes-label">Recipient Email or Phone</label>
              <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="finance@client.cm" className="opes-input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Monthly Corporate Fuel Statement" className="opes-input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Message Body</label>
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write message content..."
                className="w-full p-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-amber-600"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setMsgModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold">
              Send Message
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={profileModal}
        title="My Profile & Language Preferences"
        subtitle="Update your display name, phone number, alerts, and EN/FR language."
        onClose={() => setProfileModal(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLang(pLang);
            onUpdateProfile({
              fullName: pName.trim(),
              phone: pPhone.trim(),
              preferredLanguage: pLang,
              emailAlertsEnabled: pAlerts,
            });
            setProfileModal(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="opes-label">Full Name</label>
              <input value={pName} onChange={(e) => setPName(e.target.value)} className="opes-input" required />
            </div>
            <div>
              <label className="opes-label">Phone / WhatsApp</label>
              <input value={pPhone} onChange={(e) => setPPhone(e.target.value)} className="opes-input" />
            </div>
            <div className="sm:col-span-2">
              <label className="opes-label">Interface Language</label>
              <select value={pLang} onChange={(e) => setPLang(e.target.value as 'en' | 'fr')} className="opes-input">
                <option value="en">English (EN)</option>
                <option value="fr">Français (FR)</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2.5">
              <input id="p-alerts" type="checkbox" checked={pAlerts} onChange={(e) => setPAlerts(e.target.checked)} className="w-4 h-4 accent-amber-600" />
              <label htmlFor="p-alerts" className="text-xs font-medium text-slate-700">
                Receive daily shortage, low-tank, and invoice alerts by email
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setProfileModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              Save Preferences
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
