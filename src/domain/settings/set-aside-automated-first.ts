// SetAsideAutomatedFirst — an administrator says whether plainly automated mail is set aside
// by rule, before anything else looks at it.
//
//   DomPre   (none)
//   DomPost  it is, or it is not
//   ReqPre   the member is an administrator
import { isAdministrator } from '../computations/access.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function setAsideAutomatedFirst({ db }: World, actor: Actor, value: boolean): Promise<void> {
  accepted(isAdministrator(actor));
  await db.run('UPDATE organizations SET skip_automated = $1 WHERE id = $2', [value, actor.organization.id]);
}
