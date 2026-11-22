// ImproveStyle — a member asks the AI to reword what they wrote, keeping its meaning.
//
//   DomPre   a text in the reply area
//   DomPost  a proposal for the email: the same text, reworded
//   ReqPre   the member may use the email's mailbox
//            something is written
//            a key is in force (the LLM refuses otherwise)
//   ReqPost  the email received is not sent to the LLM: only the member's text is
//            only what a reply may contain is kept of the answer
import { buildStyleMessages } from '../computations/llm-prompts.ts';
import { llmSettings } from '../computations/key-in-force.ts';
import { hasSomethingWritten } from '../computations/replying.ts';
import { accepted } from '../refusal.ts';
import { emailFor } from '../state/emails.ts';
import type { Actor, World } from '../world.ts';
import { writeProposal, writtenSoFar } from './proposal.ts';
import type { Proposal } from './proposal.ts';

export async function improveStyle(world: World, actor: Actor, request: { emailId: unknown; html: unknown }): Promise<Proposal> {
  const email = await emailFor(world.db, actor, request.emailId);
  const html = writtenSoFar(request.html);
  const settings = llmSettings(actor.member, actor.organization, world);
  accepted(hasSomethingWritten(html));
  return writeProposal(world, { emailId: email.id, action: 'style', promptId: null, messages: buildStyleMessages({ html }), ...settings });
}
