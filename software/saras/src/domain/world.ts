// What operations act in and on behalf of.
import type { Config } from '../tooling/config.ts';
import type { Vault } from '../tooling/crypto.ts';
import type { Db } from '../tooling/db.ts';
import type { MailService } from '../tooling/mail/mail-service.ts';
import type { Postman } from '../tooling/postman.ts';
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

/** The same, with what this running server keeps in memory only: several servers on one database do not share it. */
export interface World extends Reach {
  /** Wrong guesses of passwords and invitation links, per origin. */
  attempts: Map<string, Attempts>;
  /** The fetching of mailboxes: one at a time per mailbox, whoever asks. */
  fetching: Sync;
  /** The server's own outgoing mail, when it was given one. */
  postman: Postman;
}

export const createWorld = (reach: Reach, fetching: Sync, postman: Postman): World => ({ ...reach, attempts: new Map(), fetching, postman });

/** The member an operation is performed by, with their organisation. */
export interface Actor {
  member: UserRow;
  organization: OrganizationRow;
}
