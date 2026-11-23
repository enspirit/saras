// SignIn — a visitor proves who they are and becomes a signed-in member.
//
//   DomPre   (none)
//   DomPost  the member with this address is admitted: a session, or a sign-in waiting for their second factor (see admit.ts)
//   ReqPre   the origin is not locked out
//            the address and the password are those of a member
//   ReqPost  a refusal does not say which of the two was wrong, and counts as a wrong guess
import { verifyPassword } from '../../tooling/crypto.ts';
import { addressGiven } from '../computations/given.ts';
import { Refusal } from '../refusal.ts';
import { memberByAddress } from '../state/members.ts';
import type { World } from '../world.ts';
import { admit } from './admit.ts';
import type { Admission } from './admit.ts';
import { withGuessingBrake } from './guessing-brake.ts';

export function signIn(world: World, origin: string, given: { email?: unknown; password?: unknown }): Promise<Admission> {
  return withGuessingBrake(world, origin, async () => {
    const member = await memberByAddress(world.db, addressGiven(given.email));
    if (!member || !verifyPassword(String(given.password || ''), member.password_hash)) throw new Refusal('unauthenticated', 'auth.invalidCredentials');
    return admit(world, member.id);
  });
}
