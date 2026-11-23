// AcceptInvitation — an invited person chooses a password and joins the organisation.
//
//   DomPre   a pending, unexpired invitation
//   DomPost  a member with the invitation's address and role, signed in; the invitation is gone
//   ReqPre   the origin is not locked out
//            the link opens a pending invitation
//            the password has ten characters or more
//            nobody took the address meanwhile
import { clipped, languageGiven } from '../computations/given.ts';
import { Refusal } from '../refusal.ts';
import { forgetInvitation, pendingInvitation } from '../state/invitations.ts';
import type { World } from '../world.ts';
import { admit } from './admit.ts';
import type { Admission } from './admit.ts';
import { withGuessingBrake } from './guessing-brake.ts';
import { openAccount } from './open-account.ts';

export function acceptInvitation(world: World, origin: string, given: { token?: unknown; password?: unknown; name?: unknown; language?: unknown }): Promise<Admission> {
  const { db } = world;
  return withGuessingBrake(world, origin, async () => {
    const invitation = await pendingInvitation(db, given.token);
    if (!invitation) throw new Refusal('notFound', 'invitation.invalid');
    const memberId = await db.transaction(async (tx) => {
      const id = await openAccount(tx, { organizationId: invitation.org_id, address: invitation.email, password: given.password, role: invitation.role, language: languageGiven(given.language), name: clipped(given.name, 120) });
      await forgetInvitation(tx, invitation.id);
      return id;
    });
    return admit(world, memberId);
  });
}
