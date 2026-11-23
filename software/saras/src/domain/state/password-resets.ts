// State: the links that let a member choose a new password. Only the hash of a link's token is kept.
import { tokenHash } from '../../tooling/crypto.ts';
import type { Db } from '../../tooling/db.ts';
import type { UserRow } from '../model/member.ts';

export const RESET_MINUTES = 60;

/** One link per member: a new one replaces the one before. */
export async function keepPasswordReset(db: Db, memberId: number, token: string): Promise<void> {
  await db.run('DELETE FROM password_resets WHERE user_id = $1', [memberId]);
  await db.run(`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`, [tokenHash(token), memberId, RESET_MINUTES]);
}

/** Whether a link was made for this member in the last two minutes. */
export const askedRecently = async (db: Db, memberId: number): Promise<boolean> =>
  Boolean(await db.one(`SELECT 1 FROM password_resets WHERE user_id = $1 AND expires_at > now() + make_interval(mins => $2)`, [memberId, RESET_MINUTES - 2]));

/** The member a live link is for. */
export const memberResetting = (db: Db, token: unknown): Promise<UserRow | undefined> =>
  db.one<UserRow>(`SELECT u.* FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.token_hash = $1 AND r.expires_at > now()`, [tokenHash(token)]);

export const forgetPasswordResetsOf = async (db: Db, memberId: number): Promise<void> => void (await db.run('DELETE FROM password_resets WHERE user_id = $1', [memberId]));

export const forgetExpiredPasswordResets = (db: Db): Promise<number> => db.run('DELETE FROM password_resets WHERE expires_at <= now()');
