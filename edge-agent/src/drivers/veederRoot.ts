import net from 'node:net';

/**
 * Veeder-Root TLS-350 / TLS-450 Automatic Tank Gauge (ATG) serial/TCP driver.
 * Implements standard Veeder-Root computer format commands:
 *   <SOH>i20100 (In-Tank Inventory Report)
 *   <SOH>i20200 (In-Tank Delivery Report)
 * IEEE-754 32-bit big-endian hex floats (8 hex chars per measurement).
 */

export const SOH = '\x01';
export const ETX = '\x03';

export interface AtgTankInventory {
  tankNumber: number;
  productCode: string;
  volumeLitres: number;
  tcVolumeLitres: number;
  ullageLitres: number;
  heightMm: number;
  waterHeightMm: number;
  temperatureC: number;
  waterVolumeLitres: number;
  alarmTriggered: boolean;
}

export interface AtgDeliveryRecord {
  tankNumber: number;
  productCode: string;
  startVolumeLitres: number;
  endVolumeLitres: number;
  deliveredLitres: number;
  startTempC: number;
  endTempC: number;
}

export function decodeIeee754Hex(hex8: string): number {
  if (!/^[0-9a-fA-F]{8}$/.test(hex8)) {
    throw new Error(`Invalid IEEE-754 hex float: ${hex8}`);
  }
  const buf = Buffer.from(hex8, 'hex');
  return Math.round(buf.readFloatBE(0) * 100) / 100;
}

export function encodeIeee754Hex(value: number): string {
  const buf = Buffer.alloc(4);
  buf.writeFloatBE(value, 0);
  return buf.toString('hex').toUpperCase();
}

export function buildVeederRootCommand(functionCode: 'i201' | 'i202', tank = '00'): string {
  return `${SOH}${functionCode}${tank}`;
}

/**
 * Parses Veeder-Root computer-format i201 response:
 * <SOH>i20100YYMMDDHHmm [TT P SSSS NN F1(8) F2(8) F3(8) F4(8) F5(8) F6(8) F7(8)] ... &&CCCC<ETX>
 * Fields: 1=Volume, 2=TC Volume, 3=Ullage, 4=Height, 5=Water, 6=Temp, 7=Water Volume
 */
export function parseVeederRootI201(rawFrame: string): AtgTankInventory[] {
  const cleaned = rawFrame.replace(SOH, '').replace(ETX, '').split('&&')[0].trim();
  if (!cleaned.startsWith('i201')) {
    throw new Error(`Expected i201 frame, got: ${cleaned.slice(0, 12)}`);
  }
  // Skip header: i201 (4) + TT (2) + YYMMDDHHmm (10) = 16 chars
  let cursor = 16;
  const tanks: AtgTankInventory[] = [];
  while (cursor + 9 <= cleaned.length) {
    const tankNo = parseInt(cleaned.slice(cursor, cursor + 2), 10);
    const productCode = cleaned.slice(cursor + 2, cursor + 3);
    // 4 chars status flags + 2 chars field count
    const fieldCount = parseInt(cleaned.slice(cursor + 7, cursor + 9), 16);
    cursor += 9;
    if (Number.isNaN(tankNo) || Number.isNaN(fieldCount) || fieldCount < 6) break;
    const fields: number[] = [];
    for (let i = 0; i < fieldCount && cursor + 8 <= cleaned.length; i++) {
      fields.push(decodeIeee754Hex(cleaned.slice(cursor, cursor + 8)));
      cursor += 8;
    }
    const volumeLitres = fields[0] ?? 0;
    const tcVolumeLitres = fields[1] ?? volumeLitres;
    const ullageLitres = fields[2] ?? 0;
    const heightMm = fields[3] ?? 0;
    const waterHeightMm = fields[4] ?? 0;
    const temperatureC = fields[5] ?? 25;
    const waterVolumeLitres = fields[6] ?? 0;
    tanks.push({
      tankNumber: tankNo,
      productCode,
      volumeLitres,
      tcVolumeLitres,
      ullageLitres,
      heightMm,
      waterHeightMm,
      temperatureC,
      waterVolumeLitres,
      alarmTriggered: waterHeightMm >= 15 || volumeLitres < 2000,
    });
  }
  return tanks;
}

/**
 * Parses Veeder-Root computer-format i202 delivery report (simplified single/multi delivery record):
 * <SOH>i20200YYMMDDHHmm [TT P NN F1(StartVol) F2(EndVol) F3(StartTemp) F4(EndTemp)] &&CCCC<ETX>
 */
export function parseVeederRootI202(rawFrame: string): AtgDeliveryRecord[] {
  const cleaned = rawFrame.replace(SOH, '').replace(ETX, '').split('&&')[0].trim();
  if (!cleaned.startsWith('i202')) {
    throw new Error(`Expected i202 frame, got: ${cleaned.slice(0, 12)}`);
  }
  let cursor = 16;
  const deliveries: AtgDeliveryRecord[] = [];
  while (cursor + 5 <= cleaned.length) {
    const tankNo = parseInt(cleaned.slice(cursor, cursor + 2), 10);
    const productCode = cleaned.slice(cursor + 2, cursor + 3);
    const fieldCount = parseInt(cleaned.slice(cursor + 3, cursor + 5), 16);
    cursor += 5;
    if (Number.isNaN(tankNo) || Number.isNaN(fieldCount) || fieldCount < 2) break;
    const fields: number[] = [];
    for (let i = 0; i < fieldCount && cursor + 8 <= cleaned.length; i++) {
      fields.push(decodeIeee754Hex(cleaned.slice(cursor, cursor + 8)));
      cursor += 8;
    }
    const startVol = fields[0] ?? 0;
    const endVol = fields[1] ?? startVol;
    deliveries.push({
      tankNumber: tankNo,
      productCode,
      startVolumeLitres: startVol,
      endVolumeLitres: endVol,
      deliveredLitres: Math.round((endVol - startVol) * 100) / 100,
      startTempC: fields[2] ?? 25,
      endTempC: fields[3] ?? 25,
    });
  }
  return deliveries;
}

export function queryVeederRootTcp(host: string, port: number, cmd: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = '';
    socket.setTimeout(timeoutMs);
    socket.connect(port, host, () => {
      socket.write(cmd);
    });
    socket.on('data', (chunk) => {
      buffer += chunk.toString('ascii');
      if (buffer.includes(ETX)) {
        socket.destroy();
        resolve(buffer);
      }
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Veeder-Root TCP timeout (${host}:${port})`));
    });
    socket.on('error', (err) => reject(err));
  });
}
