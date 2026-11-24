import { ApiError, DEFAULT_INSTITUTIONAL_FUELS, OpesFuelMobileClient } from './api/opesfuelMobileClient';
import type { EmployeeDto, FleetAccountDto, FinancialReportDto, MobileSyncHealth, PumpDto, ShiftDto, ShopItemDto, StationDto, SubmitResult, TankDto } from './api/opesfuelMobileClient';
import type { Session } from './session';

/** In-memory station used for the development demo and screenshots. Nothing leaves the phone. */
export class DemoClient extends OpesFuelMobileClient {
  private pumps: PumpDto[] = [
    { id: 'pmp_1', stationId: 'st_demo', tankId: 'tk_1', code: 'P-01', grade: 'SUPER', totalizerLitres: 485000, unitPriceFcfa: 840, status: 'ACTIVE_SHIFT' },
    { id: 'pmp_2', stationId: 'st_demo', tankId: 'tk_2', code: 'P-02', grade: 'GASOIL', totalizerLitres: 612400, unitPriceFcfa: 828, status: 'IDLE' },
    { id: 'pmp_3', stationId: 'st_demo', tankId: 'tk_1', code: 'P-03', grade: 'SUPER', totalizerLitres: 294120, unitPriceFcfa: 840, status: 'ACTIVE_SHIFT' },
  ];
  private tanks: TankDto[] = [
    { id: 'tk_1', stationId: 'st_demo', name: 'Cuve T-01 Super', grade: 'SUPER', capacityLitres: 35000, bookVolumeLitres: 24680, lastDipLitres: 24645, varianceLitres: -35, unitCostFcfa: 745, status: 'NOMINAL' },
    { id: 'tk_2', stationId: 'st_demo', name: 'Cuve T-02 Gasoil', grade: 'GASOIL', capacityLitres: 45000, bookVolumeLitres: 31200, lastDipLitres: 30900, varianceLitres: -300, unitCostFcfa: 735, status: 'NOMINAL' },
    { id: 'tk_3', stationId: 'st_demo', name: 'Cuve T-03 Pétrole', grade: 'KEROSENE', capacityLitres: 15000, bookVolumeLitres: 2450, lastDipLitres: 2370, varianceLitres: -80, unitCostFcfa: 470, status: 'LOW_STOCK' },
  ];
  private now = Date.now();
  private shifts: ShiftDto[] = [
    { id: 'sh_1', stationId: 'st_demo', pumpId: 'pmp_1', pumpCode: 'P-01', grade: 'SUPER', attendantId: 'emp_1', attendantName: 'Samuel Tchoupo', openingMeterLitres: 484700, closingMeterLitres: null, litresSold: null, unitPriceFcfa: 840, expectedRevenueFcfa: 0, cashFcfa: 0, mobileMoneyFcfa: 0, cardFcfa: 0, fleetCreditFcfa: 0, varianceFcfa: 0, status: 'OPEN', openedAt: new Date(this.now - 5 * 3600_000).toISOString(), closedAt: null },
    { id: 'sh_2', stationId: 'st_demo', pumpId: 'pmp_3', pumpCode: 'P-03', grade: 'SUPER', attendantId: 'emp_2', attendantName: 'Mireille Ngo', openingMeterLitres: 293900, closingMeterLitres: null, litresSold: null, unitPriceFcfa: 840, expectedRevenueFcfa: 0, cashFcfa: 0, mobileMoneyFcfa: 0, cardFcfa: 0, fleetCreditFcfa: 0, varianceFcfa: 0, status: 'OPEN', openedAt: new Date(this.now - 3 * 3600_000).toISOString(), closedAt: null },
    { id: 'sh_0', stationId: 'st_demo', pumpId: 'pmp_2', pumpCode: 'P-02', grade: 'GASOIL', attendantId: 'emp_3', attendantName: 'Koffi Mensah', openingMeterLitres: 611000, closingMeterLitres: 612400, litresSold: 1400, unitPriceFcfa: 828, expectedRevenueFcfa: 1159200, cashFcfa: 800000, mobileMoneyFcfa: 355000, cardFcfa: 0, fleetCreditFcfa: 0, varianceFcfa: -4200, status: 'CLOSED', openedAt: new Date(this.now - 9 * 3600_000).toISOString(), closedAt: new Date(this.now - 1 * 3600_000).toISOString() },
  ];
  private fleets: FleetAccountDto[] = [
    { id: 'flt_1', companyName: 'Cameroon Timber Logistics SA', creditLimitFcfa: 6000000, balanceOwedFcfa: 2450000, status: 'ACTIVE' },
    { id: 'flt_2', companyName: 'Douala Express Freight SARL', creditLimitFcfa: 4500000, balanceOwedFcfa: 4300000, status: 'ACTIVE' },
  ];
  private items: ShopItemDto[] = [
    { id: 'it_1', stationId: 'st_demo', sku: 'OIL-5W30', name: 'Huile Total Quartz 5W-30 (4 L)', category: 'LUBRICANT', stockQty: 18, reorderLevel: 5, unitPriceFcfa: 24500 },
    { id: 'it_2', stationId: 'st_demo', sku: 'WATER-15', name: 'Eau minérale 1,5 L', category: 'DRINK', stockQty: 96, reorderLevel: 24, unitPriceFcfa: 500 },
    { id: 'it_3', stationId: 'st_demo', sku: 'GAS-12', name: 'Bouteille gaz 12,5 kg (échange)', category: 'GAS', stockQty: 0, reorderLevel: 4, unitPriceFcfa: 6500 },
  ];
  private employees: EmployeeDto[] = [
    { id: 'emp_1', stationId: 'st_demo', fullName: 'Samuel Tchoupo', role: 'ATTENDANT', clockedIn: true },
    { id: 'emp_2', stationId: 'st_demo', fullName: 'Mireille Ngo', role: 'ATTENDANT', clockedIn: true },
    { id: 'emp_3', stationId: 'st_demo', fullName: 'Koffi Mensah', role: 'ATTENDANT', clockedIn: false },
  ];
  constructor(private session: Session) { super(); }

