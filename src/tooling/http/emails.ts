// Routes: the emails of the boxes, and the corrections of how they were sorted. The
// operations are in domain/sorting.
import { emailWithItsReply, emailsOfBox } from '../../domain/observations/emails.ts';
import { Refusal } from '../../domain/refusal.ts';
import { ignoreEmail } from '../../domain/sorting/ignore-email.ts';
import { markNoReplyNeeded } from '../../domain/sorting/mark-no-reply-needed.ts';
import { moveBackToHandle } from '../../domain/sorting/move-back-to-handle.ts';
import { emailFor } from '../../domain/state/emails.ts';
import { actorOf, done } from './route.ts';
import type { Handle, Route } from './route.ts';

const box: Handle = async ({ world }, req, res) => void res.json(await emailsOfBox(world.db, actorOf(req), req.query.box));

const read: Handle = async ({ world }, req, res) => void res.json(await emailWithItsReply(world.db, actorOf(req), req.params.id));

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

export const EMAILS: Route[] = [
  { method: 'get', path: '/emails', handle: box },
  { method: 'get', path: '/emails/:id', handle: read },
  { method: 'post', path: '/emails/:id/status', handle: correctSorting },
];
