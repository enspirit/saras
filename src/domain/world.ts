// What operations act in and on behalf of.
import type { Config } from '../tooling/config.ts';
import type { Vault } from '../tooling/crypto.ts';
import type { Db } from '../tooling/db.ts';
import type { MailService } from '../tooling/mail/mail-service.ts';
import type { Llm } from './model/llm.ts';
import type { UserRow } from './model/member.ts';
import type { OrganizationRow } from './model/organization.ts';
import type { Attempts } from './computations/access.ts';
import type { Sync } from './mailboxes/fetch-mailbox.ts';

/** The other agents and the stores an operation may reach: the database, the mailboxes, the LLM. */
export interface Reach {
  db: Db;
  mail: MailService;
  llm: Llm;
  vault: Vault;
  config: Config;
}

/** The same, with what this running server keeps in memory only. */
export interface World extends Reach {
  /** Wrong guesses of passwords and invitation links, per origin. */
  attempts: Map<string, Attempts>;
  /** Emails whose reply is on its way to the mailbox. */
  handingOver: Set<number>;
  /** The fetching of mailboxes: one at a time per mailbox, whoever asks. */
  fetching: Sync;
}

export const createWorld = (reach: Reach, fetching: Sync): World => ({ ...reach, attempts: new Map(), handingOver: new Set(), fetching });

/** The member an operation is performed by, with their organisation. */
export interface Actor {
  member: UserRow;
  organization: OrganizationRow;
}
