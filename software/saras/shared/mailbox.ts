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
  /** What is fetched from that folder: how many days back, and whether only what is unread. */
  fetchDays: number;
  unreadOnly: boolean;
  lastSyncAt: string | null;
  lastError: Problem | null;
  /** Emails of this mailbox that are to handle. */
  todo: number;
}

export interface MailFolder {
  id: string;
  name: string;
}

/** The servers a mailbox is reached by. */
export interface MailServers {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

/** The servers a mailbox is reached by, as they are told to who manages it: never its password. */
export interface MailboxServers extends MailServers {
  imapSecure: boolean;
  smtpSecure: boolean;
  username: string;
}

/** Who hosts the mail of an address, and its servers when we are sure of them: nothing is proposed otherwise. */
export interface MailHost {
  provider: 'google' | 'microsoft' | 'other';
  servers: MailServers | null;
}

/** What a fetch brought in, and what went wrong if anything did. */
export interface FetchResult {
  fetched: number;
  /** How many more emails the folder holds that later fetches will bring: a fetch takes a limited number, the most recent first. */
  toCome: number;
  error: Problem | null;
}

/** How far back a mailbox can be fetched, in days. Never further than what the server keeps. */
export const FETCH_DAYS = [1, 7, 14, 30] as const;

/** What is fetched from the watched folder of a mailbox. */
export interface WhatIsFetched {
  days: number;
  /** Only the emails not yet read in the mailbox; otherwise all of them, read or not. */
  unreadOnly: boolean;
}
