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
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="space-y-3">
          <OpesFuelLogo variant="light" size="md" showSubline />
          <p className="text-sm text-slate-400 leading-relaxed">
            API-first petrol station management, forecourt reconciliation, and automated FCFA
            accounting built for independent stations and regional fuel networks.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Product</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button type="button" onClick={() => go('platform')} className="hover:text-white transition-colors">
                Platform Modules
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('pricing')} className="hover:text-white transition-colors">
                Pricing (from 25 000 FCFA/mo)
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('licensing')} className="hover:text-white transition-colors">
                Perpetual &amp; IP Licensing
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('mobile')} className="hover:text-white transition-colors">
                Android &amp; iPhone App
              </button>
            </li>
            <li>
              <button type="button" onClick={onOpenConsole} className="hover:text-white transition-colors">
                Station Portal Login
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Architecture &amp; API</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button type="button" onClick={() => go('api')} className="hover:text-white transition-colors">
                OpenAPI 3.1 Specification
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('api')} className="hover:text-white transition-colors">
                Java 25 Spring Boot Backend
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('api')} className="hover:text-white transition-colors">
                Auth0 &amp; Domain Events
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Company</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button type="button" onClick={() => go('contact')} className="hover:text-white transition-colors">
                Schedule Enterprise Onboarding
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go('legal')} className="hover:text-white transition-colors">
                Terms &amp; Data Privacy
              </button>
            </li>
            <li className="text-slate-400">info@opesware.com</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <span>© 2026 OpesFuel by Opesware. All rights reserved.</span>
          <span>99.9% Uptime SLA · SYSCOHADA &amp; IFRS Ready · Java 25 Spring Boot · PostgreSQL 17 ACID</span>
        </div>
      </div>
    </footer>
  );
};
