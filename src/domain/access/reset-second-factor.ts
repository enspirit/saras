// ResetSecondFactor — an administrator takes a member's second factor away, for one who lost
// their authenticator app and their recovery codes.
//
//   DomPre   a member of the organisation
//   DomPost  the member has no second factor, nor recovery codes; their sessions are closed
//   ReqPre   the member who asks is an administrator
//   ReqPost  where a second factor is required, the member sets a new one up at their next sign-in
import { isAdministrator } from '../computations/access.ts';
import { accepted } from '../refusal.ts';
import { memberOf } from '../state/members.ts';
import { forgetSecondFactor } from '../state/second-factor.ts';
import { closeSessionsOf } from '../state/sessions.ts';
import type { Actor, World } from '../world.ts';

export async function resetSecondFactor({ db }: World, actor: Actor, memberId: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const member = await memberOf(db, actor.organization.id, memberId);
  await db.transaction(async (tx) => {
    await forgetSecondFactor(tx, member.id);
    await closeSessionsOf(tx, member.id);
  });
}
