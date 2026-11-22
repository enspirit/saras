// Routes: writing a reply with the AI's help, and handing it to the mailbox. The operations
// are in domain/replying: a route translates the request and calls one.
import type { Request } from 'express';
import { addressesGiven, clipped } from '../../domain/computations/given.ts';
import { Refusal } from '../../domain/refusal.ts';
import { checkTypos } from '../../domain/replying/check-typos.ts';
import { fileReplyAsDraft } from '../../domain/replying/file-reply-as-draft.ts';
import { improveStyle } from '../../domain/replying/improve-style.ts';
import { sendReply } from '../../domain/replying/send-reply.ts';
import { writeWithPrompt } from '../../domain/replying/write-with-prompt.ts';
import { emailFor } from '../../domain/state/emails.ts';
import { actorOf } from './route.ts';
import type { Handle, Route } from './route.ts';

/** The help asked for says which of the three operations it is. */
const ASSISTANCE = { typos: checkTypos, style: improveStyle, prompt: writeWithPrompt };

const assist: Handle = async ({ world }, req, res) => {
  const help = ASSISTANCE[String(req.body.action) as keyof typeof ASSISTANCE];
  if (!help) {
    // An email one may not see is not found, whatever else is wrong with the request.
    await emailFor(world.db, actorOf(req), req.params.id);
    throw new Refusal('invalid', 'assist.invalidAction');
  }
  res.status(201).json(await help(world, actorOf(req), { emailId: req.params.id, html: req.body.html, promptId: req.body.promptId }));
};

const replyGiven = (req: Request) => ({
  emailId: req.params.id,
  html: req.body.html,
  to: addressesGiven(req.body.to),
  cc: addressesGiven(req.body.cc),
  proposalId: Number(req.body.proposalId) || 0,
  changeReason: clipped(req.body.changeReason, 1000),
});

const send: Handle = async ({ world }, req, res) => void res.json({ ok: true, ...(await sendReply(world, actorOf(req), replyGiven(req))) });

const fileAsDraft: Handle = async ({ world }, req, res) => void res.json({ ok: true, ...(await fileReplyAsDraft(world, actorOf(req), replyGiven(req))) });

export const REPLYING: Route[] = [
  { method: 'post', path: '/emails/:id/assist', handle: assist },
  { method: 'post', path: '/emails/:id/send', handle: send },
  { method: 'post', path: '/emails/:id/file-as-draft', handle: fileAsDraft },
];
