// A proposal the AI wrote, and a reply handed to the mailbox.
import type { Email } from './email.ts';

/** What the LLM is asked to do with the text the user wrote in the reply area. */
export type AssistAction = 'typos' | 'style' | 'prompt';

/** How a reply was handed to the mailbox. */
export type ReplyMode = 'sent' | 'draft';

export interface DraftRow {
  id: number;
  email_id: number;
  /** What the LLM was asked to do. Null for a draft made before assistance had kinds: then `ai_text` is plain text. */
  action: AssistAction | null;
  prompt_id: number | null;
  model: string;
  instructions: string;
  ai_text: string;
  created_at: Date;
}

/** A reply ready to leave: the stored email it answers, its recipients, and the user's text. */
export interface OutgoingReply {
  email: Email;
  to: string[];
  cc: string[];
  /** The reply as sanitised HTML; its plain-text form is derived from it. */
  html: string;
  /** Language of the line introducing the quoted original. */
  language: string;
}
