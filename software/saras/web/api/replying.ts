// Replying: the three kinds of AI help, sending, and filing as a draft. One function per
// operation of doc/2-operations.md.
import type { Proposal } from '../../shared/reply.ts';
import { api } from '../api.ts';

/** A reply as it is handed over: what was written, to whom, and why the proposal was changed. */
export interface ReplyToHandOver {
  proposalId: number | undefined;
  html: string;
  to: string[];
  cc: string[];
  changeReason: string;
}

export const checkTypos = (emailId: number, html: string): Promise<Proposal> => api<Proposal>('POST', `/emails/${emailId}/assist`, { action: 'typos', html });
export const improveStyle = (emailId: number, html: string): Promise<Proposal> => api<Proposal>('POST', `/emails/${emailId}/assist`, { action: 'style', html });
export const writeWithPrompt = (emailId: number, html: string, promptId: number): Promise<Proposal> =>
  api<Proposal>('POST', `/emails/${emailId}/assist`, { action: 'prompt', html, promptId });
export const sendReply = (emailId: number, reply: ReplyToHandOver): Promise<unknown> => api('POST', `/emails/${emailId}/send`, reply);
export const fileReplyAsDraft = (emailId: number, reply: ReplyToHandOver): Promise<unknown> => api('POST', `/emails/${emailId}/file-as-draft`, reply);
