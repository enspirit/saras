// ChooseSorting — an administrator chooses who sorts the emails the organisation fetches.
//
//   DomPre   (none)
//   DomPost  fetched emails are sorted this way: by nobody, or by the AI
//   ReqPre   the member is an administrator
//            it is a way of sorting we know
import { isAdministrator } from '../computations/access.ts';
import { sortingGiven } from '../computations/settings.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function chooseSorting({ db }: World, actor: Actor, value: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const sorting = accepted(sortingGiven(value));
  await db.run('UPDATE organizations SET triage_strategy = $1 WHERE id = $2', [sorting, actor.organization.id]);
}
