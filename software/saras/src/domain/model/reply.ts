// A proposal the AI wrote, and a reply handed to the mailbox.
import type { Assistance } from '../../../shared/reply.ts';
import type { Email } from './email.ts';

export type { ReplyMode } from '../../../shared/reply.ts';
/** The kind of help a proposal came from. */
export type AssistAction = Assistance;



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
