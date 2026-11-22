// ChooseOwnModel — a member chooses the model that writes for them, or goes back to the organisation's.
//
//   DomPre   (none)
//   DomPost  the member's model is this one, or none: the organisation's then applies
//   ReqPre   it is named "provider/model"
import { modelGiven } from '../computations/settings.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function chooseOwnModel({ db }: World, { member }: Actor, value: unknown): Promise<void> {
  const model = accepted(modelGiven(value));
  await db.run('UPDATE users SET model = $1 WHERE id = $2', [model, member.id]);
}
