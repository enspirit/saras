// Routes: the emails of the boxes, one email as it was written and its files, and the
// corrections of how they were sorted. The operations are in domain/sorting.
import { attachedFile } from '../../domain/observations/attached-file.ts';
import { emailAsDocument, emailWithItsReply, emailsOfBox } from '../../domain/observations/emails.ts';
import { Refusal } from '../../domain/refusal.ts';
import { ignoreEmail } from '../../domain/sorting/ignore-email.ts';
import { markNoReplyNeeded } from '../../domain/sorting/mark-no-reply-needed.ts';
import { moveBackToHandle } from '../../domain/sorting/move-back-to-handle.ts';
import { correctSortingOfSelection } from '../../domain/sorting/correct-sorting-of-selection.ts';
import { emailFor } from '../../domain/state/emails.ts';
import { actorOf, done } from './route.ts';
import type { Handle, Route } from './route.ts';

const box: Handle = async ({ world }, req, res) => void res.json(await emailsOfBox(world.db, actorOf(req), req.query.box, req.query.search));

const read: Handle = async ({ world }, req, res) => void res.json(await emailWithItsReply(world.db, actorOf(req), req.params.id, world.config));

/**
 * What an email shown as it was written may do, whatever its HTML says once rebuilt: run
 * nothing, ask nothing of any host (an image hosted elsewhere would tell that the email was
 * opened), send no form, and be no origin of ours. Its links open in a tab of their own. It
 * is the one answer a page of ours may frame.
 */
const AS_WRITTEN = {
  'content-security-policy': "sandbox allow-popups allow-popups-to-escape-sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; frame-ancestors 'self'",
  'x-frame-options': 'SAMEORIGIN',
};

const asWritten: Handle = async ({ world }, req, res) => void res.set(AS_WRITTEN).type('html').send(await emailAsDocument(world.db, actorOf(req), req.params.id));

/** The files a browser shows without running anything of them. Every other is saved, never opened: an HTML or SVG file would be a page of ours. */
const SHOWN = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']);

/** A file name as a header carries it (RFC 5987). */
const named = (name: string): string => `filename*=UTF-8''${encodeURIComponent(name || 'file').replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;

const file: Handle = async ({ world }, req, res) => {
  const { name, type, content } = await attachedFile(world, actorOf(req), req.params.id, req.params.index);
  const kind = type.split(';')[0]?.trim().toLowerCase() ?? '';
  const shown = SHOWN.has(kind);
  res.set('content-disposition', `${shown ? 'inline' : 'attachment'}; ${named(name)}`).type(shown ? kind : 'application/octet-stream').send(content);
};

/** The status asked for says which of the three corrections it is. */
const CORRECTIONS = { no_reply: markNoReplyNeeded, ignored: ignoreEmail, needs_reply: moveBackToHandle };

const correctSorting: Handle = async ({ world }, req, res) => {
  const correct = CORRECTIONS[String(req.body.status) as keyof typeof CORRECTIONS];
  if (!correct) {
    // An email one may not see is not found, whatever else is wrong with the request.
    await emailFor(world.db, actorOf(req), req.params.id);
    throw new Refusal('invalid', 'emails.invalidStatus');
  }
  await correct(world, actorOf(req), req.params.id);
  done(res);
};

/** Several emails at once: which, in the body (ticked, or all of a view), never in the address. */
const correctSelection: Handle = async ({ world }, req, res) => void res.json(await correctSortingOfSelection(world, actorOf(req), req.body.selection, req.body.status));

export const EMAILS: Route[] = [
  { method: 'get', path: '/emails', handle: box },
  // Before the routes of one email, whose number would otherwise be read as "selection".
  { method: 'post', path: '/emails/selection/status', handle: correctSelection },
  { method: 'get', path: '/emails/:id', handle: read },
  { method: 'get', path: '/emails/:id/html', handle: asWritten },
  { method: 'get', path: '/emails/:id/attachments/:index', handle: file },
  { method: 'post', path: '/emails/:id/status', handle: correctSorting },
];
