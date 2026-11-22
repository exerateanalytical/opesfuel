#!/usr/bin/env bash
set -euo pipefail

# OpesFuel PostgreSQL Restore Script
# Usage: ./deploy/restore-postgres.sh /path/to/opesfuel_opesfuel_YYYYMMDDTHHMMSSZ.sql.gz

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
POSTGRES_CONTAINER="${OPESFUEL_PG_CONTAINER:-opesfuel-postgres-1}"
POSTGRES_DB="${POSTGRES_DB:-opesfuel}"
POSTGRES_USER="${POSTGRES_USER:-opesfuel_app}"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "Restoring ${BACKUP_FILE} into ${POSTGRES_DB} inside ${POSTGRES_CONTAINER}..."
gunzip -c "${BACKUP_FILE}" | docker exec -i "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --set ON_ERROR_STOP=1
echo "Restore completed successfully."
