// State: who is signed in from which browser, and the wrong guesses of those who are not.
import { randomToken } from '../../tooling/crypto.ts';
import type { Db } from '../../tooling/db.ts';
import type { UserRow } from '../../types.ts';
import { LOCK_OUT_MS, opensNewWindow } from '../computations/access.ts';
import type { Attempts } from '../computations/access.ts';

export const SESSION_DAYS = 30;

/** A session just opened: what the browser must keep, and for how long. */
export interface Session {
  id: string;
  days: number;
}

export async function openSession(db: Db, memberId: number): Promise<Session> {
  const id = randomToken();
  await db.run(`INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`, [id, memberId, SESSION_DAYS]);
  return { id, days: SESSION_DAYS };
}

export const closeSession = (db: Db, id: string): Promise<number> => db.run('DELETE FROM sessions WHERE id = $1', [id]);

/** Closes every session of a member but this one. */
export const closeOtherSessions = (db: Db, memberId: number, keptId: string): Promise<number> => db.run('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [memberId, keptId]);

/** A member as their session shows them: with the session's own number, and the OAuth round trip in progress. */
export type SessionMember = UserRow & { sid: string; oauth_state: string | null };

/** The member a live session belongs to. */
export const memberOfSession = (db: Db, id: string): Promise<SessionMember | undefined> =>
  db.one<SessionMember>(`SELECT u.*, s.id AS sid, s.oauth_state FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > now()`, [id]);

export const forgetExpiredSessions = (db: Db): Promise<number> => db.run(`DELETE FROM sessions WHERE expires_at <= now()`);

/** Counts a wrong guess from this origin: in a new window of fifteen minutes, or in the one in progress. */
export function countWrongGuess(attempts: Map<string, Attempts>, origin: string, seen: Attempts | undefined, now: number): void {
  if (opensNewWindow(seen, now)) attempts.set(origin, { count: 1, reset: now + LOCK_OUT_MS });
  else seen!.count += 1;
}

/** A sign-in under way at a mail host, remembered with the session that started it. */
export const rememberHostSignIn = async (db: Db, sessionId: string, remembered: string): Promise<void> =>
  void (await db.run('UPDATE sessions SET oauth_state = $1 WHERE id = $2', [remembered, sessionId]));
export const forgetHostSignIn = async (db: Db, sessionId: string): Promise<void> => void (await db.run('UPDATE sessions SET oauth_state = NULL WHERE id = $1', [sessionId]));
