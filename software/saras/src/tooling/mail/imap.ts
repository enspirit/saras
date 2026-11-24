// Generic mailbox: IMAP to read, SMTP to send.
import type { ImapCredentials, MailProvider, Sender } from '../../domain/model/mailbox.ts';
import { attachment } from './imap/attachments.ts';
import { smtpVerified, withFolder } from './imap/connection.ts';
import { listFolders, listNew } from './imap/folders.ts';
import { saveDraft, send } from './imap/replies.ts';

/** Both servers let us in. */
async function verify(cfg: ImapCredentials): Promise<void> {
  await withFolder(cfg, 'INBOX', async () => {});
  await smtpVerified(cfg);
}

export const createImapProvider = (account: Sender, cfg: ImapCredentials): MailProvider => ({
  verify: () => verify(cfg),
  listFolders: () => listFolders(cfg),
  listNew: (query) => listNew(cfg, query),
  send: (reply) => send(account, cfg, reply),
  saveDraft: (reply) => saveDraft(account, cfg, reply),
  attachment: (email, index) => attachment(cfg, email, index),
});
