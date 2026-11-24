#!/usr/bin/env python3
"""
One-command Auth0 setup for OpesFuel (idempotent; safe to re-run).

Creates/updates: the API (audience), the 6 platform roles, the post-login Action that stamps tenant_id/roles/station_ids
into tokens, and binds that Action to the Login flow.

Needs an Auth0 Machine-to-Machine app authorised for the Management API with scopes:
  read:actions create:actions update:actions read:roles create:roles read:resource_servers create:resource_servers
  update:resource_servers  (Auth0 Dashboard > Applications > APIs > Auth0 Management API > Machine to Machine)

Usage:
  export AUTH0_DOMAIN=your-tenant.auth0.com AUTH0_M2M_CLIENT_ID=... AUTH0_M2M_CLIENT_SECRET=...
  export OPESFUEL_API_BASE=https://api.yourdomain.com OPESFUEL_ACTION_SECRET=<same as OPESFUEL_AUTH0_ACTION_SECRET>
  python3 deploy/auth0_setup.py --dry-run     # shows what it would do, changes nothing
  python3 deploy/auth0_setup.py               # applies
"""
import json, os, sys, urllib.request, urllib.error, urllib.parse

DRY = '--dry-run' in sys.argv
ROLES = ['PLATFORM_ADMIN', 'GROUP_CFO', 'OWNER', 'MANAGER', 'ACCOUNTANT', 'ATTENDANT']
AUDIENCE = os.environ.get('AUTH0_AUDIENCE', 'https://api.opesfuel.com/v1')
ACTION_NAME = 'OpesFuel tenant claims'


def need(name):
    v = os.environ.get(name, '')
    if not v:
        sys.exit(f'Missing environment variable {name}')
    return v


DOMAIN = need('AUTH0_DOMAIN').replace('https://', '').rstrip('/')
CID, SECRET = need('AUTH0_M2M_CLIENT_ID'), need('AUTH0_M2M_CLIENT_SECRET')
API_BASE, ACTION_SECRET = need('OPESFUEL_API_BASE').rstrip('/'), need('OPESFUEL_ACTION_SECRET')


def call(method, path, body=None, token=None, form=None):
    url = f"{os.environ.get('AUTH0_SCHEME', 'https')}://{DOMAIN}{path}"
    data, headers = None, {'Accept': 'application/json'}
    if body is not None:
        data, headers['Content-Type'] = json.dumps(body).encode(), 'application/json'
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} {path} -> HTTP {e.code}: {e.read().decode()[:300]}')


def token():
    body = {'grant_type': 'client_credentials', 'client_id': CID, 'client_secret': SECRET,
            'audience': f'https://{DOMAIN}/api/v2/'}
    return call('POST', '/oauth/token', body)['access_token']


def step(msg):
    print(('[dry-run] ' if DRY else '') + msg)


t = token()
mgmt = lambda m, p, b=None: call(m, p, b, t)

# 1. API (audience)
apis = mgmt('GET', '/api/v2/resource-servers?per_page=100')
api = next((a for a in apis if a['identifier'] == AUDIENCE), None)
if api:
    step(f'API {AUDIENCE} exists')
else:
    step(f'create API {AUDIENCE}')
    if not DRY:
        mgmt('POST', '/api/v2/resource-servers', {'identifier': AUDIENCE, 'name': 'OpesFuel API', 'signing_alg': 'RS256',
                                                   'allow_offline_access': True, 'token_lifetime': 86400})

# 2. Roles
existing = {r['name'] for r in mgmt('GET', '/api/v2/roles?per_page=100')}
for role in ROLES:
    if role in existing:
        step(f'role {role} exists')
    else:
        step(f'create role {role}')
        if not DRY:
            mgmt('POST', '/api/v2/roles', {'name': role, 'description': f'OpesFuel {role}'})

# 3. Action (code from deploy/auth0-post-login-action.js)
code = open(os.path.join(os.path.dirname(__file__), 'auth0-post-login-action.js')).read()
secrets = [{'name': 'OPESFUEL_API_BASE', 'value': API_BASE}, {'name': 'OPESFUEL_ACTION_SECRET', 'value': ACTION_SECRET}]
actions = mgmt('GET', '/api/v2/actions/actions?actionName=' + urllib.parse.quote(ACTION_NAME))['actions']
action = next((a for a in actions if a['name'] == ACTION_NAME), None)
if action:
    step(f'update Action {ACTION_NAME}')
    if not DRY:
        mgmt('PATCH', f"/api/v2/actions/actions/{action['id']}", {'code': code, 'secrets': secrets})
else:
    step(f'create Action {ACTION_NAME}')
    if not DRY:
        action = mgmt('POST', '/api/v2/actions/actions', {
            'name': ACTION_NAME, 'runtime': 'node18', 'code': code, 'secrets': secrets,
            'supported_triggers': [{'id': 'post-login', 'version': 'v3'}]})
if not DRY:
    step('deploy Action')
    mgmt('POST', f"/api/v2/actions/actions/{action['id']}/deploy")
    bindings = mgmt('GET', '/api/v2/actions/triggers/post-login/bindings')['bindings']
    if any(b.get('action', {}).get('id') == action['id'] for b in bindings):
        step('Action already bound to Login flow')
    else:
        step('bind Action to Login flow')
        keep = [{'ref': {'type': 'action_id', 'value': b['action']['id']}, 'display_name': b['display_name']} for b in bindings]
        keep.append({'ref': {'type': 'action_id', 'value': action['id']}, 'display_name': ACTION_NAME})
        mgmt('PATCH', '/api/v2/actions/triggers/post-login/bindings', {'bindings': keep})

print('\nDone. Remaining manual items in Auth0 (cannot be set by API safely):')
print(' - Assign role PLATFORM_ADMIN to your own user; roles are read from the roles claim via your existing role rule.')
print(' - Applications > your SPA: add your site URL to Allowed Callback/Logout/Web Origins.')
print(' - Branding > Email: make sure the verification email is enabled (default on).')
