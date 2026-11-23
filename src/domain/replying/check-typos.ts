// CheckTypos — a member asks the AI to correct what they wrote, and nothing else.
//
//   DomPre   a text in the reply area
//   DomPost  a proposal for the email: the same text, corrected
//   ReqPre   the member may use the email's mailbox
//            something is written
//            a key is in force (the LLM refuses otherwise)
//   ReqPost  the email received is not sent to the LLM: only the member's text is
//            only what a reply may contain is kept of the answer
import { buildTyposMessages } from '../computations/llm-prompts.ts';
import { llmSettings } from '../computations/key-in-force.ts';
import { hasSomethingWritten } from '../computations/replying.ts';
import { accepted } from '../refusal.ts';
import { emailFor } from '../state/emails.ts';
import type { Actor, World } from '../world.ts';
import { writeProposal, writtenSoFar } from './proposal.ts';
import type { Proposal } from './proposal.ts';

export async function checkTypos(world: World, actor: Actor, request: { emailId: unknown; html: unknown }): Promise<Proposal> {
  const email = await emailFor(world.db, actor, request.emailId);
  const html = writtenSoFar(request.html);
  const settings = llmSettings(actor.organization, world);
  accepted(hasSomethingWritten(html));
  return writeProposal(world, { emailId: email.id, action: 'typos', promptId: null, messages: buildTyposMessages({ html }), ...settings });
}
