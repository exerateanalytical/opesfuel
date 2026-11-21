import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'opesfuel.mobile.auth0.access_token';
const AUTH0_DOMAIN = (process.env.EXPO_PUBLIC_AUTH0_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID || '';
const AUTH0_AUDIENCE = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE || 'https://api.opesfuel.com/v1';

export const isMobileAuth0Configured = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

export function getAuth0Discovery(): AuthSession.DiscoveryDocument {
  return {
    authorizationEndpoint: `https://${AUTH0_DOMAIN}/authorize`,
    tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
    revocationEndpoint: `https://${AUTH0_DOMAIN}/oauth/revoke`,
  };
}

export function getMobileRedirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: 'opesfuel', path: 'callback' });
}

export async function loginWithMobileAuth0(): Promise<string> {
  if (!isMobileAuth0Configured) {
    throw new Error('Set EXPO_PUBLIC_AUTH0_DOMAIN and EXPO_PUBLIC_AUTH0_CLIENT_ID to enable mobile Auth0 login.');
  }
  const discovery = getAuth0Discovery();
  const redirectUri = getMobileRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId: AUTH0_CLIENT_ID,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    extraParams: { audience: AUTH0_AUDIENCE },
  });

  const result = await request.promptAsync(discovery);
  if (result.type !== 'success' || !result.params.code) {
    throw new Error('Auth0 mobile sign-in was cancelled or failed.');
  }

  const tokenRes = await AuthSession.exchangeCodeAsync(
    {
      clientId: AUTH0_CLIENT_ID,
      code: result.params.code,
      redirectUri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    discovery
  );

  if (!tokenRes.accessToken) {
    throw new Error('Auth0 token exchange returned no access token.');
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokenRes.accessToken);
  return tokenRes.accessToken;
}

export async function getStoredMobileAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearMobileAccessToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    // ignore
  }
}
