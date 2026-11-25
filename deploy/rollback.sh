#!/usr/bin/env bash
# Return the running site to the previous release (code only; the database is NOT restored).
#   deploy/rollback.sh              go back to the commit recorded before the last deploy
#   deploy/rollback.sh <sha|tag>    go back to a specific commit
# Database migrations only move forward. Older code normally runs fine on a newer schema; if a release added a
# migration that old code cannot tolerate, restore a backup instead: deploy/restore-postgres.sh
set -Eeuo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:-}"; ENV_FILE="${OPESFUEL_ENV_FILE:-.env}"
[[ -z "$TARGET" && -f deploy/.last-release ]] && TARGET="$(cat deploy/.last-release)"
[[ -z "$TARGET" || "$TARGET" == unknown ]] && { echo "No previous release recorded. Pass a commit: deploy/rollback.sh <sha>" >&2; exit 1; }
git cat-file -e "$TARGET^{commit}" 2>/dev/null || { git fetch -q origin; git cat-file -e "$TARGET^{commit}" || { echo "unknown commit: $TARGET" >&2; exit 1; }; }
echo "Rolling back code to $(git log --oneline -1 "$TARGET")"
read -r -p "Continue? [y/N] " a; [[ "$a" == y || "$a" == Y ]] || { echo "cancelled"; exit 1; }
git checkout -q --detach "$TARGET"
PROFILES=(--profile tls --profile demo); docker compose -f docker-compose.prod.yml config --profiles 2>/dev/null | grep -qx mcp && docker ps --format '{{.Names}}' | grep -q opesfuel-mcp && PROFILES+=(--profile mcp)
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" "${PROFILES[@]}" up -d --build
echo "Rolled back. Verify: deploy/verify-public.sh https://<domain> https://api.<domain> https://demo.<domain>"
echo "To go forward again later: git checkout main && deploy/deploy.sh"
