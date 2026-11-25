#!/usr/bin/env python3
"""
One-command Keycloak setup for OpesFuel (idempotent; safe to re-run).

Configures the realm (self-signup, REQUIRED email verification, brute-force protection, French/English, short-lived tokens)
and two public clients with PKCE: `opesfuel-web` (website) and `opesfuel-mobile` (staff app), each with an Audience mapper that
adds the API audience the backend requires. Nobody is created here: people sign up on the site, and the backend finds their
company and role from their verified email.

Needs a Keycloak admin account (or any user allowed to manage the realm).
  export KC_URL=https://auth.example.com            # Keycloak base URL (no /realms/..; keep a /auth prefix only on legacy Keycloak)
  export KC_ADMIN_USER=admin KC_ADMIN_PASSWORD=...
  export OPESFUEL_WEB_ORIGIN=https://opesfuel.com    # website origin
  # optional: KC_REALM=opesfuel  OPESFUEL_API_AUDIENCE=https://api.opesfuel.com/v1
  # SMTP so Keycloak can send the verification email (REQUIRED for anyone to be able to sign in):
  #   KC_SMTP_HOST KC_SMTP_PORT(587) KC_SMTP_FROM KC_SMTP_USER KC_SMTP_PASSWORD KC_SMTP_STARTTLS(true)
  python3 deploy/keycloak_setup.py --dry-run     # shows what it would change, writes nothing
  python3 deploy/keycloak_setup.py
"""
import json, os, sys, urllib.error, urllib.parse, urllib.request

DRY = '--dry-run' in sys.argv


def need(name):
    v = os.environ.get(name, '')
    if not v:
        sys.exit(f'Missing environment variable {name}')
    return v


BASE = need('KC_URL').rstrip('/')
REALM = os.environ.get('KC_REALM', 'opesfuel')
ADMIN_USER, ADMIN_PASSWORD = need('KC_ADMIN_USER'), need('KC_ADMIN_PASSWORD')
WEB_ORIGIN = need('OPESFUEL_WEB_ORIGIN').rstrip('/')
AUDIENCE = os.environ.get('OPESFUEL_API_AUDIENCE', 'https://api.opesfuel.com/v1')
SMTP_HOST = os.environ.get('KC_SMTP_HOST', '')


def call(method, path, body=None, token=None, form=None):
    url = BASE + path
    data, headers = None, {'Accept': 'application/json'}
    if form is not None:
        data, headers['Content-Type'] = urllib.parse.urlencode(form).encode(), 'application/x-www-form-urlencoded'
    elif body is not None:
        data, headers['Content-Type'] = json.dumps(body).encode(), 'application/json'
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return 404, {}
        sys.exit(f'{method} {path} -> HTTP {e.code}: {e.read().decode()[:300]}')


def step(msg):
    print(('[dry-run] ' if DRY else '') + msg)


_, tok = call('POST', '/realms/master/protocol/openid-connect/token',
              form={'grant_type': 'password', 'client_id': 'admin-cli', 'username': ADMIN_USER, 'password': ADMIN_PASSWORD})
T = tok['access_token']

REALM_SETTINGS = {
    'enabled': True,
    'registrationAllowed': True,            # self-service signup on the site
    'registrationEmailAsUsername': True,
    'loginWithEmailAllowed': True,
    'duplicateEmailsAllowed': False,        # one login per email (the backend maps email -> company)
    'verifyEmail': True,                    # never let an unverified email in (it would be an account-takeover path)
    'resetPasswordAllowed': True,
    'rememberMe': True,
    'bruteForceProtected': True,
    'failureFactor': 10,
    'sslRequired': 'external',
    'accessTokenLifespan': 900,             # 15 minutes
    'ssoSessionIdleTimeout': 2592000,       # 30 days (staff stay signed in on their phones)
    'offlineSessionIdleTimeout': 2592000,
    'revokeRefreshToken': True,             # refresh-token rotation
    'refreshTokenMaxReuse': 0,
    'internationalizationEnabled': True,
    'supportedLocales': ['fr', 'en'],
    'defaultLocale': 'fr',
}
if SMTP_HOST:
    REALM_SETTINGS['smtpServer'] = {
        'host': SMTP_HOST, 'port': os.environ.get('KC_SMTP_PORT', '587'), 'from': need('KC_SMTP_FROM'),
        'fromDisplayName': 'OpesFuel', 'auth': 'true' if os.environ.get('KC_SMTP_USER') else 'false',
        'user': os.environ.get('KC_SMTP_USER', ''), 'password': os.environ.get('KC_SMTP_PASSWORD', ''),
        'starttls': os.environ.get('KC_SMTP_STARTTLS', 'true'), 'ssl': 'false',
    }

