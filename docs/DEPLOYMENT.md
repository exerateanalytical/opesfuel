> **Identity provider update:** OpesFuel now signs in with Keycloak. Where this runbook mentions Auth0, follow `deploy/DESKTOP_SESSION_HANDOFF.md` and `deploy/keycloak_setup.py` instead.

# OpesFuel deployment runbook

## 0. What this release contains
Fail-closed tenancy, self-signup, trial/suspension lock, separate public demo site, MCP connector for Claude/ChatGPT,
Auth0 setup script, platform-admin bootstrap. Database: Flyway **V1..V26** (V26 disables seeded demo staff logins).
Verified locally: backend 83/83 tests, website lint + build, MCP 8/8 tests, compose + script validation.

## 1. One-time setup (about 20 minutes)
| # | Action | How |
|---|---|---|
| 1 | Back up the database | `deploy/backup-postgres.sh` |
| 2 | Create `.env` | copy `.env.production.example`, replace every `CHANGE_ME` |
| 3 | Generate the Action secret | `openssl rand -hex 32` -> `OPESFUEL_AUTH0_ACTION_SECRET` |
| 4 | Set **your admin login** | `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL=` the email you will sign in with (REQUIRED) |
| 5 | Configure Auth0 in one command | see below |
| 6 | Auth0 SPA app: add your site URL to Allowed Callback / Logout / Web Origins | Auth0 dashboard |
| 7 | DNS: app., api., demo. (and mcp. if used) -> server | DNS |

Auth0 script (creates the API, roles, the claims Action and binds it to the Login flow; safe to re-run):
```bash
export AUTH0_DOMAIN=your-tenant.auth0.com AUTH0_M2M_CLIENT_ID=... AUTH0_M2M_CLIENT_SECRET=...
export OPESFUEL_API_BASE=https://api.yourdomain.com OPESFUEL_ACTION_SECRET=<value from step 3>
python3 deploy/auth0_setup.py --dry-run   # preview
python3 deploy/auth0_setup.py             # apply
```
The M2M app needs the Management API scopes listed at the top of the script. The script was tested against a simulated
Auth0, not your live tenant, so run `--dry-run` first.

## 2. Deploy
```bash
git pull origin main
docker compose -f docker-compose.prod.yml --profile tls --profile demo up -d --build   # add --profile mcp for the connector
```
Flyway applies V1..V26 on backend start. Watch the backend build output: the project targets Java 25 (the Docker image
builds it for you; local verification used Java 21).

## 3. Verify (10 minutes)
```bash
bash deploy/smoke-test.sh
curl -fsS https://api.yourdomain.com/actuator/health
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.yourdomain.com/api/v1/public/auth/identity-claims   # expect 401/422, never 200
```
1. **Demo:** open https://demo.yourdomain.com, sign in with a sample role, browse. It runs on built-in sample data, no Auth0, no backend.
2. **Signup:** on the website start a trial with a real inbox you own. You should see "Your workspace is ready".
3. **First login:** click "Create password & open my workspace", sign up in Auth0, verify the email, and the dashboard opens with only that company.
4. **Admin:** sign in with `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL`; the SaaS admin console should list the company from step 2.
5. **Lock:** in the admin console set that company's trial end to yesterday; edits must return 402 while billing pages still open.
6. A login for an unknown email must be refused (403). That is the safe behaviour.

## 4. Rollback
`git checkout <previous-tag>` and repeat step 2. V26 only disables seeded demo logins (re-enable with
`UPDATE user_accounts SET status='ACTIVE' WHERE id IN (...)` if ever needed). Restore data only if corrupted: `deploy/restore-postgres.sh`.

## 5. Things to know
- **CI:** GitHub Actions is blocked by an account spending limit ("Actions budget is preventing further use").
  Fix under GitHub > Settings > Billing > Budgets; until then no automatic checks run.
- Self-signup email squatting is neutralised: re-submitting an email whose owner never signed in resumes the same
  workspace; only a verified-email login can ever open it.
- `ten_opes_cm` is your operator tenant (platform alerts and lead notifications land there). The public demo never
  touches it; the backend also keeps it read-only for non-admin roles.
- The MCP connector needs its own Auth0 settings: see `mcp/README.md`.
