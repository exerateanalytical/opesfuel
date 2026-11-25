# Hand-off: deploy OpesFuel to opesfuel.com

You are the session that will deploy. The code is finished, merged to `main` and tested. Everything below is scripted;
your job is to gather the secrets from the owner, run the scripts in order, stop on any FAIL, and report honestly.

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
deploy/deploy.sh --with-mcp             # also the Claude/ChatGPT connector (see mcp/README.md for its Auth0 steps)
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
- Real Auth0/Keycloak sign-in and the mobile app on a real phone have not been tested by the developer.
- Some enterprise modules do not yet load their existing lists from the server (listed in `DEPLOY_OPESFUEL_COM.md`, Known limits).
- Email sending needs a provider configured and SPF/DKIM DNS records.
- Keycloak is the identity provider for this deploy (Auth0 remains supported by the code but is no longer used). Real Keycloak sign-in has not been tested by the developer: expect to iterate on the Keycloak hostname/SMTP items above.

## 8. Report back
Give the owner: the deployed commit, the `verify-public` summary, the results of the 8 manual checks, and the open items above.
