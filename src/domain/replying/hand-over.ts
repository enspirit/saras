// What SendReply and FileReplyAsDraft have in common: the reply is handed to the mailbox,
// one way or the other, and what happened to the proposal on the way is recorded.
//
//   fetch    the email
//   decide   may it be handed over                                  (pure: mayHandOver)
//   execute  the mailbox takes it; what is recorded is worked out   (pure: handOverRecord)
//            and kept, and the email is replied
import { errorMessage } from '../../tooling/errors.ts';
import { rowToEmail } from '../computations/emails.ts';
import type { ReplyMode } from '../../types.ts';
import { handOverRecord, mayHandOver } from '../computations/replying.ts';
import { Refusal, accepted } from '../refusal.ts';
import { emailFor } from '../state/emails.ts';
import { mailboxById } from '../state/mailboxes.ts';
import { proposalOf, recordReply } from '../state/proposals.ts';
import type { Actor, World } from '../world.ts';
import { writtenSoFar } from './proposal.ts';

export interface ReplyRequest {
  emailId: unknown;
  html: unknown;
  to: string[];
  cc: string[];
  /** The proposal the reply started from, when there was one. */
  proposalId: number;
  /** Why the member changed the proposal, in their words. */
  changeReason: string;
}

export async function handOver(world: World, actor: Actor, request: ReplyRequest, mode: ReplyMode): Promise<{ wasEdited: boolean }> {
  // `handingOver` holds the emails with a hand-over in flight, so that a double click cannot send twice.
  const { db, mail, handingOver: inFlight } = world;
  const row = await emailFor(db, actor, request.emailId);
  const html = writtenSoFar(request.html);
  // Decided and claimed in the same breath, before anything else is awaited, so that a second request cannot slip in between.
  accepted(mayHandOver({ status: row.status, inFlight: inFlight.has(row.id), html, to: request.to, cc: request.cc }));
  inFlight.add(row.id);
  try {
    const proposal = request.proposalId ? await proposalOf(db, row.id, request.proposalId) : undefined;
    const mailbox = await mailboxById(db, row.account_id);
    const reply = { email: rowToEmail(row), to: request.to, cc: request.cc, html, language: actor.member.language };
    try {
      await (mode === 'draft' ? mail.providerFor(mailbox).saveDraft(reply) : mail.providerFor(mailbox).send(reply));
    } catch (e) {
      throw new Refusal('upstream', mode === 'draft' ? 'reply.draftFailed' : 'reply.sendFailed', { detail: errorMessage(e) });
    }
    const record = handOverRecord(html, proposal, request.changeReason);
    await recordReply(db, { emailId: row.id, memberId: actor.member.id, mode, to: request.to, cc: request.cc, html, ...record });
    return { wasEdited: record.edited };
  } finally {
    inFlight.delete(row.id);
  }
}
