// SetOrganizationModel — an administrator chooses the model members write with unless they
// chose their own, or goes back to the server's.
//
//   DomPre   (none)
//   DomPost  the organisation's model is this one, or none: the server's then applies
//   ReqPre   the member is an administrator
//            it is named "provider/model"
import { isAdministrator } from '../computations/access.ts';
import { modelGiven } from '../computations/settings.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function setOrganizationModel({ db }: World, actor: Actor, value: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const model = accepted(modelGiven(value));
  await db.run('UPDATE organizations SET model = $1 WHERE id = $2', [model, actor.organization.id]);
}
