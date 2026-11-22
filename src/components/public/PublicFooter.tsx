import React from 'react';
import { PublicPage } from '../../domain/types';
import { OpesFuelLogo } from '../brand/OpesFuelLogo';

interface PublicFooterProps {
  onNavigate: (page: PublicPage) => void;
  onOpenConsole: () => void;
}

export const PublicFooter: React.FC<PublicFooterProps> = ({ onNavigate, onOpenConsole }) => {
  const go = (page: PublicPage) => {
    onNavigate(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
        <div className="sm:col-span-2 lg:col-span-1 space-y-4">
          <OpesFuelLogo variant="light" size="md" showSubline />
          <p className="text-sm text-slate-400 leading-relaxed">
            Simple, reliable petrol station management for pump shifts, underground tanks, mobile money,
            corporate fleets, staff payroll, and daily FCFA accounting.
          </p>
          <button
            type="button"
            onClick={() => go('status')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-xs font-medium text-emerald-400 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            All Services Running Normally
          </button>
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-white mb-4">Features</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button type="button" onClick={() => go('platform')} className="hover:text-white transition-colors">
                Station Management Features
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('mobile')} className="hover:text-white transition-colors">
                Android &amp; iPhone App
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('integrations')} className="hover:text-white transition-colors">
                Payments &amp; Tank Gauges
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('pricing')} className="hover:text-white transition-colors">
                Pricing (from 25 000 FCFA/mo)
              </button>
            </li>
            <li>
              <button type="button" onClick={onOpenConsole} className="hover:text-white transition-colors">
                Station Portal Sign In
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-white mb-4">Solutions</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button type="button" onClick={() => go('solutions')} className="hover:text-white transition-colors">
                By Station Type
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('customers')} className="hover:text-white transition-colors">
                Customer Stories
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('licensing')} className="hover:text-white transition-colors">
                Private Server License
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('security')} className="hover:text-white transition-colors">
                Anti-Fraud &amp; Data Security
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-white mb-4">Help &amp; Docs</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button type="button" onClick={() => go('docs')} className="hover:text-white transition-colors">
                Station User Manual (Docs)
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('faq')} className="hover:text-white transition-colors">
                Frequently Asked Questions
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('resources')} className="hover:text-white transition-colors">
                Launch Checklists &amp; Updates
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('api')} className="hover:text-white transition-colors">
                IT &amp; Developer API
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('status')} className="hover:text-white transition-colors">
                Service Status
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-white mb-4">Company</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button type="button" onClick={() => go('about')} className="hover:text-white transition-colors">
                About OpesFuel
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('contact')} className="hover:text-white transition-colors">
                Book a Live Demo
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('legal')} className="hover:text-white transition-colors">
                Terms, Privacy &amp; SLA
              </button>
            </li>
            <li className="text-slate-400 font-mono text-xs pt-1">info@opesware.com</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <span>© 2026 OpesFuel by Opesware. All rights reserved.</span>
          <span>99.9% Uptime Guarantee · SYSCOHADA &amp; IFRS Ready · Built for Petrol Stations in FCFA</span>
        </div>
      </div>
    </footer>
  );
};
