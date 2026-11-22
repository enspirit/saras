// State: the mailboxes of an organisation.
import type { Db } from '../../db.ts';
import type { AccountRow } from '../../types.ts';

/**
 * Derived notion "may use a mailbox": it is in the member's organisation, and is theirs or
 * shared. As a SQL condition on the accounts table aliased `a`; `org` and `user` are the
 * positions of the two parameters.
 */
export const mayUse = (org: string, user: string): string => `a.org_id = ${org} AND (a.user_id = ${user} OR a.shared)`;

export const mailboxById = async (db: Db, id: number): Promise<AccountRow> => (await db.one<AccountRow>('SELECT * FROM accounts WHERE id = $1', [id]))!;
