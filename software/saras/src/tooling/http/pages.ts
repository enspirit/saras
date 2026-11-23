// The interface's two pages and the security headers every answer carries. A page is given
// a nonce of its own: the one style sheet the rule editor writes itself is allowed by it, and
// nothing else written into the page is.
import type { RequestHandler, Response } from 'express';
import type { HelmetOptions } from 'helmet';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** What stands in a page for its nonce until the page is served. */
const PLACEHOLDER = '__CSP_NONCE__';

/** Every answer is given a nonce of its own, before its headers are written. */
export const nonced: RequestHandler = (_req, res, next) => {
  res.locals.nonce = randomBytes(16).toString('base64');
  next();
};

const nonceOf = (_req: unknown, res: unknown): string => `'nonce-${(res as Response).locals.nonce}'`;

/** What a page may run and style: our own files, and the one style sheet written with the nonce of the answer. */
const POLICY = { defaultSrc: ["'self'"], styleSrc: ["'self'", nonceOf], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'self'"] };

/**
 * The headers that keep an answer to itself, as helmet is asked for them: the policy above and
 * nothing of helmet's own; no framing, for the browsers that do not read the policy; HTTPS kept
 * once met, for this host only, since we cannot speak for the others of its domain. The rest is
 * what helmet sends unasked: no type guessed, no address told to where a link leads, nothing of
 * another origin reading a file or keeping a handle on a window.
 */
export const HEADERS: HelmetOptions = {
  contentSecurityPolicy: { useDefaults: false, directives: POLICY },
  xFrameOptions: { action: 'deny' },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false },
};

/** A page of the interface, told its nonce. Never kept by the browser: the nonce is good once. */
export function page(publicDir: string, file: string): RequestHandler {
  const html = readFileSync(join(publicDir, file), 'utf8');
  return (_req, res) => void res.set('cache-control', 'no-store').type('html').send(html.replaceAll(PLACEHOLDER, res.locals.nonce));
}
