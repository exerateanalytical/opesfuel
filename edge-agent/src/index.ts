import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import { DurableOutbox, OutboxEvent } from './outbox.js';
import { pollPts2Controller } from './drivers/pts2.js';
import { buildVeederRootCommand, parseVeederRootI201, queryVeederRootTcp } from './drivers/veederRoot.js';
import { handleOcpp201Message } from './drivers/ocpp201.js';

const CLOUD_URL = (process.env.OPESFUEL_CLOUD_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
const EDGE_API_KEY = process.env.OPESFUEL_EDGE_KEY || '';
const OUTBOX_PATH = process.env.OPESFUEL_OUTBOX_PATH || '/var/lib/opesfuel-edge/outbox.jsonl';
const POLL_INTERVAL_MS = Number(process.env.OPESFUEL_POLL_INTERVAL_MS || 15000);
const OCPP_PORT = Number(process.env.OPESFUEL_OCPP_PORT || 9201);
const AGENT_VERSION = '1.0.0';

const outbox = new DurableOutbox(OUTBOX_PATH);

async function postCloud(path: string, body: Record<string, unknown>): Promise<void> {
  if (!EDGE_API_KEY) {
    throw new Error('OPESFUEL_EDGE_KEY is not configured.');
  }
  const res = await fetch(`${CLOUD_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Edge-Key': EDGE_API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Cloud HTTP ${res.status} on ${path}`);
  }
}

async function sendHeartbeat(): Promise<void> {
  const drivers: string[] = [];
  if (process.env.PTS2_URL) drivers.push('DOMS_PTS2');
  if (process.env.ATG_TCP_HOST) drivers.push('VEEDER_ROOT_ATG');
  if (OCPP_PORT > 0) drivers.push('OCPP_201_EV');
  await postCloud('/api/v1/public/edge/heartbeat', {
    agentVersion: AGENT_VERSION,
    hostname: os.hostname(),
    driversCsv: drivers.join(',') || 'STANDBY',
    outboxDepth: outbox.depth(),
  });
}

async function pollHardwareOnce(): Promise<void> {
  if (process.env.PTS2_URL) {
    const pumps = (process.env.PTS2_PUMPS || '1,2').split(',').map((s) => Number(s.trim())).filter(Boolean);
    const probes = (process.env.PTS2_PROBES || '1,2').split(',').map((s) => Number(s.trim())).filter(Boolean);
    try {
      const events = await pollPts2Controller(
        process.env.PTS2_URL,
        process.env.PTS2_USER || 'admin',
        process.env.PTS2_PASSWORD || 'admin',
        pumps,
        probes
      );
      for (const e of events) {
        outbox.enqueue({
          deviceEventId: e.deviceEventId,
          protocol: 'DOMS_PTS2',
          summary: e.summary,
          alarmTriggered: e.alarmTriggered,
          payload: e.data,
        });
      }
    } catch (err) {
      console.error('[PTS2] Poll error:', (err as Error).message);
    }
  }

  if (process.env.ATG_TCP_HOST) {
    const port = Number(process.env.ATG_TCP_PORT || 10001);
    try {
      const frame = await queryVeederRootTcp(process.env.ATG_TCP_HOST, port, buildVeederRootCommand('i201', '00'));
      const tanks = parseVeederRootI201(frame);
      const tsBucket = Math.floor(Date.now() / 60000);
      for (const t of tanks) {
        outbox.enqueue({
          deviceEventId: `VR-T${t.tankNumber}-${tsBucket}`,
          protocol: 'VEEDER_ROOT_ATG',
          summary: `Veeder-Root Tank #${t.tankNumber}: ${t.volumeLitres} L | Water ${t.waterHeightMm}mm | ${t.temperatureC}C`,
          alarmTriggered: t.alarmTriggered,
          payload: t as unknown as Record<string, unknown>,
        });
      }
    } catch (err) {
      console.error('[ATG] Poll error:', (err as Error).message);
    }
  }
}

/** Minimal zero-dependency RFC 6455 WebSocket upgrade server for OCPP 2.0.1 EV chargers */
function startOcppCsmsServer(port: number): void {
  if (port <= 0) return;
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'opesfuel-edge-ocpp-201', outboxDepth: outbox.depth() }));
  });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }
    const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    const cpId = (req.url || '/EVSE-1').replace(/^\/+/, '') || 'EVSE-1';
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      'Sec-WebSocket-Protocol: ocpp2.0.1\r\n\r\n'
    );

    socket.on('data', (buf) => {
      try {
        const text = decodeWsTextFrame(buf);
        if (!text) return;
        const { responseFrame, telemetry } = handleOcpp201Message(cpId, text);
        if (telemetry) {
          outbox.enqueue({
            deviceEventId: telemetry.deviceEventId,
            protocol: 'OCPP_201_EV',
            summary: telemetry.summary,
            alarmTriggered: telemetry.alarmTriggered,
            payload: telemetry.payload,
          });
        }
        socket.write(encodeWsTextFrame(responseFrame));
      } catch (err) {
        console.error('[OCPP] Frame error:', (err as Error).message);
      }
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[OpesFuel Edge] OCPP 2.0.1 CSMS listening on ws://0.0.0.0:${port}`);
  });
}

function decodeWsTextFrame(buf: Buffer): string | null {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  if (opcode !== 0x1) return null;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let offset = 2;
  if (len === 126) {
    len = buf.readUInt16BE(2);
    offset = 4;
  } else if (len === 127) {
    len = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  const maskKey = masked ? buf.subarray(offset, offset + 4) : null;
  if (masked) offset += 4;
  const payload = Buffer.alloc(len);
  for (let i = 0; i < len && offset + i < buf.length; i++) {
    payload[i] = maskKey ? buf[offset + i] ^ maskKey[i % 4] : buf[offset + i];
  }
  return payload.toString('utf8');
}

function encodeWsTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

async function main(): Promise<void> {
  console.log(`[OpesFuel Edge] Starting v${AGENT_VERSION} -> ${CLOUD_URL}`);
  startOcppCsmsServer(OCPP_PORT);

  const cycle = async () => {
    await pollHardwareOnce();
    await outbox.flush(async (evt: OutboxEvent) => {
      await postCloud('/api/v1/public/edge/ingest', {
        protocol: evt.protocol,
        deviceEventId: evt.deviceEventId,
        summary: evt.summary,
        alarmTriggered: evt.alarmTriggered,
        payload: evt.payload,
      });
    });
    try {
      await sendHeartbeat();
    } catch (err) {
      console.warn('[OpesFuel Edge] Heartbeat deferred:', (err as Error).message);
    }
  };

  await cycle();
  setInterval(() => void cycle(), POLL_INTERVAL_MS);
}

void main();
