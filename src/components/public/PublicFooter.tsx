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
            API-first petrol station management, forecourt reconciliation, and automated SYSCOHADA FCFA
            accounting for independent sites and regional fuel networks.
          </p>
          <button
            type="button"
            onClick={() => go('status')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-xs font-medium text-emerald-400 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            All Systems Operational
          </button>
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-white mb-4">Product</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button type="button" onClick={() => go('platform')} className="hover:text-white transition-colors">
                Platform &amp; 15 Modules
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('mobile')} className="hover:text-white transition-colors">
                Android &amp; iPhone App
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('integrations')} className="hover:text-white transition-colors">
                Integrations &amp; ATG IoT
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
                Industry Solutions
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('customers')} className="hover:text-white transition-colors">
                Customer Case Studies
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('licensing')} className="hover:text-white transition-colors">
                Perpetual &amp; IP Licensing
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('security')} className="hover:text-white transition-colors">
                Security &amp; Compliance
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-white mb-4">Resources</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button type="button" onClick={() => go('resources')} className="hover:text-white transition-colors">
                Help Center &amp; FAQ
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('api')} className="hover:text-white transition-colors">
                OpenAPI 3.1 Docs
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('resources')} className="hover:text-white transition-colors">
                Platform Changelog
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('status')} className="hover:text-white transition-colors">
                Live System Status
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
                Terms, Privacy &amp; DPA
              </button>
            </li>
            <li className="text-slate-400 font-mono text-xs pt-1">info@opesware.com</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <span>© 2026 OpesFuel by Opesware. All rights reserved.</span>
          <span>99.9% Uptime SLA · SYSCOHADA &amp; IFRS Ready · Java 25 Spring Boot · PostgreSQL 17 ACID</span>
        </div>
      </div>
    </footer>
  );
};
