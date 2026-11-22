// What the three kinds of AI help have in common: ask the LLM, keep of its answer only what
// a reply may contain, and keep the result as a proposal for the email.
import { sanitizeHtml, stripCodeFence } from '../../tooling/html.ts';
import type { AssistAction, ChatMessage } from '../../types.ts';
import { keepProposal } from '../state/proposals.ts';
import type { Reach } from '../world.ts';

/** A proposal as the member receives it. */
export interface Proposal {
  id: number;
  action: AssistAction;
  promptId: number | null;
  model: string;
  /** The provider the request was routed to, when it is known. */
  provider: string | null;
  html: string;
}

/** What the member wrote, reduced to what a reply may contain, however it arrived. */
export const writtenSoFar = (html: unknown): string => sanitizeHtml(typeof html === 'string' ? html.slice(0, 200_000) : '');

/** Asks the LLM and keeps its answer as a proposal. `keyAndModel` are those in force for whoever asks. */
export async function writeProposal(
  { db, llm }: Reach,
  ask: { emailId: number; action: AssistAction; promptId: number | null; messages: ChatMessage[]; apiKey: string; model: string },
): Promise<Proposal> {
  const answer = await llm.chat({ apiKey: ask.apiKey, model: ask.model, messages: ask.messages, maxTokens: 3000 });
  // Whatever the model returned, only the elements a reply may contain are kept.
  const html = sanitizeHtml(stripCodeFence(answer.text));
  const id = await keepProposal(db, { emailId: ask.emailId, action: ask.action, promptId: ask.promptId, model: answer.model, html });
  return { id, action: ask.action, promptId: ask.promptId, model: answer.model, provider: answer.provider, html };
}
