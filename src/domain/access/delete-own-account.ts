// DeleteOwnAccount — a member leaves saras: their account is deleted, by themselves.
//
//   DomPre   a member
//   DomPost  the member is gone, with their sessions
//   ReqPre   the origin is not locked out
//            the member gives their current password
//            not the last administrator of the organisation: they first appoint another, or
//            delete the organisation (DeleteOrganization)
//   ReqPost  a wrong password counts as a wrong guess
//            what belongs to the organisation outlives who created it: their prompts and their
//            shared mailboxes pass to the organisation's longest-standing other administrator
//            their personal mailboxes go with them, with what was stored from them (the database's doing)
import { verifyPassword } from '../../tooling/crypto.ts';
import { mayLeave } from '../computations/access.ts';
import { Refusal, accepted } from '../refusal.ts';
import { administratorsOf, forgetMember, handOverWhatTheyMade, longestStandingAdministrator } from '../state/members.ts';
import type { Actor, World } from '../world.ts';
import { withGuessingBrake } from './guessing-brake.ts';

export function deleteOwnAccount(world: World, origin: string, { member, organization }: Actor, given: { password?: unknown }): Promise<void> {
  return withGuessingBrake(world, origin, async () => {
    if (!verifyPassword(String(given.password || ''), member.password_hash)) throw new Refusal('unauthenticated', 'auth.wrongPassword');
    accepted(mayLeave(member.role, await administratorsOf(world.db, organization.id)));
    await world.db.transaction(async (tx) => {
      const heir = await longestStandingAdministrator(tx, organization.id, member.id);
      if (heir) await handOverWhatTheyMade(tx, member.id, heir);
      await forgetMember(tx, member.id);
    });
  });
}
