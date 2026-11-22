// ChangePassword — a member replaces the password they sign in with.
//
//   DomPre   (none)
//   DomPost  the member's password is the new one
//            the member's other sessions are closed: only the one that made the change stays
//   ReqPre   the origin is not locked out
//            the member gives their current password
//            the new one has ten characters or more
//   ReqPost  a wrong current password counts as a wrong guess
import { hashPassword, verifyPassword } from '../../tooling/crypto.ts';
import { isLongEnough } from '../computations/access.ts';
import { Refusal, accepted } from '../refusal.ts';
import { setPassword } from '../state/members.ts';
import { closeOtherSessions } from '../state/sessions.ts';
import type { Actor, World } from '../world.ts';
import { withGuessingBrake } from './guessing-brake.ts';

export function changePassword(world: World, origin: string, { member }: Actor, sessionId: string, given: { current?: unknown; next?: unknown }): Promise<void> {
  return withGuessingBrake(world, origin, async () => {
    if (!verifyPassword(String(given.current || ''), member.password_hash)) throw new Refusal('unauthenticated', 'auth.wrongPassword');
    const next = accepted(isLongEnough(given.next));
    await world.db.transaction(async (tx) => {
      await setPassword(tx, member.id, hashPassword(next));
      await closeOtherSessions(tx, member.id, sessionId);
    });
  });
}
