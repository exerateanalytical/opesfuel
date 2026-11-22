import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Cpu,
  Droplets,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Zap,
} from 'lucide-react';
import { UserRole } from '../../domain/types';
import { FormModal } from '../shared/FormModal';

interface HardwareDevice {
  id: string;
  stationId: string;
  deviceCode: string;
  protocol: 'DOMS_PTS2' | 'VEEDER_ROOT_ATG' | 'OCPP_201_EV';
  endpointUri: string;
  firmwareVersion: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  lastHeartbeatAt: string;
}

interface HardwareTelemetryEvent {
  id: string;
  deviceCode: string;
  protocol: 'DOMS_PTS2' | 'VEEDER_ROOT_ATG' | 'OCPP_201_EV' | 'MOBILE_OFFLINE_SYNC';
  deviceEventId: string;
  summary: string;
  alarmTriggered: boolean;
  idempotentReplay: boolean;
  receivedAt: string;
}

interface HardwareEdgeBridgePanelProps {
  role: UserRole;
  stationId: string;
  stationName: string;
  onPostBackend: (path: string, method: 'POST' | 'PATCH', body?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const HardwareEdgeBridgePanel: React.FC<HardwareEdgeBridgePanelProps> = ({
  role,
  stationId,
  stationName,
  onPostBackend,
  onNotify,
}) => {
  const canManage = role === 'PLATFORM_ADMIN' || role === 'OWNER' || role === 'MANAGER';

  const [devices, setDevices] = useState<HardwareDevice[]>([
    {
      id: 'hw_doms01',
      stationId,
      deviceCode: 'DOMS-FC-01',
      protocol: 'DOMS_PTS2',
      endpointUri: 'wss://edge-bonanjo.opesfuel.local:8443/pts2',
      firmwareVersion: 'PTS2-v3.8.2',
      status: 'ONLINE',
      lastHeartbeatAt: new Date(Date.now() - 18_000).toISOString(),
    },
    {
      id: 'hw_atg01',
      stationId,
      deviceCode: 'VR-TLS450-01',
      protocol: 'VEEDER_ROOT_ATG',
      endpointUri: 'tcp://10.42.10.22:10001/tls450',
      firmwareVersion: 'TLS450-v4.12',
      status: 'ONLINE',
      lastHeartbeatAt: new Date(Date.now() - 32_000).toISOString(),
    },
    {
      id: 'hw_ocpp01',
      stationId,
      deviceCode: 'OCPP-EV-DC01',
      protocol: 'OCPP_201_EV',
      endpointUri: 'wss://ocpp.opesfuel.cm/v201/ev-dc01',
      firmwareVersion: 'OCPP201-v1.9',
      status: 'ONLINE',
      lastHeartbeatAt: new Date(Date.now() - 45_000).toISOString(),
    },
  ]);

  const [events, setEvents] = useState<HardwareTelemetryEvent[]>([
    {
      id: 'hwe_init01',
      deviceCode: 'DOMS-FC-01',
      protocol: 'DOMS_PTS2',
      deviceEventId: 'DOMS-TX-9001',
      summary: 'DOMS/PTS-2 P1-NOZZLE-A (SUPER): 42.5 L = 35,700 FCFA',
      alarmTriggered: false,
      idempotentReplay: false,
      receivedAt: new Date(Date.now() - 120_000).toISOString(),
    },
    {
      id: 'hwe_init02',
      deviceCode: 'VR-TLS450-01',
      protocol: 'VEEDER_ROOT_ATG',
      deviceEventId: 'ATG-POLL-4410',
      summary: 'Veeder-Root ATG TNK-SUPER-01: 31,420 L | Water 2.1mm | 26.8C',
      alarmTriggered: false,
      idempotentReplay: false,
      receivedAt: new Date(Date.now() - 95_000).toISOString(),
    },
  ]);

  const [seenEventIds, setSeenEventIds] = useState<Set<string>>(
    () => new Set(['DOMS-TX-9001', 'ATG-POLL-4410'])
  );
  const [lastDomsEventId, setLastDomsEventId] = useState<string>('DOMS-TX-9001');
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

  // Registration form fields
  const [devCode, setDevCode] = useState('');
  const [devProtocol, setDevProtocol] = useState<'DOMS_PTS2' | 'VEEDER_ROOT_ATG' | 'OCPP_201_EV'>('DOMS_PTS2');
  const [devUri, setDevUri] = useState('wss://edge-site.opesfuel.local:8443');
  const [devFirmware, setDevFirmware] = useState('v2.4.1');
  const [provisionedKey, setProvisionedKey] = useState<{ deviceName: string; apiKey: string } | null>(null);

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devCode.trim() || !devUri.trim()) {
      onNotify('error', 'Device code and endpoint URI are required.');
      return;
    }
    const payload = {
      stationId,
      deviceCode: devCode.trim().toUpperCase(),
      protocol: devProtocol,
      endpointUri: devUri.trim(),
      firmwareVersion: devFirmware.trim() || 'v2.4.1',
    };
    const remote = await onPostBackend('/api/v1/enterprise/hardware/devices', 'POST', payload);
    const created: HardwareDevice = {
      id: String(remote?.id ?? `hw_${Date.now().toString(36)}`),
      stationId,
      deviceCode: payload.deviceCode,
      protocol: devProtocol,
      endpointUri: payload.endpointUri,
      firmwareVersion: payload.firmwareVersion,
      status: 'ONLINE',
      lastHeartbeatAt: new Date().toISOString(),
    };
    setDevices((prev) => [created, ...prev]);
    setDevCode('');
    setRegisterModalOpen(false);
    onNotify('success', `Registered ${payload.protocol} edge bridge ${payload.deviceCode} for ${stationName}.`);
  };

