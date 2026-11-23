// ChooseSorting — an administrator chooses who sorts the emails the organisation fetches:
// the first of the two steps an email goes through.
//
//   DomPre   (none)
//   DomPost  fetched emails are sorted by nobody (all are to handle), or by the AI, from the next fetch on
//   ReqPre   the member is an administrator
//            it is a way of sorting we know
//   ReqPost  what was fetched before stays as it was sorted (see SortAgainUnsorted)
import { isAdministrator } from '../computations/access.ts';
import { sortingGiven } from '../computations/settings.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function chooseSorting({ db }: World, actor: Actor, value: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const sorting = accepted(sortingGiven(value));
  await db.run('UPDATE organizations SET triage_strategy = $1 WHERE id = $2', [sorting, actor.organization.id]);
}
