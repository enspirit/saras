// A mailbox: how it is kept, the credentials that reach it, and what every kind of mailbox knows how to do.
import type { MailFolder, MailboxKind as AccountKind } from '../../../shared/mailbox.ts';
import type { IncomingEmail } from './email.ts';
import type { OutgoingReply } from './reply.ts';

/** How a mailbox is reached; a folder of one that can be watched, identified as the provider does (IMAP path, Gmail label id, Graph folder id). */
export type { MailFolder, MailboxKind as AccountKind } from '../../../shared/mailbox.ts';
export type OAuthKind = 'google' | 'microsoft';

export interface AccountRow {
  id: number;
  org_id: number;
  /** Who connected it. For a personal mailbox, also the only one who uses it. */
  user_id: number;
  /** A shared mailbox (contact@, info@…) is used by every member of the organisation. */
  shared: boolean;
  kind: AccountKind;
  email: string;
  display_name: string;
  /** Credentials, sealed by the vault. */
  config_enc: string;
  /** The one folder watched, by its provider id. Null until the user has chosen it. */
  folder: string | null;
  folder_name: string;
  last_sync_at: Date | null;
  last_error: string | null;
  created_at: Date;
}

/** What identifies the sender of a reply: enough of an account to build the From header. */
export type Sender = Pick<AccountRow, 'email' | 'display_name'>;

export interface ServerCredentials {
  host: string;
  port: number;
  /** TLS from the first byte (ports 993 / 465); otherwise STARTTLS. */
  secure: boolean;
  user: string;
  pass: string;
}

export interface ImapCredentials {
  imap: ServerCredentials;
  smtp: ServerCredentials;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
}

export interface ListQuery {
  /** Provider id of the folder to read. */
  folder: string;
  since: Date;
  limit: number;
  /** Provider ids already stored, not to be fetched again. */
  known: Set<string>;
}

/** What every kind of mailbox knows how to do. */
export interface MailProvider {
  /** Throws when the credentials do not work. */
  verify(): Promise<void>;
  /** The folders that can be watched, the inbox first. */
  listFolders(): Promise<MailFolder[]>;
  /** Emails of a folder that are not in `known` yet. */
  listNew(query: ListQuery): Promise<IncomingEmail[]>;
  send(reply: OutgoingReply): Promise<void>;
  /** Files the reply in the mailbox's drafts instead of sending it. */
  saveDraft(reply: OutgoingReply): Promise<unknown>;
}
