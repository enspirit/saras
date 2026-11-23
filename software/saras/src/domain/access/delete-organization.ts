// DeleteOrganization — an administrator deletes the organisation and all saras holds for it.
//
//   DomPre   an organisation
//   DomPost  it is gone, with its members and their sessions, its invitations, its prompts,
//            its mailboxes and the emails, proposals and replies kept from them
//   ReqPre   the origin is not locked out
//            the member is an administrator
//            the member gives their current password
//            the member gives the organisation's name, as it is
//   ReqPost  a wrong password counts as a wrong guess
//            nothing changes in the mailboxes themselves
//            the other members are not told (they find themselves signed out)
import { verifyPassword } from '../../tooling/crypto.ts';
import { isAdministrator, namesTheOrganization } from '../computations/access.ts';
import { Refusal, accepted } from '../refusal.ts';
import { forgetOrganization } from '../state/members.ts';
import type { Actor, World } from '../world.ts';
import { withGuessingBrake } from './guessing-brake.ts';

export function deleteOrganization(world: World, origin: string, actor: Actor, given: { password?: unknown; name?: unknown }): Promise<void> {
  return withGuessingBrake(world, origin, async () => {
    accepted(isAdministrator(actor));
    if (!verifyPassword(String(given.password || ''), actor.member.password_hash)) throw new Refusal('unauthenticated', 'auth.wrongPassword');
    accepted(namesTheOrganization(given.name, actor.organization.name));
    await forgetOrganization(world.db, actor.organization.id);
  });
}
