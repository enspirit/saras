import { createGmailProvider } from './gmail.js';
import { createGraphProvider } from './graph.js';
import { createImapProvider } from './imap.js';
import { refreshTokens } from './oauth.js';

/**
 * Gives the right provider for an account row. Every provider exposes:
 *   verify()                         -> throws when the credentials do not work
 *   listNew({ since, limit, known }) -> emails of the inbox not yet in `known`
 *   send({ email, to, cc, text })    -> sends the reply to `email` from the account
 *   saveDraft({ email, to, cc, text }) -> files the reply in the mailbox's drafts instead of sending it
 */
export function createMailService({ db, vault, config, fetchImpl = fetch }) {
  function accessTokenGetter(account) {
    return async () => {
      const cfg = vault.open(account.config_enc);
      if (cfg.expiresAt - Date.now() > 60_000) return cfg.accessToken;
      const fresh = await refreshTokens(config, account.kind, cfg.refreshToken, fetchImpl);
      const next = { ...cfg, ...fresh, refreshToken: fresh.refreshToken || cfg.refreshToken };
      account.config_enc = vault.seal(next);
      db.prepare('UPDATE accounts SET config_enc = ? WHERE id = ?').run(account.config_enc, account.id);
      return next.accessToken;
    };
  }

  return {
    providerFor(account) {
      if (account.kind === 'imap') return createImapProvider(account, vault.open(account.config_enc));
      const deps = { getAccessToken: accessTokenGetter(account), fetchImpl };
      return account.kind === 'google' ? createGmailProvider(account, deps) : createGraphProvider(account, deps);
    },
    /** For an account that is not saved yet. */
    imapProvider: (account, cfg) => createImapProvider(account, cfg),
  };
}
