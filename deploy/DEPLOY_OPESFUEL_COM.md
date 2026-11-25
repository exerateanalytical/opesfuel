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
openssl rand -hex 32                          # use for OPESFUEL_ENCRYPTION_KEY
```
Required before first start: `SPRING_DATASOURCE_PASSWORD`, `OPESFUEL_ENCRYPTION_KEY`, `OIDC_ISSUER_URI`, `VITE_OIDC_ISSUER`,
`VITE_OIDC_CLIENT_ID`, `OIDC_AUDIENCE`, `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL`. The stack refuses to start without the first few.

## 3. Identity provider: Keycloak (one time)
OpesFuel signs people in with **Keycloak**. The backend finds each person's company and role from their verified email, so no
Auth0 Action or action secret is involved. Configure the realm and the two clients in one idempotent command (preview with `--dry-run`):
```bash
export KC_URL=https://<keycloak-host> KC_ADMIN_USER=<admin> KC_ADMIN_PASSWORD=...
export OPESFUEL_WEB_ORIGIN=https://opesfuel.com
export KC_SMTP_HOST=<smtp host> KC_SMTP_FROM=noreply@opesfuel.com KC_SMTP_USER=... KC_SMTP_PASSWORD=...   # verification emails: REQUIRED
python3 deploy/keycloak_setup.py --dry-run && python3 deploy/keycloak_setup.py
```
Then put the printed issuer (`https://<keycloak-host>/realms/opesfuel`, no trailing slash) in `.env` as `OIDC_ISSUER_URI` and `VITE_OIDC_ISSUER`.
Keycloak's own **hostname** setting must make it report exactly that issuer; `deploy/preflight.sh` checks this from the server.
Without a working verification email nobody can finish signing in (by design: unverified emails are never trusted).

## 4. Deploy
Scripted (recommended). Details and failure table: `deploy/DESKTOP_SESSION_HANDOFF.md`.
```bash
deploy/preflight.sh                 # read-only checks; must end with "READY to deploy."
deploy/deploy.sh --skip-backup      # first deploy on an empty server (add --with-mcp for the connector)
deploy/deploy.sh                    # later deploys: backs up, pulls main, builds, starts, waits healthy, verifies public URLs
deploy/rollback.sh                  # return to the previous release (code only)
```
Manual equivalent: `git pull origin main` then
`docker compose -f docker-compose.prod.yml --profile tls --profile demo up -d --build`.
Flyway applies migrations V1 to V26 automatically on backend start. The backend image builds with Java 25.

## 5. Verify
`deploy/deploy.sh` already runs `deploy/verify-public.sh` (health, access refused without login, signup route, made-up tokens refused, Keycloak realm reachable,
CORS, TLS certificate, sitemap/llms/robots, demo). To rerun it alone:
`deploy/verify-public.sh https://opesfuel.com https://api.opesfuel.com https://demo.opesfuel.com`.
Then do these manual checks (they need a browser and real inboxes):
1. `https://demo.opesfuel.com` opens and you can browse with a sample role.
2. On `https://opesfuel.com` start a free trial with an inbox you own; you should see "Your workspace is ready".
3. Click "Create password & open my workspace", create the Keycloak account and verify the email (it must arrive), and the dashboard opens with only that company.
4. Sign in with `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL`; the SaaS admin console should list the company from step 2.
5. In the admin console set that company's trial end to yesterday: edits must return 402 while billing pages still open.
6. A login for an unknown email must be refused (403).
7. Staff: as the test owner, invite an attendant (Invite staff) with a second inbox you own. Sign up in Keycloak with that exact email,
   verify it; the person must land in the same company as an attendant. (Managers can invite attendants only.)
8. As that test company, the console top bar should show the free-trial countdown only in the last 7 days, and "read-only" after
   expiry. Billing pages must stay reachable when read-only.

## 5a. Search and AI discoverability (after DNS is live)
- Open `https://opesfuel.com/sitemap.xml`, `/llms.txt` and `/robots.txt`; each must load. The sitemap lists clean page paths (e.g. `/pricing`).
- Submit the sitemap in Google Search Console and Bing Webmaster Tools.
- `demo.opesfuel.com` marks itself `noindex` so it is not indexed as a duplicate of the main site.
- Prices in `public/llms.txt` and `public/sitemap.xml` dates are edited by hand: update them when plans change.

## 5b. Adding staff after launch
Owners invite staff from the console (Invite staff). Managers can invite attendants only; owners can invite any role.
The invitation creates the login record; the person signs up in Keycloak with **that exact email**, verifies it, and is placed in the
right company, role and station automatically. One email can belong to one company only.

## 6. Email deliverability
Mail from `@opesfuel.com` needs SPF and DKIM records at your mail provider or it lands in spam. Keycloak sends its
verification emails through the SMTP settings you give it. Set `OPESFUEL_MAIL_PROVIDER` (SMTP or RESEND) and credentials to enable welcome/OTP emails.

## 7. If something fails
Collect: `docker compose -f docker-compose.prod.yml logs --tail=200 opesfuel-backend`, the failing step, and the exact error.
Rollback: `git checkout <previous-tag>` and repeat step 4 (no schema change needs reverting; V26 only disables seeded demo staff logins).

## Known limits
- **Connected to live data (load from and save to the server):** IAM and Billing-pro, Shop (FEFO batches, stock adjustments, cart checkout),
  Loyalty (members, campaigns), Maintenance/CMMS (work orders, generator logs, spare parts), LPG cylinder exchange, Hardware bridge.
- **Also connected now:** HR admin, cash vault, pump calibrations and maintenance, HSE / fraud / quality, transfers, service bay, vouchers,
  bulk orders, fixed assets, budgets, approvals, EV, franchises (all lists load from the server after sign-in and reload after every save;
  a failed save shows an error instead of looking saved). Also new screens: PM schedules and cost per asset (Maintenance), loyalty earning
  rules, subscription payments, Mobile Money list/refund/provider status, payment reminders, plan-change calculator, country rules.
- **Real customers never see built-in sample records anywhere.**
- Access-review "REVOKED" records a flag in the audit trail; it does not disable the account automatically.
- GitHub Actions is blocked by an account spending limit ("Actions budget is preventing further use"). Fix under GitHub
  Settings, Billing, Budgets. Until then CI does not run.
- Tested on Java 21 locally; first Java 25 build happens on the server.
- Mobile app: needs the Keycloak mobile client (created by the realm setup script) and employee-to-login linking; see `mobile/README.md`.
