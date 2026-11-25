# Hand-off: deploy OpesFuel to opesfuel.com

## LIVE NOW (updated 2026-11-25) - read this first
OpesFuel is **deployed and running** on the shared Contabo server (84.46.246.228) at commit `8ebf622` (main), next to OPES Maintain.
This server does **not** use `docker-compose.prod.yml`/Caddy/`deploy/deploy.sh`; it uses the shared layout below. Sections 2-4 describe a
fresh standalone install and are kept for reference only.

| Piece | Live setup |
|---|---|
| Website | container `opesfuel-web`, host network, port 3083 (healthy) |
| Backend | container `opesfuel-backend`, port 8083 (healthy); DB `opesfuel` in the shared PostgreSQL 16 (127.0.0.1) |
| Public demo | container `opesfuel-demo`, port 3084 |
| Proxy/TLS | Nginx + certbot, site `opesfuel.com` (`/api/ai/`, `/api/health` -> 3083; `/api/` -> 8083; `/` -> 3083, demo page as fallback) |
| Identity | shared Keycloak, realm `opesfuel`, issuer `https://auth.opesmaintain.com/realms/opesfuel`, public PKCE client `opesfuel-web` with the `https://api.opesfuel.com/v1` audience mapper |
| Settings | `/etc/spring/opesfuel.env` (chmod 600): `AUTH0_ISSUER_URI` = the Keycloak issuer (the backend reads this name), `VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID=opesfuel-web`, `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL=nshome@opesware.com` |
| Redeploy | `opesfuel-redeploy` on the server: pulls main, rebuilds demo/backend/web images, restarts containers with health checks |

Verified live: `/`, `/app/overview`, `/login` 200; `/sitemap.xml`, `/robots.txt`, `/llms.txt` served as files; clean URLs (no `#`);
backend health UP; API without a token -> 401; "Sign in" redirects to the Keycloak login page.

**Still open on the live server**
- A real sign-in has not been done yet. The owner registers at opesfuel.com with the admin email; until SMTP exists the operator marks the
  email verified in Keycloak (Users > the user > Email verified).
- Keycloak SMTP is not configured, so verification and password-reset emails are not sent (needs Brevo/Zoho details).
- The `opesfuel-mobile` client has not been created in the realm yet (only `opesfuel-web`).
- Manual checks 1-12 in section 5 have not been run against the live server.

---


You are the session that will deploy. The code is finished, merged to `main` and tested. Everything below is scripted;
your job is to gather the secrets from the owner, run the scripts in order, stop on any FAIL, and report honestly.

**Status as of `main` @ PR #14 (`4142d21`) - everything is merged; nothing is pending on the developer side.** Since the last hand-off:
Keycloak replaced Auth0 everywhere (web, mobile app, Claude/ChatGPT connector, deploy scripts), and every enterprise screen now loads
from the server (HR, vault, calibrations, HSE/fraud/quality, assets, budgets, approvals, EV, franchises, transfers, vouchers, bulk orders)
plus new screens (PM schedules, cost per asset, loyalty earning rules, payments/Mobile Money/reminders/plan calculator/country rules).
No database change since V26. Run `git pull` and confirm `git log -1` shows `4142d21` or later before deploying.

## 0. Ground rules
- Deploy from `main` only. Never force-push, never commit `.env`, never print secret values back in chat.
- If a script prints FAIL, stop and fix the cause. Do not edit scripts to make a check pass.
- Run `deploy/keycloak_setup.py` first with `--dry-run`, show the owner the plan, and apply only after they agree.
- Do not claim the deploy succeeded until `deploy/deploy.sh` prints `DEPLOYED ...` AND the manual checks in section 5 are done.

