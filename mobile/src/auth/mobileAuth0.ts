import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'opesfuel.mobile.auth0.access_token';
const ID_KEY = 'opesfuel.mobile.auth0.id_token';
const REFRESH_KEY = 'opesfuel.mobile.auth0.refresh_token';
const AUTH0_DOMAIN = (process.env.EXPO_PUBLIC_AUTH0_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID || '';
const AUTH0_AUDIENCE = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE || 'https://api.opesfuel.com/v1';

// Self-hosted OpenID Connect (Keycloak). When set it takes precedence over Auth0, and OpesFuel identity (company, role, stations)
// is read from the backend instead of the token.
const OIDC_ISSUER = (process.env.EXPO_PUBLIC_OIDC_ISSUER || '').replace(/\/$/, '');
const OIDC_CLIENT_ID = process.env.EXPO_PUBLIC_OIDC_CLIENT_ID || 'opesfuel-mobile';
const isOidc = Boolean(OIDC_ISSUER);
const CLIENT_ID = isOidc ? OIDC_CLIENT_ID : AUTH0_CLIENT_ID;

export const isMobileAuth0Configured = isOidc ? true : Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);
export const usesBackendIdentityLookup = isOidc;
export const isDemoModeEnabled = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

export interface StoredTokens { accessToken: string; idToken: string | null; refreshToken: string | null }

export function getAuth0Discovery(): AuthSession.DiscoveryDocument {
  if (isOidc) {
    return {
      authorizationEndpoint: `${OIDC_ISSUER}/protocol/openid-connect/auth`,
      tokenEndpoint: `${OIDC_ISSUER}/protocol/openid-connect/token`,
      revocationEndpoint: `${OIDC_ISSUER}/protocol/openid-connect/revoke`,
      endSessionEndpoint: `${OIDC_ISSUER}/protocol/openid-connect/logout`,
    };
  }
  return {
    authorizationEndpoint: `https://${AUTH0_DOMAIN}/authorize`,
    tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
    revocationEndpoint: `https://${AUTH0_DOMAIN}/oauth/revoke`,
  };
}

export function getMobileRedirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: 'opesfuel', path: 'callback' });
}

async function persist(t: { accessToken: string; idToken?: string | null; refreshToken?: string | null }): Promise<StoredTokens> {
  await SecureStore.setItemAsync(ACCESS_KEY, t.accessToken);
  if (t.idToken) await SecureStore.setItemAsync(ID_KEY, t.idToken);
  if (t.refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, t.refreshToken);
  return { accessToken: t.accessToken, idToken: t.idToken ?? (await SecureStore.getItemAsync(ID_KEY)), refreshToken: t.refreshToken ?? (await SecureStore.getItemAsync(REFRESH_KEY)) };
}

export async function loginWithMobileAuth0(): Promise<StoredTokens> {
  if (!isMobileAuth0Configured) {
    throw new Error('Set EXPO_PUBLIC_OIDC_ISSUER (Keycloak) or EXPO_PUBLIC_AUTH0_DOMAIN and EXPO_PUBLIC_AUTH0_CLIENT_ID to enable sign-in.');
  }
  const discovery = getAuth0Discovery();
  const redirectUri = getMobileRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId: CLIENT_ID,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    extraParams: isOidc ? {} : { audience: AUTH0_AUDIENCE },
  });
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success' || !result.params.code) {
    throw new Error('Auth0 mobile sign-in was cancelled or failed.');
  }
  const tokenRes = await AuthSession.exchangeCodeAsync(
    {
      clientId: CLIENT_ID,
      code: result.params.code,
      redirectUri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    discovery
  );
  if (!tokenRes.accessToken) throw new Error('Auth0 token exchange returned no access token.');
  return persist({ accessToken: tokenRes.accessToken, idToken: tokenRes.idToken, refreshToken: tokenRes.refreshToken });
}

export async function getStoredTokens(): Promise<StoredTokens | null> {
  try {
    const accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
    if (!accessToken) return null;
    return { accessToken, idToken: await SecureStore.getItemAsync(ID_KEY), refreshToken: await SecureStore.getItemAsync(REFRESH_KEY) };
  } catch {
    return null;
  }
}

/** Silent renewal so staff are not thrown out mid-shift. Returns null when renewal is impossible. */
export async function refreshStoredTokens(refreshToken: string | null): Promise<StoredTokens | null> {
  if (!refreshToken || !isMobileAuth0Configured) return null;
  try {
    const res = await AuthSession.refreshAsync({ clientId: CLIENT_ID, refreshToken }, getAuth0Discovery());
    if (!res.accessToken) return null;
    return await persist({ accessToken: res.accessToken, idToken: res.idToken, refreshToken: res.refreshToken ?? refreshToken });
  } catch {
    return null;
  }
}

export async function clearMobileTokens(): Promise<void> {
  for (const k of [ACCESS_KEY, ID_KEY, REFRESH_KEY]) {
    try { await SecureStore.deleteItemAsync(k); } catch { /* ignore */ }
  }
}
