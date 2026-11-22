// DeleteMember — an administrator removes a member from the organisation.
//
//   DomPre   a member of the organisation
//   DomPost  the member is gone
//   ReqPre   the member who asks is an administrator
//            not oneself
//   ReqPost  what belongs to the organisation outlives who created it: their prompts and
//            their shared mailboxes pass to the administrator who deletes them
//            their personal mailboxes go with them, with what was stored from them (the database's doing)
import { isAdministrator, mayDeleteMember } from '../computations/access.ts';
import { accepted } from '../refusal.ts';
import { memberOf } from '../state/members.ts';
import type { Actor, World } from '../world.ts';

export async function deleteMember({ db }: World, actor: Actor, memberId: unknown): Promise<void> {
  accepted(isAdministrator(actor));
  const target = await memberOf(db, actor.organization.id, memberId);
  accepted(mayDeleteMember(target.id, actor.member.id));
  await db.transaction(async (tx) => {
    await tx.run('UPDATE prompts SET user_id = $1 WHERE user_id = $2', [actor.member.id, target.id]);
    await tx.run('UPDATE accounts SET user_id = $1 WHERE user_id = $2 AND shared', [actor.member.id, target.id]);
    await tx.run('DELETE FROM users WHERE id = $1', [target.id]);
  });
}
