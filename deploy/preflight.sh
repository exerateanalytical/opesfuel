#!/usr/bin/env bash
# OpesFuel production preflight. Read-only: changes nothing. Exit code 0 = safe to deploy, 1 = at least one FAIL.
# Usage: deploy/preflight.sh [--env FILE] [--with-mcp] [--no-dns] [--no-git]
set -uo pipefail

ENV_FILE=".env"; WITH_MCP=0; CHECK_DNS=1; CHECK_GIT=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_FILE="$2"; shift 2 ;;
    --with-mcp) WITH_MCP=1; shift ;;
    --no-dns) CHECK_DNS=0; shift ;;
    --no-git) CHECK_GIT=0; shift ;;
    -h|--help) sed -n 2,4p "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

FAILS=0; WARNS=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; WARNS=$((WARNS+1)); }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAILS=$((FAILS+1)); }
section() { printf '\n== %s ==\n' "$1"; }

# value of KEY in the env file (no shell evaluation, strips surrounding quotes)
envget() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//; s/"$//' -e "s/^'//; s/'\$//"; }

section "Tools"
for t in docker git curl; do command -v "$t" >/dev/null 2>&1 && pass "$t installed" || fail "$t is not installed"; done
if docker compose version >/dev/null 2>&1; then pass "docker compose available"; else fail "docker compose plugin missing"; fi
if docker info >/dev/null 2>&1; then pass "docker daemon reachable"; else fail "docker daemon not reachable (is it running? are you in the docker group?)"; fi

section "Environment file ($ENV_FILE)"
if [[ ! -f "$ENV_FILE" ]]; then
  fail "$ENV_FILE not found (copy deploy/opesfuel.com.env.example and fill it in)"