## 1. What to ask the owner for (once)
Identity provider is **Keycloak** (self-hosted). The backend finds a person's company and role from their verified email, so there is no
Auth0 Action and no action secret.
| Value | Where it goes | Source |
|---|---|---|
| Server SSH access, with docker + docker compose installed, ports 80/443 open | where you run the scripts | owner / hosting panel |
| DNS: `opesfuel.com`, `api.`, `demo.` (and `mcp.` if used) pointing to the server IP | DNS provider | owner |
| Keycloak base URL (e.g. `https://auth.example.com`) and the realm name (default `opesfuel`) | `OIDC_ISSUER_URI`, `VITE_OIDC_ISSUER` = `<base>/realms/<realm>` (no trailing slash) | owner |
| A Keycloak admin login able to manage that realm | shell variables for `keycloak_setup.py` only; never in `.env` | owner |
| SMTP details so Keycloak can send the verification email (host, port, from, user, password) | `keycloak_setup.py` (or Keycloak console: Realm settings > Email) | owner; **without it nobody can finish signing in** |
| Admin email the owner will sign in with | `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL` | owner |
| Strong database password | `SPRING_DATASOURCE_PASSWORD` | generate: `openssl rand -base64 24` |
| Encryption key (32+ chars) | `OPESFUEL_ENCRYPTION_KEY` | generate: `openssl rand -hex 32` |
| Optional now: Resend/SMTP for OpesFuel's own emails, MTN MoMo, Orange Money credentials | `.env` | owner (see `docs/PAYMENTS_MESSAGING.md`); the site runs without them |

## 2. Prepare (on the server)
```bash
git clone https://github.com/exerateanalytical/opesfuel.git && cd opesfuel
cp deploy/opesfuel.com.env.example .env && chmod 600 .env      # edit: replace every CHANGE_ME
deploy/preflight.sh                                            # must end with "READY to deploy."
```
Preflight checks tools, the env file (placeholders, key lengths, domain consistency, unsafe flags), DNS pointing at this
server, free ports, disk and memory, and that compose validates. Fix every FAIL; read every WARN.

## 3. Keycloak realm and clients (once)
```bash
export KC_URL=https://<keycloak-host> KC_ADMIN_USER=<admin> KC_ADMIN_PASSWORD=...
export OPESFUEL_WEB_ORIGIN=https://opesfuel.com
export KC_SMTP_HOST=<smtp host> KC_SMTP_FROM=noreply@opesfuel.com KC_SMTP_USER=... KC_SMTP_PASSWORD=...
python3 deploy/keycloak_setup.py --dry-run     # show the owner what will change, then run again without --dry-run
```
It configures the realm (self-signup, required email verification, one login per email, brute-force protection, French/English,
15-minute tokens, refresh rotation) and two public PKCE clients: `opesfuel-web` (the website) and `opesfuel-mobile` (the staff app),
each with an Audience mapper adding `https://api.opesfuel.com/v1`, which the backend requires. It is safe to re-run.
Not something an API call can set, so check it in Keycloak: its **hostname** must make Keycloak report exactly the issuer you put in `.env`
(behind a proxy this means the hostname/proxy-headers settings). `deploy/preflight.sh` tests this from the server: it fetches
`<issuer>/.well-known/openid-configuration` and compares the reported issuer character for character.

## 4. Deploy
```bash
deploy/deploy.sh --skip-backup          # first deploy on an empty server
deploy/deploy.sh                        # every later deploy (backs up the database first)
deploy/deploy.sh --with-mcp             # also the Claude/ChatGPT connector (see mcp/README.md for its Keycloak steps)
```
It runs preflight, backs up, pulls `main`, builds (the first build takes several minutes and compiles Java 25 inside Docker),
starts everything, waits for health (Flyway applies migrations V1 to V26 on first start), then runs
`deploy/verify-public.sh` against the real URLs (health, anonymous access refused, signup route alive, login-claims secret
made-up tokens refused, the Keycloak realm reachable, CORS, TLS certificate, sitemap/llms/robots, demo). Success prints `DEPLOYED <commit> to https://opesfuel.com`.

## 5. Manual checks (cannot be scripted; about 10 minutes, with the owner)
1. Open `https://demo.opesfuel.com`: sign in with a sample role and browse.
2. On `https://opesfuel.com/contact` start a free trial with an inbox the owner controls: "Your workspace is ready".
3. Click "Create password & open my workspace", create the Keycloak account and verify the email (it must arrive): the dashboard opens with only that company.
4. Sign in as `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL`: the SaaS admin console lists the test company.
5. In the admin console set the test company's trial end to yesterday: edits fail with the read-only message; billing opens.
6. As the test company owner invite a second inbox as an attendant; sign up with it: it lands in the same company as an attendant.
7. A login with an email that has no workspace must be refused.
8. Open a report (Z-report) and confirm the PDF preview opens with Download and Print.
9. As the test company owner, add one record in each of: HR (a contract), Cash vault, HSE, Fixed assets, Approvals. Refresh the page: each record
   must still be there (this proves save and load against the real server). A save that fails must show "Not saved: <reason>".
