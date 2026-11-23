// GiveSecondFactor — someone whose password was accepted gives the code of their authenticator
// app, and is signed in. The first time, that code also makes the proposed secret theirs.
//
//   DomPre   a sign-in in progress for a member
//   DomPost  a session is open for the member; the sign-in in progress is over
//            the first time: the member has a second factor, and recovery codes
//   ReqPre   the origin is not locked out
//            the sign-in in progress has not run out (ten minutes)
//            the code is the one of the moment for the member's secret, and was not used before
//            — or it is one of their recovery codes, which is then spent
//   ReqPost  a wrong code counts as a wrong guess
//            the recovery codes are told once; only their hashes are kept
import { randomBytes } from 'node:crypto';
import { tokenHash } from '../../tooling/crypto.ts';
import { codeGiven, stepMatching, withoutRecoveryCode } from '../computations/second-factor.ts';
import { Refusal } from '../refusal.ts';
import { endSignIn, keepRecoveryCodes, keepSecondFactor, memberSigningIn, recordStepUsed } from '../state/second-factor.ts';
import type { MemberSigningIn } from '../state/second-factor.ts';
import { openSession } from '../state/sessions.ts';
import type { Session } from '../state/sessions.ts';
import type { World } from '../world.ts';
import { withGuessingBrake } from './guessing-brake.ts';

const wrongCode = (): Refusal => new Refusal('unauthenticated', 'auth.wrongCode');

/** Eight codes, each good once, to get in when the authenticator app is out of reach. */
const newRecoveryCodes = (): string[] => Array.from({ length: 8 }, () => randomBytes(5).toString('hex').replace(/^(.{5})/, '$1-'));

/** The first code makes the proposed secret the member's. */
async function setUp({ db, vault }: World, member: MemberSigningIn, code: string): Promise<string[]> {
  const step = stepMatching(vault.open<string>(member.proposed_secret_enc ?? ''), code, Date.now(), 0);
  if (step === null) throw wrongCode();
  const recoveryCodes = newRecoveryCodes();
  await keepSecondFactor(db, member.id, member.proposed_secret_enc!, recoveryCodes.map((recovery) => tokenHash(codeGiven(recovery))), step);
  return recoveryCodes;
}

/** A code of the moment, good once; else a recovery code, spent by this use. */
async function verify({ db, vault }: World, member: MemberSigningIn, code: string): Promise<void> {
  const step = stepMatching(vault.open<string>(member.totp_secret_enc!), code, Date.now(), member.totp_last_step);
  if (step !== null) return recordStepUsed(db, member.id, step);
  const left = withoutRecoveryCode(JSON.parse(member.recovery_codes_json), tokenHash(code));
  if (!left) throw wrongCode();
  await keepRecoveryCodes(db, member.id, left);
}

export interface SecondFactorGiven {
  session: Session;
  recoveryCodes?: string[];
}

export function giveSecondFactor(world: World, origin: string, signInId: string | null, code: unknown): Promise<SecondFactorGiven> {
  return withGuessingBrake(world, origin, async () => {
    const member = signInId ? await memberSigningIn(world.db, signInId) : undefined;
    if (!member) throw new Refusal('gone', 'auth.signInExpired');
    const recoveryCodes = member.totp_secret_enc ? void (await verify(world, member, codeGiven(code))) : await setUp(world, member, codeGiven(code));
    await endSignIn(world.db, signInId!);
    return { session: await openSession(world.db, member.id), recoveryCodes: recoveryCodes ?? undefined };
  });
}
