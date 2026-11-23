// The interface's two pages and the security headers every answer carries. A page is given
// a nonce of its own: the one style sheet the rule editor writes itself is allowed by it, and
// nothing else written into the page is.
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** What stands in a page for its nonce until the page is served. */
const PLACEHOLDER = '__CSP_NONCE__';

const policy = (nonce: string): string => `default-src 'self'; style-src 'self' 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`;

/**
 * The headers that keep an answer to itself, but for the policy below, which needs the nonce:
 * nothing frames a page, nothing of another origin reads a file or keeps a handle on a window,
 * no type is guessed, no address is told to where a link leads. Browsers keep to HTTPS once
 * they have met it; only for this host, since we cannot speak for the others of its domain.
 */
const headers = helmet({ contentSecurityPolicy: false, xFrameOptions: { action: 'deny' }, strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false } });

/** A nonce of its own, and what the browser may run and style. */
const nonced: RequestHandler = (_req, res, next) => {
  res.locals.nonce = randomBytes(16).toString('base64');
  res.set('content-security-policy', policy(res.locals.nonce));
  next();
};

/** Every answer carries both. */
export const hardened: RequestHandler[] = [headers, nonced];

/** A page of the interface, told its nonce. Never kept by the browser: the nonce is good once. */
export function page(publicDir: string, file: string): RequestHandler {
  const html = readFileSync(join(publicDir, file), 'utf8');
  return (_req, res) => void res.set('cache-control', 'no-store').type('html').send(html.replaceAll(PLACEHOLDER, res.locals.nonce));
}
