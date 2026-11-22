// AppointAdministrator — an administrator gives a member the administrator role.
//
//   DomPre   a member of the organisation
//   DomPost  the member is an administrator
//   ReqPre   the member who asks is an administrator
import type { Actor, World } from '../world.ts';
import { changeRole } from './change-role.ts';

export const appointAdministrator = (world: World, actor: Actor, memberId: unknown): Promise<void> => changeRole(world, actor, memberId, 'admin');
