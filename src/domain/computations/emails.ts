// Pure: an email, from how it is kept to how operations and the sorting gate see it.
import type { TriageMail } from '../sorting/gate.ts';
import type { Email, EmailRow } from '../../types.ts';

export function rowToEmail(row: EmailRow): Email {
  return {
    id: row.id,
    accountId: row.account_id,
    folder: row.folder,
    providerId: row.provider_id,
    messageId: row.message_id,
    threadId: row.thread_id,
    refs: row.refs,
    fromName: row.from_name,
    fromAddr: row.from_addr,
    replyTo: row.reply_to,
    to: JSON.parse(row.to_json),
    cc: JSON.parse(row.cc_json),
    subject: row.subject,
    date: row.date.toISOString(),
    bodyText: row.body_text,
    attachments: JSON.parse(row.attachments_json),
    status: row.status,
    triageSource: row.triage_source,
    triageReason: row.triage_reason,
    priority: row.priority,
    suggestedPromptId: row.suggested_prompt_id,
  };
}

/** Pure: a stored email, as the triage gate is given it. */
export function toTriageMail(email: Email): TriageMail {
  return {
    id: email.id,
    from: { name: email.fromName, address: email.fromAddr },
    to: email.to,
    cc: email.cc,
    subject: email.subject,
    body: email.bodyText,
    attachments: email.attachments,
  };
}
