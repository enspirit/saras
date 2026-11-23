// A board: a named view of emails, defined by a filter on their attributes.
import type { Box, EmailSummary, Priority } from './email.ts';

/**
 * The attributes of an email a board can filter on, each with the kind of value it takes.
 * Every condition given must hold; within one made of several values, any of them does.
 *   mailbox     the mailboxes it arrived in
 *   box         where it stands: to handle, no reply needed, replied, ignored
 *   priority    how urgent the sorting found it
 *   received    how recently it arrived, in days
 *   from        part of the sender's name or address
 *   keywords    words that all appear in its subject or text
 *   attachment  whether it came with attachments
 */
export const EMAIL_ATTRIBUTES = ['mailbox', 'box', 'priority', 'received', 'from', 'keywords', 'attachment'] as const;
export type EmailAttribute = (typeof EMAIL_ATTRIBUTES)[number];

export const PRIORITIES = ['high', 'normal', 'low'] as const satisfies readonly Priority[];

export interface BoardFilter {
  mailbox?: number[];
  box?: Box[];
  priority?: Priority[];
  received?: number;
  from?: string;
  keywords?: string;
  attachment?: boolean;
}

/** A board as a member sees it. */
export interface Board {
  id: number;
  name: string;
  /** Seen by every member of the organisation, each through the mailboxes they may use. */
  shared: boolean;
  /** Whether this member may change or delete it: its owner; for a shared one, the administrators. */
  canManage: boolean;
  filter: BoardFilter;
  /** How many emails it shows this member now. */
  count: number;
}

/** What a member gives to create or change a board. */
export interface BoardGiven {
  name: string;
  shared: boolean;
  filter: BoardFilter;
}

/** A board with the most recent emails it shows. */
export interface EmailsOfBoard {
  board: Board;
  emails: EmailSummary[];
}
