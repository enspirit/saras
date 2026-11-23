// Pure decisions about replying: what a proposal is, whether a reply may be handed over and
// what is recorded of it, which prompt writes a proposal nobody asked for. No state is read
// or written here; every function is a table of inputs and outputs.
import { isBlankHtml, textToHtml } from '../../tooling/html.ts';
import { wasEdited } from './reply.ts';
import { htmlToText, isEmailAddress } from '../../tooling/text.ts';
import type { EmailStatus } from '../model/email.ts';
import type { PromptRow } from '../model/prompt.ts';
import type { DraftRow } from '../model/reply.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';

/** A stored proposal as HTML. One made before proposals were rich text is plain text. */
export const proposalHtml = (proposal: Pick<DraftRow, 'action' | 'ai_text'>): string => (proposal.action ? proposal.ai_text : textToHtml(proposal.ai_text));

/** ReqPre of CheckTypos and ImproveStyle: there is something to work on. */
export const hasSomethingWritten = (html: string): Verdict<true> => (isBlankHtml(html) ? refuse('invalid', 'assist.nothingWritten') : accept(true));

/** ReqPre of WriteWithPrompt: the content of the email is still kept. */
export const contentIsKept = (bodyText: string): Verdict<true> => (bodyText ? accept(true) : refuse('gone', 'emails.contentErased'));

/**
 * Whether a reply may be handed to the mailbox (SendReply, FileReplyAsDraft): each clause in
 * the order it is checked.
 */
export function mayHandOver({ status, inFlight, html, to, cc }: { status: EmailStatus; inFlight: boolean; html: string; to: string[]; cc: string[] }): Verdict<true> {
  // ReqPre: the reply is not empty.
  if (isBlankHtml(html)) return refuse('invalid', 'reply.empty');
  // ReqPre: it goes to someone.
  if (!to.length) return refuse('invalid', 'reply.noRecipient');
  // ReqPre: every recipient is an address.
  const bad = [...to, ...cc].find((address) => !isEmailAddress(address));
  if (bad) return refuse('invalid', 'reply.invalidAddress', { address: bad });
  // DomPre: the email is not replied yet, and no reply to it is on its way.
  if (status === 'sent' || inFlight) return refuse('conflict', 'emails.alreadyHandled');
  return accept(true);
}

/** What a hand-over records once the mailbox has taken the reply. */
export interface HandOverRecord {
  text: string;
  promptId: number | null;
  proposedText: string | null;
  edited: boolean;
  /** Kept only when the proposal was edited: a reason for a change that did not happen means nothing. */
  reason: string;
}

/** What is recorded of a reply: its text, the proposal it started from, and whether the member changed it. */
export function handOverRecord(html: string, proposal: Pick<DraftRow, 'action' | 'ai_text' | 'prompt_id'> | undefined, changeReason: string): HandOverRecord {
  const text = htmlToText(html);
  const proposedText = proposal ? htmlToText(proposalHtml(proposal)) : null;
  const edited = proposal ? wasEdited(proposedText, text) : false;
  return { text, promptId: proposal?.prompt_id ?? null, proposedText, edited, reason: edited ? changeReason : '' };
}

/**
 * The prompt that writes a proposal nobody asked for: the one of a shared board that shows the
 * email, else the one suggested at triage, else the organisation's first. How the organisation
 * arranged its work comes before what the AI thought of one email.
 */
export const promptToPrepareWith = (boardPromptId: number | null, suggestedPromptId: number | null, prompts: PromptRow[]): PromptRow | undefined =>
  prompts.find((p) => p.id === boardPromptId) ?? prompts.find((p) => p.id === suggestedPromptId) ?? prompts[0];