# 1. Realm
code, current = call('GET', f'/admin/realms/{REALM}', token=T)
if code == 404:
    step(f'create realm {REALM}')
    if not DRY:
        call('POST', '/admin/realms', {'realm': REALM, 'displayName': 'OpesFuel', **REALM_SETTINGS}, T)
else:
    changed = {k: v for k, v in REALM_SETTINGS.items() if current.get(k) != v and k != 'smtpServer'}
    smtp_changed = SMTP_HOST and any(current.get('smtpServer', {}).get(k) != v for k, v in REALM_SETTINGS.get('smtpServer', {}).items() if k != 'password')
    if changed or smtp_changed:
        step(f'update realm {REALM}: ' + ', '.join(sorted(list(changed) + (['smtpServer'] if smtp_changed else []))))
        if not DRY:
            call('PUT', f'/admin/realms/{REALM}', {**current, **REALM_SETTINGS}, T)
    else:
        step(f'realm {REALM} already configured')

# 2. Clients
AUD_MAPPER = {
    'name': 'opesfuel-api-audience', 'protocol': 'openid-connect', 'protocolMapper': 'oidc-audience-mapper',
    'config': {'included.custom.audience': AUDIENCE, 'access.token.claim': 'true', 'id.token.claim': 'false'},
}


def ensure_client(client_id, name, redirects, origins, post_logout):
    rep = {
        'clientId': client_id, 'name': name, 'enabled': True, 'protocol': 'openid-connect', 'publicClient': True,
        'standardFlowEnabled': True, 'implicitFlowEnabled': False, 'directAccessGrantsEnabled': False, 'serviceAccountsEnabled': False,
        'fullScopeAllowed': False, 'redirectUris': redirects, 'webOrigins': origins,
        'attributes': {'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': post_logout},
    }
    _, found = call('GET', f'/admin/realms/{REALM}/clients?clientId=' + urllib.parse.quote(client_id), token=T)
    cid = found[0]['id'] if found else None
    if cid is None:
        step(f'create client {client_id}')
        if not DRY:
            call('POST', f'/admin/realms/{REALM}/clients', rep, T)
            _, found = call('GET', f'/admin/realms/{REALM}/clients?clientId=' + urllib.parse.quote(client_id), token=T)
            cid = found[0]['id']
    else:
        existing = found[0]
        drift = [k for k in ('publicClient', 'standardFlowEnabled', 'implicitFlowEnabled', 'directAccessGrantsEnabled', 'redirectUris', 'webOrigins') if existing.get(k) != rep[k]]
        drift += [k for k, v in rep['attributes'].items() if existing.get('attributes', {}).get(k) != v]
        if drift:
            step(f'update client {client_id}: ' + ', '.join(drift))
            if not DRY:
                call('PUT', f'/admin/realms/{REALM}/clients/{cid}', {**existing, **rep, 'attributes': {**existing.get('attributes', {}), **rep['attributes']}}, T)
        else:
            step(f'client {client_id} already configured')
    if cid:
        _, mappers = call('GET', f'/admin/realms/{REALM}/clients/{cid}/protocol-mappers/models', token=T)
        have = next((m for m in mappers if m.get('name') == AUD_MAPPER['name']), None)
        if not have:
            step(f'add audience mapper ({AUDIENCE}) to {client_id}')
            if not DRY:
                call('POST', f'/admin/realms/{REALM}/clients/{cid}/protocol-mappers/models', AUD_MAPPER, T)
        elif have.get('config', {}).get('included.custom.audience') != AUDIENCE:
            step(f'fix audience mapper on {client_id}')
            if not DRY:
                call('PUT', f'/admin/realms/{REALM}/clients/{cid}/protocol-mappers/models/{have["id"]}', {**have, 'config': AUD_MAPPER['config']}, T)


ensure_client('opesfuel-web', 'OpesFuel website', [f'{WEB_ORIGIN}/*'], [WEB_ORIGIN], f'{WEB_ORIGIN}/*')
ensure_client('opesfuel-mobile', 'OpesFuel staff app', ['opesfuel://callback', 'opesfuel://*'], [], 'opesfuel://*')

issuer = f'{BASE}/realms/{REALM}'
print(f'\nDone. Use this issuer in .env (OIDC_ISSUER_URI and VITE_OIDC_ISSUER): {issuer}')
if not SMTP_HOST:
    print('\n!! No SMTP settings given. Keycloak cannot send the verification email, so NOBODY will be able to finish signing in.')
    print('   Re-run with KC_SMTP_HOST / KC_SMTP_FROM (and user/password), or set Realm settings > Email in the Keycloak console.')
print('\nAlso check in Keycloak (not changeable through this API call): the "hostname" setting must make Keycloak report exactly the issuer above,')
print('and it must be reachable over HTTPS from the OpesFuel server. deploy/preflight.sh verifies both.')
