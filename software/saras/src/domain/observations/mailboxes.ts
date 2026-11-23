// Observation: the mailboxes a member may use, with what each watches and how its last fetch went.
import type { Config } from '../../tooling/config.ts';
import type { Mailbox } from '../../../shared/mailbox.ts';
import type { Db } from '../../tooling/db.ts';
import { decodeProblem } from '../../tooling/messages.ts';
import { manages } from '../computations/mailboxes.ts';
import { mayUse } from '../state/mailboxes.ts';
import type { Actor } from '../world.ts';

/** A mailbox as it is kept: with its owner, its last error encoded, its last fetch as a date. */
type Listed = Omit<Mailbox, 'canManage' | 'lastError' | 'lastSyncAt'> & { user_id: number; lastError: string | null; lastSyncAt: Date | null };

/** Shared ones first. Each says how far back it is fetched (what the server is set up for, when nothing was chosen), whether the member manages it, and how many of its emails are to handle. */
export async function mailboxesOf(db: Db, actor: Actor, { syncDays, retentionDays }: Pick<Config, 'syncDays' | 'retentionDays'>): Promise<Mailbox[]> {
  const rows = await db.query<Listed>(
    `SELECT a.id, a.kind, a.email, a.display_name AS "displayName", a.shared, a.user_id, a.folder, a.folder_name AS "folderName", LEAST(COALESCE(a.fetch_days, $3), $4)::int AS "fetchDays", a.unread_only AS "unreadOnly",
            a.last_sync_at AS "lastSyncAt", a.last_error AS "lastError",
            (SELECT count(*)::int FROM emails e WHERE e.account_id = a.id AND e.status IN ('needs_reply','pending')) AS todo
     FROM accounts a WHERE ${mayUse('$1', '$2')} ORDER BY a.shared DESC, a.id`,
    [actor.organization.id, actor.member.id, syncDays, retentionDays],
  );
  return rows.map(({ user_id, ...row }) => ({
    ...row,
    canManage: manages(actor, { shared: row.shared, user_id }),
    lastError: decodeProblem(row.lastError),
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
  }));
}
