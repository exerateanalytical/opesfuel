export interface HseRecordItem {
  id: string;
  stationId: string;
  recordType: 'INCIDENT_SPILL' | 'FIRE_EXTINGUISHER' | 'SAFETY_DRILL' | 'WASTE_OIL' | 'TANK_LEAK_CHECK' | 'PERMIT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  details: string;
  inspectorOrReporter: string;
  nextDueDate: string;
  capaAction: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLIANT' | 'CLOSED';
  recordedAt: string;
}

export interface FraudCaseItem {
  id: string;
  stationId: string;
  anomalyType: 'SHIFT_SHORTAGE' | 'TANK_SHRINKAGE' | 'SHORT_DELIVERY' | 'METER_TAMPER' | 'FLEET_VELOCITY';
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  subjectRef: string;
  suspectedLossFcfa: number;
  recoveredFcfa: number;
  investigator: string;
  findings: string;
  disposition: 'UNDER_INVESTIGATION' | 'CONFIRMED_FRAUD' | 'FALSE_POSITIVE' | 'RECOVERED_CLOSED';
  openedAt: string;
}

export interface FuelQualitySampleItem {
  id: string;
  stationId: string;
  tankId: string;
  tankName: string;
  fuelGrade: string;
  batchCoaRef: string;
  densityKgM3: number;
  temperatureC: number;
  waterPasteDetected: boolean;
  quarantined: boolean;
  testedBy: string;
  notes: string;
  testedAt: string;
}

export interface InterstationTransferItem {
  id: string;
  fromStationId: string;
  fromStationName: string;
  toStationId: string;
  toStationName: string;
  fuelGrade: string;
  dispatchedLitres: number;
  receivedLitres: number | null;
  sealNumber: string;
  tankerPlate: string;
  driverName: string;
  status: 'IN_TRANSIT' | 'RECEIVED' | 'DISPUTED' | 'CANCELLED';
  dispatchedAt: string;
}

export interface ServiceBayTicketItem {
  id: string;
  stationId: string;
  serviceCategory: 'CAR_WASH' | 'OIL_CHANGE' | 'TIRE_SERVICE' | 'DIAGNOSTIC';
  vehiclePlate: string;
  customerName: string;
  technicianName: string;
  amountFcfa: number;
  paymentMethod: 'CASH' | 'MOBILE_MONEY' | 'CARD';
  status: 'COMPLETED' | 'IN_BAY';
  createdAt: string;
}

export interface LoyaltyVoucherItem {
  id: string;
  stationId: string;
  voucherCode: string;
  customerName: string;
  customerPhone: string;
  issuedFcfa: number;
  balanceFcfa: number;
  loyaltyPoints: number;
  status: 'ACTIVE' | 'REDEEMED' | 'EXPIRED';
  issuedAt: string;
}

export interface BulkWholesaleOrderItem {
  id: string;
  stationId: string;
  customerCompany: string;
  fuelGrade: string;
  volumeLitres: number;
  unitPriceFcfa: number;
  totalFcfa: number;
  tankerTruckCode: string;
  driverName: string;
  deliveryDestination: string;
  status: 'SCHEDULED' | 'DISPATCHED' | 'DELIVERED_POD';
  createdAt: string;
}

export interface FixedAssetItem {
  id: string;
  stationId: string;
  assetTag: string;
  assetName: string;
  category: 'UNDERGROUND_TANK' | 'FUEL_DISPENSER' | 'GENERATOR' | 'CANOPY' | 'POS_IT' | 'SOLAR';
  acquisitionDate: string;
  acquisitionCostFcfa: number;
  usefulLifeYears: number;
  custodian: string;
  insurancePolicy: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'DISPOSED';
}

export interface StationBudgetItem {
  id: string;
  stationId: string;
  periodLabel: string;
  category: string;
  budgetFcfa: number;
  actualFcfa: number;
}

export interface MakerCheckerApprovalItem {
  id: string;
  stationId: string;
  requestType: 'PO_APPROVAL' | 'PRICE_CHANGE' | 'CAPEX_EXPENSE' | 'CREDIT_LIMIT';
  title: string;
  amountFcfa: number;
  requestedBy: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedBy?: string;
  createdAt: string;
}

