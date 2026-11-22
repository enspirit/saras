// Observation: the emails a member may see, box by box, and one email with where its reply stands.
import type { Db } from '../../tooling/db.ts';
import { readReason } from '../../tooling/messages.ts';
import type { EmailStatus } from '../model/email.ts';
import type { DraftRow, ReplyMode } from '../model/reply.ts';
import { countsPerBox, statusesOf } from '../computations/boxes.ts';
import { rowToEmail } from '../computations/emails.ts';
import { replyRecipients } from '../computations/reply.ts';
import { proposalHtml } from '../computations/replying.ts';
import { emailFor } from '../state/emails.ts';
import { mayUse } from '../state/mailboxes.ts';
import type { Actor } from '../world.ts';

const listed = (db: Db, { member, organization }: Actor, statuses: EmailStatus[]): Promise<unknown[]> =>
  db.query(
    `SELECT e.id, e.from_name AS "fromName", e.from_addr AS "fromAddr", e.subject, e.date, e.status, e.priority,
            e.triage_source AS "triageSource", substr(e.body_text, 1, 160) AS snippet, a.email AS account, a.shared,
            (SELECT r.mode FROM replies r WHERE r.email_id = e.id ORDER BY r.id DESC LIMIT 1) AS "replyMode"
     FROM emails e JOIN accounts a ON a.id = e.account_id
     WHERE ${mayUse('$1', '$2')} AND e.status = ANY($3)
     ORDER BY e.date DESC LIMIT 200`,
    [organization.id, member.id, statuses],
  );

const perStatus = (db: Db, { member, organization }: Actor): Promise<{ status: EmailStatus; n: number }[]> =>
  db.query(`SELECT e.status, count(*)::int AS n FROM emails e JOIN accounts a ON a.id = e.account_id WHERE ${mayUse('$1', '$2')} GROUP BY e.status`, [organization.id, member.id]);

/** The 200 most recent emails of a box, with how many each box holds. */
export const emailsOfBox = async (db: Db, actor: Actor, box: unknown): Promise<{ emails: unknown[]; counts: Record<string, number> }> => ({
  emails: await listed(db, actor, statusesOf(box)),
  counts: countsPerBox(await perStatus(db, actor)),
});

interface ReplyView {
  finalText: string;
  finalHtml: string;
  wasEdited: boolean;
  changeReason: string;
  mode: ReplyMode;
  toJson: string;
  ccJson: string;
  sentAt: Date;
  by: string | null;
  byName: string | null;
}

/** The latest proposal, to resume where the member left off. */
async function latestProposal(db: Db, emailId: number) {
  const draft = await db.one<DraftRow>('SELECT * FROM drafts WHERE email_id = $1 ORDER BY id DESC LIMIT 1', [emailId]);
  return draft ? { id: draft.id, action: draft.action ?? 'prompt', promptId: draft.prompt_id, model: draft.model, html: proposalHtml(draft) } : null;
}

/** What was last handed to the mailbox for this email, and by whom. */
async function latestReply(db: Db, emailId: number) {
  const reply = await db.one<ReplyView>(
    `SELECT r.final_text AS "finalText", r.final_html AS "finalHtml", r.was_edited AS "wasEdited", r.change_reason AS "changeReason", r.mode, r.to_json AS "toJson", r.cc_json AS "ccJson",
            r.sent_at AS "sentAt", u.email AS by, u.name AS "byName"
     FROM replies r LEFT JOIN users u ON u.id = r.user_id WHERE r.email_id = $1 ORDER BY r.id DESC LIMIT 1`,
    [emailId],
  );
  return reply ? { ...reply, to: JSON.parse(reply.toJson), cc: JSON.parse(reply.ccJson) } : null;
}

/** One email as its reader sees it: its content, why it was sorted so, who a reply would go to, its proposal and its reply. */
export async function emailWithItsReply(db: Db, actor: Actor, id: unknown) {
  const row = await emailFor(db, actor, id);
  const email = rowToEmail(row);
  const reason = readReason(email.triageReason);
  return {
    ...email,
    triageReason: reason.text,
    triageReasonCode: reason.code,
    account: row.account_email,
    shared: row.account_shared,
    recipients: replyRecipients(email, row.account_email, false),
    recipientsAll: replyRecipients(email, row.account_email, true),
    draft: await latestProposal(db, row.id),
    reply: await latestReply(db, row.id),
  };
}
