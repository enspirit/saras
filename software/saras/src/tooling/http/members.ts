// Routes: the members of an organisation and its invitations, for its administrators. The
// operations are in domain/access.
import { appointAdministrator } from '../../domain/access/appoint-administrator.ts';
import { createPasswordResetLink } from '../../domain/access/create-password-reset-link.ts';
import { deleteMember } from '../../domain/access/delete-member.ts';
import { inviteMember } from '../../domain/access/invite-member.ts';
import { removeAdministratorRole } from '../../domain/access/remove-administrator-role.ts';
import { resetSecondFactor } from '../../domain/access/reset-second-factor.ts';
import { revokeInvitation } from '../../domain/access/revoke-invitation.ts';
import { invitationsOf, membersOf } from '../../domain/observations/members.ts';
import { Refusal } from '../../domain/refusal.ts';
import { memberOf } from '../../domain/state/members.ts';
import { actorOf, done } from './route.ts';
import type { Handle, Route } from './route.ts';

const list: Handle = async ({ world }, req, res) => void res.json(await membersOf(world.db, req.org.id));

const invitations: Handle = async ({ world }, req, res) => void res.json(await invitationsOf(world.db, req.org.id));

const invite: Handle = async ({ world }, req, res) => void res.status(201).json(await inviteMember(world, actorOf(req), req.body));

const revoke: Handle = async ({ world }, req, res) => {
  await revokeInvitation(world, actorOf(req), req.params.id);
  done(res);
};

const remove: Handle = async ({ world }, req, res) => {
  await deleteMember(world, actorOf(req), req.params.id);
  done(res);
};

const resetLink: Handle = async ({ world }, req, res) => void res.status(201).json(await createPasswordResetLink(world, actorOf(req), req.params.id));

const resetFactor: Handle = async ({ world }, req, res) => {
  await resetSecondFactor(world, actorOf(req), req.params.id);
  done(res);
};

/** The role asked for says which of the two operations it is. */
const ROLE_CHANGES = { admin: appointAdministrator, user: removeAdministratorRole };

const changeRole: Handle = async ({ world }, req, res) => {
  const change = ROLE_CHANGES[String(req.body.role) as keyof typeof ROLE_CHANGES];
  if (!change) {
    // A member one may not see is not found, whatever else is wrong with the request.
    await memberOf(world.db, req.org.id, req.params.id);
    throw new Refusal('invalid', 'members.invalidRole');
  }
  await change(world, actorOf(req), req.params.id);
  done(res);
};

export const MEMBERS: Route[] = [
  { method: 'get', path: '/members', handle: list, for: 'administrators' },
  { method: 'get', path: '/invitations', handle: invitations, for: 'administrators' },
  { method: 'post', path: '/invitations', handle: invite },
  { method: 'delete', path: '/invitations/:id', handle: revoke },
  { method: 'delete', path: '/members/:id', handle: remove },
  { method: 'put', path: '/members/:id', handle: changeRole, for: 'administrators' },
  { method: 'post', path: '/members/:id/password-reset', handle: resetLink },
  { method: 'delete', path: '/members/:id/second-factor', handle: resetFactor },
];
