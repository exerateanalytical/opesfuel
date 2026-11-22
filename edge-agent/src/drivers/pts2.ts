/**
 * Technotrade PTS-2 / DOMS Forecourt Controller driver using jsonPTS HTTP protocol.
 * Supports PumpGetStatus, PumpGetTransactionInformation, and ProbeGetMeasurements.
 */

export interface Pts2Packet {
  Id: number;
  Type: 'PumpGetStatus' | 'PumpGetTransactionInformation' | 'ProbeGetMeasurements';
  Data?: Record<string, unknown>;
}

export interface Pts2Envelope {
  Protocol: 'jsonPTS';
  Packets: Array<{
    Id: number;
    Type: string;
    Error?: boolean;
    Code?: number;
    Message?: string;
    Data?: Record<string, unknown>;
  }>;
}

export interface ParsedPts2Event {
  deviceEventId: string;
  kind: 'PUMP_STATUS' | 'PUMP_TRANSACTION' | 'PROBE_MEASUREMENT';
  summary: string;
  alarmTriggered: boolean;
  data: Record<string, unknown>;
}

export function buildPts2Request(packets: Pts2Packet[]): { Protocol: 'jsonPTS'; Packets: Pts2Packet[] } {
  return { Protocol: 'jsonPTS', Packets: packets };
}

export function parsePts2Response(envelope: Pts2Envelope, controllerId = 'PTS2'): ParsedPts2Event[] {
  if (!envelope || envelope.Protocol !== 'jsonPTS' || !Array.isArray(envelope.Packets)) {
    throw new Error('Invalid jsonPTS envelope: expected Protocol="jsonPTS" and Packets array.');
  }
  const events: ParsedPts2Event[] = [];
  for (const pkt of envelope.Packets) {
    if (pkt.Error) continue;
    const d = pkt.Data ?? {};
    if (pkt.Type === 'PumpTransactionInformation' || pkt.Type === 'PumpGetTransactionInformation') {
      const pump = Number(d.Pump ?? 0);
      const tx = Number(d.Transaction ?? pkt.Id);
      const volume = Number(d.Volume ?? 0);
      const amount = Number(d.Amount ?? 0);
      const price = Number(d.Price ?? 0);
      const nozzle = Number(d.Nozzle ?? 1);
      events.push({
        deviceEventId: `${controllerId}-TX-P${pump}-${tx}`,
        kind: 'PUMP_TRANSACTION',
        summary: `PTS-2 Pump ${pump} Nozzle ${nozzle}: ${volume.toFixed(2)} L @ ${price} = ${amount} FCFA (Tx #${tx})`,
        alarmTriggered: false,
        data: { pump, nozzle, transaction: tx, volume, price, amount, totalVolume: d.TotalVolume ?? null },
      });
    } else if (pkt.Type === 'ProbeMeasurements' || pkt.Type === 'ProbeGetMeasurements') {
      const probe = Number(d.Probe ?? pkt.Id);
      const productVol = Number(d.ProductVolume ?? 0);
      const waterHeight = Number(d.WaterHeight ?? 0);
      const tempC = Number(d.Temperature ?? 0);
      const waterAlarm = waterHeight >= 15;
      events.push({
        deviceEventId: `${controllerId}-PRB-${probe}-${String(d.DateTime ?? Date.now())}`,
        kind: 'PROBE_MEASUREMENT',
        summary: `PTS-2 Probe #${probe}: ${productVol.toFixed(1)} L | Water ${waterHeight.toFixed(1)}mm | ${tempC.toFixed(1)}C`,
        alarmTriggered: waterAlarm,
        data: { probe, productVolume: productVol, waterHeight, temperatureC: tempC, ullage: d.ProductUllage ?? null },
      });
    } else if (pkt.Type === 'PumpIdleStatus' || pkt.Type === 'PumpFillingStatus' || pkt.Type === 'PumpOfflineStatus') {
      const pump = Number(d.Pump ?? pkt.Id);
      const offline = pkt.Type === 'PumpOfflineStatus';
      events.push({
        deviceEventId: `${controllerId}-ST-P${pump}-${pkt.Type}-${Math.floor(Date.now() / 30000)}`,
        kind: 'PUMP_STATUS',
        summary: `PTS-2 Pump ${pump}: ${pkt.Type} (Nozzle ${d.Nozzle ?? 0}, Vol ${d.Volume ?? 0} L)`,
        alarmTriggered: offline,
        data: { pump, statusType: pkt.Type, ...d },
      });
    }
  }
  return events;
}

export async function pollPts2Controller(
  baseUrl: string,
  username: string,
  password: string,
  pumps: number[],
  probes: number[]
): Promise<ParsedPts2Event[]> {
  let id = 1;
  const packets: Pts2Packet[] = [];
  for (const p of pumps) {
    packets.push({ Id: id++, Type: 'PumpGetStatus', Data: { Pump: p } });
    packets.push({ Id: id++, Type: 'PumpGetTransactionInformation', Data: { Pump: p } });
  }
  for (const pr of probes) {
    packets.push({ Id: id++, Type: 'ProbeGetMeasurements', Data: { Probe: pr } });
  }

  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/jsonPTS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(buildPts2Request(packets)),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) {
    throw new Error(`PTS-2 HTTP ${res.status}`);
  }
  const envelope = (await res.json()) as Pts2Envelope;
  return parsePts2Response(envelope);
}
