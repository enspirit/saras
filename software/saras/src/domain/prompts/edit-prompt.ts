// EditPrompt — an administrator changes the name, the description, the instructions of a prompt,
// or the emails it suits.
//
//   DomPre   a prompt of the organisation
//   DomPost  the prompt has this name, description and instructions, and suits the emails with these values
//   ReqPre   the member is an administrator
//            the prompt has a name and instructions
//            the prompt is one of the organisation's
import { isAdministrator } from '../computations/access.ts';
import { promptContent } from '../computations/prompts.ts';
import { accepted } from '../refusal.ts';
import { promptOf } from '../state/prompts.ts';
import type { Actor, World } from '../world.ts';

export async function editPrompt({ db }: World, actor: Actor, promptId: unknown, given: { name?: unknown; description?: unknown; systemPrompt?: unknown; affinity?: unknown }): Promise<void> {
  accepted(isAdministrator(actor));
  const content = accepted(promptContent(given));
  const prompt = await promptOf(db, actor.organization.id, promptId);
  await db.run('UPDATE prompts SET name = $1, description = $2, system_prompt = $3, affinity_json = $4 WHERE id = $5', [content.name, content.description, content.systemPrompt, JSON.stringify(content.affinity), prompt.id]);
}
