#!/usr/bin/env bash
# Non-destructive checks of a LIVE deployment (creates no data). Exit 1 if anything fails.
# Usage: [IDP=keycloak|auth0] [OIDC_ISSUER=https://.../realms/x] deploy/verify-public.sh WEB_URL API_URL DEMO_URL [MCP_URL]
#   e.g. deploy/verify-public.sh https://opesfuel.com https://api.opesfuel.com https://demo.opesfuel.com
set -uo pipefail
WEB="${1:?usage: verify-public.sh WEB_URL API_URL DEMO_URL [MCP_URL]}"; API="${2:?}"; DEMO="${3:?}"; MCP="${4:-}"
WEB="${WEB%/}"; API="${API%/}"; DEMO="${DEMO%/}"; MCP="${MCP%/}"
FAILS=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAILS=$((FAILS+1)); }
code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$@" 2>/dev/null || echo 000; }
body() { curl -sS --max-time 15 "$@" 2>/dev/null || true; }
expect_code() { # label expected url [curl args]
  local label="$1" want="$2" url="$3"; shift 3; local got; got=$(code "$@" "$url")
  [[ "$got" =~ ^($want)$ ]] && pass "$label (HTTP $got)" || fail "$label: expected HTTP $want, got $got  <- $url"
}

echo "== Backend API: $API =="
h=$(body "$API/actuator/health"); [[ "$h" == *'"status":"UP"'* ]] && pass "health is UP" || fail "health is not UP: ${h:0:120}"
expect_code "plans endpoint is public" 200 "$API/api/v1/billing/plans"
expect_code "protected endpoint refuses anonymous callers" 401 "$API/api/v1/forecourt/pumps"
expect_code "admin endpoint refuses anonymous callers" 401 "$API/api/v1/platform-admin/overview"
expect_code "signup route is live (empty body is rejected by validation)" "400|422" "$API/api/v1/public/auth/signup" -X POST -H 'Content-Type: application/json' -d '{}'
c=$(code -X POST -H 'Content-Type: application/json' -d '{"email":"a@b.cm","sub":"x","emailVerified":true}' "$API/api/v1/public/auth/identity-claims")
if [[ "${IDP:-auth0}" == "keycloak" ]]; then
  # Keycloak: the backend resolves company/role from the verified email itself; the Auth0 Action endpoint is not used (disabled = 503, or 401)
  case "$c" in 401|503) pass "Auth0-Action endpoint is closed to callers (HTTP $c; not used with Keycloak)";; *) fail "identity-claims endpoint answered HTTP $c (expected 401 or 503)";; esac
  expect_code "a made-up login token is refused" 401 "$API/api/v1/identity/me" -H 'Authorization: Bearer not.a.real.token'
  if [[ -n "${OIDC_ISSUER:-}" ]]; then
    d=$(body "${OIDC_ISSUER%/}/.well-known/openid-configuration"); [[ "$d" == *"\"issuer\""* && "$d" == *"${OIDC_ISSUER%/}"* ]] && pass "Keycloak realm answers publicly with the expected issuer" || fail "Keycloak realm discovery missing or reports another issuer (${OIDC_ISSUER%/})"
  fi
else
  case "$c" in 401) pass "login-claims endpoint refuses calls without the Action secret (HTTP 401)";;
    503) fail "login-claims endpoint says it is NOT configured (HTTP 503): set OPESFUEL_AUTH0_ACTION_SECRET on the backend, or every login is refused";;
    *) fail "login-claims endpoint answered HTTP $c (expected 401)";; esac
fi
expect_code "actuator env is not exposed" "401|403|404" "$API/actuator/env"
expect_code "actuator beans are not exposed" "401|403|404" "$API/actuator/beans"
cors=$(curl -sSI --max-time 15 -X OPTIONS -H "Origin: $WEB" -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type' "$API/api/v1/public/leads" 2>/dev/null | tr -d '\r' | grep -i '^access-control-allow-origin:' | head -1)
[[ "$cors" == *"$WEB"* ]] && pass "CORS allows the website origin ($WEB)" || fail "CORS does not allow $WEB (check OPESFUEL_CORS_ALLOWED_ORIGINS): ${cors:-no header}"

echo "== Website: $WEB =="
expect_code "home page loads" 200 "$WEB/"
expect_code "page by path (/pricing) loads" 200 "$WEB/pricing"
hdrs=$(curl -sS -D - -o /dev/null --max-time 15 "$WEB/" 2>/dev/null | tr -d '\r')
[[ "$WEB" == https://* ]] && { echo "$hdrs" | grep -qi '^strict-transport-security' && pass "HSTS header present" || fail "HSTS header missing"; }
echo "$hdrs" | grep -qi '^x-content-type-options: *nosniff' && pass "nosniff header present" || fail "x-content-type-options header missing"
s=$(body "$WEB/sitemap.xml"); [[ "$s" == *"<urlset"* && "$s" == *"/pricing"* ]] && pass "sitemap.xml serves clean page paths" || fail "sitemap.xml missing or wrong"
expect_code "llms.txt is served" 200 "$WEB/llms.txt"
r=$(body "$WEB/robots.txt"); [[ "$r" == *"Sitemap:"* ]] && pass "robots.txt points to the sitemap" || fail "robots.txt missing the Sitemap line"
if [[ "$WEB" == https://* ]]; then
  host="${WEB#https://}"; host="${host%%/*}"
  end=$(echo | timeout 10 openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [[ -n "$end" ]]; then days=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 )); [[ $days -gt 14 ]] && pass "TLS certificate valid for $days more days" || fail "TLS certificate expires in $days days"; else fail "could not read the TLS certificate for $host"; fi
fi

echo "== Demo: $DEMO =="
expect_code "demo site loads" 200 "$DEMO/"

if [[ -n "$MCP" ]]; then
  echo "== MCP connector: $MCP =="
  expect_code "connector health" 200 "$MCP/healthz"
  expect_code "OAuth metadata is published" 200 "$MCP/.well-known/oauth-protected-resource"
  expect_code "connector refuses anonymous callers" 401 "$MCP/mcp" -X POST -H 'Content-Type: application/json' -d '{}'
fi

echo
if [[ $FAILS -gt 0 ]]; then echo "VERIFY FAILED: $FAILS check(s). See FAIL lines."; exit 1; fi
echo "ALL PUBLIC CHECKS PASSED"; exit 0