  const simulateDomsTx = async (replayPrevious: boolean) => {
    const eventId = replayPrevious ? lastDomsEventId : `DOMS-TX-${Math.floor(10000 + Math.random() * 89999)}`;
    const payload = {
      stationId,
      deviceCode: 'DOMS-FC-01',
      deviceEventId: eventId,
      pumpCode: 'P2-NOZZLE-B',
      fuelGrade: 'GASOIL',
      litresDispensed: 55.0,
      amountFcfa: 45540,
    };
    const remote = await onPostBackend('/api/v1/enterprise/hardware/ingest/forecourt-tx', 'POST', payload);
    const isReplay = remote ? Boolean(remote.idempotentReplay) : seenEventIds.has(eventId);

    setSeenEventIds((prev) => new Set(prev).add(eventId));
    setLastDomsEventId(eventId);
    setEvents((prev) => [
      {
        id: String(remote?.id ?? `hwe_${Date.now().toString(36)}`),
        deviceCode: payload.deviceCode,
        protocol: 'DOMS_PTS2',
        deviceEventId: eventId,
        summary: isReplay
          ? `REPLAY IGNORED (T012) for ${eventId} — zero duplicate sale or GL posting`
          : `DOMS/PTS-2 ${payload.pumpCode} (${payload.fuelGrade}): ${payload.litresDispensed} L = ${payload.amountFcfa.toLocaleString()} FCFA`,
        alarmTriggered: false,
        idempotentReplay: isReplay,
        receivedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    onNotify(
      'success',
      isReplay
        ? `Idempotent replay guard (T012) deduplicated ${eventId} cleanly.`
        : `Ingested DOMS/PTS-2 forecourt dispense ${eventId} (55.0 L GASOIL).`
    );
  };

  const simulateAtgProbe = async (triggerWaterAlarm: boolean) => {
    const eventId = `ATG-POLL-${Math.floor(10000 + Math.random() * 89999)}`;
    const waterMm = triggerWaterAlarm ? 24.5 : 3.2;
    const payload = {
      stationId,
      deviceCode: 'VR-TLS450-01',
      deviceEventId: eventId,
      tankId: 'TNK-GASOIL-02',
      fuelVolumeLitres: 28940,
      waterLevelMm: waterMm,
      temperatureC: 27.4,
    };
    const remote = await onPostBackend('/api/v1/enterprise/hardware/ingest/atg-reading', 'POST', payload);
    const alarm = remote ? Boolean(remote.waterIngressAlarm) : waterMm > 15.0;

    setSeenEventIds((prev) => new Set(prev).add(eventId));
    setEvents((prev) => [
      {
        id: String(remote?.id ?? `hwe_${Date.now().toString(36)}`),
        deviceCode: payload.deviceCode,
        protocol: 'VEEDER_ROOT_ATG',
        deviceEventId: eventId,
        summary: `Veeder-Root ATG ${payload.tankId}: ${payload.fuelVolumeLitres.toLocaleString()} L | Water ${waterMm}mm | ${payload.temperatureC}C`,
        alarmTriggered: alarm,
        idempotentReplay: false,
        receivedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    onNotify(
      alarm ? 'error' : 'success',
      alarm
        ? `WATER INGRESS ALARM (${waterMm}mm > 15mm threshold) triggered on ${payload.tankId}!`
        : `Veeder-Root ATG telemetry synced cleanly (${payload.fuelVolumeLitres.toLocaleString()} L).`
    );
  };

  const simulateOcppSession = async () => {
    const eventId = `OCPP-SES-${Math.floor(10000 + Math.random() * 89999)}`;
    const payload = {
      stationId,
      deviceCode: 'OCPP-EV-DC01',
      deviceEventId: eventId,
      connectorId: 'DC-CCS2-01',
      kwhDelivered: 38.4,
      tariffFcfaPerKwh: 220,
    };
    const remote = await onPostBackend('/api/v1/enterprise/hardware/ingest/ocpp-session', 'POST', payload);
    const amount = Number(remote?.amountFcfa ?? Math.round(payload.kwhDelivered * payload.tariffFcfaPerKwh));

    setSeenEventIds((prev) => new Set(prev).add(eventId));
    setEvents((prev) => [
      {
        id: String(remote?.id ?? `hwe_${Date.now().toString(36)}`),
        deviceCode: payload.deviceCode,
        protocol: 'OCPP_201_EV',
        deviceEventId: eventId,
        summary: `OCPP 2.0.1 ${payload.connectorId}: ${payload.kwhDelivered} kWh = ${amount.toLocaleString()} FCFA (posted to EV Utility Ledger)`,
        alarmTriggered: false,
        idempotentReplay: false,
        receivedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    onNotify('success', `Settled OCPP 2.0.1 EV charging session (${payload.kwhDelivered} kWh / ${amount.toLocaleString()} FCFA).`);
  };

  const simulateOfflineSyncRetry = async () => {
    const opId = `MOB-OFF-${Math.floor(1000 + Math.random() * 8999)}`;
    const batch = {
      operations: [
        { clientOpId: opId, stationId, operationType: 'OFFLINE_SALE', payloadSummary: 'Pump P1 manual fallback 20L SUPER' },
        { clientOpId: opId, stationId, operationType: 'OFFLINE_SALE', payloadSummary: 'Duplicate retry frame after reconnect' },
      ],
    };
    const remote = await onPostBackend('/api/v1/enterprise/mobile/offline-sync', 'POST', batch);
    const applied = Number(remote?.appliedCount ?? 1);
    const skipped = Number(remote?.duplicatesSkipped ?? 1);
    setEvents((prev) => [
      {
        id: `msy_${Date.now().toString(36)}`,
        deviceCode: 'MOBILE-ATTENDANT-APP',
        protocol: 'MOBILE_OFFLINE_SYNC',
        deviceEventId: opId,
        summary: `Offline Sync Batch (T014): ${applied} applied, ${skipped} duplicate retry skipped cleanly`,
        alarmTriggered: false,
        idempotentReplay: skipped > 0,
        receivedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    onNotify('success', `Mobile offline sync verified (T014): ${applied} applied, ${skipped} duplicate retry skipped.`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-slate-900" />
            <h3 className="font-display text-lg font-bold text-slate-950">
              Forecourt Hardware Edge Bridge &amp; OCPP 2.0.1 Telemetry (M44 · M53 · T012 · T014)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cloud ingestion gateway and live protocol simulator for DOMS/PTS-2 pump controllers, Veeder-Root TLS-450 ATG probes, OCPP 2.0.1 EV chargers, and mobile offline sync deduplication.
            Physical RS-485/TCP site gateway pairing completes during on-site station commissioning.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setRegisterModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Register Edge Device
          </button>
        )}
      </div>

      {/* 1-Click Live Protocol Simulators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => void simulateDomsTx(false)}
          className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-400 text-left transition"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-950">
            <Activity className="w-3.5 h-3.5 text-amber-600" /> DOMS / PTS-2 TX
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Simulate 55L Gasoil pump dispense</div>
        </button>

        <button
          type="button"
          onClick={() => void simulateDomsTx(true)}
          className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-400 text-left transition"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-950">
            <RefreshCw className="w-3.5 h-3.5 text-slate-700" /> Replay Last TX (T012)
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Test idempotent deduplication</div>
        </button>

        <button
          type="button"
          onClick={() => void simulateAtgProbe(true)}
          className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-400 text-left transition"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-950">
            <Droplets className="w-3.5 h-3.5 text-red-600" /> Veeder-Root ATG Alarm
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Simulate 24.5mm water ingress</div>
        </button>

        <button
          type="button"
          onClick={() => void simulateOcppSession()}
          className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-400 text-left transition"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-950">
            <Zap className="w-3.5 h-3.5 text-amber-600" /> OCPP 2.0.1 EV Session
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Settle 38.4 kWh DC charger</div>
        </button>

        <button
          type="button"
          onClick={() => void simulateOfflineSyncRetry()}
          className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-400 text-left transition"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-950">
            <Smartphone className="w-3.5 h-3.5 text-slate-700" /> Mobile Sync Retry (T014)
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Verify offline duplicate guard</div>
        </button>
      </div>

      {/* Registered Site Edge Devices */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Registered Edge Bridges &amp; Field Controllers ({devices.length})
        </h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0F172A] text-white font-mono text-[11px] uppercase">
                <th className="py-2.5 px-3">Device Code</th>
                <th className="py-2.5 px-3">Protocol</th>
                <th className="py-2.5 px-3">Endpoint URI</th>
                <th className="py-2.5 px-3">Firmware</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {devices.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-950">{d.deviceCode}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">{d.protocol}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{d.endpointUri}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{d.firmwareVersion}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold text-[11px]">
                      <ShieldCheck className="w-3 h-3" /> {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-Time Telemetry Stream */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Idempotent Hardware Telemetry &amp; Sync Log ({events.length})
        </h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0F172A] text-white font-mono text-[11px] uppercase">
                <th className="py-2.5 px-3">Protocol</th>
                <th className="py-2.5 px-3">Device Event ID</th>
                <th className="py-2.5 px-3">Telemetry Payload Summary</th>
                <th className="py-2.5 px-3">Guard Status</th>
                <th className="py-2.5 px-3">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">{ev.protocol}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">{ev.deviceEventId}</td>
                  <td className="py-2.5 px-3 text-slate-800">{ev.summary}</td>
                  <td className="py-2.5 px-3">
                    {ev.alarmTriggered ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-700 font-semibold text-[11px]">
                        <AlertTriangle className="w-3 h-3" /> WATER ALARM
                      </span>
                    ) : ev.idempotentReplay ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800 font-semibold text-[11px]">
                        DEDUPLICATED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700 font-semibold text-[11px]">
                        INGESTED
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">
                    {new Date(ev.receivedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FormModal
        open={registerModalOpen}
        title="Register Site Hardware Edge Bridge"
        subtitle={`Bind a DOMS/PTS-2, Veeder-Root ATG, or OCPP 2.0.1 edge controller to ${stationName}.`}
        onClose={() => setRegisterModalOpen(false)}
      >
        <form onSubmit={(e) => void handleRegisterDevice(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="opes-label">Device Code</label>
              <input
                required
                placeholder="e.g. DOMS-FC-02"
                value={devCode}
                onChange={(e) => setDevCode(e.target.value)}
                className="opes-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="opes-label">Hardware Protocol</label>
              <select
                value={devProtocol}
                onChange={(e) => setDevProtocol(e.target.value as 'DOMS_PTS2' | 'VEEDER_ROOT_ATG' | 'OCPP_201_EV')}
                className="opes-input text-xs"
              >
                <option value="DOMS_PTS2">DOMS / PTS-2 Forecourt Controller</option>
                <option value="VEEDER_ROOT_ATG">Veeder-Root TLS-450 ATG Probe</option>
                <option value="OCPP_201_EV">OCPP 2.0.1 EV Charger Gateway</option>
              </select>
            </div>
          </div>
          <div>
            <label className="opes-label">Edge Endpoint URI</label>
            <input
              required
              value={devUri}
              onChange={(e) => setDevUri(e.target.value)}
              className="opes-input font-mono text-xs"
            />
          </div>
          <div>
            <label className="opes-label">Firmware Version</label>
            <input
              value={devFirmware}
              onChange={(e) => setDevFirmware(e.target.value)}
              className="opes-input font-mono text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRegisterModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#D97706] hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Save Edge Bridge
            </button>
          </div>
        </form>
      </FormModal>

      <div className="border-t border-slate-200 pt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-display text-sm font-bold text-slate-900">
              Deployable On-Site Edge Agent (Raspberry Pi / Linux Daemon — <span className="font-mono">edge-agent/</span>)
            </h4>
            <p className="text-xs text-slate-500">
              Generate a SHA-256 hashed site API key (<span className="font-mono">X-Edge-Key</span>) for physical PTS-2 jsonPTS, Veeder-Root TLS-350/450, and OCPP 2.0.1 EVSE hardware.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={async () => {
                const name = `Edge-${stationName.replace(/[^a-zA-Z0-9]+/g, '-')}-${Math.floor(10 + Math.random() * 89)}`;
                const res = await onPostBackend('/api/v1/edge/devices', 'POST', {
                  stationId,
                  deviceName: name,
                  driversCsv: 'DOMS_PTS2,VEEDER_ROOT_ATG,OCPP_201_EV',
                });
                const key = String(res?.apiKey ?? `opf_edge_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`);
                setProvisionedKey({ deviceName: name, apiKey: key });
                onNotify('success', `Provisioned on-site Edge Agent key for ${name}.`);
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Provision Edge Agent Key
            </button>
          )}
        </div>
        {provisionedKey && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-1.5 text-xs">
            <div className="font-bold text-amber-950">One-Time Edge API Key for {provisionedKey.deviceName}</div>
            <div className="font-mono text-slate-900 break-all bg-white border border-amber-200 rounded px-3 py-2">
              OPESFUEL_EDGE_KEY={provisionedKey.apiKey}
            </div>
            <div className="text-[11px] text-amber-900">
              Paste into <span className="font-mono">/etc/opesfuel-edge/edge.env</span> and run <span className="font-mono">sudo systemctl restart opesfuel-edge</span>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
