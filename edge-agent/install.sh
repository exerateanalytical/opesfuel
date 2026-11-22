#!/usr/bin/env bash
set -euo pipefail

echo "=== OpesFuel On-Site Hardware Edge Agent Installer ==="
INSTALL_DIR="/opt/opesfuel-edge"
CONF_DIR="/etc/opesfuel-edge"
DATA_DIR="/var/lib/opesfuel-edge"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js 22+ is required. Install Node.js 24 LTS first."
  exit 1
fi

sudo mkdir -p "$INSTALL_DIR" "$CONF_DIR" "$DATA_DIR"
sudo cp -r package.json dist "$INSTALL_DIR/"
sudo cp opesfuel-edge.service /etc/systemd/system/opesfuel-edge.service

if [ ! -f "$CONF_DIR/edge.env" ]; then
  cat <<'EOF' | sudo tee "$CONF_DIR/edge.env" >/dev/null
OPESFUEL_CLOUD_URL=https://api.opesfuel.com
OPESFUEL_EDGE_KEY=REPLACE_WITH_KEY_FROM_OPESFUEL_CONSOLE
OPESFUEL_OUTBOX_PATH=/var/lib/opesfuel-edge/outbox.jsonl
OPESFUEL_POLL_INTERVAL_MS=15000
OPESFUEL_OCPP_PORT=9201
# Optional PTS-2 / DOMS controller on site LAN:
# PTS2_URL=http://192.168.1.50
# PTS2_USER=admin
# PTS2_PASSWORD=admin
# PTS2_PUMPS=1,2,3,4
# PTS2_PROBES=1,2
# Optional Veeder-Root TLS-350/450 ATG TCP/Serial bridge:
# ATG_TCP_HOST=192.168.1.60
# ATG_TCP_PORT=10001
EOF
  echo "Created $CONF_DIR/edge.env — edit OPESFUEL_EDGE_KEY before starting."
fi

id -u opesfuel-edge >/dev/null 2>&1 || sudo useradd --system --no-create-home opesfuel-edge
sudo chown -R opesfuel-edge:opesfuel-edge "$INSTALL_DIR" "$DATA_DIR"
sudo systemctl daemon-reload
sudo systemctl enable opesfuel-edge.service
echo "Installed. Edit $CONF_DIR/edge.env then run: sudo systemctl restart opesfuel-edge"
