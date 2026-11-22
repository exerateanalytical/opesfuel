import React, { useState } from 'react';
import { PublicPage } from '../../domain/types';

interface CookiePrivacyNoticeProps {
  onNavigate: (page: PublicPage) => void;
}

const CONSENT_KEY = 'opesfuel_privacy_ack_v1';

export const CookiePrivacyNotice: React.FC<CookiePrivacyNoticeProps> = ({ onNavigate }) => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(CONSENT_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const accept = () => {
    try {
      window.localStorage.setItem(CONSENT_KEY, '1');
    } catch {
      // ignore storage errors
    }
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 glass-surface rounded-xl p-4 shadow-lg no-print">
      <div className="space-y-3">
        <p className="text-xs text-slate-700 leading-relaxed">
          OpesFuel uses essential session storage to keep your language preference and secure sign-in active.
          We never sell station data.{' '}
          <button
            type="button"
            onClick={() => onNavigate('legal')}
            className="font-semibold text-slate-950 underline hover:text-amber-700"
          >
            Read Privacy Policy
          </button>
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={accept}
            className="px-3.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
