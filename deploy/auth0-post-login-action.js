/**
 * Auth0 > Actions > Library > Build Custom > Trigger: Login / Post Login
 * Add to the Login flow. Secrets to set on the Action:
 *   OPESFUEL_API_BASE        e.g. https://api.opesfuel.com
 *   OPESFUEL_ACTION_SECRET   must equal the backend env OPESFUEL_AUTH0_ACTION_SECRET
 *
 * Stamps tenant_id / roles / station_ids into the tokens so the API knows which company a user belongs to.
 * Unknown or unverified emails get NO claims, and the API refuses such tokens (fail closed).
 */
exports.onExecutePostLogin = async (event, api) => {
  const ns = 'https://opesfuel.com/';
  try {
    const res = await fetch(`${event.secrets.OPESFUEL_API_BASE}/api/v1/public/auth/identity-claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth0-Action-Secret': event.secrets.OPESFUEL_ACTION_SECRET,
      },
      body: JSON.stringify({
        email: event.user.email,
        sub: event.user.user_id,
        emailVerified: event.user.email_verified === true,
      }),
    });
    if (!res.ok) return; // no workspace / unverified: issue token without tenant claim
    const c = await res.json();
    for (const target of [api.accessToken, api.idToken]) {
      target.setCustomClaim(`${ns}tenant_id`, c.tenant_id);
      target.setCustomClaim(`${ns}roles`, c.roles);
      target.setCustomClaim(`${ns}station_ids`, c.station_ids);
    }
  } catch (e) {
    // network failure: fail closed (no claims)
  }
};
