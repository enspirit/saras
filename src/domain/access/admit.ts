// Admitting someone whose password was just accepted, or whose account was just opened: a
// session at once, or, where the installation requires a second factor, a sign-in that waits
// for it. The end of SignIn, CreateOrganization and AcceptInvitation.
//
//   DomPost  a session is open for the member — or a sign-in is in progress for them
//   ReqPost  where a second factor is required, no session is opened before it is given
//            a member who has none yet is proposed a secret to put in their authenticator app
import { randomBytes } from 'node:crypto';
import type { SecondFactorAsked } from '../../../shared/access.ts';
import { authenticatorUri, base32 } from '../computations/second-factor.ts';
import type { UserRow } from '../model/member.ts';
import { memberById } from '../state/members.ts';
import { beginSignIn } from '../state/second-factor.ts';
import type { SignInInProgress } from '../state/second-factor.ts';
import { openSession } from '../state/sessions.ts';
import type { Session } from '../state/sessions.ts';
import type { World } from '../world.ts';

export type Admission = { session: Session } | { waiting: SignInInProgress; asked: SecondFactorAsked };

/** Who issues the codes, as authenticator apps show it. */
const ISSUER = 'saras';

/** A member without a second factor is proposed a secret; it becomes theirs once they give a code made with it. */
async function askToEnrol({ db, vault }: World, member: UserRow): Promise<Admission> {
  const secret = base32(randomBytes(20));
  const waiting = await beginSignIn(db, member.id, vault.seal(secret));
  return { waiting, asked: { step: 'enrol', secret, uri: authenticatorUri(ISSUER, member.email, secret) } };
}

export async function admit(world: World, memberId: number): Promise<Admission> {
  if (!world.config.secondFactor) return { session: await openSession(world.db, memberId) };
  const member = await memberById(world.db, memberId);
  if (!member.totp_secret_enc) return askToEnrol(world, member);
  return { waiting: await beginSignIn(world.db, member.id, null), asked: { step: 'code' } };
}
