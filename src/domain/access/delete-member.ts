// DeleteMember — an administrator removes a member from the organisation.
//
//   DomPre   a member of the organisation
//   DomPost  the member is gone
//   ReqPre   the member who asks is an administrator
//            not oneself (that is DeleteOwnAccount)
//   ReqPost  what belongs to the organisation outlives who created it: their prompts and
//            their shared mailboxes pass to the administrator who deletes them
//            their personal mailboxes go with them, with what was stored from them (the database's doing)
import { isAdministrator, mayDeleteMember } from '../computations/access.ts';
import { accepted } from '../refusal.ts';
import { forgetMember, handOverWhatTheyMade, memberOf } from '../state/members.ts';
import type { Actor, World } from '../world.ts';

export async function deleteMember({ db }: World, actor: Actor, memberId: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const target = await memberOf(db, actor.organization.id, memberId);
  accepted(mayDeleteMember(target.id, actor.member.id));
  await db.transaction(async (tx) => {
    await handOverWhatTheyMade(tx, target.id, actor.member.id);
    await forgetMember(tx, target.id);
  });
}
