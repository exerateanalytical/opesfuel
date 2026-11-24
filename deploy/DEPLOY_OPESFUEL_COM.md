# Deploying OpesFuel to opesfuel.com

Everything here is specific to the production domain. General background and rollback: `docs/DEPLOYMENT.md`.
Deploy from `main` (merged and tested; no open pull requests).

## 1. DNS (all records point to the server's IP)
| Name | Purpose |
|---|---|
| `opesfuel.com` | Website and console |
| `api.opesfuel.com` | Backend API |
| `demo.opesfuel.com` | Public demo (browser-only sample data) |
| `mcp.opesfuel.com` | Claude / ChatGPT connector (optional) |

Open ports 80 and 443. Caddy obtains the HTTPS certificates itself once DNS resolves.
Optional: add `www.opesfuel.com` DNS; no redirect is configured for it yet.

## 2. Environment file
```bash
cp deploy/opesfuel.com.env.example .env      # then replace every CHANGE_ME
openssl rand -hex 32                          # use for OPESFUEL_AUTH0_ACTION_SECRET
```
Required before first start: `SPRING_DATASOURCE_PASSWORD`, `OPESFUEL_ENCRYPTION_KEY`, `AUTH0_*`, `VITE_AUTH0_*`,
`OPESFUEL_AUTH0_ACTION_SECRET`, `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL`. The stack refuses to start without the first few.

## 3. Auth0 (one time)
Single Page Application settings:
- Allowed Callback URLs: `https://opesfuel.com/`
- Allowed Logout URLs: `https://opesfuel.com/`
- Allowed Web Origins: `https://opesfuel.com`

Then configure the API, roles and claims Action (safe to re-run; preview first):
```bash
export AUTH0_DOMAIN=YOUR-TENANT.auth0.com AUTH0_M2M_CLIENT_ID=... AUTH0_M2M_CLIENT_SECRET=...
export OPESFUEL_API_BASE=https://api.opesfuel.com OPESFUEL_ACTION_SECRET=<same value as in .env>
python3 deploy/auth0_setup.py --dry-run
python3 deploy/auth0_setup.py
```
Without the Action every login is refused (by design: no company tag, no access).

## 4. Deploy
```bash
bash deploy/backup-postgres.sh                # skip on a brand-new server
git pull origin main                          # expect merge commit 594cb69 or later
docker compose -f docker-compose.prod.yml --profile tls --profile demo up -d --build
# add --profile mcp only after doing the Auth0 steps in mcp/README.md
```
Flyway applies migrations V1 to V26 automatically on backend start. The backend image builds with Java 25;
if that build fails, capture the error output.

## 5. Verify (about 10 minutes)
```bash
curl -fsS https://api.opesfuel.com/actuator/health
bash deploy/smoke-test.sh
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.opesfuel.com/api/v1/public/auth/identity-claims   # expect 401 or 422, never 200
```
1. `https://demo.opesfuel.com` opens and you can browse with a sample role.
2. On `https://opesfuel.com` start a free trial with an inbox you own; you should see "Your workspace is ready".
3. Click "Create password & open my workspace", verify the email, and the dashboard opens with only that company.
4. Sign in with `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL`; the SaaS admin console should list the company from step 2.
5. In the admin console set that company's trial end to yesterday: edits must return 402 while billing pages still open.
6. A login for an unknown email must be refused (403).

## 6. Email deliverability
Mail from `@opesfuel.com` needs SPF and DKIM records at your mail provider or it lands in spam. Auth0 sends its own
verification emails separately. Set `OPESFUEL_MAIL_PROVIDER` (SMTP or RESEND) and credentials to enable welcome/OTP emails.

## 7. If something fails
Collect: `docker compose -f docker-compose.prod.yml logs --tail=200 opesfuel-backend`, the failing step, and the exact error.
Rollback: `git checkout <previous-tag>` and repeat step 4 (no schema change needs reverting; V26 only disables seeded demo staff logins).

## Known limits
- GitHub Actions is blocked by an account spending limit ("Actions budget is preventing further use"). Fix under GitHub
  Settings, Billing, Budgets. Until then CI does not run.
- Tested on Java 21 locally; first Java 25 build happens on the server.
- Mobile app: needs an Auth0 Native application and employee-to-login linking; see `mobile/README.md`.
