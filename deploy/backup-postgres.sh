#!/usr/bin/env bash
set -euo pipefail

# OpesFuel Automated Daily PostgreSQL 17 Backup Script
# Usage: ./deploy/backup-postgres.sh
# Cron example (02:00 UTC daily):
#   0 2 * * * /opt/opesfuel/deploy/backup-postgres.sh >> /var/log/opesfuel-backup.log 2>&1

BACKUP_DIR="${OPESFUEL_BACKUP_DIR:-$(cd "$(dirname "$0")" && pwd)/backups}"
RETENTION_DAYS="${OPESFUEL_BACKUP_RETENTION_DAYS:-30}"
POSTGRES_CONTAINER="${OPESFUEL_PG_CONTAINER:-opesfuel-postgres-1}"
POSTGRES_DB="${POSTGRES_DB:-opesfuel}"
POSTGRES_USER="${POSTGRES_USER:-opesfuel_app}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "${BACKUP_DIR}"
OUT_FILE="${BACKUP_DIR}/opesfuel_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

echo "[$(date -u +%FT%TZ)] Starting PostgreSQL backup to ${OUT_FILE}..."
docker exec "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --no-acl | gzip -9 > "${OUT_FILE}"

if [[ -n "${OPESFUEL_BACKUP_GPG_RECIPIENT:-}" ]] && command -v gpg >/dev/null 2>&1; then
  gpg --yes --batch --trust-model always -e -r "${OPESFUEL_BACKUP_GPG_RECIPIENT}" "${OUT_FILE}"
  rm -f "${OUT_FILE}"
  OUT_FILE="${OUT_FILE}.gpg"
  echo "[$(date -u +%FT%TZ)] Encrypted backup -> ${OUT_FILE}"
fi

find "${BACKUP_DIR}" -type f \( -name "opesfuel_*.sql.gz" -o -name "opesfuel_*.sql.gz.gpg" \) -mtime +"${RETENTION_DAYS}" -delete
echo "[$(date -u +%FT%TZ)] Backup complete ($(du -h "${OUT_FILE}" | cut -f1)). Retained last ${RETENTION_DAYS} days."
