// Observation: the emails a member may see, box by box, and one email with where its reply stands.
import type { Db } from '../../tooling/db.ts';
import { readReason } from '../../tooling/messages.ts';
import type { EmailStatus, EmailSummary, EmailWithItsReply, EmailsOfBox } from '../../../shared/email.ts';
import type { Proposal, Reply } from '../../../shared/reply.ts';
import type { DraftRow } from '../model/reply.ts';
import type { Conditions } from '../computations/boards.ts';
import { countsPerBox, statusesOf } from '../computations/boxes.ts';
import { rowToEmail } from '../computations/emails.ts';
import { replyRecipients } from '../computations/reply.ts';
import { proposalHtml } from '../computations/replying.ts';
import { emailFor } from '../state/emails.ts';
import { mayUse } from '../state/mailboxes.ts';
import type { Actor } from '../world.ts';

/** The emails a member may see, among those of their organisation's mailboxes they may use: parameters $1 and $2. */
export const SEEN_BY_MEMBER = `FROM emails e JOIN accounts a ON a.id = e.account_id WHERE ${mayUse('$1', '$2')}`;

/** The 200 most recent emails a member may see that meet these conditions, whose parameters are numbered from $3. */
export async function emailSummaries(db: Db, { member, organization }: Actor, { sql, params }: Conditions): Promise<EmailSummary[]> {
  const emails = await db.query<Omit<EmailSummary, 'date' | 'attributes'> & { date: Date; attributesJson: string }>(
    `SELECT e.id, e.from_name AS "fromName", e.from_addr AS "fromAddr", e.subject, e.date, e.status, e.priority,
            e.triage_source AS "triageSource", substr(e.body_text, 1, 160) AS snippet, a.email AS mailbox, a.shared, e.attributes_json AS "attributesJson",
            (SELECT r.mode FROM replies r WHERE r.email_id = e.id ORDER BY r.id DESC LIMIT 1) AS "replyMode"
     ${[SEEN_BY_MEMBER, ...sql].join(' AND ')}
     ORDER BY e.date DESC LIMIT 200`,
    [organization.id, member.id, ...params],
  );
  return emails.map(({ attributesJson, ...email }) => ({ ...email, date: email.date.toISOString(), attributes: JSON.parse(attributesJson) }));
}

const listed = (db: Db, actor: Actor, statuses: readonly EmailStatus[]): Promise<EmailSummary[]> => emailSummaries(db, actor, { sql: ['e.status = ANY($3)'], params: [statuses] });

const perStatus = (db: Db, { member, organization }: Actor): Promise<{ status: EmailStatus; n: number }[]> =>
  db.query(`SELECT e.status, count(*)::int AS n FROM emails e JOIN accounts a ON a.id = e.account_id WHERE ${mayUse('$1', '$2')} GROUP BY e.status`, [organization.id, member.id]);

/** The 200 most recent emails of a box, with how many each box holds. */
export const emailsOfBox = async (db: Db, actor: Actor, box: unknown): Promise<EmailsOfBox> => ({
  emails: await listed(db, actor, statusesOf(box)),
  counts: countsPerBox(await perStatus(db, actor)),
});

/** A reply as it is kept: its recipients as JSON, its date as a date. */
type ReplyKept = Omit<Reply, 'to' | 'cc' | 'sentAt'> & { toJson: string; ccJson: string; sentAt: Date };

/** The latest proposal, to resume where the member left off. */
async function latestProposal(db: Db, emailId: number): Promise<Proposal | null> {
  const draft = await db.one<DraftRow>('SELECT * FROM drafts WHERE email_id = $1 ORDER BY id DESC LIMIT 1', [emailId]);
  return draft ? { id: draft.id, action: draft.action ?? 'prompt', promptId: draft.prompt_id, model: draft.model, html: proposalHtml(draft) } : null;
}

/** What was last handed to the mailbox for this email, and by whom. */
async function latestReply(db: Db, emailId: number): Promise<Reply | null> {
  const reply = await db.one<ReplyKept>(
    `SELECT r.final_text AS "finalText", r.final_html AS "finalHtml", r.was_edited AS "wasEdited", r.change_reason AS "changeReason", r.mode, r.to_json AS "toJson", r.cc_json AS "ccJson",
            r.sent_at AS "sentAt", u.email AS by, u.name AS "byName"
     FROM replies r LEFT JOIN users u ON u.id = r.user_id WHERE r.email_id = $1 ORDER BY r.id DESC LIMIT 1`,
    [emailId],
  );
  if (!reply) return null;
  const { toJson, ccJson, sentAt, ...rest } = reply;
  return { ...rest, to: JSON.parse(toJson), cc: JSON.parse(ccJson), sentAt: sentAt.toISOString() };
}

/** One email as its reader sees it: its content, why it was sorted so, who a reply would go to, its proposal and its reply. */
export async function emailWithItsReply(db: Db, actor: Actor, id: unknown): Promise<EmailWithItsReply> {
  const row = await emailFor(db, actor, id);
  const email = rowToEmail(row);
  const reason = readReason(email.triageReason);
  return {
    ...email,
    triageReason: reason.text,
    triageReasonCode: reason.code,
    attributes: JSON.parse(row.attributes_json),
    mailbox: row.account_email,
    shared: row.account_shared,
    recipients: replyRecipients(email, row.account_email, false),
    recipientsAll: replyRecipients(email, row.account_email, true),
    proposal: await latestProposal(db, row.id),
    reply: await latestReply(db, row.id),
  };
}
