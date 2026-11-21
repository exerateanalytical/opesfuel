import { ConsoleSection, UserRole } from '../domain/types';

export interface AuthSession {
  mode: 'DEMO_RBAC' | 'AUTH0_OIDC';
  userName: string;
  email: string;
  role: UserRole;
  accessToken: string | null;
  auth0Configured: boolean;
}

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID || '';
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE || 'https://api.opesfuel.com/v1';

export const isAuth0Configured = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

export const ROLE_PROFILES: Record<UserRole, { name: string; email: string; title: string; summary: string }> = {
  OWNER: {
    name: 'Jean-Paul Mbarga',
    email: 'owner@opesfuel.com',
    title: 'Station Network Owner',
    summary: 'Full access across stations, pricing, accounting statements, payroll, and API keys.',
  },
  MANAGER: {
    name: 'Amina Diallo',
    email: 'manager@opesfuel.com',
    title: 'Forecourt Station Manager',
    summary: 'Manages pump shifts, tanker deliveries, dipstick checks, staff roster, and station expenses.',
  },
  ATTENDANT: {
    name: 'Koffi Mensah',
    email: 'attendant@opesfuel.com',
    title: 'Pump Island Attendant',
    summary: 'Opens/closes assigned pump shifts, records cash/MoMo tenders, fleet vouchers, and shop sales.',
  },
  ACCOUNTANT: {
    name: 'Clarisse Ndiaye',
    email: 'finance@opesfuel.com',
    title: 'Chief Accountant',
    summary: 'Audits double-entry journals, settles fleet AR, records treasury deposits, and exports P&L/Trial Balance.',
  },
};

export function canAccessSection(role: UserRole, section: ConsoleSection): boolean {
  if (section === 'mobile-app') return true;
  switch (role) {
    case 'OWNER':
      return true;
    case 'MANAGER':
      return section !== 'api-platform' && section !== 'admin';
    case 'ATTENDANT':
      return section === 'overview' || section === 'forecourt' || section === 'fleet';
    case 'ACCOUNTANT':
      return (
        section === 'overview' ||
        section === 'fleet' ||
        section === 'accounting' ||
        section === 'workforce' ||
        section === 'ai-assistant'
      );
  }
}

export function canPerformAction(
  role: UserRole,
  action:
    | 'MANAGE_STATIONS_PRICES'
    | 'OPEN_CLOSE_SHIFT'
    | 'RECORD_DELIVERY'
    | 'RECORD_DIPSTICK'
    | 'MANAGE_EMPLOYEES'
    | 'SETTLE_FLEET'
    | 'RECORD_EXPENSE_DEPOSIT'
    | 'MANAGE_API_PLATFORM'
    | 'MANAGE_AI_ADDON'
): boolean {
  switch (action) {
    case 'MANAGE_STATIONS_PRICES':
    case 'MANAGE_API_PLATFORM':
      return role === 'OWNER';
    case 'MANAGE_AI_ADDON':
      return role === 'OWNER' || role === 'MANAGER';
    case 'OPEN_CLOSE_SHIFT':
      return role === 'OWNER' || role === 'MANAGER' || role === 'ATTENDANT';
    case 'RECORD_DELIVERY':
    case 'MANAGE_EMPLOYEES':
      return role === 'OWNER' || role === 'MANAGER';
    case 'RECORD_DIPSTICK':
      return role === 'OWNER' || role === 'MANAGER' || role === 'ATTENDANT';
    case 'SETTLE_FLEET':
    case 'RECORD_EXPENSE_DEPOSIT':
      return role === 'OWNER' || role === 'MANAGER' || role === 'ACCOUNTANT';
  }
}

export function buildAuth0AuthorizeUrl(): string | null {
  if (!isAuth0Configured) return null;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: AUTH0_CLIENT_ID,
    redirect_uri: window.location.origin,
    scope: 'openid profile email',
    audience: AUTH0_AUDIENCE,
  });
  return `https://${AUTH0_DOMAIN}/authorize?${params.toString()}`;
}
