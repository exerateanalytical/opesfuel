/**
 * OCPP 2.0.1 JSON-over-WebSocket CSMS protocol handler.
 * Handles BootNotification, Heartbeat, StatusNotification, TransactionEvent, and MeterValues.
 * Frame format: CALL [2, messageId, action, payload] -> CALLRESULT [3, messageId, responsePayload]
 */

export interface OcppTelemetry {
  deviceEventId: string;
  action: string;
  summary: string;
  alarmTriggered: boolean;
  payload: Record<string, unknown>;
}

export interface OcppHandleResult {
  responseFrame: string;
  telemetry: OcppTelemetry | null;
}

export function handleOcpp201Message(chargePointId: string, rawJson: string): OcppHandleResult {
  const parsed = JSON.parse(rawJson) as unknown[];
  if (!Array.isArray(parsed) || parsed.length < 4 || parsed[0] !== 2) {
    throw new Error('Invalid OCPP 2.0.1 CALL frame: expected [2, msgId, action, payload].');
  }
  const msgId = String(parsed[1]);
  const action = String(parsed[2]);
  const payload = (parsed[3] ?? {}) as Record<string, unknown>;
  const nowIso = new Date().toISOString();

  switch (action) {
    case 'BootNotification': {
      const cs = (payload.chargingStation ?? {}) as Record<string, unknown>;
      return {
        responseFrame: JSON.stringify([3, msgId, { currentTime: nowIso, interval: 60, status: 'Accepted' }]),
        telemetry: {
          deviceEventId: `OCPP-${chargePointId}-BOOT-${msgId}`,
          action,
          summary: `OCPP 2.0.1 Charger ${chargePointId} booted (${cs.vendorName ?? 'Vendor'} ${cs.model ?? 'EVSE'})`,
          alarmTriggered: false,
          payload,
        },
      };
    }
    case 'Heartbeat': {
      return {
        responseFrame: JSON.stringify([3, msgId, { currentTime: nowIso }]),
        telemetry: null,
      };
    }
    case 'StatusNotification': {
      const status = String(payload.connectorStatus ?? 'Available');
      const faulted = status.toLowerCase() === 'faulted';
      return {
        responseFrame: JSON.stringify([3, msgId, {}]),
        telemetry: {
          deviceEventId: `OCPP-${chargePointId}-STATUS-${msgId}`,
          action,
          summary: `OCPP 2.0.1 Charger ${chargePointId} EVSE #${payload.evseId ?? 1} Connector #${payload.connectorId ?? 1}: ${status}`,
          alarmTriggered: faulted,
          payload,
        },
      };
    }
    case 'TransactionEvent': {
      const eventType = String(payload.eventType ?? 'Updated');
      const txInfo = (payload.transactionInfo ?? {}) as Record<string, unknown>;
      const txId = String(txInfo.transactionId ?? msgId);
      const meters = Array.isArray(payload.meterValue) ? payload.meterValue : [];
      return {
        responseFrame: JSON.stringify([3, msgId, { idTokenInfo: { status: 'Accepted' } }]),
        telemetry: {
          deviceEventId: `OCPP-${chargePointId}-TX-${txId}-${eventType}-${payload.seqNo ?? 0}`,
          action,
          summary: `OCPP 2.0.1 Charger ${chargePointId} TransactionEvent ${eventType} (tx=${txId}, samples=${meters.length})`,
          alarmTriggered: false,
          payload,
        },
      };
    }
    case 'MeterValues': {
      return {
        responseFrame: JSON.stringify([3, msgId, {}]),
        telemetry: {
          deviceEventId: `OCPP-${chargePointId}-MV-${msgId}`,
          action,
          summary: `OCPP 2.0.1 Charger ${chargePointId} MeterValues EVSE #${payload.evseId ?? 1}`,
          alarmTriggered: false,
          payload,
        },
      };
    }
    default: {
      return {
        responseFrame: JSON.stringify([4, msgId, 'NotImplemented', `Unsupported action ${action}`, {}]),
        telemetry: null,
      };
    }
  }
}
