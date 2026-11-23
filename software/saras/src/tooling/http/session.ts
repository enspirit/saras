// The session of a browser: the cookie that carries it, and the guards that read it.
import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { Refusal } from '../../domain/refusal.ts';
import { organizationById } from '../../domain/state/members.ts';
import { memberOfSession } from '../../domain/state/sessions.ts';
import type { SignInInProgress } from '../../domain/state/second-factor.ts';
import type { Session } from '../../domain/state/sessions.ts';
import type { World } from '../../domain/world.ts';
import type { Http } from './route.ts';

const cookieOptions = ({ world }: Http): CookieOptions => ({ httpOnly: true, sameSite: 'lax', secure: world.config.secureCookies, path: '/' });

export function readCookie(req: Request, name: string): string | null {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Has the browser keep a session just opened. */
export const startSession = (http: Http, res: Response, session: Session): void => void res.cookie('sid', session.id, { ...cookieOptions(http), maxAge: session.days * 86_400_000 });

/** Has the browser keep, for a few minutes, the sign-in that waits for a second factor. */
export const keepSignIn = (http: Http, res: Response, waiting: SignInInProgress): void => void res.cookie('signin', waiting.id, { ...cookieOptions(http), maxAge: waiting.minutes * 60_000 });

export const forgetSignIn = (http: Http, res: Response): void => void res.clearCookie('signin', cookieOptions(http));

/** Has the browser forget its session. */
export const endSession = (http: Http, res: Response): void => void res.clearCookie('sid', cookieOptions(http));

/** Lets signed-in members through, and says who they are and which organisation they act in. */
export const membersOnly = ({ db }: World): RequestHandler => async (req, _res, next) => {
  const sid = readCookie(req, 'sid');
  const member = sid ? await memberOfSession(db, sid) : undefined;
  if (!member) return next(new Refusal('unauthenticated', 'auth.signedOut'));
  req.user = member;
  req.org = await organizationById(db, member.org_id);
  next();
};

export const administratorsOnly: RequestHandler = (req, _res, next) => next(req.user.role === 'admin' ? undefined : new Refusal('forbidden', 'auth.adminOnly'));
