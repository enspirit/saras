// The HTTP server: the interface's files, and under /api one route per operation or observation.
import express from 'express';
import type { Express, RequestHandler } from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Sync } from '../../domain/mailboxes/fetch-mailbox.ts';
import { createWorld } from '../../domain/world.ts';
import type { Reach } from '../../domain/world.ts';
import type { Config } from '../config.ts';
import { createPostman } from '../postman.ts';
import type { Postman } from '../postman.ts';
import type { Fetch } from '../fetch.ts';
import { ACCESS } from './access.ts';
import { ATTRIBUTES } from './attributes.ts';
import { BOARDS } from './boards.ts';
import { EMAILS } from './emails.ts';
import { MAILBOXES } from './mailboxes.ts';
import { MEMBERS } from './members.ts';
import { hardened, page } from './pages.ts';
import { PROMPTS } from './prompts.ts';
import { HttpError, tellRefusal, unknownRoute } from './refusals.ts';
import { REPLYING } from './replying.ts';
import type { Http, Route } from './route.ts';
import { administratorsOnly, membersOnly } from './session.ts';
import { SETTINGS } from './settings.ts';

const PUBLIC_DIR = fileURLToPath(new URL('../../../public', import.meta.url));
const ROUTES: Route[] = [...ACCESS, ...SETTINGS, ...MAILBOXES, ...PROMPTS, ...MEMBERS, ...EMAILS, ...REPLYING, ...BOARDS, ...ATTRIBUTES];

/** Cross-site forms cannot send JSON: requiring it on writes is our CSRF barrier, with SameSite=Lax. */
const jsonOnly: RequestHandler = (req, res, next) => {
  res.set('cache-control', 'no-store');
  const reads = ['GET', 'HEAD'].includes(req.method);
  next(reads || req.is('application/json') ? undefined : new HttpError(415, 'request.jsonRequired'));
};

/** The interface's files. A company's brand folder takes precedence, file by file: what it lacks falls back to the default brand. */
function serveInterface(app: Express, config: Config): void {
  if (config.brandDir) app.use('/brand', express.static(resolve(config.brandDir)));
  // The two pages are told their nonce; every other file is served as it is.
  app.get(['/', '/index.html'], page(PUBLIC_DIR, 'index.html'));
  app.get('/styleguide.html', page(PUBLIC_DIR, 'styleguide.html'));
  app.use(express.static(PUBLIC_DIR, { index: false }));
}

/** Who a route lets through, before it is handled. */
function guardsOf(route: Route, http: Http): RequestHandler[] {
  if (route.for === 'visitors') return [];
  const members = membersOnly(http.world);
  return route.for === 'administrators' ? [members, administratorsOnly] : [members];
}

function serveApi(app: Express, http: Http): void {
  app.use('/api', jsonOnly);
  app.use(express.json({ limit: '1mb' }));
  for (const route of ROUTES) app[route.method](`/api${route.path}`, ...guardsOf(route, http), (req, res) => route.handle(http, req, res));
  app.use('/api', unknownRoute);
}

export interface Dependencies extends Reach {
  sync: Sync;
  /** The server's own outgoing mail; none is configured from the configuration when it is not given. */
  postman?: Postman;
  fetchImpl?: Fetch;
}

export function createApp({ sync, fetchImpl = fetch, postman, ...reach }: Dependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(hardened);
  serveInterface(app, reach.config);
  serveApi(app, { world: createWorld(reach, sync, postman ?? createPostman(reach.config)), fetchImpl });
  app.use(tellRefusal);
  return app;
}
