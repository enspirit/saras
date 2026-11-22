// ChooseWayOfWorking — an administrator chooses how the organisation works: who sorts what
// is fetched, when proposals are written, where they wait.
//
//   DomPre   (none)
//   DomPost  the organisation works this way, from the next fetch on
//   ReqPre   the member is an administrator
//            it is one of the four ways
//   ReqPost  what was fetched before stays as it was sorted (see SortAgainUnsorted)
import { isAdministrator } from '../computations/access.ts';
import { WAYS, wayGiven } from '../computations/way-of-working.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function chooseWayOfWorking({ db }: World, actor: Actor, value: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const { sorting, proposals } = WAYS[accepted(wayGiven(value))];
  await db.run('UPDATE organizations SET triage_strategy = $1, automation = $2 WHERE id = $3', [sorting, proposals, actor.organization.id]);
}
