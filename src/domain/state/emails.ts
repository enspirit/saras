// State: the emails saras keeps, and where each stands.
import type { Db } from '../../tooling/db.ts';
import type { EmailRow } from '../model/email.ts';
import { Refusal } from '../refusal.ts';
import type { Actor } from '../world.ts';
import { mayUse } from './mailboxes.ts';

/** An email row joined with the address of the mailbox it belongs to. */
export type OwnedEmailRow = EmailRow & { account_email: string; account_shared: boolean };

/** The email with this number, if the member may use its mailbox. Refused as not found otherwise: what one may not see does not exist. */
export async function emailFor(db: Db, { member, organization }: Actor, id: unknown): Promise<OwnedEmailRow> {
  const row = await db.one<OwnedEmailRow>(
    `SELECT e.*, a.email AS account_email, a.shared AS account_shared FROM emails e JOIN accounts a ON a.id = e.account_id WHERE e.id = $1 AND ${mayUse('$2', '$3')}`,
    [Number(id) || 0, organization.id, member.id],
  );
  if (!row) throw new Refusal('notFound', 'emails.notFound');
  return row;
}

/** Emails to handle that have content and no proposal yet, most recent first. */
export const emailsAwaitingProposal = (db: Db, mailboxId: number, limit: number): Promise<EmailRow[]> =>
  db.query<EmailRow>(
    `SELECT e.* FROM emails e
     WHERE e.account_id = $1 AND e.status = 'needs_reply' AND e.body_text != ''
       AND NOT EXISTS (SELECT 1 FROM drafts d WHERE d.email_id = e.id)
     ORDER BY e.date DESC LIMIT $2`,
    [mailboxId, limit],
  );
