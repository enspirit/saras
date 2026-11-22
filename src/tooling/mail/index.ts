import type { Config } from '../config.ts';
import type { Vault } from '../crypto.ts';
import type { Db } from '../db.ts';
import type { AccountRow, Fetch, ImapCredentials, MailProvider, OAuthKind, OAuthTokens, Sender } from '../../types.ts';
import { createGmailProvider } from './gmail.ts';
import { createGraphProvider } from './graph.ts';
import { createImapProvider } from './imap.ts';
import { refreshTokens } from './oauth.ts';

export interface MailService {
  /** The provider matching the kind of a stored account. */
  providerFor(account: AccountRow): MailProvider;
  /** For an account that is not saved yet. */
  imapProvider(account: Sender, credentials: ImapCredentials): MailProvider;
}

interface Dependencies {
  db: Db;
  vault: Vault;
  config: Config;
  fetchImpl?: Fetch;
}

export function createMailService({ db, vault, config, fetchImpl = fetch }: Dependencies): MailService {
  /** Returns a valid access token, refreshing and persisting it when it is about to expire. */
  function accessTokenGetter(account: AccountRow, kind: OAuthKind) {
    return async (): Promise<string> => {
      const tokens = vault.open<OAuthTokens>(account.config_enc);
      if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;
      if (!tokens.refreshToken) throw new Error('the OAuth session expired: reconnect the mailbox');
      const fresh = await refreshTokens(config, kind, tokens.refreshToken, fetchImpl);
      const next: OAuthTokens = { ...fresh, refreshToken: fresh.refreshToken || tokens.refreshToken };
      account.config_enc = vault.seal(next);
      await db.run('UPDATE accounts SET config_enc = $1 WHERE id = $2', [account.config_enc, account.id]);
      return next.accessToken;
    };
  }

  return {
    providerFor(account) {
      if (account.kind === 'imap') return createImapProvider(account, vault.open<ImapCredentials>(account.config_enc));
      const deps = { getAccessToken: accessTokenGetter(account, account.kind), fetchImpl };
      return account.kind === 'google' ? createGmailProvider(account, deps) : createGraphProvider(account, deps);
    },
    imapProvider: (account, credentials) => createImapProvider(account, credentials),
  };
}
