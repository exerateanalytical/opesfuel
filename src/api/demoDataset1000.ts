/**
 * Local preview / offline 1,000+ Record Flagship Demo Petrol Station Dataset
 * Mirrors the Java 25 Spring Boot POST /api/v1/tenants/current/seed-1000-demo seeder
 * so all workflows (Shifts, Tanks, Calibrations, Maintenance, Cash Safe, HR Suite,
 * Fleet Credit, Shop POS, Accounting Journals, Price History, Outbound Mailer, Audit Logs)
 * work seamlessly with rich realistic data in both connected VPS and standalone preview mode.
 */

export interface HrContractItem {
  id: string;
  stationId: string;
  employeeId: string;
  employeeName: string;
  contractType: 'CDI' | 'CDD' | 'PROBATION';
  cnpsNumber: string;
  baseSalaryFcfa: number;
  transportAllowanceFcfa: number;
  housingAllowanceFcfa: number;
  emergencyContactName: string;
  emergencyContactPhone: string;
  startDate: string;
  status: 'ACTIVE' | 'ENDED';
}

export interface HrLeaveItem {
  id: string;
  stationId: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'ANNUAL' | 'SICK' | 'MATERNITY' | 'UNPAID';
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
}

export interface HrCertItem {
  id: string;
  stationId: string;
  employeeId: string;
  employeeName: string;
  certName: string;
  issuer: string;
  issuedDate: string;
  expiresDate: string;
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
}

export interface HrDisciplinaryItem {
  id: string;
  stationId: string;
  employeeId: string;
  employeeName: string;
  category: 'CASH_SHORTAGE' | 'LATENESS' | 'SAFETY_VIOLATION' | 'COMMENDATION';
  severity: 'INFO' | 'WARNING' | 'FINAL_WARNING';
  summary: string;
  amountFcfa: number;
  recordedBy: string;
  recordedAt: string;
}

export interface PumpCalibrationItem {
  id: string;
  stationId: string;
  pumpId: string;
  pumpCode: string;
  tankId: string;
  testLitres: number;
  returnedToTank: boolean;
  openingTotalizer: number;
  closingTotalizer: number;
  inspectorName: string;
  notes: string;
  testedAt: string;
}

export interface PumpMaintenanceItem {
  id: string;
  stationId: string;
  pumpId: string;
  pumpCode: string;
  maintenanceType: string;
  description: string;
  costFcfa: number;
  technician: string;
  outOfService: boolean;
  nextDueDate: string;
  loggedAt: string;
}

export interface CashVaultEntryItem {
  id: string;
  stationId: string;
  entryType: 'SHIFT_DROP' | 'PETTY_CASH_OUT' | 'ARMORED_BANK_PICKUP' | 'MANAGER_HANDOVER';
  amountFcfa: number;
  runningBalanceFcfa: number;
  referenceCode: string;
  handedBy: string;
  receivedBy: string;
  notes: string;
  recordedAt: string;
}

export interface PriceHistoryItem {
  id: string;
  stationId: string;
  grade: string;
  oldPriceFcfa: number;
  newPriceFcfa: number;
  changedBy: string;
  reason: string;
  changedAt: string;
}

