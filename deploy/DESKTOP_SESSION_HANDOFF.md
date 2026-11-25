# Hand-off: deploy OpesFuel to opesfuel.com

You are the session that will deploy. The code is finished, merged to `main` and tested. Everything below is scripted;
your job is to gather the secrets from the owner, run the scripts in order, stop on any FAIL, and report honestly.

## 0. Ground rules
- Deploy from `main` only. Never force-push, never commit `.env`, never print secret values back in chat.
- Run `deploy/auth0_setup.py` first with `--dry-run`, show the owner the plan, and apply only after they agree.
- If a script prints FAIL, stop and fix the cause. Do not edit scripts to make a check pass.
- Do not claim the deploy succeeded until `deploy/deploy.sh` prints `DEPLOYED ...` AND the manual checks in section 5 are done.

## 1. What to ask the owner for (once)
| Value | Where it goes | Source |
|---|---|---|
| Server SSH access, with docker + docker compose installed, ports 80/443 open | where you run the scripts | owner / hosting panel |
| DNS: `opesfuel.com`, `api.`, `demo.` (and `mcp.` if used) pointing to the server IP | DNS provider | owner |
| Auth0 tenant domain, SPA client id, a Machine-to-Machine app (client id + secret) with Management API scopes (listed at the top of `deploy/auth0_setup.py`) | `.env` and the shell for `auth0_setup.py` | Auth0 dashboard |
| Admin email the owner will sign in with | `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL` | owner |
| Strong database password | `SPRING_DATASOURCE_PASSWORD` | generate: `openssl rand -base64 24` |
| Encryption key (32+ chars) and Action secret (64 hex) | `OPESFUEL_ENCRYPTION_KEY`, `OPESFUEL_AUTH0_ACTION_SECRET` | generate: `openssl rand -hex 32` |
| Optional now: SMTP/Resend, MTN MoMo, Orange Money credentials | `.env` | owner (see `docs/PAYMENTS_MESSAGING.md`); the site runs without them |

## 2. Prepare (on the server)
```bash
git clone https://github.com/exerateanalytical/opesfuel.git && cd opesfuel
cp deploy/opesfuel.com.env.example .env && chmod 600 .env      # edit: replace every CHANGE_ME
deploy/preflight.sh                                            # must end with "READY to deploy."
```
Preflight checks tools, the env file (placeholders, key lengths, domain consistency, unsafe flags), DNS pointing at this
server, free ports, disk and memory, and that compose validates. Fix every FAIL; read every WARN.

## 3. Auth0 (once)
```bash
export AUTH0_DOMAIN=<tenant>.auth0.com AUTH0_M2M_CLIENT_ID=... AUTH0_M2M_CLIENT_SECRET=...
export OPESFUEL_API_BASE=https://api.opesfuel.com OPESFUEL_ACTION_SECRET=<same value as in .env>
python3 deploy/auth0_setup.py --dry-run     # show the owner, then run again without --dry-run
```
In the Auth0 SPA settings add: Allowed Callback URLs `https://opesfuel.com/`, Allowed Logout URLs `https://opesfuel.com/`,
Allowed Web Origins `https://opesfuel.com`. (Not automatable safely; ask the owner or do it in the dashboard.)

## 4. Deploy
```bash
deploy/deploy.sh --skip-backup          # first deploy on an empty server
deploy/deploy.sh                        # every later deploy (backs up the database first)
deploy/deploy.sh --with-mcp             # also the Claude/ChatGPT connector (see mcp/README.md for its Auth0 steps)
```
It runs preflight, backs up, pulls `main`, builds (the first build takes several minutes and compiles Java 25 inside Docker),
starts everything, waits for health (Flyway applies migrations V1 to V26 on first start), then runs
`deploy/verify-public.sh` against the real URLs (health, anonymous access refused, signup route alive, login-claims secret
configured, CORS, TLS certificate, sitemap/llms/robots, demo). Success prints `DEPLOYED <commit> to https://opesfuel.com`.

## 5. Manual checks (cannot be scripted; about 10 minutes, with the owner)
1. Open `https://demo.opesfuel.com`: sign in with a sample role and browse.
2. On `https://opesfuel.com/contact` start a free trial with an inbox the owner controls: "Your workspace is ready".
3. Click "Create password & open my workspace", verify the email in Auth0: the dashboard opens with only that company.
4. Sign in as `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL`: the SaaS admin console lists the test company.
5. In the admin console set the test company's trial end to yesterday: edits fail with the read-only message; billing opens.
6. As the test company owner invite a second inbox as an attendant; sign up with it: it lands in the same company as an attendant.
7. A login with an email that has no workspace must be refused.
8. Open a report (Z-report) and confirm the PDF preview opens with Download and Print.

## 6. If something fails
| Symptom | Likely cause | Fix |
|---|---|---|
| Preflight: `X does not resolve` / `resolves to <other ip>` | DNS not set or not propagated | add/fix the record, wait, rerun |
| Build fails in the Java step | Java 25 image or low memory | read the error; add swap; paste the error to the owner/developer |
| `verify-public` login-claims HTTP 503 | `OPESFUEL_AUTH0_ACTION_SECRET` missing on backend | set it in `.env`, `deploy/deploy.sh` again |
| Every login refused (403) | Auth0 Action not installed/bound, or email not verified | run `auth0_setup.py`; check Auth0 Actions > Flows > Login |
| Admin cannot see the console | `OPESFUEL_BOOTSTRAP_ADMIN_EMAIL` differs from the Auth0 email | fix `.env`, redeploy, sign in again |
| Browser shows CORS errors | `OPESFUEL_CORS_ALLOWED_ORIGINS` missing the site origin | fix `.env`, redeploy |
| HTTPS certificate not issued | DNS wrong or ports 80/443 blocked | `docker compose -f docker-compose.prod.yml logs caddy` |
| Anything else | | `docker compose -f docker-compose.prod.yml --env-file .env logs --tail=200 opesfuel-backend` |

Roll back code: `deploy/rollback.sh` (database is not restored; for data problems use `deploy/restore-postgres.sh`).

## 7. Known open items (tell the owner; do not hide them)
- GitHub Actions CI is blocked by an account spending limit ("Actions budget is preventing further use"), so nothing runs automatically.
- The backend was tested on Java 21 locally; the first Java 25 build happens in your deploy.
- Real Auth0/Keycloak sign-in and the mobile app on a real phone have not been tested by the developer.
- Some enterprise modules do not yet load their existing lists from the server (listed in `DEPLOY_OPESFUEL_COM.md`, Known limits).
- Email sending needs a provider configured and SPF/DKIM DNS records.
- Auth0 is the supported identity provider for this deploy. The code also contains self-hosted Keycloak support (`VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID`), but `docker-compose.prod.yml` and the env template do not pass those yet; do not choose Keycloak without wiring them first.

## 8. Report back
Give the owner: the deployed commit, the `verify-public` summary, the results of the 8 manual checks, and the open items above.
