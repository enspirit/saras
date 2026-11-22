// Routes: getting in, getting out, and leaving for good. The operations are in domain/access;
// those a visitor may attempt are braked against guessing, per origin.
import { acceptInvitation } from '../../domain/access/accept-invitation.ts';
import { changePassword } from '../../domain/access/change-password.ts';
import { checkInvitation } from '../../domain/access/check-invitation.ts';
import { createOrganization } from '../../domain/access/create-organization.ts';
import { deleteOrganization } from '../../domain/access/delete-organization.ts';
import { deleteOwnAccount } from '../../domain/access/delete-own-account.ts';
import { signIn } from '../../domain/access/sign-in.ts';
import { signOut } from '../../domain/access/sign-out.ts';
import { whatVisitorsAreTold } from '../../domain/observations/profile.ts';
import { actorOf, done, originOf } from './route.ts';
import type { Handle, Route } from './route.ts';
import { endSession, startSession } from './session.ts';

const tellVisitors: Handle = async ({ world }, _req, res) => void res.json(await whatVisitorsAreTold(world));

const signUp: Handle = async (http, req, res) => {
  startSession(http, res, await createOrganization(http.world, originOf(req), req.body));
  res.status(201).json({ ok: true });
};

const checkInvitationLink: Handle = async ({ world }, req, res) => void res.json(await checkInvitation(world, originOf(req), req.body.token));

const join: Handle = async (http, req, res) => {
  startSession(http, res, await acceptInvitation(http.world, originOf(req), req.body));
  res.status(201).json({ ok: true });
};

const logIn: Handle = async (http, req, res) => {
  startSession(http, res, await signIn(http.world, originOf(req), req.body));
  done(res);
};

const logOut: Handle = async (http, req, res) => {
  await signOut(http.world, req.user.sid);
  endSession(http, res);
  done(res);
};

const newPassword: Handle = async ({ world }, req, res) => {
  await changePassword(world, originOf(req), actorOf(req), req.user.sid, req.body);
  done(res);
};

const leave: Handle = async (http, req, res) => {
  await deleteOwnAccount(http.world, originOf(req), actorOf(req), req.body);
  endSession(http, res);
  done(res);
};

const dissolve: Handle = async (http, req, res) => {
  await deleteOrganization(http.world, originOf(req), actorOf(req), req.body);
  endSession(http, res);
  done(res);
};

export const ACCESS: Route[] = [
  { method: 'get', path: '/public', handle: tellVisitors, for: 'visitors' },
  { method: 'post', path: '/auth/signup', handle: signUp, for: 'visitors' },
  { method: 'post', path: '/invitations/check', handle: checkInvitationLink, for: 'visitors' },
  { method: 'post', path: '/invitations/accept', handle: join, for: 'visitors' },
  { method: 'post', path: '/auth/login', handle: logIn, for: 'visitors' },
  { method: 'post', path: '/auth/logout', handle: logOut },
  { method: 'put', path: '/auth/password', handle: newPassword },
  { method: 'delete', path: '/me', handle: leave },
  { method: 'delete', path: '/organization', handle: dissolve },
];
