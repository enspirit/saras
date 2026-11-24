// Pure: an email, from how it is kept to how operations see it.
import type { ValueOfEmail } from '../../../shared/attribute.ts';
import type { Priority } from '../../../shared/email.ts';
import type { Email, EmailRow, EmailStatus } from '../model/email.ts';

/** What saras keeps of a message, and how it is sorted, from its row. */
const sortingOf = (row: EmailRow) => ({
  status: row.status,
  triageSource: row.triage_source,
  triageReason: row.triage_reason,
  priority: row.priority,
});

/** Who wrote, to whom, and whom to answer. */
const correspondentsOf = (row: EmailRow) => ({
  fromName: row.from_name,
  fromAddr: row.from_addr,
  replyTo: row.reply_to,
  to: JSON.parse(row.to_json),
  cc: JSON.parse(row.cc_json),
});

export const rowToEmail = (row: EmailRow): Email => ({
  id: row.id,
  accountId: row.account_id,
  folder: row.folder,
  providerId: row.provider_id,
  messageId: row.message_id,
  threadId: row.thread_id,
  refs: row.refs,
  ...correspondentsOf(row),
  subject: row.subject,
  date: row.date.toISOString(),
  bodyText: row.body_text,
  attachments: JSON.parse(row.attachments_json),
  ...sortingOf(row),
});

const MAX_STORED_BODY = 100_000;

/** The text kept of an email. PostgreSQL text cannot hold a NUL character, which a malformed mail may contain. */
export const textToKeep = (body: string): string => body.replaceAll('\u0000', '').slice(0, MAX_STORED_BODY);

/** Where a fetched email first stands, who decided so ('rule', or 'none' for nobody) and why, its priority, and the other attributes the rules gave it. */
export interface Standing {
  status: EmailStatus;
  source: string;
  reason: string;
  priority: Priority;
  attributes: Record<string, ValueOfEmail>;
}
