// ChooseWriting — an administrator chooses when proposals are written for the emails to
// handle: the second of the two steps an email goes through.
//
//   DomPre   (none)
//   DomPost  proposals are written on demand, at fetch, or at fetch and filed in the mailbox's drafts
//   ReqPre   the member is an administrator
//            it is one of those three: nothing sends by itself
import { isAdministrator } from '../computations/access.ts';
import { writingGiven } from '../computations/settings.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function chooseWriting({ db }: World, actor: Actor, value: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const writing = accepted(writingGiven(value));
  await db.run('UPDATE organizations SET automation = $1 WHERE id = $2', [writing, actor.organization.id]);
}
