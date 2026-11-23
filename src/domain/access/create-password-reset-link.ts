// CreatePasswordResetLink — an administrator gets, for a member who lost their password, a
// link to choose a new one, to hand to them.
//
//   DomPre   a member of the organisation
//   DomPost  a link to choose a new password exists for them, replacing any earlier one
//   ReqPre   the member who asks is an administrator
//   ReqPost  the link is told once, good once, for an hour; only its hash is kept
import type { PasswordResetLink } from '../../../shared/access.ts';
import { randomToken } from '../../tooling/crypto.ts';
import { isAdministrator } from '../computations/access.ts';
import { resetLink } from '../computations/password-reset.ts';
import { accepted } from '../refusal.ts';
import { memberOf } from '../state/members.ts';
import { keepPasswordReset, RESET_MINUTES } from '../state/password-resets.ts';
import type { Actor, World } from '../world.ts';

export async function createPasswordResetLink({ db, config }: World, actor: Actor, memberId: unknown): Promise<PasswordResetLink> {
  accepted(isAdministrator(actor));
  const member = await memberOf(db, actor.organization.id, memberId);
  const token = randomToken();
  await keepPasswordReset(db, member.id, token);
  return { link: resetLink(config.baseUrl, token), validMinutes: RESET_MINUTES };
}
