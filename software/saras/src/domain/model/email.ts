// An email, as it arrives from a mailbox and as saras keeps it.
import type { Address, Attachment, EmailStatus } from '../../../shared/email.ts';

export type { Address, Attachment, EmailStatus } from '../../../shared/email.ts';

/** The few headers sorting rules look at. */
export interface MailHeaders {
  listUnsubscribe?: string;
  listId?: string;
  autoSubmitted?: string;
  precedence?: string;
}

/** An email as a mail provider hands it over, before it is stored. */
export interface IncomingEmail {
  /** Identifier of the message at the provider (IMAP "uidvalidity:uid", Gmail or Graph id). */
  providerId: string;
  messageId: string | null;
  threadId: string | null;
  /** Space-separated Message-IDs of the References header. */
  refs: string;
  fromName: string;
  fromAddr: string;
  replyTo: string;
  to: Address[];
  cc: Address[];
  subject: string;
  /** ISO 8601. */
  date: string;
  bodyText: string;
  /** Its HTML as it was written, when it has one: shown rebuilt (tooling/received-html.ts), never sent to the LLM. */
  bodyHtml: string;
  attachments: Attachment[];
  headers: MailHeaders;
  /** Already answered from the user's own mail client, when the provider can tell. */
  answered: boolean;
}

/** Who decided where an email stands: 'rule', 'user', or 'none' for nobody ('ai' on an email the AI sorted, when it did). */
export type TriageSource = string;

/** An email once stored. */
export interface Email extends Omit<IncomingEmail, 'headers' | 'answered'> {
  id: number;
  accountId: number;
  /** The folder it was fetched from. */
  folder: string;
  status: EmailStatus;
  triageSource: TriageSource | null;
  triageReason: string;
}

export interface EmailRow {
  id: number;
  account_id: number;
  folder: string;
  provider_id: string;
  message_id: string | null;
  thread_id: string | null;
  refs: string;
  from_name: string;
  from_addr: string;
  reply_to: string;
  to_json: string;
  cc_json: string;
  subject: string;
  date: Date;
  body_text: string;
  body_html: string;
  attachments_json: string;
  status: EmailStatus;
  triage_source: TriageSource | null;
  triage_reason: string;
  suggested_prompt_id: number | null;
  /** The values it has for the organisation's own attributes, by the key of each, and who decided each. */
  attributes_json: string;
  /** The few headers rules look at, as fetched; '{}' for an email fetched before they were kept. */
  headers_json: string;
  created_at: Date;
}
