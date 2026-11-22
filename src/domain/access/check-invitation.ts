// CheckInvitation — a visitor opens an invitation link and is told what it is for.
//
//   DomPre   (none)
//   DomPost  the address and the organisation of the invitation are told
//   ReqPre   the origin is not locked out
//            the link opens a pending invitation
//   ReqPost  a link that opens nothing counts as a wrong guess
import type { InvitationOpened } from '../../../shared/member.ts';
import { Refusal } from '../refusal.ts';
import { pendingInvitation } from '../state/invitations.ts';
import { organizationById } from '../state/members.ts';
import type { World } from '../world.ts';
import { withGuessingBrake } from './guessing-brake.ts';

export function checkInvitation(world: World, origin: string, token: unknown): Promise<InvitationOpened> {
  return withGuessingBrake(world, origin, async () => {
    const invitation = await pendingInvitation(world.db, token);
    if (!invitation) throw new Refusal('notFound', 'invitation.invalid');
    return { email: invitation.email, organization: (await organizationById(world.db, invitation.org_id)).name };
  });
}