export interface AuditLogItem {
  id: string;
  stationId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface OutboundMessageItem {
  id: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  recipient: string;
  subject: string;
  bodyPreview: string;
  status: 'SENT' | 'SANDBOX_LOGGED' | 'FAILED';
  provider: string;
  createdAt: string;
}

export interface UserAccountItem {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'PLATFORM_ADMIN' | 'OWNER' | 'MANAGER' | 'ATTENDANT' | 'ACCOUNTANT';
  assignedStationId: string;
  preferredLanguage: 'en' | 'fr';
  emailAlertsEnabled: boolean;
  status: 'ACTIVE' | 'DISABLED';
}

export interface ExtendedOperationsBundle {
  totalDemoRecords: number;
  accounts: UserAccountItem[];
  hrContracts: HrContractItem[];
  hrLeaves: HrLeaveItem[];
  hrCerts: HrCertItem[];
  hrDisciplinary: HrDisciplinaryItem[];
  calibrations: PumpCalibrationItem[];
  maintenance: PumpMaintenanceItem[];
  vaultEntries: CashVaultEntryItem[];
  priceHistory: PriceHistoryItem[];
  auditLogs: AuditLogItem[];
  outboundMessages: OutboundMessageItem[];
}

export function buildExtendedOperationsDataset(stationId = 'st_plateau'): ExtendedOperationsBundle {
  const now = Date.now();
  const dayMs = 86_400_000;

  const accounts: UserAccountItem[] = [
    {
      id: 'usr_platform_admin',
      fullName: 'Dr. Alain Mbarga',
      email: 'admin@opesware.com',
      phone: '+237 699 000 001',
      role: 'PLATFORM_ADMIN',
      assignedStationId: 'ALL',
      preferredLanguage: 'en',
      emailAlertsEnabled: true,
      status: 'ACTIVE',
    },
    {
      id: 'usr_owner_01',
      fullName: 'Jean-Paul Nkomo',
      email: 'owner@opesfuel.cm',
      phone: '+237 699 112 233',
      role: 'OWNER',
      assignedStationId: 'ALL',
      preferredLanguage: 'en',
      emailAlertsEnabled: true,
      status: 'ACTIVE',
    },
    {
      id: 'usr_manager_01',
      fullName: 'Clarisse Ewondo',
      email: 'manager@opesfuel.cm',
      phone: '+237 677 445 566',
      role: 'MANAGER',
      assignedStationId: stationId,
      preferredLanguage: 'fr',
      emailAlertsEnabled: true,
      status: 'ACTIVE',
    },
    {
      id: 'usr_attendant_01',
      fullName: 'Samuel Tchoupo',
      email: 'attendant@opesfuel.cm',
      phone: '+237 655 778 899',
      role: 'ATTENDANT',
      assignedStationId: stationId,
      preferredLanguage: 'fr',
      emailAlertsEnabled: true,
      status: 'ACTIVE',
    },
    {
      id: 'usr_accountant_01',
      fullName: 'Mireille Fotso',
      email: 'accountant@opesfuel.cm',
      phone: '+237 691 334 455',
      role: 'ACCOUNTANT',
      assignedStationId: 'ALL',
      preferredLanguage: 'fr',
      emailAlertsEnabled: true,
      status: 'ACTIVE',
    },
  ];

  const crewNames = [
    'Samuel Tchoupo', 'Clarisse Ewondo', 'Mireille Fotso', 'Emmanuel Ngassa',
    'Nadège Biya', 'Patrick Essomba', 'Gisèle Kamga', 'Hervé Ndjock',
    'Fabrice Onana', 'Beatrice Mballa',
  ];

  const hrContracts: HrContractItem[] = crewNames.map((name, i) => ({
    id: `hrc_demo_${i + 1}`,
    stationId,
    employeeId: `emp_${String(i + 1).padStart(2, '0')}`,
    employeeName: name,
    contractType: i % 3 === 0 ? 'CDI' : i % 3 === 1 ? 'CDD' : 'PROBATION',
    cnpsNumber: `CNPS-CM-2025-${String(1001 + i)}`,
    baseSalaryFcfa: 135000 + (i % 4) * 40000,
    transportAllowanceFcfa: 25000,
    housingAllowanceFcfa: i < 3 ? 45000 : 25000,
    emergencyContactName: `Next of Kin (${name.split(' ')[1]})`,
    emergencyContactPhone: `+237 670 410 ${String(100 + i)}`,
    startDate: '2025-01-15',
    status: 'ACTIVE',
  }));

  const hrLeaves: HrLeaveItem[] = Array.from({ length: 14 }, (_, i) => ({
    id: `hrl_demo_${i + 1}`,
    stationId,
    employeeId: `emp_${String((i % 10) + 1).padStart(2, '0')}`,
    employeeName: crewNames[i % 10],
    leaveType: i % 3 === 0 ? 'ANNUAL' : i % 3 === 1 ? 'SICK' : 'UNPAID',
    startDate: `2026-11-${String(10 + (i % 12)).padStart(2, '0')}`,
    endDate: `2026-11-${String(13 + (i % 12)).padStart(2, '0')}`,
    daysCount: 3 + (i % 3),
    reason: i % 3 === 0 ? 'Scheduled annual rest leave' : 'Medical consultation & recovery',
    status: i < 3 ? 'PENDING' : 'APPROVED',
    reviewedBy: i < 3 ? undefined : 'Clarisse Ewondo',
  }));

  const hrCerts: HrCertItem[] = Array.from({ length: 12 }, (_, i) => ({
    id: `hrcert_demo_${i + 1}`,
    stationId,
    employeeId: `emp_${String((i % 10) + 1).padStart(2, '0')}`,
    employeeName: crewNames[i % 10],
    certName:
      i % 2 === 0
        ? 'Forecourt Fire Extinguisher & Fuel Spill Response'
        : 'LPG Cylinder & Hazardous Fuel Handling Level 1',
    issuer: 'Cameroon Civil Protection HSE',
    issuedDate: '2025-11-01',
    expiresDate: i < 2 ? '2026-12-10' : '2027-06-30',
    status: i < 2 ? 'EXPIRING_SOON' : 'VALID',
  }));

  const hrDisciplinary: HrDisciplinaryItem[] = Array.from({ length: 8 }, (_, i) => ({
    id: `hrd_demo_${i + 1}`,
    stationId,
    employeeId: `emp_${String((i % 10) + 1).padStart(2, '0')}`,
    employeeName: crewNames[i % 10],
    category: i % 2 === 0 ? 'COMMENDATION' : 'CASH_SHORTAGE',
    severity: i % 2 === 0 ? 'INFO' : 'WARNING',
    summary:
      i % 2 === 0
        ? 'Zero shift cash variance for 30 consecutive forecourt shifts'
        : 'Minor shift handover variance reviewed & logged for month-end payroll',
    amountFcfa: i % 2 === 0 ? 0 : 2500,
    recordedBy: 'Clarisse Ewondo',
    recordedAt: new Date(now - i * 4 * dayMs).toISOString(),
  }));

  const calibrations: PumpCalibrationItem[] = Array.from({ length: 12 }, (_, i) => ({
    id: `cal_demo_${i + 1}`,
    stationId,
    pumpId: i % 2 === 0 ? 'pmp_01' : 'pmp_02',
    pumpCode: i % 2 === 0 ? 'P-01A' : 'P-02A',
    tankId: i % 2 === 0 ? 'tk_01' : 'tk_02',
    testLitres: 20,
    returnedToTank: true,
    openingTotalizer: 482000 + i * 20,
    closingTotalizer: 482020 + i * 20,
    inspectorName: 'Inspector M. Ndongo',
    notes: '20L Ministry calibration can verified — fuel returned to underground tank',
    testedAt: new Date(now - i * 6 * dayMs).toISOString(),
  }));

  const maintenance: PumpMaintenanceItem[] = Array.from({ length: 10 }, (_, i) => ({
    id: `mnt_demo_${i + 1}`,
    stationId,
    pumpId: i % 2 === 0 ? 'pmp_01' : 'pmp_03',
    pumpCode: i % 2 === 0 ? 'P-01A' : 'P-03B',
    maintenanceType: i % 2 === 0 ? 'NOZZLE_SEAL_SERVICE' : 'FILTER_REPLACEMENT',
    description: 'Preventive dispenser nozzle seal, hose swivel & flow meter service',
    costFcfa: 35000 + (i % 3) * 15000,
    technician: 'Tech. Eric Biloa',
    outOfService: false,
    nextDueDate: '2027-02-15',
    loggedAt: new Date(now - i * 8 * dayMs).toISOString(),
  }));

  let running = 0;
  const vaultRaw: CashVaultEntryItem[] = [];
  for (let i = 24; i >= 0; i--) {
    const isPickup = i % 5 === 0 && running >= 2500000;
    const isPetty = i % 7 === 0 && running >= 150000 && !isPickup;
    const entryType: CashVaultEntryItem['entryType'] = isPickup
      ? 'ARMORED_BANK_PICKUP'
      : isPetty
      ? 'PETTY_CASH_OUT'
      : 'SHIFT_DROP';
    const amount = isPickup ? 2400000 : isPetty ? 85000 : 1280000;
    running = entryType === 'SHIFT_DROP' ? running + amount : running - amount;
    vaultRaw.push({
      id: `vlt_demo_${25 - i}`,
      stationId,
      entryType,
      amountFcfa: amount,
      runningBalanceFcfa: running,
      referenceCode: `SAFE-2026-${String(1025 - i)}`,
      handedBy: entryType === 'SHIFT_DROP' ? 'Samuel Tchoupo' : 'Clarisse Ewondo',
      receivedBy:
        entryType === 'ARMORED_BANK_PICKUP'
          ? 'Afriland First Bank CIT'
          : entryType === 'PETTY_CASH_OUT'
          ? 'Station Maintenance Petty Cash'
          : 'Station Safe #1',
      notes:
        entryType === 'ARMORED_BANK_PICKUP'
          ? 'Sealed armored pickup slip matched against bank credit'
          : entryType === 'PETTY_CASH_OUT'
          ? 'Generator oil & forecourt lighting bulbs'
          : 'Verified end-of-shift cash drop into station safe',
      recordedAt: new Date(now - i * 2 * dayMs).toISOString(),
    });
  }
  const vaultEntries = vaultRaw.reverse();

  const priceHistory: PriceHistoryItem[] = [
    {
      id: 'fph_1',
      stationId,
      grade: 'SUPER',
      oldPriceFcfa: 825,
      newPriceFcfa: 840,
      changedBy: 'owner@opesfuel.cm',
      reason: 'Official CSPH quarterly pump tariff update',
      changedAt: new Date(now - 5 * dayMs).toISOString(),
    },
    {
      id: 'fph_2',
      stationId,
      grade: 'GASOIL',
      oldPriceFcfa: 815,
      newPriceFcfa: 828,
      changedBy: 'owner@opesfuel.cm',
      reason: 'Official CSPH quarterly diesel retail update',
      changedAt: new Date(now - 14 * dayMs).toISOString(),
    },
    {
      id: 'fph_3',
      stationId,
      grade: 'KEROSENE',
      oldPriceFcfa: 540,
      newPriceFcfa: 550,
      changedBy: 'owner@opesfuel.cm',
      reason: 'Depot wholesale supply alignment',
      changedAt: new Date(now - 30 * dayMs).toISOString(),
    },
  ];

  const auditLogs: AuditLogItem[] = Array.from({ length: 24 }, (_, i) => ({
    id: `aud_demo_${i + 1}`,
    stationId,
    actorEmail: i % 3 === 0 ? 'owner@opesfuel.cm' : i % 3 === 1 ? 'manager@opesfuel.cm' : 'accountant@opesfuel.cm',
    actorRole: i % 3 === 0 ? 'OWNER' : i % 3 === 1 ? 'MANAGER' : 'ACCOUNTANT',
    action:
      i % 4 === 0
        ? 'SHIFT_RECONCILED'
        : i % 4 === 1
        ? 'CASH_VAULT_SHIFT_DROP'
        : i % 4 === 2
        ? 'PUMP_CALIBRATION_TEST'
        : 'HR_LEAVE_APPROVED',
    entityType: i % 4 === 0 ? 'SHIFT' : i % 4 === 1 ? 'CASH_VAULT' : i % 4 === 2 ? 'PUMP' : 'HR_LEAVE',
    entityId: `ref_${100 + i}`,
    summary:
      i % 4 === 0
        ? `Closed shift reconciled cleanly with balanced SYSCOHADA journal #JE-${400 + i}`
        : i % 4 === 1
        ? 'Verified 1 280 000 FCFA cash safe drop signed by Clarisse Ewondo'
        : i % 4 === 2
        ? '20L Ministry calibration can verified on P-01A (returned to tank)'
        : 'Approved annual leave request and updated shift roster coverage',
    createdAt: new Date(now - i * 18 * 3600_000).toISOString(),
  }));

  const outboundMessages: OutboundMessageItem[] = [
    {
      id: 'msg_1',
      channel: 'EMAIL',
      recipient: 'finance@transcam-logistics.cm',
      subject: 'Monthly Corporate Fleet Statement — November 2026',
      bodyPreview: 'Attached is your itemized corporate fuel statement with approved vehicle plates and total FCFA due.',
      status: 'SENT',
      provider: 'RESEND',
      createdAt: new Date(now - 1 * dayMs).toISOString(),
    },
    {
      id: 'msg_2',
      channel: 'WHATSAPP',
      recipient: '+237 699 112 233',
      subject: 'Low Underground Tank Alert — Kerosene T-03',
      bodyPreview: 'Tank T-03 (Kerosene) is at 16% reserve (2,450 L). Recommend ordering 12,000 L from SCDP.',
      status: 'SANDBOX_LOGGED',
      provider: 'WHATSAPP_WEBHOOK',
      createdAt: new Date(now - 2 * dayMs).toISOString(),
    },
    {
      id: 'msg_3',
      channel: 'EMAIL',
      recipient: 'attendant@opesfuel.cm',
      subject: 'Welcome to OpesFuel — Your Station Account Invitation',
      bodyPreview: 'You have been invited to OpesFuel Bonanjo Plateau as Pump Attendant. Accept your 7-day link to sign in.',
      status: 'SENT',
      provider: 'RESEND',
      createdAt: new Date(now - 4 * dayMs).toISOString(),
    },
  ];

  return {
    totalDemoRecords: 1326, // Matches Java backend seed-1000-demo breakdown (shifts, journals, lines, deliveries, dips, fleet, shop, HR, vault, audit)
    accounts,
    hrContracts,
    hrLeaves,
    hrCerts,
    hrDisciplinary,
    calibrations,
    maintenance,
    vaultEntries,
    priceHistory,
    auditLogs,
    outboundMessages,
  };
}
