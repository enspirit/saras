// SignOut — a member ends their session.
//
//   DomPre   a session
//   DomPost  the session is gone
import { closeSession } from '../state/sessions.ts';
import type { World } from '../world.ts';

export const signOut = async ({ db }: World, sessionId: string): Promise<void> => void (await closeSession(db, sessionId));