  async checkConnectivity(): Promise<MobileSyncHealth> {
    const q = await this.getOfflineQueue();
    return { state: 'LIVE_CONNECTED', connected: true, latencyMs: 42, pendingQueueCount: q.length, lastSyncedAt: new Date().toISOString(), endpoint: 'demo' };
  }
  async getMyProfile(): Promise<EmployeeDto> {
    if (this.session.role !== 'ATTENDANT') throw new ApiError(404, 'No employee record');
    return this.employees[0];
  }
  async getStations(): Promise<StationDto[]> { return [{ id: 'st_demo', name: 'Station Bonanjo', city: 'Douala' }]; }
  async getPumps() { return this.pumps.map((p) => ({ ...p })); }
  async getShifts() { return this.shifts.map((x) => ({ ...x })); }
  async getTanks() { return this.tanks.map((x) => ({ ...x })); }
  async getEmployees() { return this.employees.map((x) => ({ ...x })); }
  async getFleetAccounts() { return this.fleets.map((x) => ({ ...x })); }
  async getShopItems() { return this.items.map((x) => ({ ...x })); }
  async getFinancialReport(): Promise<FinancialReportDto> {
    return { currency: 'FCFA', totalRevenueFcfa: 18_450_000, cogsFcfa: 15_720_000, grossProfitFcfa: 2_730_000, operatingExpensesFcfa: 1_190_000, netIncomeFcfa: 1_540_000, vatPayableFcfa: 355_000, trialBalanceBalanced: true };
  }
  async fetchInstitutionalFuels() { return DEFAULT_INSTITUTIONAL_FUELS; }
  async askAiAdvisor(_s: string, q: string) {
    return { stationId: 'st_demo', answer: `Réponse d'exemple à : « ${q} ». La cuve T-03 (pétrole) est à 16 % : prévoyez une livraison cette semaine.`, answeredAt: new Date().toISOString() };
  }

  async submit<T = unknown>(_label: string, path: string, body: Record<string, any>): Promise<SubmitResult<T>> {
    const key = `demo-${Math.random().toString(36).slice(2, 8)}`;
    const ok = (data: unknown): SubmitResult<T> => ({ status: 'SYNCED', idempotencyKey: key, data: data as T });
    if (path === '/forecourt/shifts/open') {
      const pump = this.pumps.find((p) => p.id === body.pumpId)!; const emp = this.employees.find((e) => e.id === body.attendantId);
      pump.status = 'ACTIVE_SHIFT';
      const sh: ShiftDto = { id: `sh_${Date.now()}`, stationId: 'st_demo', pumpId: pump.id, pumpCode: pump.code, grade: pump.grade, attendantId: body.attendantId, attendantName: emp?.fullName ?? '', openingMeterLitres: pump.totalizerLitres, closingMeterLitres: null, litresSold: null, unitPriceFcfa: pump.unitPriceFcfa, expectedRevenueFcfa: 0, cashFcfa: 0, mobileMoneyFcfa: 0, cardFcfa: 0, fleetCreditFcfa: 0, varianceFcfa: 0, status: 'OPEN', openedAt: new Date().toISOString(), closedAt: null };
      this.shifts.unshift(sh); return ok(sh);
    }
    const close = path.match(/^\/forecourt\/shifts\/(.+)\/close$/);
    if (close) {
      const sh = this.shifts.find((x) => x.id === decodeURIComponent(close[1]))!; const pump = this.pumps.find((p) => p.id === sh.pumpId)!;
      const sold = body.closingMeterLitres - sh.openingMeterLitres; const expected = Math.round(sold * sh.unitPriceFcfa);
      const got = body.cashFcfa + body.mobileMoneyFcfa + body.cardFcfa + body.fleetCreditFcfa;
      Object.assign(sh, { closingMeterLitres: body.closingMeterLitres, litresSold: sold, expectedRevenueFcfa: expected, cashFcfa: body.cashFcfa, mobileMoneyFcfa: body.mobileMoneyFcfa, cardFcfa: body.cardFcfa, fleetCreditFcfa: body.fleetCreditFcfa, varianceFcfa: got - expected, status: 'CLOSED', closedAt: new Date().toISOString() });
      pump.status = 'IDLE'; pump.totalizerLitres = body.closingMeterLitres; return ok(sh);
    }
    if (path === '/inventory/dipsticks') {
      const t = this.tanks.find((x) => x.id === body.tankId)!; t.lastDipLitres = body.measuredLitres; t.varianceLitres = body.measuredLitres - t.bookVolumeLitres; return ok(t);
    }
    if (path === '/fleet/vouchers') {
      if (body.litres > 100) throw new ApiError(409, 'Daily litre limit (100.0 L) exceeded for this vehicle.');
      return ok({ id: 'ftx_demo' });
    }
    if (path === '/shop/sales') { const it = this.items.find((x) => x.id === body.itemId)!; it.stockQty = Math.max(0, it.stockQty - body.quantity); return ok({ id: 'sale_demo' }); }
    const clock = path.match(/^\/workforce\/employees\/(.+)\/attendance$/);
    if (clock) { const e = this.employees.find((x) => x.id === decodeURIComponent(clock[1]))!; e.clockedIn = !e.clockedIn; return ok(e); }
    return ok({});
  }
  async flushOfflineQueue() { return { sent: 0, remaining: 0, failed: 0 }; }
}
