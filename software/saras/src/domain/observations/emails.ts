// Observation: the emails a member may see, box by box, and one email with where its reply stands.
import type { ValueOfEmail } from '../../../shared/attribute.ts';
import { bestPrompt, valuesOf } from '../computations/prompt-affinity.ts';
import { promptsWithAffinity } from '../state/prompts.ts';
import type { Config } from '../../tooling/config.ts';
import type { Db } from '../../tooling/db.ts';
import { holdsHostedImages, receivedDocument } from '../../tooling/received-html.ts';
import { readReason } from '../../tooling/messages.ts';
import type { EmailStatus, EmailSummary, EmailWithItsReply, EmailsOfBox, View } from '../../../shared/email.ts';
import type { Proposal, Reply } from '../../../shared/reply.ts';
import type { DraftRow } from '../model/reply.ts';
import type { Conditions } from '../computations/boards.ts';
import { countsPerBox } from '../computations/boxes.ts';
import { wordsOf } from '../computations/search.ts';
import { viewGiven } from '../computations/selection.ts';
import { viewConditions } from '../state/views.ts';
import { isPastRetention, rowToEmail } from '../computations/emails.ts';
import { handsFilesOver } from '../computations/mailboxes.ts';
import { replyRecipients } from '../computations/reply.ts';
import { proposalHtml } from '../computations/replying.ts';
import { Refusal } from '../refusal.ts';
import { emailFor } from '../state/emails.ts';
import type { OwnedEmailRow } from '../state/emails.ts';
import { mayUse } from '../state/mailboxes.ts';
import type { Actor } from '../world.ts';

/** The emails a member may see, among those of their organisation's mailboxes they may use: parameters $1 and $2. */
export const SEEN_BY_MEMBER = `FROM emails e JOIN accounts a ON a.id = e.account_id WHERE ${mayUse('$1', '$2')}`;

/** The start of an email's text; or, with a word searched, its text from a little before where that word first is. */
const snippetOf = (n: number | null): string =>
  n === null ? 'substr(e.body_text, 1, 160)' : `substr(e.body_text, greatest(1, strpos(lower(e.body_text), lower($${n})) - 40), 160)`;

/** The 200 most recent emails a member may see that meet these conditions, whose parameters are numbered from $3; their snippet around `around`, when said. */
export async function emailSummaries(db: Db, { member, organization }: Actor, { sql, params }: Conditions, around = ''): Promise<EmailSummary[]> {
  const emails = await db.query<Omit<EmailSummary, 'date' | 'attributes'> & { date: Date; attributesJson: string }>(
    `SELECT e.id, e.from_name AS "fromName", e.from_addr AS "fromAddr", e.subject, e.date, e.status,
            e.triage_source AS "triageSource", ${snippetOf(around ? 3 + params.length : null)} AS snippet, a.email AS mailbox, a.shared, e.attributes_json AS "attributesJson",
            (SELECT r.mode FROM replies r WHERE r.email_id = e.id ORDER BY r.id DESC LIMIT 1) AS "replyMode"
     ${[SEEN_BY_MEMBER, ...sql].join(' AND ')}
     ORDER BY e.date DESC LIMIT 200`,
    [organization.id, member.id, ...params, ...(around ? [around] : [])],
  );
  return emails.map(({ attributesJson, ...email }) => ({ ...email, date: email.date.toISOString(), attributes: JSON.parse(attributesJson) }));
}

const perStatus = (db: Db, { member, organization }: Actor): Promise<{ status: EmailStatus; n: number }[]> =>
  db.query(`SELECT e.status, count(*)::int AS n FROM emails e JOIN accounts a ON a.id = e.account_id WHERE ${mayUse('$1', '$2')} GROUP BY e.status`, [organization.id, member.id]);

/** The 200 most recent emails of a view, their snippets around the first word searched. */
export const emailsOfView = async (db: Db, actor: Actor, view: View): Promise<EmailSummary[]> =>
  emailSummaries(db, actor, await viewConditions(db, actor, view), wordsOf(view.search ?? '')[0]);

/** The 200 most recent emails of a box (or of every box), as searched, with how many each box holds. */
export const emailsOfBox = async (db: Db, actor: Actor, box: unknown, search: unknown): Promise<EmailsOfBox> => ({
  emails: await emailsOfView(db, actor, viewGiven({ box, search })),
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

/** Where an email arrived, and how it can be looked at beyond its text: as it was written, and with its files. */
const shownAs = (row: OwnedEmailRow, { retentionDays }: Pick<Config, 'retentionDays'>) => ({
  mailbox: row.account_email,
  shared: row.account_shared,
  hasHtml: row.body_html !== '',
  hostedImagesHeld: holdsHostedImages(row.body_html),
  attachmentsOpen: handsFilesOver(row.account_kind) && !isPastRetention(row.date, retentionDays),
});

/** The HTML of an email, rebuilt as a document to show in a frame. Not found for an email that has none. */
export async function emailAsDocument(db: Db, actor: Actor, id: unknown): Promise<string> {
  const row = await emailFor(db, actor, id);
  if (!row.body_html) throw new Refusal('notFound', 'emails.notFound');
  return receivedDocument(row.body_html);
}

/** One email as its reader sees it: its content, why it was sorted so, who a reply would go to, its proposal and its reply. */
export async function emailWithItsReply(db: Db, actor: Actor, id: unknown, config: Pick<Config, 'retentionDays'>): Promise<EmailWithItsReply> {
  const row = await emailFor(db, actor, id);
  // The HTML is not part of the answer: it is a document of its own.
  const { bodyHtml: _html, ...email } = rowToEmail(row);
  const reason = readReason(email.triageReason);
  const attributes: Record<string, ValueOfEmail> = JSON.parse(row.attributes_json);
  const suited = bestPrompt(await promptsWithAffinity(db, actor.organization.id), valuesOf({ status: row.status, attributes }));
  return {
    ...email,
    ...shownAs(row, config),
    suggestedPromptId: suited?.id ?? null,
    triageReason: reason.text,
    triageReasonCode: reason.code,
    attributes,
    recipients: replyRecipients(email, row.account_email, false),
    recipientsAll: replyRecipients(email, row.account_email, true),
    proposal: await latestProposal(db, row.id),
    reply: await latestReply(db, row.id),
  };
}
