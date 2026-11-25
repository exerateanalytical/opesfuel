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
    <div className="fixed bottom-3 left-3 right-3 sm:bottom-4 sm:left-auto sm:right-6 sm:max-w-md z-40 glass-surface rounded-xl px-3 py-2.5 sm:p-4 shadow-lg no-print">
      <div className="flex items-center gap-3 sm:block sm:space-y-3">
        <p className="text-[13px] sm:text-xs text-slate-700 leading-snug sm:leading-relaxed flex-1">
          OpesFuel uses essential session storage for your language and secure sign-in. We never sell station data.{' '}
          <button
            type="button"
            onClick={() => onNavigate('legal')}
            className="font-semibold text-slate-950 underline hover:text-amber-700"
          >
            Privacy Policy
          </button>
        </p>
        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={accept}
            className="px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-sm sm:text-xs font-semibold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
