// ResetPassword — someone holding a link to choose a new password chooses it.
// CheckPasswordReset tells first whose password the link is for.
//
//   DomPre   a live link for a member
//   DomPost  the member's password is the new one; the link is spent; all their sessions are closed
//   ReqPre   the origin is not locked out
//            the link is live: not used, not replaced, less than an hour old
//            the new password has ten characters or more
//   ReqPost  a link that opens nothing counts as a wrong guess
//            nobody is signed in by it: the member signs in, second factor included where required
import { hashPassword } from '../../tooling/crypto.ts';
import { isLongEnough } from '../computations/access.ts';
import type { UserRow } from '../model/member.ts';
import { Refusal, accepted } from '../refusal.ts';
import { setPassword } from '../state/members.ts';
import { forgetPasswordResetsOf, memberResetting } from '../state/password-resets.ts';
import { closeSessionsOf } from '../state/sessions.ts';
import type { World } from '../world.ts';
import { withGuessingBrake } from './guessing-brake.ts';

async function memberOfLink({ db }: World, token: unknown): Promise<UserRow> {
  const member = await memberResetting(db, token);
  if (!member) throw new Refusal('notFound', 'auth.resetInvalid');
  return member;
}

export const checkPasswordReset = (world: World, origin: string, token: unknown): Promise<{ email: string }> =>
  withGuessingBrake(world, origin, async () => ({ email: (await memberOfLink(world, token)).email }));

export function resetPassword(world: World, origin: string, given: { token?: unknown; password?: unknown }): Promise<void> {
  return withGuessingBrake(world, origin, async () => {
    const member = await memberOfLink(world, given.token);
    const password = accepted(isLongEnough(given.password));
    await world.db.transaction(async (tx) => {
      await setPassword(tx, member.id, hashPassword(password));
      await forgetPasswordResetsOf(tx, member.id);
      await closeSessionsOf(tx, member.id);
    });
  });
}
