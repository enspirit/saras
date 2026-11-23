// The brake on guessing passwords and invitation links, around the operations a visitor may
// attempt: ten wrong guesses from one origin lock that origin out for fifteen minutes.
//
//   ReqPre   the origin is not locked out
//   ReqPost  a wrong guess (who one is not, or a link that opens nothing) counts; a right one does not
import { isLockedOut } from '../computations/access.ts';
import { Refusal } from '../refusal.ts';
import { countWrongGuess } from '../state/sessions.ts';
import type { World } from '../world.ts';

export async function withGuessingBrake<T>({ attempts }: World, origin: string, operation: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const seen = attempts.get(origin);
  if (isLockedOut(seen, now)) throw new Refusal('tooMany', 'request.tooManyAttempts');
  try {
    return await operation();
  } catch (e) {
    if (e instanceof Refusal && (e.kind === 'unauthenticated' || e.kind === 'notFound')) countWrongGuess(attempts, origin, seen, now);
    throw e;
  }
}
