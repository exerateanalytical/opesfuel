#!/usr/bin/env bash
# One-command production deploy of OpesFuel (opesfuel.com).
#   deploy/deploy.sh                 preflight -> backup -> pull main -> build -> start -> wait healthy -> verify public URLs
#   deploy/deploy.sh --with-mcp      also start the Claude/ChatGPT connector
#   deploy/deploy.sh --dry-run       preflight only, shows what would run
#   deploy/deploy.sh --skip-backup   (first deploy on an empty server)
#   deploy/deploy.sh --ref <sha|tag> deploy a specific commit instead of origin/main
# Run from the repository folder that contains docker-compose.prod.yml and .env.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

WITH_MCP=0; SKIP_BACKUP=0; DRY=0; REF=""; ENV_FILE=".env"
while [[ $# -gt 0 ]]; do case "$1" in
  --with-mcp) WITH_MCP=1; shift ;; --skip-backup) SKIP_BACKUP=1; shift ;; --dry-run) DRY=1; shift ;;
  --ref) REF="$2"; shift 2 ;; --env) ENV_FILE="$2"; shift 2 ;; -h|--help) sed -n 2,9p "$0"; exit 0 ;;
  *) echo "unknown option: $1" >&2; exit 2 ;; esac; done

step() { printf '\n\033[1m[%s] %s\033[0m\n' "$(date -u +%H:%M:%S)" "$1"; }
envget() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//; s/"$//'; }
PROFILES=(--profile tls --profile demo); [[ $WITH_MCP -eq 1 ]] && PROFILES+=(--profile mcp)
DC=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" "${PROFILES[@]}")
PREV_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
trap 'echo; echo "DEPLOY FAILED at the step above."; echo "  Logs:      ${DC[*]} logs --tail=150 opesfuel-backend"; echo "  Roll back: deploy/rollback.sh   (previous release: ${PREV_SHA:0:9})"; ' ERR

step "1/7 Preflight"
PF=(deploy/preflight.sh --env "$ENV_FILE"); [[ $WITH_MCP -eq 1 ]] && PF+=(--with-mcp)
"${PF[@]}"
if [[ $DRY -eq 1 ]]; then
  echo; echo "DRY RUN: would now back up the database, pull ${REF:-origin/main}, build and start: ${DC[*]} up -d --build"; exit 0
fi

step "2/7 Database backup"
if [[ $SKIP_BACKUP -eq 1 ]]; then echo "skipped (--skip-backup)"
else
  PG="$("${DC[@]}" ps -q postgres 2>/dev/null || true)"
  if [[ -n "$PG" ]]; then OPESFUEL_PG_CONTAINER="$PG" POSTGRES_DB="$(envget POSTGRES_DB)" POSTGRES_USER="$(envget POSTGRES_USER)" deploy/backup-postgres.sh
  else echo "no running database container: nothing to back up (first deploy?)"; fi
fi

step "3/7 Get the code"
if [[ -n "$REF" ]]; then git fetch -q origin && git checkout -q --detach "$REF"
else git checkout -q main && git pull -q --ff-only origin main; fi
NEW_SHA="$(git rev-parse HEAD)"; echo "deploying $(git log --oneline -1)"
echo "$PREV_SHA" > deploy/.last-release

step "4/7 Build images (the first build takes several minutes)"
"${DC[@]}" build

step "5/7 Start services"
"${DC[@]}" up -d

wait_for() { # label url seconds
  local label="$1" url="$2" max="$3" t=0
  printf 'waiting for %s ' "$label"
  until curl -fsS --max-time 4 -o /dev/null "$url" 2>/dev/null; do
    t=$((t+5)); [[ $t -ge $max ]] && { echo " TIMEOUT after ${max}s"; return 1; }; printf '.'; sleep 5
  done; echo " up (${t}s)"
}
step "6/7 Wait until healthy (database migrations run on the first start)"
wait_for "backend" "http://127.0.0.1:8080/actuator/health" 420
wait_for "website" "http://127.0.0.1:3000/" 180
wait_for "demo site" "http://127.0.0.1:3001/" 180
[[ $WITH_MCP -eq 1 ]] && wait_for "MCP connector" "http://127.0.0.1:8787/healthz" 120

step "7/7 Verify the public site"
WEB="https://$(envget OPESFUEL_DOMAIN)"; API="https://$(envget OPESFUEL_API_DOMAIN)"; DEMO="https://$(envget OPESFUEL_DEMO_DOMAIN)"; MCP=""
[[ $WITH_MCP -eq 1 ]] && MCP="https://$(envget OPESFUEL_MCP_DOMAIN)"
ok=0
for attempt in 1 2 3 4 5 6; do   # HTTPS certificates can take a minute to be issued on the first deploy
  if deploy/verify-public.sh "$WEB" "$API" "$DEMO" $MCP; then ok=1; break; fi
  [[ $attempt -lt 6 ]] && { echo "retrying in 20s (certificate or routing may still be settling)..."; sleep 20; }
done
[[ $ok -eq 1 ]] || { echo "Public verification did not pass."; false; }

echo "$(date -u +%FT%TZ) $NEW_SHA (previous $PREV_SHA)" >> deploy/.releases.log
trap - ERR
printf '\n\033[32mDEPLOYED %s to %s\033[0m\n' "${NEW_SHA:0:9}" "$WEB"
cat <<EOM

Manual checks that cannot be automated (about 10 minutes): see deploy/DEPLOY_OPESFUEL_COM.md section 5, steps 2 to 8:
  signup with a real inbox, first Auth0 login, admin login, trial lock, staff invite.
EOM
