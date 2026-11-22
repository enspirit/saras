// WriteWithPrompt — a member asks the AI to write the reply the way one of the organisation's
// prompts describes, from the email received and from what they wrote: notes, instructions,
// a draft to rework, or nothing.
//
//   DomPre   an email whose content is still kept
//   DomPost  a proposal for the email, written with the prompt
//   ReqPre   the member may use the email's mailbox
//            the content of the email was not erased
//            the prompt is one of the organisation's
//            a key is in force (the LLM refuses otherwise)
//   ReqPost  written as the mailbox's address, ending with the member's signature
//            the member's past corrections on this prompt are taken into account
//            only what a reply may contain is kept of the answer
import { buildPromptMessages } from '../computations/llm-prompts.ts';
import { llmSettings } from '../computations/key-in-force.ts';
import { rowToEmail } from '../computations/emails.ts';
import { contentIsKept } from '../computations/replying.ts';
import { accepted } from '../refusal.ts';
import { emailFor } from '../state/emails.ts';
import { lessonsFor, promptOf } from '../state/prompts.ts';
import type { Actor, World } from '../world.ts';
import { writeProposal, writtenSoFar } from './proposal.ts';
import type { Proposal } from './proposal.ts';

export async function writeWithPrompt(world: World, actor: Actor, request: { emailId: unknown; html: unknown; promptId: unknown }): Promise<Proposal> {
  const { member, organization } = actor;
  const email = await emailFor(world.db, actor, request.emailId);
  const html = writtenSoFar(request.html);
  const settings = llmSettings(member, organization, world);
  accepted(contentIsKept(email.body_text));
  const prompt = await promptOf(world.db, organization.id, request.promptId);
  const messages = buildPromptMessages({
    email: rowToEmail(email),
    prompt: { systemPrompt: prompt.system_prompt },
    ownAddress: email.account_email,
    signature: member.signature,
    lessons: await lessonsFor(world.db, prompt.id, member.id),
    html,
  });
  return writeProposal(world, { emailId: email.id, action: 'prompt', promptId: prompt.id, messages, ...settings });
}
