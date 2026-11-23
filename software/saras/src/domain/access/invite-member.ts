// InviteMember — an administrator creates a link that lets one person join the organisation.
//
//   DomPre   (none: an earlier invitation to the same address is replaced)
//   DomPost  a pending invitation for this address, with a role and an expiry
//   ReqPre   the member is an administrator
//            the address is one
//            nobody has this address yet
//   ReqPost  the link is told once, here: only the hash of its token is kept
//            saras has no mailbox of its own, so the administrator passes the link on
import type { NewInvitation } from '../../../shared/member.ts';
import { randomToken } from '../../tooling/crypto.ts';
import { addressIsFree, isAdministrator, isAnAddress, roleInvitedAs } from '../computations/access.ts';
import { addressGiven } from '../computations/given.ts';
import { accepted } from '../refusal.ts';
import { keepInvitation } from '../state/invitations.ts';
import { addressIsTaken } from '../state/members.ts';
import type { Actor, World } from '../world.ts';

export async function inviteMember({ db, config }: World, actor: Actor, given: { email?: unknown; role?: unknown }): Promise<NewInvitation> {
  accepted(isAdministrator(actor));
  const address = addressGiven(given.email);
  accepted(isAnAddress(address));
  accepted(addressIsFree(await addressIsTaken(db, address)));
  const token = randomToken();
  const id = await keepInvitation(db, { organizationId: actor.organization.id, address, role: roleInvitedAs(given.role), token, invitedBy: actor.member.id, days: config.invitationDays });
  return { id, email: address, link: `${config.baseUrl}/#/invitation/${token}`, validDays: config.invitationDays };
}
