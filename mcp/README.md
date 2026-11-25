# OpesFuel MCP connector

Lets the platform owner run OpesFuel from **Claude** or **ChatGPT**, like a mailbox:
"What's new?", "Show companies that joined this week", "Any new enquiries?", "Reply to ticket X".

**Platform administrators only.** Every call is made with the owner's own login token, so the backend still enforces
`PLATFORM_ADMIN` and writes its normal audit trail. The connector holds no database access and no stored passwords.

## Tools
| Tool | Type | What it does |
|---|---|---|
| `whats_new` | read | Inbox digest: new companies, new enquiries, open tickets, trials ending in 3 days |
| `platform_overview` | read | Headline numbers |
| `list_companies` / `get_company` | read | Companies, newest first; filter by joined-since, status, billing |
| `list_enquiries` | read | Demo requests / sales enquiries |
| `list_support_tickets` / `get_ticket_thread` | read | Customer support |
| `list_invoices` / `platform_health` | read | Billing and health |
| `set_company_status` | write | Suspend / reactivate a company |
| `extend_trial` | write | Add trial days |
| `update_enquiry_status` | write | Mark contacted / qualified / converted / archived |
| `reply_to_ticket` | write | Reply or add an internal note |

Write tools are **off by default** (`MCP_ENABLE_WRITES=false`) and every one needs `confirm=true`.

## Deploy
```bash
# in .env.production
AUTH0_ISSUER_URI=https://auth.opesfuel.com/realms/opesfuel   # your Keycloak realm URL, no trailing slash (the variable name is historical)
MCP_PUBLIC_URL=https://mcp.opesfuel.com
MCP_ENABLE_WRITES=false        # set true once you are comfortable
docker compose -f docker-compose.prod.yml --profile mcp --profile tls up -d --build
```
Point DNS `mcp.opesfuel.com` at the server (Caddy issues the certificate).

## Identity setup (one time, Keycloak)
1. Use the **same API audience** as the backend (`https://api.opesfuel.com/v1`), so the token passes straight through (the realm setup script already adds this audience mapper).
2. Keycloak: allow **dynamic client registration** (Clients > Client registration) so Claude and ChatGPT can register themselves, and add `https://claude.ai/*` and the ChatGPT callback as allowed redirect/trusted hosts.
3. Your platform-admin user is recognised by the backend from the verified email (`OPESFUEL_BOOTSTRAP_ADMIN_EMAIL`); the connector asks `GET /api/v1/identity/me` and only admits `PLATFORM_ADMIN`. Tokens that already carry the roles claim (Auth0) are read directly.
Not yet tested against a real Keycloak: dynamic client registration is the likeliest place to need adjustment.

## Connect
- **Claude** (claude.ai / desktop): Settings > Connectors > Add custom connector > `https://mcp.opesfuel.com/mcp`, then sign in.
- **ChatGPT**: Settings > Connectors > Advanced > enable Developer mode > Create > MCP server URL
  `https://mcp.opesfuel.com/mcp`, authentication OAuth, then sign in.

## Local dev
```bash
cd mcp && npm install
OPESFUEL_API_BASE=http://localhost:8080 MCP_DEV_TOKEN=<a real platform-admin access token> npm run dev
npm test
```
`MCP_DEV_TOKEN` is refused when `NODE_ENV=production`.

## Safety notes
- Names, emails and ticket text are typed by outsiders. Results are labelled as data and server instructions tell the
  assistant never to obey them; write tools still need your explicit confirm.
- Not push-based: assistants check when you ask. For alerts, keep the existing email/Slack notifications.
