import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildPts2Request, parsePts2Response } from '../dist/drivers/pts2.js';
import {
  SOH,
  ETX,
  encodeIeee754Hex,
  decodeIeee754Hex,
  parseVeederRootI201,
  parseVeederRootI202,
} from '../dist/drivers/veederRoot.js';
import { handleOcpp201Message } from '../dist/drivers/ocpp201.js';
import { DurableOutbox } from '../dist/outbox.js';

test('PTS-2 jsonPTS request builder & transaction/probe response parser', () => {
  const req = buildPts2Request([{ Id: 1, Type: 'PumpGetTransactionInformation', Data: { Pump: 2 } }]);
  assert.equal(req.Protocol, 'jsonPTS');
  assert.equal(req.Packets.length, 1);

  const events = parsePts2Response({
    Protocol: 'jsonPTS',
    Packets: [
      {
        Id: 1,
        Type: 'PumpTransactionInformation',
        Data: { Pump: 2, Nozzle: 1, Transaction: 4412, Volume: 45.5, Price: 840, Amount: 38220 },
      },
      {
        Id: 2,
        Type: 'ProbeMeasurements',
        Data: { Probe: 1, ProductVolume: 24500.5, WaterHeight: 18.2, Temperature: 27.4, DateTime: '2026-11-22T12:00:00' },
      },
    ],
  }, 'PTS-DLA');

  assert.equal(events.length, 2);
  assert.equal(events[0].deviceEventId, 'PTS-DLA-TX-P2-4412');
  assert.equal(events[0].alarmTriggered, false);
  assert.match(events[0].summary, /45\.50 L/);
  assert.equal(events[1].alarmTriggered, true); // waterHeight >= 15mm alarm!
});

test('Veeder-Root TLS-350/450 i201 inventory & i202 delivery IEEE-754 hex parser', () => {
  const hexVol = encodeIeee754Hex(31250.5);
  assert.equal(decodeIeee754Hex(hexVol), 31250.5);

  const f1 = encodeIeee754Hex(31250.5); // Volume
  const f2 = encodeIeee754Hex(31100.0); // TC Volume
  const f3 = encodeIeee754Hex(8750.0);  // Ullage
  const f4 = encodeIeee754Hex(1820.5);  // Height mm
  const f5 = encodeIeee754Hex(16.5);    // Water mm (triggers alarm >= 15)
  const f6 = encodeIeee754Hex(28.4);    // Temp C
  const f7 = encodeIeee754Hex(12.0);    // Water Vol

  const i201Frame = `${SOH}i201002611221200011000007${f1}${f2}${f3}${f4}${f5}${f6}${f7}&&ABCD${ETX}`;
  const tanks = parseVeederRootI201(i201Frame);
  assert.equal(tanks.length, 1);
  assert.equal(tanks[0].tankNumber, 1);
  assert.equal(tanks[0].volumeLitres, 31250.5);
  assert.equal(tanks[0].waterHeightMm, 16.5);
  assert.equal(tanks[0].alarmTriggered, true);

  const dStart = encodeIeee754Hex(12000);
  const dEnd = encodeIeee754Hex(30000);
  const dT1 = encodeIeee754Hex(26.5);
  const dT2 = encodeIeee754Hex(27.0);
  const i202Frame = `${SOH}i20200261122120001104${dStart}${dEnd}${dT1}${dT2}&&1234${ETX}`;
  const deliveries = parseVeederRootI202(i202Frame);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].deliveredLitres, 18000);
});

test('OCPP 2.0.1 CSMS BootNotification, Heartbeat & TransactionEvent handling', () => {
  const boot = handleOcpp201Message('EV-DC01', JSON.stringify([2, 'm1', 'BootNotification', {
    chargingStation: { vendorName: 'ABB', model: 'Terra184' },
  }]));
  const bootResp = JSON.parse(boot.responseFrame);
  assert.equal(bootResp[0], 3);
  assert.equal(bootResp[1], 'm1');
  assert.equal(bootResp[2].status, 'Accepted');
  assert.ok(boot.telemetry?.deviceEventId.includes('BOOT-m1'));

  const tx = handleOcpp201Message('EV-DC01', JSON.stringify([2, 'm2', 'TransactionEvent', {
    eventType: 'Ended',
    seqNo: 4,
    transactionInfo: { transactionId: 'tx-991' },
    meterValue: [{ sampledValue: [{ value: 42.3 }] }],
  }]));
  assert.equal(tx.telemetry?.deviceEventId, 'OCPP-EV-DC01-TX-tx-991-Ended-4');
});

test('DurableOutbox deduplicates, persists across restarts, and retries cleanly', async () => {
  const tmpFile = path.join(os.tmpdir(), `opesfuel-outbox-${Date.now()}.jsonl`);
  const outbox1 = new DurableOutbox(tmpFile);
  assert.equal(outbox1.enqueue({
    deviceEventId: 'EVT-1',
    protocol: 'DOMS_PTS2',
    summary: 'Test tx',
    alarmTriggered: false,
    payload: { litres: 10 },
  }), true);
  // Duplicate rejected
  assert.equal(outbox1.enqueue({
    deviceEventId: 'EVT-1',
    protocol: 'DOMS_PTS2',
    summary: 'Test tx',
    alarmTriggered: false,
    payload: { litres: 10 },
  }), false);
  assert.equal(outbox1.depth(), 1);

  // Reload from disk simulating power restart
  const outbox2 = new DurableOutbox(tmpFile);
  assert.equal(outbox2.depth(), 1);
  const flushed = await outbox2.flush(async () => {});
  assert.equal(flushed.sent, 1);
  assert.equal(outbox2.depth(), 0);
  fs.rmSync(tmpFile, { force: true });
});