10. Maintenance: add a PM schedule, press "Open due work orders now", then check Cost per Asset. Loyalty: save an earning rule.
11. Billing tools (owner): Subscription payments, Mobile Money (provider status shows Connected or Not configured), Plan change calculator, Country rules all open without error.
12. Only if `--with-mcp` was used: in Claude, add the connector `https://mcp.opesfuel.com/mcp`, sign in with the admin email; a non-admin login must be refused.

## 6. If something fails
| Symptom | Likely cause | Fix |
|---|---|---|
| Preflight: `X does not resolve` / `resolves to <other ip>` | DNS not set or not propagated | add/fix the record, wait, rerun |
| Preflight: `Keycloak reports issuer ... but OIDC_ISSUER_URI is ...` | Keycloak hostname/proxy settings differ from the URL in `.env` | fix Keycloak's hostname settings (or the `.env` value) until they match exactly |
| Preflight: `OIDC_ISSUER_URI must NOT end with /` | trailing slash copied from Auth0 habits | remove it in both `OIDC_ISSUER_URI` and `VITE_OIDC_ISSUER` |
| Backend container restarts in a loop right after start | it cannot reach Keycloak's discovery URL, or the issuer differs | `docker compose ... logs opesfuel-backend`; fix network/issuer; redeploy |
| Build fails in the Java step | Java 25 image or low memory | read the error; add swap; send the error to the developer |
| Every login refused (403) after a successful Keycloak login | the person's verified email has no workspace, or the email is not verified | sign up first on the website with that email; check Keycloak email verification and SMTP |
| Login works at Keycloak but API calls return 401 | access token lacks the API audience | run `keycloak_setup.py` again (Audience mapper), then sign out and in |
| Nobody receives the verification email | Keycloak SMTP not configured | Realm settings > Email, or re-run `keycloak_setup.py` with the `KC_SMTP_*` variables |
| Admin cannot see the console | `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL` differs from the email used at Keycloak | fix `.env`, redeploy, sign in again |
| Browser shows CORS errors | `OPESFUEL_CORS_ALLOWED_ORIGINS` missing the site origin; or Keycloak web origin missing | fix `.env` / client Web origins, redeploy |
| HTTPS certificate not issued | DNS wrong or ports 80/443 blocked | `docker compose -f docker-compose.prod.yml logs caddy` |
| Anything else | | `docker compose -f docker-compose.prod.yml --env-file .env logs --tail=200 opesfuel-backend` |

Roll back code: `deploy/rollback.sh` (database is not restored; for data problems use `deploy/restore-postgres.sh`).

## 7. Known open items (tell the owner; do not hide them)
- GitHub Actions CI is blocked by an account spending limit ("Actions budget is preventing further use"), so nothing runs automatically.
- The backend was tested on Java 21 locally; the first Java 25 build happens in your deploy.
- The mobile app on a real phone has not been tested by the developer.
- Enterprise screens and the new billing/maintenance screens were verified only against a mock API in a browser, never against the real backend: checks 9-11 are the first real test. Report any module that errors.
- The Claude/ChatGPT connector's dynamic client registration with Keycloak is the likeliest thing to need adjusting (see `mcp/README.md`).
- Access-review "REVOKED" records a flag in the audit trail; it does not disable the account.
- Email sending needs a provider configured and SPF/DKIM DNS records.
- Keycloak is the identity provider for this deploy (Auth0 remains supported by the code but is no longer used). Real Keycloak sign-in has not been tested by the developer: expect to iterate on the Keycloak hostname/SMTP items above.

## 8. Report back
Give the owner: the deployed commit, the `verify-public` summary, the results of the 12 manual checks, and the open items above.
