/** OAuth 2 authorization-code flow for Google and Microsoft mailboxes. */

const PROVIDERS = {
  google: {
    authUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
    extra: { access_type: 'offline', prompt: 'consent' },
  },
  microsoft: {
    authUrl: (c) => `https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/authorize`,
    tokenUrl: (c) => `https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`,
    scope: 'offline_access User.Read Mail.ReadWrite Mail.Send',
    extra: { prompt: 'select_account' },
  },
};

export const isOAuthKind = (kind) => Object.hasOwn(PROVIDERS, kind);
export const isConfigured = (config, kind) => Boolean(config[kind]?.clientId && config[kind]?.clientSecret);
export const redirectUri = (config, kind) => `${config.baseUrl}/api/oauth/${kind}/callback`;

/** Pure. */
export function authorizationUrl(config, kind, state) {
  const p = PROVIDERS[kind];
  const params = new URLSearchParams({
    client_id: config[kind].clientId,
    redirect_uri: redirectUri(config, kind),
    response_type: 'code',
    scope: p.scope,
    state,
    ...p.extra,
  });
  return `${p.authUrl(config[kind])}?${params}`;
}

async function tokenRequest(config, kind, params, fetchImpl) {
  const res = await fetchImpl(PROVIDERS[kind].tokenUrl(config[kind]), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config[kind].clientId, client_secret: config[kind].clientSecret, ...params }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Échec OAuth ${kind} : ${body.error_description || body.error || res.status}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || null,
    expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000,
  };
}

export const exchangeCode = (config, kind, code, fetchImpl = fetch) =>
  tokenRequest(config, kind, { grant_type: 'authorization_code', code, redirect_uri: redirectUri(config, kind) }, fetchImpl);

export const refreshTokens = (config, kind, refreshToken, fetchImpl = fetch) =>
  tokenRequest(config, kind, { grant_type: 'refresh_token', refresh_token: refreshToken }, fetchImpl);

/** Which mailbox did the user just authorize? */
export async function fetchIdentity(kind, accessToken, fetchImpl = fetch) {
  const url =
    kind === 'google'
      ? 'https://gmail.googleapis.com/gmail/v1/users/me/profile'
      : 'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName';
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Impossible de lire le profil ${kind} (${res.status})`);
  const body = await res.json();
  return kind === 'google'
    ? { email: String(body.emailAddress).toLowerCase(), name: '' }
    : { email: String(body.mail || body.userPrincipalName).toLowerCase(), name: body.displayName || '' };
}
