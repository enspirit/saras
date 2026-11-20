import type { Config } from '../config.ts';
import type { Fetch, OAuthKind, OAuthTokens } from '../types.ts';

/** OAuth 2 authorization-code flow for Google and Microsoft mailboxes. */

type OAuthConfig = Pick<Config, 'baseUrl' | 'google' | 'microsoft'>;

interface ProviderSpec {
  authUrl: (config: OAuthConfig) => string;
  tokenUrl: (config: OAuthConfig) => string;
  scope: string;
  extra: Record<string, string>;
}

const PROVIDERS: Record<OAuthKind, ProviderSpec> = {
  google: {
    authUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    // gmail.compose covers both creating drafts and sending.
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose',
    extra: { access_type: 'offline', prompt: 'consent' },
  },
  microsoft: {
    authUrl: (c) => `https://login.microsoftonline.com/${c.microsoft.tenant}/oauth2/v2.0/authorize`,
    tokenUrl: (c) => `https://login.microsoftonline.com/${c.microsoft.tenant}/oauth2/v2.0/token`,
    scope: 'offline_access User.Read Mail.ReadWrite Mail.Send',
    extra: { prompt: 'select_account' },
  },
};

export const isOAuthKind = (kind: unknown): kind is OAuthKind => typeof kind === 'string' && Object.hasOwn(PROVIDERS, kind);
export const isConfigured = (config: OAuthConfig, kind: OAuthKind): boolean => Boolean(config[kind].clientId && config[kind].clientSecret);
export const redirectUri = (config: OAuthConfig, kind: OAuthKind): string => `${config.baseUrl}/api/oauth/${kind}/callback`;

/** Pure. */
export function authorizationUrl(config: OAuthConfig, kind: OAuthKind, state: string): string {
  const p = PROVIDERS[kind];
  const params = new URLSearchParams({
    client_id: config[kind].clientId,
    redirect_uri: redirectUri(config, kind),
    response_type: 'code',
    scope: p.scope,
    state,
    ...p.extra,
  });
  return `${p.authUrl(config)}?${params}`;
}

/** The fields of a token endpoint response we read. */
interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(config: OAuthConfig, kind: OAuthKind, params: Record<string, string>, fetchImpl: Fetch): Promise<OAuthTokens> {
  const res = await fetchImpl(PROVIDERS[kind].tokenUrl(config), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config[kind].clientId, client_secret: config[kind].clientSecret, ...params }),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !body.access_token) {
    throw new Error(`Échec OAuth ${kind} : ${body.error_description || body.error || res.status}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || null,
    expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000,
  };
}

export const exchangeCode = (config: OAuthConfig, kind: OAuthKind, code: string, fetchImpl: Fetch = fetch) =>
  tokenRequest(config, kind, { grant_type: 'authorization_code', code, redirect_uri: redirectUri(config, kind) }, fetchImpl);

export const refreshTokens = (config: OAuthConfig, kind: OAuthKind, refreshToken: string, fetchImpl: Fetch = fetch) =>
  tokenRequest(config, kind, { grant_type: 'refresh_token', refresh_token: refreshToken }, fetchImpl);

/** Which mailbox did the user just authorize? */
export async function fetchIdentity(kind: OAuthKind, accessToken: string, fetchImpl: Fetch = fetch): Promise<{ email: string; name: string }> {
  const url =
    kind === 'google'
      ? 'https://gmail.googleapis.com/gmail/v1/users/me/profile'
      : 'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName';
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Impossible de lire le profil ${kind} (${res.status})`);
  const body = (await res.json()) as { emailAddress?: string; mail?: string; userPrincipalName?: string; displayName?: string };
  return kind === 'google'
    ? { email: String(body.emailAddress).toLowerCase(), name: '' }
    : { email: String(body.mail || body.userPrincipalName).toLowerCase(), name: body.displayName || '' };
}
