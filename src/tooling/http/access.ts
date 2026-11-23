// Routes: getting in, getting out, and leaving for good. The operations are in domain/access;
// those a visitor may attempt are braked against guessing, per origin.
import type { Response } from 'express';
import type { Admitted } from '../../../shared/access.ts';
import { acceptInvitation } from '../../domain/access/accept-invitation.ts';
import type { Admission } from '../../domain/access/admit.ts';
import { changePassword } from '../../domain/access/change-password.ts';
import { checkInvitation } from '../../domain/access/check-invitation.ts';
import { createOrganization } from '../../domain/access/create-organization.ts';
import { deleteOrganization } from '../../domain/access/delete-organization.ts';
import { deleteOwnAccount } from '../../domain/access/delete-own-account.ts';
import { giveSecondFactor } from '../../domain/access/give-second-factor.ts';
import { requestPasswordReset } from '../../domain/access/request-password-reset.ts';
import { checkPasswordReset, resetPassword } from '../../domain/access/reset-password.ts';
import { signIn } from '../../domain/access/sign-in.ts';
import { signOut } from '../../domain/access/sign-out.ts';
import { whatVisitorsAreTold } from '../../domain/observations/profile.ts';
import { actorOf, done, originOf } from './route.ts';
import type { Handle, Http, Route } from './route.ts';
import { endSession, forgetSignIn, keepSignIn, readCookie, startSession } from './session.ts';

const tellVisitors: Handle = async ({ world }, _req, res) => void res.json(await whatVisitorsAreTold(world));

/** Tells how far the person got: signed in, with their session, or asked for their second factor, with the sign-in that waits. */
function admitted(http: Http, res: Response, admission: Admission, status = 200): void {
  if ('session' in admission) startSession(http, res, admission.session);
  else keepSignIn(http, res, admission.waiting);
  const told: Admitted = 'session' in admission ? { ok: true } : { ok: true, secondFactor: admission.asked };
  res.status(status).json(told);
}

const signUp: Handle = async (http, req, res) => admitted(http, res, await createOrganization(http.world, originOf(req), req.body), 201);

const checkInvitationLink: Handle = async ({ world }, req, res) => void res.json(await checkInvitation(world, originOf(req), req.body.token));

const join: Handle = async (http, req, res) => admitted(http, res, await acceptInvitation(http.world, originOf(req), req.body), 201);

const logIn: Handle = async (http, req, res) => admitted(http, res, await signIn(http.world, originOf(req), req.body));

const secondFactor: Handle = async (http, req, res) => {
  const { session, recoveryCodes } = await giveSecondFactor(http.world, originOf(req), readCookie(req, 'signin'), req.body.code);
  forgetSignIn(http, res);
  startSession(http, res, session);
  res.json({ ok: true, recoveryCodes } satisfies Admitted);
};

const askPasswordReset: Handle = async ({ world }, req, res) => {
  await requestPasswordReset(world, req.body.email);
  done(res);
};

const checkResetLink: Handle = async ({ world }, req, res) => void res.json(await checkPasswordReset(world, originOf(req), req.body.token));

const chooseNewPassword: Handle = async ({ world }, req, res) => {
  await resetPassword(world, originOf(req), req.body);
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
  { method: 'post', path: '/auth/second-factor', handle: secondFactor, for: 'visitors' },
  { method: 'post', path: '/auth/password-reset', handle: askPasswordReset, for: 'visitors' },
  { method: 'post', path: '/auth/password-reset/check', handle: checkResetLink, for: 'visitors' },
  { method: 'put', path: '/auth/password-reset', handle: chooseNewPassword, for: 'visitors' },
  { method: 'post', path: '/auth/logout', handle: logOut },
  { method: 'put', path: '/auth/password', handle: newPassword },
  { method: 'delete', path: '/me', handle: leave },
  { method: 'delete', path: '/organization', handle: dissolve },
];
