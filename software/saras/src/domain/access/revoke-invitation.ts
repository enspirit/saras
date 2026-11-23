// RevokeInvitation — an administrator withdraws an invitation before it is accepted.
//
//   DomPre   a pending invitation of the organisation
//   DomPost  the invitation is gone
//   ReqPre   the member is an administrator
import { isAdministrator } from '../computations/access.ts';
import { accepted } from '../refusal.ts';
import { forgetInvitationOf } from '../state/invitations.ts';
import type { Actor, World } from '../world.ts';

export async function revokeInvitation({ db }: World, actor: Actor, invitationId: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  await forgetInvitationOf(db, actor.organization.id, invitationId);
}
