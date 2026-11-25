// State: the mailboxes of an organisation.
import type { Db } from '../../tooling/db.ts';
import { encodeProblem } from '../../tooling/messages.ts';
import type { ServerProblem } from '../../tooling/messages.ts';
import type { AccountKind, AccountRow } from '../model/mailbox.ts';
import { Refusal } from '../refusal.ts';
import type { Actor } from '../world.ts';

/**
 * Derived notion "may use a mailbox": it is in the member's organisation, and is theirs or
 * shared. As a SQL condition on the accounts table aliased `a`; `org` and `user` are the
 * positions of the two parameters.
 */
export const mayUse = (org: string, user: string): string => `a.org_id = ${org} AND (a.user_id = ${user} OR a.shared)`;

/** The mailboxes a member may use, each as its number and its address: what names a mailbox to them. */
export const mailboxesUsedBy = (db: Db, { member, organization }: Actor): Promise<{ id: number; email: string }[]> =>
  db.query<{ id: number; email: string }>(`SELECT a.id, a.email FROM accounts a WHERE ${mayUse('$1', '$2')} ORDER BY a.id`, [organization.id, member.id]);

export const mailboxById = async (db: Db, id: number): Promise<AccountRow> => (await db.one<AccountRow>('SELECT * FROM accounts WHERE id = $1', [id]))!;

/** The mailbox with this number, if the member may use it. Refused as not found otherwise: what one may not see does not exist. */
export async function mailboxFor(db: Db, { member, organization }: Actor, id: unknown): Promise<AccountRow> {
  const mailbox = await db.one<AccountRow>(`SELECT a.* FROM accounts a WHERE a.id = $1 AND ${mayUse('$2', '$3')}`, [Number(id) || 0, organization.id, member.id]);
  if (!mailbox) throw new Refusal('notFound', 'mailboxes.notFound');
  return mailbox;
}

/** The mailbox an organisation has connected for this address, if any: an address is connected once per organisation. */
export const mailboxAt = (db: Db, organizationId: number, kind: AccountKind, address: string): Promise<AccountRow | undefined> =>
  db.one<AccountRow>('SELECT * FROM accounts WHERE org_id = $1 AND kind = $2 AND email = $3', [organizationId, kind, address]);

export interface NewMailbox {
  organizationId: number;
  ownerId: number;
  shared: boolean;
  kind: AccountKind;
  address: string;
  displayName: string;
  sealedCredentials: string;
}

export const addMailbox = async (db: Db, m: NewMailbox): Promise<AccountRow> =>
  (await db.one<AccountRow>('INSERT INTO accounts (org_id, user_id, shared, kind, email, display_name, config_enc) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [
    m.organizationId,
    m.ownerId,
    m.shared,
    m.kind,
    m.address,
    m.displayName,
    m.sealedCredentials,
  ]))!;

/** New credentials for a mailbox; what went wrong with the old ones is forgotten. */
export const renewCredentials = async (db: Db, mailboxId: number, sealedCredentials: string, displayName: string): Promise<AccountRow> =>
  (await db.one<AccountRow>('UPDATE accounts SET config_enc = $1, display_name = $2, last_error = NULL WHERE id = $3 RETURNING *', [sealedCredentials, displayName, mailboxId]))!;

export const nameMailbox = async (db: Db, mailboxId: number, displayName: string): Promise<void> =>
  void (await db.run('UPDATE accounts SET display_name = $1 WHERE id = $2', [displayName, mailboxId]));

/** A mailbox becomes shared: every member of its organisation may use it from then on. */
export const shareMailbox = async (db: Db, mailboxId: number): Promise<void> => void (await db.run('UPDATE accounts SET shared = true WHERE id = $1', [mailboxId]));

export const watchFolder = async (db: Db, mailboxId: number, folder: { id: string; name: string }, fetched: { days: number | null; unreadOnly: boolean }): Promise<AccountRow> =>
  (await db.one<AccountRow>('UPDATE accounts SET folder = $1, folder_name = $2, fetch_days = $3, unread_only = $4, last_error = NULL WHERE id = $5 RETURNING *', [folder.id, folder.name, fetched.days, fetched.unreadOnly, mailboxId]))!;

/** Forgets a mailbox, and with it everything saras kept from it. */
export const forgetMailbox = async (db: Db, mailboxId: number): Promise<void> => void (await db.run('DELETE FROM accounts WHERE id = $1', [mailboxId]));

export const watchedMailboxes = (db: Db): Promise<AccountRow[]> => db.query<AccountRow>('SELECT * FROM accounts WHERE folder IS NOT NULL');

/** When a mailbox was last fetched, and what went wrong if anything did. */
export const recordFetch = async (db: Db, mailboxId: number, error: ServerProblem | null): Promise<void> =>
  void (await db.run(`UPDATE accounts SET last_sync_at = now(), last_error = $1 WHERE id = $2`, [encodeProblem(error), mailboxId]));
