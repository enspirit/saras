// A board: a named view of emails, defined by a filter on their attributes.
import type { EmailSummary } from './email.ts';

/**
 * What a board filters on: the attributes of the organisation, and the facts of an email.
 * Every condition given must hold; within one made of several values, any of them does.
 *   attributes  its values for the attributes of the organisation, by their key: where it
 *               stands, its priority, and those the organisation made
 *   mailbox     the mailboxes it arrived in
 *   received    how recently it arrived, in days
 *   from        part of the sender's name or address
 *   keywords    words that all appear in its subject or text
 *   attachment  whether it came with attachments
 */
export interface BoardFilter {
  attributes?: Record<string, string[]>;
  mailbox?: number[];
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

/** What a filter being written would show: how many emails, and the most recent of them. */
export interface FilterTried {
  count: number;
  emails: EmailSummary[];
}
