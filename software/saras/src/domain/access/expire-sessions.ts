// ExpireSessions — the backend forgets the sessions whose time is up.
//
//   DomPre   sessions past their date
//   DomPost  they are gone
//   ReqTrig  every hour, and when the server starts
import { forgetExpiredPasswordResets } from '../state/password-resets.ts';
import { forgetExpiredSignIns } from '../state/second-factor.ts';
import { forgetExpiredSessions } from '../state/sessions.ts';
import type { Reach } from '../world.ts';

/** With them go the sign-ins that waited too long for a second factor, and the links to a new password that ran out. */
export async function expireSessions({ db }: Pick<Reach, 'db'>): Promise<void> {
  await forgetExpiredSessions(db);
  await forgetExpiredSignIns(db);
  await forgetExpiredPasswordResets(db);
}
