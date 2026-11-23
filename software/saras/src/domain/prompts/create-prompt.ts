// CreatePrompt — an administrator adds a way of replying to the organisation's.
// AddReadyMadePrompt is this operation, called with the content of a template.
//
//   DomPre   (none: a prompt may always be added)
//   DomPost  the organisation has one more prompt, with this name, description and instructions
//   ReqPre   the member is an administrator
//            the prompt has a name and instructions
import { isAdministrator } from '../computations/access.ts';
import { promptContent } from '../computations/prompts.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function createPrompt({ db }: World, actor: Actor, given: { name?: unknown; description?: unknown; systemPrompt?: unknown; affinity?: unknown }): Promise<{ id: number }> {
  accepted(isAdministrator(actor));
  const content = accepted(promptContent(given));
  const created = await db.one<{ id: number }>('INSERT INTO prompts (org_id, user_id, name, description, system_prompt, affinity_json) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [
    actor.organization.id,
    actor.member.id,
    content.name,
    content.description,
    content.systemPrompt,
    JSON.stringify(content.affinity),
  ]);
  return { id: created!.id };
}
