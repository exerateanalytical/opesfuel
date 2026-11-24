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
cd mobile && cp .env.example .env     # fill in Auth0 + API URL
npm install && npx expo start
```
Auth0: create a **Native** application, allowed callback `opesfuel://callback`, enable Refresh Token Rotation, and use the
same API audience and claims Action as the web app (`deploy/auth0_setup.py`). Staff need an employee record linked to their
login (`employees.auth0_sub`) so the backend `GET /api/v1/workforce/me` can find them.

## Tests
```bash
npm test        # business rules, role tabs, token handling, translations, offline queue contract
npm run typecheck
```
