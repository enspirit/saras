// SignIn — a visitor proves who they are and becomes a signed-in member.
//
//   DomPre   (none)
//   DomPost  a session is open for the member with this address
//   ReqPre   the origin is not locked out
//            the address and the password are those of a member
//   ReqPost  a refusal does not say which of the two was wrong, and counts as a wrong guess
import { verifyPassword } from '../../tooling/crypto.ts';
import { addressGiven } from '../computations/given.ts';
import { Refusal } from '../refusal.ts';
import { memberByAddress } from '../state/members.ts';
import { openSession } from '../state/sessions.ts';
import type { Session } from '../state/sessions.ts';
import type { World } from '../world.ts';
import { withGuessingBrake } from './guessing-brake.ts';

export function signIn(world: World, origin: string, given: { email?: unknown; password?: unknown }): Promise<Session> {
  return withGuessingBrake(world, origin, async () => {
    const member = await memberByAddress(world.db, addressGiven(given.email));
    if (!member || !verifyPassword(String(given.password || ''), member.password_hash)) throw new Refusal('unauthenticated', 'auth.invalidCredentials');
    return openSession(world.db, member.id);
  });
}
