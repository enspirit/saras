// What is logged of a request: that it came, how it was answered and in how long — or that
// whoever asked left before the answer, which is what a gateway giving up (a 504) looks like
// from here. Never its body, its query or its cookies: they hold mail and secrets.
import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { about, log } from '../log.ts';
import type { Fields } from '../log.ts';

const GIVEN_ID = /^[\w.:-]{1,64}$/;

/** The id a gateway gave the request, so that its log and this one are read together; one of ours otherwise. */
function idOf(req: Request): string {
  const given = req.get('x-request-id') ?? '';
  return GIVEN_ID.test(given) ? given : randomUUID();
}

const isApi = (req: Request): boolean => req.path === '/api' || req.path.startsWith('/api/');

/** The route as it is declared (`/api/mailboxes/:id`), not the address asked for; a file of the interface by its path. */
function routeOf(req: Request): string {
  const declared: unknown = req.route?.path;
  if (typeof declared === 'string') return declared;
  return isApi(req) ? '/api/(unknown)' : req.path.slice(0, 200);
}

/** Who asked, as numbers: a member and an organisation are never named in a log. */
function askedBy(req: Request): Fields {
  const { user, org } = req as Partial<Pick<Request, 'user' | 'org'>>;
  return { member: user?.id, organization: org?.id };
}

/** What is asked every few seconds by whatever watches the server (the image's health check, a probe), and answered. */
const isProbe = (req: Request, status: number): boolean => req.path === '/api/public' && status < 400;

/** The files of the interface and the probes are many and tell little: they are logged for whoever asks for everything. */
function levelOf(req: Request, status: number): 'debug' | 'info' | 'warn' {
  if (status >= 500) return 'warn';
  return isApi(req) && !isProbe(req, status) ? 'info' : 'debug';
}

function ended(req: Request, res: Response, started: number): void {
  const what = { method: req.method, route: routeOf(req), ms: Date.now() - started, ...askedBy(req) };
  if (res.writableFinished) log[levelOf(req, res.statusCode)]('request answered', { ...what, status: res.statusCode });
  else log.warn('request left unanswered: whoever asked closed the connection', what);
}

export const accessLog: RequestHandler = (req, res, next) => {
  const started = Date.now();
  const id = idOf(req);
  res.set('x-request-id', id);
  // An event is emitted outside of what the request runs in: the id is given again.
  res.once('close', () => about({ req: id }, () => ended(req, res, started)));
  about({ req: id }, () => {
    log.debug('request received', { method: req.method, route: isApi(req) ? '/api/…' : req.path.slice(0, 200) });
    next();
  });
};
