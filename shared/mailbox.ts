// A mailbox connected to an organisation, its folders, and what fetching it gives.
import type { Problem } from './problem.ts';

/** How a mailbox is reached: by its servers, or through its host's own API. */
export type MailboxKind = 'imap' | 'google' | 'microsoft';

/** A mailbox, as a member who may use it sees it. */
export interface Mailbox {
  id: number;
  kind: MailboxKind;
  email: string;
  displayName: string;
  /** Used by every member of the organisation, not only by who connected it. */
  shared: boolean;
  /** Whether this member manages it: changes its folder, renews its access, disconnects it. */
  canManage: boolean;
  /** The watched folder; null until it has been chosen. */
  folder: string | null;
  folderName: string;
  lastSyncAt: string | null;
  lastError: Problem | null;
  /** Emails of this mailbox that are to handle. */
  todo: number;
}

export interface MailFolder {
  id: string;
  name: string;
}

/** Who hosts the mail of an address, and the servers to propose when that host is known. */
export interface MailHost {
  provider: 'google' | 'microsoft' | 'other';
  servers: { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number } | null;
}

/** What a fetch brought in and had sorted, and what went wrong if anything did. */
export interface FetchResult {
  fetched: number;
  triaged: number;
  error: Problem | null;
}
