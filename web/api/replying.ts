// Replying: the three kinds of AI help, sending, and filing as a draft. One function per
// operation of OPERATIONS.md.
import { api } from '../api.ts';

/** A proposal by the AI: the result of one of the three kinds of assistance. */
export interface Draft {
  id: number;
  action: 'typos' | 'style' | 'prompt';
  promptId: number | null;
  model: string;
  /** The proposed reply, as HTML. */
  html: string;
  provider?: string | null;
}

export interface SentReply {
  finalText: string;
  /** The reply as rich text; empty for a reply sent before replies were rich text. */
  finalHtml: string;
  wasEdited: boolean;
  changeReason: string;
  mode: 'sent' | 'draft';
  to: string[];
  cc: string[];
  sentAt: string;
  /** Who replied: in a shared mailbox, not necessarily the reader. Their address, and their name when they gave one. */
  by: string | null;
  byName: string | null;
}

/** A reply as it is handed over: what was written, to whom, and why the proposal was changed. */
export interface ReplyToHandOver {
  draftId: number | undefined;
  html: string;
  to: string[];
  cc: string[];
  changeReason: string;
}

export const checkTypos = (emailId: number, html: string): Promise<Draft> => api<Draft>('POST', `/emails/${emailId}/assist`, { action: 'typos', html });
export const improveStyle = (emailId: number, html: string): Promise<Draft> => api<Draft>('POST', `/emails/${emailId}/assist`, { action: 'style', html });
export const writeWithPrompt = (emailId: number, html: string, promptId: number): Promise<Draft> =>
  api<Draft>('POST', `/emails/${emailId}/assist`, { action: 'prompt', html, promptId });
export const sendReply = (emailId: number, reply: ReplyToHandOver): Promise<unknown> => api('POST', `/emails/${emailId}/send`, reply);
export const fileReplyAsDraft = (emailId: number, reply: ReplyToHandOver): Promise<unknown> => api('POST', `/emails/${emailId}/save-draft`, reply);
