# OpesFuel deployment runbook

## 0. What this release adds
Fail-closed tenancy, read-only public demo, trial/suspension lock, self-signup, Auth0 identity-claims endpoint,
MCP connector for Claude/ChatGPT. Database: Flyway V1..V25 (no new migration in this release).

## 1. Before you deploy (one time)
| # | Action | Where |
|---|---|---|
| 1 | Back up the database (`deploy/backup-postgres.sh`) | server |
| 2 | Copy `.env.production.example` to `.env`; replace every `CHANGE_ME` | server |
| 3 | `openssl rand -hex 32` -> `OPESFUEL_AUTH0_ACTION_SECRET` | `.env` |
| 4 | Auth0: install `deploy/auth0-post-login-action.js` as a Login (post-login) Action, add to the Login flow, set secrets `OPESFUEL_API_BASE` (https://api.yourdomain.com) and `OPESFUEL_ACTION_SECRET` (same value as step 3) | Auth0 |
| 5 | Auth0: require **email verification** for new users | Auth0 |
| 6 | Auth0: create demo user with role `OWNER`, email-verified, row in `user_accounts` for tenant `ten_opes_cm` | Auth0 + DB |
| 7 | Auth0: your own admin user has role `PLATFORM_ADMIN` | Auth0 |
| 8 | DNS: app., api. (and mcp. if used) -> server | DNS |

## 2. Deploy
```bash
git pull origin main
docker compose -f docker-compose.prod.yml --profile tls up -d --build        # add --profile mcp for the connector
```
Flyway applies migrations on backend start. First start on an empty database also loads the demo company (`ten_opes_cm`).

## 3. Verify (10 minutes)
```bash
bash deploy/smoke-test.sh
curl -fsS https://api.yourdomain.com/actuator/health
curl -s -o /dev/null -w "%{http_code}\n" https://api.yourdomain.com/api/v1/public/auth/identity-claims -X POST   # expect 401/422, never 200
```
Manual checks:
1. Sign up a test company on the website; confirm you get "workspace created".
2. Sign in with that email (verify it); confirm the dashboard opens and shows only that company.
3. Open the demo; confirm browsing works and any save is refused (DEMO_READ_ONLY).
4. In the admin console set the test company's trial end to yesterday; confirm edits return 402 and billing pages still open.
5. A login with no tenant claim must get 403 (this is the safe behaviour).

## 4. Rollback
`git checkout <previous-tag>` and redo step 2. No schema change in this release, so rollback is code-only.
Restore the database only if data was corrupted: `deploy/restore-postgres.sh`.

## 5. Known open items
- One order-dependent test (`ProductionModulesFullSuiteTests`) fails in the full run; it never ran before this release.
- Full suite was verified on Java 21 locally; CI runs Java 25.
- Email squatting on self-signup (someone registers another person's email first) needs a support release path.
- Several background paths still use `ten_opes_cm` as a fallback tenant (support tickets, alert notifications, webhook events).
