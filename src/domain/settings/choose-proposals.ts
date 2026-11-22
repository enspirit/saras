// ChooseProposals — an administrator chooses when proposals are written for the organisation.
//
//   DomPre   (none)
//   DomPost  proposals are written on demand, at fetch, or at fetch and filed in the mailbox
//   ReqPre   the member is an administrator
//            it is a way of preparing replies we know
import { isAdministrator } from '../computations/access.ts';
import { proposalsGiven } from '../computations/settings.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function chooseProposals({ db }: World, actor: Actor, value: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const proposals = accepted(proposalsGiven(value));
  await db.run('UPDATE organizations SET automation = $1 WHERE id = $2', [proposals, actor.organization.id]);
}