export interface EvUtilityReadingItem {
  id: string;
  stationId: string;
  meterType: 'EV_CHARGER_SESSION' | 'GRID_ELECTRICITY' | 'SOLAR_GENERATION' | 'GENERATOR_DIESEL';
  connectorOrMeter: string;
  quantityUnit: number;
  unitLabel: string;
  revenueOrCostFcfa: number;
  recordedAt: string;
}

export interface FranchiseAgreementItem {
  id: string;
  stationId: string;
  dealerName: string;
  operatingModel: 'COCO' | 'CODO' | 'DODO';
  royaltyFcfaPerLitre: number;
  monthlyTargetLitres: number;
  complianceScorePct: number;
  renewalDate: string;
  status: 'ACTIVE' | 'UNDER_REVIEW';
}

export interface EnterpriseModulesDataset {
  hseRecords: HseRecordItem[];
  fraudCases: FraudCaseItem[];
  qualitySamples: FuelQualitySampleItem[];
  transfers: InterstationTransferItem[];
  serviceBayTickets: ServiceBayTicketItem[];
  loyaltyVouchers: LoyaltyVoucherItem[];
  bulkOrders: BulkWholesaleOrderItem[];
  fixedAssets: FixedAssetItem[];
  budgets: StationBudgetItem[];
  approvals: MakerCheckerApprovalItem[];
  evUtility: EvUtilityReadingItem[];
  franchises: FranchiseAgreementItem[];
}

