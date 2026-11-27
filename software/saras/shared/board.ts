// A board: a named view of emails, defined by a filter on their attributes. The types of
// tests/operations/specification/boards/types.elo say what TypeScript cannot: how long a text
// may be, that a number names something kept. A request that does not fit them is refused.
import type { EmailSummary } from './email.ts';

/** One at least. */
export type SomeOf<T> = [T, ...T[]];

/** A list as one of at least one, if it is. */
export const someOf = <T>(list: T[]): SomeOf<T> | undefined => (list.length ? (list as SomeOf<T>) : undefined);

/**
 * The conditions that can be said both ways: an email is this, or is not.
 *   attributes  its values for the attributes of the organisation, by their key: where it
 *               stands (`status`), and the organisation's own (their number)
 *   mailbox     the mailboxes it arrived in, each named once
 *   from        part of the sender's name or address: not blank, trimmed, 200 characters at most
 *   keywords    words of its subject or text, the same
 * A condition that says nothing is not said: no list is empty.
 */
export interface ReversibleConditions {
  attributes?: Record<string, SomeOf<string>>;
  mailbox?: SomeOf<number>;
  from?: string;
  keywords?: string;
}

/**
 * What a board filters on: the attributes of the organisation, and the facts of an email.
 * Every condition given must hold; within one made of several values, any of them does, and
 * every keyword must appear.
 *   received    how recently it arrived, in days: ten years at most
 *   attachment  whether it came with attachments
 *   except      what it must not be: an email is left out when it has one of these values for
 *               an attribute, arrived in one of these mailboxes, has this in its sender's name
 *               or address, or holds any of these keywords. An email without a value for an
 *               attribute is not one of those left out.
 */
export interface BoardFilter extends ReversibleConditions {
  received?: number;
  attachment?: boolean;
  except?: ReversibleConditions;
}

/** A board as a member sees it. */
export interface Board {
  id: number;
  /** Not blank, trimmed, 80 characters at most. */
  name: string;
  /** Seen by every member of the organisation, each through the mailboxes they may use. */
  shared: boolean;
  /** Whether this member may change or delete it: its owner; for a shared one, the administrators. */
  canManage: boolean;
  filter: BoardFilter;
  /** How many emails it shows this member now. */
  count: number;
}

/** What a member gives to create or change a board, all of it: a change is said whole. */
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
