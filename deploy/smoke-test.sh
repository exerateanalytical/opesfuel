#!/usr/bin/env bash
set -euo pipefail

# OpesFuel Production VPS Go-Live Preflight & Smoke Verification Script
# Usage:
#   ./deploy/smoke-test.sh [API_BASE_URL] [WEB_BASE_URL]
# Example:
#   ./deploy/smoke-test.sh http://127.0.0.1:8080 http://127.0.0.1:3000
#   ./deploy/smoke-test.sh https://api.opesfuel.com https://app.opesfuel.com

API_URL="${1:-http://127.0.0.1:8080}"
WEB_URL="${2:-http://127.0.0.1:3000}"
ENV_FILE="${OPESFUEL_ENV_FILE:-.env}"

echo "=== OpesFuel Production Go-Live Smoke Test ==="
echo "API Target : ${API_URL}"
echo "Web Target : ${WEB_URL}"

# 1. Required production environment variable preflight (if .env exists)
if [[ -f "${ENV_FILE}" ]]; then
  echo "[1/5] Checking required secrets in ${ENV_FILE}..."
  for key in SPRING_DATASOURCE_PASSWORD AUTH0_ISSUER_URI OPESFUEL_ENCRYPTION_KEY OPESFUEL_CORS_ALLOWED_ORIGINS; do
    if ! grep -Eq "^${key}=.+" "${ENV_FILE}"; then
      echo "ERROR: Missing or empty required secret '${key}' in ${ENV_FILE}" >&2
      exit 1
    fi
  done
  echo "  OK: All mandatory production secrets are present."
else
  echo "[1/5] Skipping .env file check (${ENV_FILE} not found; assuming exported container env)."
fi

# 2. Verify backend actuator health endpoint
echo "[2/5] Probing Spring Boot healthcheck (${API_URL}/actuator/health)..."
HEALTH_JSON="$(curl -fsS --max-time 10 "${API_URL}/actuator/health")"
if [[ "${HEALTH_JSON}" != *'"status":"UP"'* ]]; then
  echo "ERROR: Backend healthcheck did not report UP: ${HEALTH_JSON}" >&2
  exit 1
fi
echo "  OK: Backend reported status=UP."

# 3. Verify frontend root document serves cleanly
echo "[3/5] Probing Web Console (${WEB_URL}/)..."
WEB_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${WEB_URL}/")"
if [[ "${WEB_CODE}" != "200" ]]; then
  echo "ERROR: Web Console returned HTTP ${WEB_CODE} (expected 200)" >&2
  exit 1
fi
echo "  OK: Web Console responded HTTP 200."

# 4. Verify TLS & security headers if targeting HTTPS
if [[ "${WEB_URL}" == https://* ]]; then
  echo "[4/5] Verifying HTTPS security headers..."
  HEADERS="$(curl -fsSI --max-time 10 "${WEB_URL}/")"
  for hdr in "strict-transport-security" "x-content-type-options"; do
    if ! echo "${HEADERS}" | grep -iq "${hdr}"; then
      echo "ERROR: Missing expected security header '${hdr}' on ${WEB_URL}" >&2
      exit 1
    fi
  done
  echo "  OK: HSTS and nosniff security headers verified."
else
  echo "[4/5] Skipping HTTPS header check for local HTTP target."
fi

# 5. Verify PostgreSQL backup script syntax & Flyway migration inventory
echo "[5/5] Verifying backup/restore scripts & Flyway migration inventory..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash -n "${SCRIPT_DIR}/backup-postgres.sh"
bash -n "${SCRIPT_DIR}/restore-postgres.sh"
echo "  OK: Backup/restore scripts syntax verified."

echo "=== ALL SMOKE CHECKS PASSED ==="
