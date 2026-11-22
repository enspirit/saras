// What AppointAdministrator and RemoveAdministratorRole have in common: an administrator
// changes the role of a member of the organisation.
import type { Role } from '../../types.ts';
import { isAdministrator, mayRemoveAdministratorRole } from '../computations/access.ts';
import { accepted } from '../refusal.ts';
import { administratorsOf, memberOf } from '../state/members.ts';
import type { Actor, World } from '../world.ts';

export async function changeRole({ db }: World, actor: Actor, memberId: unknown, role: Role): Promise<void> {
  accepted(isAdministrator(actor));
  const target = await memberOf(db, actor.organization.id, memberId);
  if (role === 'user') accepted(mayRemoveAdministratorRole(target.role, await administratorsOf(db, actor.organization.id)));
  await db.run('UPDATE users SET role = $1 WHERE id = $2', [role, target.id]);
}