export function buildEnterpriseModulesDataset(defaultStationId: string): EnterpriseModulesDataset {
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();

  return {
    hseRecords: [
      {
        id: 'hse_01',
        stationId: defaultStationId,
        recordType: 'FIRE_EXTINGUISHER',
        severity: 'LOW',
        title: 'Forecourt Islands 1–3 CO2 & Dry Powder Inspection',
        details: 'All 6 x 9kg extinguishers inspected; pressure green, hydro-test valid, sand buckets full.',
        inspectorOrReporter: 'HSE Officer Paul M.',
        nextDueDate: '2027-05-15',
        capaAction: 'Replace nozzle tag on Island 2 unit before Q2 audit.',
        status: 'COMPLIANT',
        recordedAt: daysAgo(2),
      },
      {
        id: 'hse_02',
        stationId: defaultStationId,
        recordType: 'TANK_LEAK_CHECK',
        severity: 'MEDIUM',
        title: 'Underground Sump & Interstitial Pressure Check (T-01/T-02)',
        details: 'Zero hydrocarbon vapor detected in monitoring wells; manhole gaskets dry.',
        inspectorOrReporter: 'Eng. Eric Biloa',
        nextDueDate: '2027-02-01',
        capaAction: 'Clean oil-water separator interceptor monthly.',
        status: 'COMPLIANT',
        recordedAt: daysAgo(5),
      },
      {
        id: 'hse_03',
        stationId: defaultStationId,
        recordType: 'INCIDENT_SPILL',
        severity: 'MEDIUM',
        title: 'Minor 4L Gasoil Nozzle Overfill — Island 2',
        details: 'Customer tank splashback; attendant deployed absorbent sand within 60 seconds and cleared bay.',
        inspectorOrReporter: 'Samuel Tchoupo',
        nextDueDate: '2026-12-01',
        capaAction: 'Auto-shutoff nozzle sensor tested & recalibrated.',
        status: 'CLOSED',
        recordedAt: daysAgo(8),
      },
      {
        id: 'hse_04',
        stationId: defaultStationId,
        recordType: 'PERMIT',
        severity: 'HIGH',
        title: 'MINEE / Environmental Operating Permit Renewal',
        details: 'Annual hazardous fuel storage compliance dossier prepared for regional inspection.',
        inspectorOrReporter: 'Station Director',
        nextDueDate: '2027-01-31',
        capaAction: 'Submit updated waste-oil manifest and fire drill signoff sheet.',
        status: 'IN_PROGRESS',
        recordedAt: daysAgo(1),
      },
    ],
    fraudCases: [
      {
        id: 'frd_01',
        stationId: defaultStationId,
        anomalyType: 'SHIFT_SHORTAGE',
        severity: 'HIGH',
        subjectRef: 'SHF-NIGHT-042 · Pump P-02',
        suspectedLossFcfa: 68500,
        recoveredFcfa: 68500,
        investigator: 'Chief Accountant',
        findings: 'Unlogged Orange Money merchant payment confirmed on MoMo statement; reconciled & recovered.',
        disposition: 'RECOVERED_CLOSED',
        openedAt: daysAgo(6),
      },
      {
        id: 'frd_02',
        stationId: defaultStationId,
        anomalyType: 'SHORT_DELIVERY',
        severity: 'HIGH',
        subjectRef: 'DEL-SCDP-904 · Tank T-02 Gasoil',
        suspectedLossFcfa: 142000,
        recoveredFcfa: 0,
        investigator: 'Station Owner',
        findings: '195 L gap between SCDP Bill-of-Lading and post-offload calibrated dipstick; supplier credit claim filed.',
        disposition: 'UNDER_INVESTIGATION',
        openedAt: daysAgo(3),
      },
    ],
    qualitySamples: [
      {
        id: 'qc_01',
        stationId: defaultStationId,
        tankId: 'tk_01',
        tankName: 'Underground Tank T-01 (Super)',
        fuelGrade: 'SUPER',
        batchCoaRef: 'SCDP-COA-2026-8841',
        densityKgM3: 744.8,
        temperatureC: 27.4,
        waterPasteDetected: false,
        quarantined: false,
        testedBy: 'Manager Jean-Luc',
        notes: 'Clear bright visual sample, Kolor Kut water paste negative.',
        testedAt: daysAgo(1),
      },
      {
        id: 'qc_02',
        stationId: defaultStationId,
        tankId: 'tk_02',
        tankName: 'Underground Tank T-02 (Gasoil)',
        fuelGrade: 'GASOIL',
        batchCoaRef: 'SCDP-COA-2026-8842',
        densityKgM3: 838.5,
        temperatureC: 27.9,
        waterPasteDetected: false,
        quarantined: false,
        testedBy: 'Manager Jean-Luc',
        notes: 'Density within CEMAC spec (820–860 kg/m3), zero sediment.',
        testedAt: daysAgo(2),
      },
    ],
    transfers: [
      {
        id: 'trf_01',
        fromStationId: defaultStationId,
        fromStationName: 'OpesFuel Bonanjo Plateau',
        toStationId: 'st_bastos',
        toStationName: 'OpesFuel Bastos Express',
        fuelGrade: 'GASOIL',
        dispatchedLitres: 6000,
        receivedLitres: 5994,
        sealNumber: 'SEAL-CM-44108',
        tankerPlate: 'LT-884-TK',
        driverName: 'Ibrahim Souley',
        status: 'RECEIVED',
        dispatchedAt: daysAgo(4),
      },
      {
        id: 'trf_02',
        fromStationId: defaultStationId,
        fromStationName: 'OpesFuel Bonanjo Plateau',
        toStationId: 'st_bastos',
        toStationName: 'OpesFuel Bastos Express',
        fuelGrade: 'SUPER',
        dispatchedLitres: 4500,
        receivedLitres: null,
        sealNumber: 'SEAL-CM-44219',
        tankerPlate: 'LT-884-TK',
        driverName: 'Ibrahim Souley',
        status: 'IN_TRANSIT',
        dispatchedAt: daysAgo(0),
      },
    ],
    serviceBayTickets: [
      {
        id: 'bay_01',
        stationId: defaultStationId,
        serviceCategory: 'OIL_CHANGE',
        vehiclePlate: 'LT-402-CM',
        customerName: 'Jean-Baptiste K.',
        technicianName: 'Tech. Rodrigue',
        amountFcfa: 28500,
        paymentMethod: 'MOBILE_MONEY',
        status: 'COMPLETED',
        createdAt: daysAgo(0),
      },
      {
        id: 'bay_02',
        stationId: defaultStationId,
        serviceCategory: 'CAR_WASH',
        vehiclePlate: 'CE-918-AB',
        customerName: 'Nadine Essomba',
        technicianName: 'Tech. Marcel',
        amountFcfa: 5000,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        createdAt: daysAgo(0),
      },
      {
        id: 'bay_03',
        stationId: defaultStationId,
        serviceCategory: 'TIRE_SERVICE',
        vehiclePlate: 'LT-771-GE',
        customerName: 'TransCam Logistics',
        technicianName: 'Tech. Rodrigue',
        amountFcfa: 14000,
        paymentMethod: 'CARD',
        status: 'COMPLETED',
        createdAt: daysAgo(1),
      },
    ],
    loyaltyVouchers: [
      {
        id: 'vch_01',
        stationId: defaultStationId,
        voucherCode: 'OPF-92A4K1',
        customerName: 'Dr. Emmanuel Ndi',
        customerPhone: '+237 699 441 820',
        issuedFcfa: 100000,
        balanceFcfa: 64000,
        loyaltyPoints: 145,
        status: 'ACTIVE',
        issuedAt: daysAgo(5),
      },
      {
        id: 'vch_02',
        stationId: defaultStationId,
        voucherCode: 'OPF-77B2M9',
        customerName: 'Clinique Bonanjo',
        customerPhone: '+237 677 204 511',
        issuedFcfa: 250000,
        balanceFcfa: 250000,
        loyaltyPoints: 250,
        status: 'ACTIVE',
        issuedAt: daysAgo(2),
      },
    ],
    bulkOrders: [
      {
        id: 'blk_01',
        stationId: defaultStationId,
        customerCompany: 'MTN Cameroon Tower Backup Sites',
        fuelGrade: 'GASOIL',
        volumeLitres: 15000,
        unitPriceFcfa: 795,
        totalFcfa: 11925000,
        tankerTruckCode: 'TRK-OPF-01 (24kL)',
        driverName: 'Moussa Bello',
        deliveryDestination: 'Douala Bonaberi Industrial Zone',
        status: 'DISPATCHED',
        createdAt: daysAgo(1),
      },
      {
        id: 'blk_02',
        stationId: defaultStationId,
        customerCompany: 'Dangote Cement Quarry Fleet',
        fuelGrade: 'GASOIL',
        volumeLitres: 20000,
        unitPriceFcfa: 790,
        totalFcfa: 15800000,
        tankerTruckCode: 'TRK-OPF-02 (32kL)',
        driverName: 'Ibrahim Souley',
        deliveryDestination: 'Douala Port Quarry',
        status: 'DELIVERED_POD',
        createdAt: daysAgo(4),
      },
    ],
    fixedAssets: [
      {
        id: 'ast_01',
        stationId: defaultStationId,
        assetTag: 'FA-TANK-01',
        assetName: 'Double-Walled Underground Tank 40,000L (Super)',
        category: 'UNDERGROUND_TANK',
        acquisitionDate: '2023-03-10',
        acquisitionCostFcfa: 24000000,
        usefulLifeYears: 20,
        custodian: 'Station Manager',
        insurancePolicy: 'AXA-CEMAC-2026-881',
        status: 'ACTIVE',
      },
      {
        id: 'ast_02',
        stationId: defaultStationId,
        assetTag: 'FA-DISP-01',
        assetName: 'Gilbarco Encore 700S 4-Nozzle Dispenser (Island 1)',
        category: 'FUEL_DISPENSER',
        acquisitionDate: '2024-06-01',
        acquisitionCostFcfa: 14500000,
        usefulLifeYears: 10,
        custodian: 'Forecourt Supervisor',
        insurancePolicy: 'AXA-CEMAC-2026-881',
        status: 'ACTIVE',
      },
      {
        id: 'ast_03',
        stationId: defaultStationId,
        assetTag: 'FA-GEN-01',
        assetName: 'Perkins 60kVA Standby Diesel Generator + ATS',
        category: 'GENERATOR',
        acquisitionDate: '2024-01-20',
        acquisitionCostFcfa: 11200000,
        usefulLifeYears: 8,
        custodian: 'Maintenance Tech',
        insurancePolicy: 'AXA-CEMAC-2026-884',
        status: 'ACTIVE',
      },
      {
        id: 'ast_04',
        stationId: defaultStationId,
        assetTag: 'FA-SOL-01',
        assetName: '15kW Rooftop Canopy Solar + Lithium Backup Bank',
        category: 'SOLAR',
        acquisitionDate: '2025-04-12',
        acquisitionCostFcfa: 9800000,
        usefulLifeYears: 12,
        custodian: 'Station Director',
        insurancePolicy: 'AXA-CEMAC-2026-890',
        status: 'ACTIVE',
      },
    ],
    budgets: [
      { id: 'bdg_01', stationId: defaultStationId, periodLabel: '2026-11', category: 'UTILITIES_POWER', budgetFcfa: 480000, actualFcfa: 392000 },
      { id: 'bdg_02', stationId: defaultStationId, periodLabel: '2026-11', category: 'PUMP_MAINTENANCE', budgetFcfa: 350000, actualFcfa: 295000 },
      { id: 'bdg_03', stationId: defaultStationId, periodLabel: '2026-11', category: 'STAFF_PAYROLL', budgetFcfa: 2450000, actualFcfa: 2380000 },
      { id: 'bdg_04', stationId: defaultStationId, periodLabel: '2026-11', category: 'SECURITY_HSE', budgetFcfa: 420000, actualFcfa: 445000 },
    ],
    approvals: [
      {
        id: 'apr_01',
        stationId: defaultStationId,
        requestType: 'PO_APPROVAL',
        title: 'SCDP Bulk Replenishment PO — 25,000L Gasoil',
        amountFcfa: 17950000,
        requestedBy: 'manager@opesfuel.cm',
        status: 'PENDING',
        createdAt: daysAgo(0),
      },
      {
        id: 'apr_02',
        stationId: defaultStationId,
        requestType: 'CREDIT_LIMIT',
        title: 'Increase Corporate Fleet Credit Limit — Brasseries du Cameroun (+3M FCFA)',
        amountFcfa: 8000000,
        requestedBy: 'accountant@opesfuel.cm',
        status: 'PENDING',
        createdAt: daysAgo(1),
      },
    ],
    evUtility: [
      {
        id: 'evu_01',
        stationId: defaultStationId,
        meterType: 'EV_CHARGER_SESSION',
        connectorOrMeter: 'CCS2-DC-60kW Bay #1',
        quantityUnit: 48.4,
        unitLabel: 'kWh',
        revenueOrCostFcfa: 16940,
        recordedAt: daysAgo(0),
      },
      {
        id: 'evu_02',
        stationId: defaultStationId,
        meterType: 'SOLAR_GENERATION',
        connectorOrMeter: 'Canopy Solar Inverter 15kW',
        quantityUnit: 64.2,
        unitLabel: 'kWh',
        revenueOrCostFcfa: 7704,
        recordedAt: daysAgo(0),
      },
      {
        id: 'evu_03',
        stationId: defaultStationId,
        meterType: 'GENERATOR_DIESEL',
        connectorOrMeter: 'Perkins 60kVA Standby Gen',
        quantityUnit: 32.0,
        unitLabel: 'Litres',
        revenueOrCostFcfa: 26496,
        recordedAt: daysAgo(1),
      },
    ],
    franchises: [
      {
        id: 'frn_01',
        stationId: defaultStationId,
        dealerName: 'OpesFuel Direct Flagship (COCO)',
        operatingModel: 'COCO',
        royaltyFcfaPerLitre: 0,
        monthlyTargetLitres: 320000,
        complianceScorePct: 98,
        renewalDate: '2030-12-31',
        status: 'ACTIVE',
      },
      {
        id: 'frn_02',
        stationId: 'st_bastos',
        dealerName: 'Bastos Energy Dealer SARL (CODO)',
        operatingModel: 'CODO',
        royaltyFcfaPerLitre: 9.5,
        monthlyTargetLitres: 210000,
        complianceScorePct: 94,
        renewalDate: '2028-06-30',
        status: 'ACTIVE',
      },
    ],
  };
}
