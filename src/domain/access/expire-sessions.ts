// ExpireSessions — the backend forgets the sessions whose time is up.
//
//   DomPre   sessions past their date
//   DomPost  they are gone
//   ReqTrig  every hour, and when the server starts
import { forgetExpiredSessions } from '../state/sessions.ts';
import type { Reach } from '../world.ts';

export const expireSessions = async ({ db }: Pick<Reach, 'db'>): Promise<void> => void (await forgetExpiredSessions(db));