else
  pass "$ENV_FILE exists"
  perm=$(stat -c '%a' "$ENV_FILE" 2>/dev/null || echo "")
  [[ -n "$perm" && "$perm" != "600" && "$perm" != "400" ]] && warn "$ENV_FILE permissions are $perm; run: chmod 600 $ENV_FILE"
  if grep -Eq '^[A-Za-z_][A-Za-z0-9_]*=.*CHANGE_ME' "$ENV_FILE"; then
    fail "placeholder values remain for: $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=.*CHANGE_ME' "$ENV_FILE" | cut -d= -f1 | tr '\n' ' ')"
  else pass "no CHANGE_ME placeholders"; fi

  for k in SPRING_DATASOURCE_PASSWORD OPESFUEL_ENCRYPTION_KEY AUTH0_ISSUER_URI AUTH0_AUDIENCE VITE_AUTH0_DOMAIN VITE_AUTH0_CLIENT_ID \
           OPESFUEL_CORS_ALLOWED_ORIGINS OPESFUEL_BOOTSTRAP_ADMIN_EMAIL OPESFUEL_AUTH0_ACTION_SECRET OPESFUEL_DOMAIN OPESFUEL_API_DOMAIN OPESFUEL_DEMO_DOMAIN PUBLIC_API_BASE_URL; do
    [[ -n "$(envget "$k")" ]] && pass "$k set" || fail "$k is missing or empty"
  done

  v=$(envget OPESFUEL_ENCRYPTION_KEY);        [[ -n "$v" && ${#v} -lt 32 ]] && fail "OPESFUEL_ENCRYPTION_KEY must be at least 32 characters (is ${#v})"
  v=$(envget OPESFUEL_AUTH0_ACTION_SECRET);   [[ -n "$v" && ${#v} -lt 32 ]] && fail "OPESFUEL_AUTH0_ACTION_SECRET must be at least 32 characters (use: openssl rand -hex 32)"
  v=$(envget SPRING_DATASOURCE_PASSWORD);     [[ -n "$v" && ${#v} -lt 16 ]] && warn "database password is short (${#v} chars)"
  v=$(envget AUTH0_ISSUER_URI);               [[ -n "$v" && "$v" != https://*/ ]] && fail "AUTH0_ISSUER_URI must start with https:// and end with / (is: $v)"
  v=$(envget OPESFUEL_BOOTSTRAP_ADMIN_EMAIL); [[ -n "$v" && ! "$v" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] && fail "OPESFUEL_BOOTSTRAP_ADMIN_EMAIL is not a valid email"

  web=$(envget OPESFUEL_DOMAIN); api=$(envget OPESFUEL_API_DOMAIN); demo=$(envget OPESFUEL_DEMO_DOMAIN)
  [[ -n "$web" && "$(envget OPESFUEL_CORS_ALLOWED_ORIGINS)" != *"https://$web"* ]] && fail "OPESFUEL_CORS_ALLOWED_ORIGINS must include https://$web"
  [[ -n "$api" && "$(envget PUBLIC_API_BASE_URL)" != "https://$api" ]] && fail "PUBLIC_API_BASE_URL must be https://$api (is: $(envget PUBLIC_API_BASE_URL))"
  [[ -n "$demo" && -n "$(envget VITE_DEMO_URL)" && "$(envget VITE_DEMO_URL)" != "https://$demo" ]] && warn "VITE_DEMO_URL differs from https://$demo"
  [[ "$(envget OPESFUEL_ALLOW_DEFAULT_TENANT_FALLBACK)" == "true" ]] && fail "OPESFUEL_ALLOW_DEFAULT_TENANT_FALLBACK=true is unsafe in production"
  [[ -n "$(envget MCP_DEV_TOKEN)" ]] && fail "MCP_DEV_TOKEN must not be set in production"
  [[ "$(envget OPESFUEL_MAIL_PROVIDER)" == "LOG_ONLY" || -z "$(envget OPESFUEL_MAIL_PROVIDER)" ]] && warn "OPESFUEL_MAIL_PROVIDER is LOG_ONLY: welcome and OTP emails are not actually sent"
  [[ "$(envget MCP_ENABLE_WRITES)" == "true" ]] && warn "MCP_ENABLE_WRITES=true: the Claude/ChatGPT connector can change data (with confirmation)"
fi

section "Compose configuration"
if [[ -f "$ENV_FILE" ]] && docker compose version >/dev/null 2>&1; then
  profiles=(--profile tls --profile demo); [[ $WITH_MCP -eq 1 ]] && profiles+=(--profile mcp)
  if out=$(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" "${profiles[@]}" config -q 2>&1); then pass "docker-compose.prod.yml validates with this env file"; else fail "compose config error: $(echo "$out" | head -2 | tr '\n' ' ')"; fi
fi

if [[ $CHECK_GIT -eq 1 ]]; then
  section "Code"
  if git rev-parse --git-dir >/dev/null 2>&1; then
    br=$(git rev-parse --abbrev-ref HEAD); [[ "$br" == "main" ]] && pass "on branch main" || warn "on branch '$br' (production deploys from main)"
    [[ -z "$(git status --porcelain --untracked-files=no)" ]] && pass "working tree clean" || fail "uncommitted changes in tracked files"
    git fetch -q origin main 2>/dev/null
    if git rev-parse origin/main >/dev/null 2>&1; then
      behind=$(git rev-list --count HEAD..origin/main); ahead=$(git rev-list --count origin/main..HEAD)
      [[ "$behind" == 0 ]] && pass "up to date with origin/main ($(git rev-parse --short HEAD))" || warn "$behind commit(s) behind origin/main (deploy.sh pulls them)"
      [[ "$ahead" != 0 ]] && warn "$ahead local commit(s) not on origin/main"
    else warn "could not reach origin/main"; fi
  else fail "not inside a git checkout"; fi
fi

if [[ $CHECK_DNS -eq 1 && -f "$ENV_FILE" ]]; then
  section "DNS and network"
  myip=$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true)
  [[ -n "$myip" ]] && pass "this server's public IP: $myip" || warn "could not detect this server's public IP; DNS targets not compared"
  hosts=("$(envget OPESFUEL_DOMAIN)" "$(envget OPESFUEL_API_DOMAIN)" "$(envget OPESFUEL_DEMO_DOMAIN)")
  [[ $WITH_MCP -eq 1 ]] && hosts+=("$(envget OPESFUEL_MCP_DOMAIN)")
  for h in "${hosts[@]}"; do
    [[ -z "$h" ]] && continue
    ips=$(getent ahostsv4 "$h" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')
    if [[ -z "$ips" ]]; then fail "$h does not resolve (add the DNS record before deploying: Caddy cannot get a certificate without it)"
    elif [[ -n "$myip" && "$ips" != *"$myip"* ]]; then fail "$h resolves to $ips, not this server ($myip)"
    else pass "$h -> $ips"; fi
  done
  for port in 80 443; do
    if command -v ss >/dev/null 2>&1 && ss -ltn "( sport = :$port )" 2>/dev/null | grep -q LISTEN; then
      docker ps --format '{{.Ports}}' 2>/dev/null | grep -q ":$port->" && pass "port $port is held by docker (ok on a re-deploy)" || warn "port $port is in use by something other than docker (Caddy needs 80 and 443)"
    else pass "port $port is free"; fi
  done
fi

section "Server resources"
free_gb=$(df -Pk . | awk 'NR==2{printf "%d", $4/1024/1024}'); [[ "$free_gb" -ge 8 ]] && pass "free disk: ${free_gb} GB" || { [[ "$free_gb" -ge 4 ]] && warn "free disk is low: ${free_gb} GB (builds need about 4 GB)" || fail "free disk too low: ${free_gb} GB"; }
mem_mb=$(awk '/MemTotal/{printf "%d",$2/1024}' /proc/meminfo 2>/dev/null || echo 0); [[ "$mem_mb" -ge 3500 ]] && pass "memory: ${mem_mb} MB" || { [[ "$mem_mb" -ge 1900 ]] && warn "memory is ${mem_mb} MB: the Java build may be slow or run out; add swap" || warn "memory is only ${mem_mb} MB"; }

printf '\nResult: %d failure(s), %d warning(s)\n' "$FAILS" "$WARNS"
if [[ $FAILS -gt 0 ]]; then echo "NOT READY: fix the FAIL lines above, then run this again."; exit 1; fi
echo "READY to deploy."; exit 0
