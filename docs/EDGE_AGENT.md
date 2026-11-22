# OpesFuel On-Site Hardware Edge Agent (`edge-agent/`)

Deployable Raspberry Pi / Linux site bridge connecting physical forecourt equipment to OpesFuel Cloud over intermittent 3G/4G links with a crash-safe durable outbox.

## Supported Protocols

1. **PTS-2 / DOMS Forecourt Controllers (`jsonPTS` HTTP)**:
   - Polls `PumpGetStatus`, `PumpGetTransactionInformation`, and `ProbeGetMeasurements`.
   - Deduplicates every transaction by `deviceEventId` (`PTS2-TX-P{pump}-{txId}`).
2. **Veeder-Root TLS-350 / TLS-450 Automatic Tank Gauges (TCP/Serial)**:
   - Sends `<SOH>i20100` (In-Tank Inventory) & `<SOH>i20200` (Deliveries) and decodes big-endian IEEE-754 hex floats.
   - Automatically flags water-ingress alarms (`>= 15mm`) and low-stock alerts (`< 2,000 L`).
3. **OCPP 2.0.1 EV Charging CSMS (WebSocket Server)**:
   - Listens on `ws://<edge-ip>:9201/<chargePointId>` with subprotocol `ocpp2.0.1`.
   - Handles `BootNotification`, `Heartbeat`, `StatusNotification`, `TransactionEvent`, and `MeterValues`.

## Installation on Raspberry Pi / Debian Linux

1. In OpesFuel Console → **Forecourt / Hardware Edge Bridge**, register a new On-Site Edge Agent and copy the one-time `opf_edge_...` API key.
2. On the site Raspberry Pi (Node.js 22/24 LTS):
   ```bash
   cd edge-agent
   npm run build
   sudo ./install.sh
   sudo nano /etc/opesfuel-edge/edge.env   # Paste OPESFUEL_EDGE_KEY and controller IPs
   sudo systemctl restart opesfuel-edge
   sudo journalctl -u opesfuel-edge -f
   ```
3. Or run via Docker:
   ```bash
   docker build -t opesfuel-edge-agent ./edge-agent
   docker run -d --restart unless-stopped --name opesfuel-edge \
     -p 9201:9201 -v opesfuel_edge_data:/data \
     -e OPESFUEL_CLOUD_URL=https://api.opesfuel.com \
     -e OPESFUEL_EDGE_KEY=opf_edge_xxxx \
     -e PTS2_URL=http://192.168.1.50 \
     -e ATG_TCP_HOST=192.168.1.60 \
     opesfuel-edge-agent
   ```
