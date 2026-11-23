// RemoveAdministratorRole — an administrator takes the administrator role away from a member.
//
//   DomPre   a member of the organisation
//   DomPost  the member is a user
//   ReqPre   the member who asks is an administrator
//            the organisation keeps at least one administrator
import type { Actor, World } from '../world.ts';
import { changeRole } from './change-role.ts';

export const removeAdministratorRole = (world: World, actor: Actor, memberId: unknown): Promise<void> => changeRole(world, actor, memberId, 'user');
