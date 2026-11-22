// The mailboxes as saras reaches them: one provider per kind of mailbox, same interface.
import type { AccountRow, ImapCredentials, MailProvider, OAuthKind, OAuthTokens, Sender } from '../../domain/model/mailbox.ts';
import type { Fetch } from '../fetch.ts';
import type { Config } from '../config.ts';
import type { Vault } from '../crypto.ts';
import type { Db } from '../db.ts';
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

/** Access granted at a host runs out: gets new tokens with the lasting one, and keeps them sealed with the mailbox. */
async function renewedTokens({ db, vault, config, fetchImpl }: Dependencies, account: AccountRow, kind: OAuthKind, tokens: OAuthTokens): Promise<OAuthTokens> {
  if (!tokens.refreshToken) throw new Error('the OAuth session expired: reconnect the mailbox');
  const fresh = await refreshTokens(config, kind, tokens.refreshToken, fetchImpl);
  const next: OAuthTokens = { ...fresh, refreshToken: fresh.refreshToken || tokens.refreshToken };
  account.config_enc = vault.seal(next);
  await db.run('UPDATE accounts SET config_enc = $1 WHERE id = $2', [account.config_enc, account.id]);
  return next;
}

/** Returns a valid access token, renewing it when it is about to expire. */
const accessTokenGetter = (deps: Dependencies, account: AccountRow, kind: OAuthKind) => async (): Promise<string> => {
  const tokens = deps.vault.open<OAuthTokens>(account.config_enc);
  if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;
  return (await renewedTokens(deps, account, kind, tokens)).accessToken;
};

function providerFor(deps: Dependencies, account: AccountRow): MailProvider {
  if (account.kind === 'imap') return createImapProvider(account, deps.vault.open<ImapCredentials>(account.config_enc));
  const access = { getAccessToken: accessTokenGetter(deps, account, account.kind), fetchImpl: deps.fetchImpl };
  return account.kind === 'google' ? createGmailProvider(account, access) : createGraphProvider(account, access);
}

export const createMailService = (deps: Dependencies): MailService => ({
  providerFor: (account) => providerFor(deps, account),
  imapProvider: (account, credentials) => createImapProvider(account, credentials),
});
