// The interface's two pages and the security headers every answer carries. A page is given
// a nonce of its own: the one style sheet the rule editor writes itself is allowed by it, and
// nothing else written into the page is.
import type { RequestHandler } from 'express';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** What stands in a page for its nonce until the page is served. */
const PLACEHOLDER = '__CSP_NONCE__';

const policy = (nonce: string): string => `default-src 'self'; style-src 'self' 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`;

/** Every answer: a nonce of its own, and the headers that keep the page to itself. */
export const hardened: RequestHandler = (_req, res, next) => {
  res.locals.nonce = randomBytes(16).toString('base64');
  res.set({ 'content-security-policy': policy(res.locals.nonce), 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
  next();
};

/** A page of the interface, told its nonce. Never kept by the browser: the nonce is good once. */
export function page(publicDir: string, file: string): RequestHandler {
  const html = readFileSync(join(publicDir, file), 'utf8');
  return (_req, res) => void res.set('cache-control', 'no-store').type('html').send(html.replaceAll(PLACEHOLDER, res.locals.nonce));
}
