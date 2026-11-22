// What operations act in and on behalf of.
import type { Config } from '../config.ts';
import type { Vault } from '../crypto.ts';
import type { Db } from '../db.ts';
import type { MailService } from '../mail/index.ts';
import type { Llm, OrganizationRow, UserRow } from '../types.ts';

/** The other agents and the stores an operation may reach: the database, the mailboxes, the LLM. */
export interface World {
  db: Db;
  mail: MailService;
  llm: Llm;
  vault: Vault;
  config: Config;
}

/** The member an operation is performed by, with their organisation. */
export interface Actor {
  member: UserRow;
  organization: OrganizationRow;
}
