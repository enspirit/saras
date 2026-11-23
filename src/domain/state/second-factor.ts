// State: the second factor of a member, and the sign-ins that wait for one.
import { randomToken } from '../../tooling/crypto.ts';
import type { Db } from '../../tooling/db.ts';
import type { UserRow } from '../model/member.ts';

/** How long someone who gave their password has to give their second factor. */
export const SIGN_IN_MINUTES = 10;

/** A sign-in in progress: the password was right, the second factor is awaited. */
export interface SignInInProgress {
  id: string;
  minutes: number;
}

/** A member whose sign-in waits, with the secret proposed to them when they are setting their second factor up. */
export type MemberSigningIn = UserRow & { proposed_secret_enc: string | null };

export async function beginSignIn(db: Db, memberId: number, sealedSecretProposed: string | null): Promise<SignInInProgress> {
  const id = randomToken();
  await db.run(`INSERT INTO sign_ins_in_progress (id, user_id, secret_enc, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))`, [id, memberId, sealedSecretProposed, SIGN_IN_MINUTES]);
  return { id, minutes: SIGN_IN_MINUTES };
}

export const memberSigningIn = (db: Db, id: string): Promise<MemberSigningIn | undefined> =>
  db.one<MemberSigningIn>(`SELECT u.*, p.secret_enc AS proposed_secret_enc FROM sign_ins_in_progress p JOIN users u ON u.id = p.user_id WHERE p.id = $1 AND p.expires_at > now()`, [id]);

export const endSignIn = async (db: Db, id: string): Promise<void> => void (await db.run('DELETE FROM sign_ins_in_progress WHERE id = $1', [id]));

export const forgetExpiredSignIns = (db: Db): Promise<number> => db.run('DELETE FROM sign_ins_in_progress WHERE expires_at <= now()');

/** The member has a second factor from now on: this secret, and these recovery codes. */
export const keepSecondFactor = async (db: Db, memberId: number, sealedSecret: string, recoveryHashes: string[], step: number): Promise<void> =>
  void (await db.run('UPDATE users SET totp_secret_enc = $1, recovery_codes_json = $2, totp_last_step = $3 WHERE id = $4', [sealedSecret, JSON.stringify(recoveryHashes), step, memberId]));

/** A code was accepted for this step: none at or before it is good any more. */
export const recordStepUsed = async (db: Db, memberId: number, step: number): Promise<void> => void (await db.run('UPDATE users SET totp_last_step = $1 WHERE id = $2', [step, memberId]));

export const keepRecoveryCodes = async (db: Db, memberId: number, hashes: string[]): Promise<void> =>
  void (await db.run('UPDATE users SET recovery_codes_json = $1 WHERE id = $2', [JSON.stringify(hashes), memberId]));

/** The member has no second factor any more: they set one up at their next sign-in. */
export const forgetSecondFactor = async (db: Db, memberId: number): Promise<void> =>
  void (await db.run(`UPDATE users SET totp_secret_enc = NULL, recovery_codes_json = '[]', totp_last_step = 0 WHERE id = $1`, [memberId]));
