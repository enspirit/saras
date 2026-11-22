// A proposal the AI wrote for an email, and a reply handed to the mailbox.

/** The three kinds of help: check typos, improve style, write with a prompt. */
export const ASSISTANCE = ['typos', 'style', 'prompt'] as const;
export type Assistance = (typeof ASSISTANCE)[number];

/** How a reply was handed to the mailbox: sent, or left in its drafts. */
export type ReplyMode = 'sent' | 'draft';

/** A proposal: the result of one kind of help. */
export interface Proposal {
  id: number;
  action: Assistance;
  promptId: number | null;
  model: string;
  /** The proposed reply, as HTML. */
  html: string;
  /** Who served the model, when the proposal was just written. */
  provider?: string | null;
}

/** What was handed to the mailbox for an email. */
export interface Reply {
  finalText: string;
  /** The reply as rich text; empty for one handed over before replies were rich text. */
  finalHtml: string;
  /** Whether the member changed the proposal, and why, in their words. */
  wasEdited: boolean;
  changeReason: string;
  mode: ReplyMode;
  to: string[];
  cc: string[];
  sentAt: string;
  /** Who replied: in a shared mailbox, not necessarily the reader. Their address, and their name when they gave one. */
  by: string | null;
  byName: string | null;
}

/** What handing a reply over tells back. */
export interface HandedOver {
  ok: true;
  wasEdited: boolean;
}
