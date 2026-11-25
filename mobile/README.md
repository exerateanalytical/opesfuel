# OpesFuel Mobile (Expo / React Native)

For station staff, each on their own phone or a shared station phone: **Owner, Manager, Attendant, Accountant**.
French by default (English available in More > Language). The role always comes from the signed-in account; there is
no role switch. The server re-checks every action, so the app only hides what a role should not use.

## Screens by role
| Role | Tabs |
|---|---|
| Attendant | My shift (clock in/out, open/close my shift) · Sell (fleet voucher, shop) · Sync · More |
| Manager | Home (money + alerts) · Pumps · Tanks · Sell · More |
| Owner | Home · Pumps · Tanks · Reports · More (+ fuel setup, AI assistant) |
| Accountant | Home · Reports · Fleet credit · More |

Offline: reads show the last known data; writes are saved on the phone and sent later with the same Idempotency-Key
(no double posting). A server refusal (limit exceeded, not allowed) is shown to the user and never queued.

## Setup
```bash
cd mobile && cp .env.example .env     # fill in Keycloak + API URL
npm install && npx expo start
```
Keycloak: create a public client for the app (the realm setup script `deploy/keycloak_setup.py` does it), allowed redirect `opesfuel://callback`, with the same API audience as the web app. The app asks the backend (`GET /api/v1/identity/me`) which company and role the signed-in person has. Staff are added with **Invite staff** (web console): the invitation creates their login record, and when they first sign in
with that verified email the system links them to their employee record, so `GET /api/v1/workforce/me` finds them.

## Tests
```bash
npm test        # business rules, role tabs, token handling, translations, offline queue contract
npm run typecheck
```
