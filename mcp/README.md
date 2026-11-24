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
AUTH0_ISSUER_URI=https://YOUR-TENANT.auth0.com/
MCP_PUBLIC_URL=https://mcp.opesfuel.com
MCP_ENABLE_WRITES=false        # set true once you are comfortable
docker compose -f docker-compose.prod.yml --profile mcp --profile tls up -d --build
```
Point DNS `mcp.opesfuel.com` at the server (Caddy issues the certificate).

## Auth0 setup (one time)
1. Use the **same API audience** as the backend (`https://api.opesfuel.com/v1`), so the token passes straight through.
2. Tenant Settings > Advanced: enable **Resource Parameter Compatibility Profile** and **Dynamic Client Registration**
   (Claude and ChatGPT register themselves).
3. Promote your connection to a domain-level connection (required for dynamically registered clients).
4. Your platform-admin user must carry role `PLATFORM_ADMIN` in `https://opesfuel.com/roles`.

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
