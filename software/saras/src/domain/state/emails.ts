// State: the emails saras keeps, and where each stands.
import type { Db } from '../../tooling/db.ts';
import { textToKeep } from '../computations/emails.ts';
import type { Standing } from '../computations/emails.ts';
import type { StatusAgain, ValueAgain } from '../computations/sorting-again.ts';
import type { EmailRow, IncomingEmail } from '../model/email.ts';
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

/** What saras already keeps of a mailbox's folder, by the mailbox's own identifiers. */
export async function knownIn(db: Db, mailboxId: number, folder: string): Promise<Set<string>> {
  const stored = await db.query<Pick<EmailRow, 'provider_id'>>('SELECT provider_id FROM emails WHERE account_id = $1 AND folder = $2', [mailboxId, folder]);
  return new Set(stored.map((row) => row.provider_id));
}

const whoAndWhat = (email: IncomingEmail): unknown[] => [
  email.providerId,
  email.messageId,
  email.threadId,
  email.refs || '',
  email.fromName,
  email.fromAddr,
  email.replyTo || '',
  JSON.stringify(email.to),
  JSON.stringify(email.cc),
  email.subject,
  email.date,
  textToKeep(email.bodyText),
  JSON.stringify(email.attachments),
];

/** Keeps a fetched email where it first stands. One already kept (same mailbox, folder and identifier) is left as it is. */
export const keepFetched = async (db: Db, mailboxId: number, folder: string, email: IncomingEmail, standing: Standing): Promise<void> =>
  void (await db.run(
    `INSERT INTO emails
       (account_id, folder, provider_id, message_id, thread_id, refs, from_name, from_addr, reply_to, to_json, cc_json,
        subject, date, body_text, attachments_json, status, triage_source, triage_reason, priority, attributes_json, headers_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
     ON CONFLICT (account_id, folder, provider_id) DO NOTHING`,
    [mailboxId, folder, ...whoAndWhat(email), standing.status, standing.source, standing.reason, standing.priority, JSON.stringify(standing.attributes), JSON.stringify(email.headers ?? {})],
  ));

/** An email the organisation keeps, with the address of the mailbox it arrived in. */
export type KeptEmail = EmailRow & { mailbox: string };

/** Every email an organisation keeps, oldest first. */
export const emailsKeptBy = (db: Db, organizationId: number): Promise<KeptEmail[]> =>
  db.query<KeptEmail>('SELECT e.*, a.email AS mailbox FROM emails e JOIN accounts a ON a.id = e.account_id WHERE a.org_id = $1 ORDER BY e.id', [organizationId]);

/** Where an email stands from now on, who decided it and why. */
export const keepStanding = async (db: Db, emailId: number, { status, source, reason }: StatusAgain): Promise<void> =>
  void (await db.run('UPDATE emails SET status = $1, triage_source = $2, triage_reason = $3 WHERE id = $4', [status, source, reason, emailId]));

/** The values an email has from now on for the organisation's attributes; its priority too when that is one of them. */
export const keepValues = async (db: Db, emailId: number, { attributes, priority }: ValueAgain): Promise<void> =>
  void (await db.run('UPDATE emails SET attributes_json = $1, priority = COALESCE($2, priority) WHERE id = $3', [JSON.stringify(attributes), priority ?? null, emailId]));
