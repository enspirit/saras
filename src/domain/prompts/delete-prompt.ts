// DeletePrompt — an administrator removes a prompt from the organisation's.
//
//   DomPre   a prompt of the organisation
//   DomPost  the prompt is gone
//   ReqPre   the member is an administrator
//            the prompt is one of the organisation's
//   ReqPost  the emails it was suggested for, and the proposals and replies written with it,
//            remain, without it (the database's doing)
import { isAdministrator } from '../computations/access.ts';
import { accepted } from '../refusal.ts';
import { promptOf } from '../state/prompts.ts';
import type { Actor, World } from '../world.ts';

export async function deletePrompt({ db }: World, actor: Actor, promptId: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const prompt = await promptOf(db, actor.organization.id, promptId);
  await db.run('DELETE FROM prompts WHERE id = $1', [prompt.id]);
}
