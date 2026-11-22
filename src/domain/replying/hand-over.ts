// What SendReply and FileReplyAsDraft have in common: the reply is handed to the mailbox,
// one way or the other, and what happened to the proposal on the way is recorded.
//
//   fetch    the email
//   decide   may it be handed over                                  (pure: mayHandOver)
//   execute  the mailbox takes it; what is recorded is worked out   (pure: handOverRecord)
//            and kept, and the email is replied
import { errorMessage } from '../../tooling/errors.ts';
import { rowToEmail } from '../computations/emails.ts';
import type { ReplyMode } from '../model/reply.ts';
import { handOverRecord, mayHandOver } from '../computations/replying.ts';
import { Refusal, accepted } from '../refusal.ts';
import type { Email } from '../model/email.ts';
import { emailFor } from '../state/emails.ts';
import type { OwnedEmailRow } from '../state/emails.ts';
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

type Reply = { email: Email; to: string[]; cc: string[]; html: string; language: string };

/** Hands the reply to the mailbox: sent, or left in its drafts. A failure of the mailbox is told as such. */
async function giveToMailbox({ db, mail }: World, mailboxId: number, reply: Reply, mode: ReplyMode): Promise<void> {
  const provider = mail.providerFor(await mailboxById(db, mailboxId));
  try {
    await (mode === 'draft' ? provider.saveDraft(reply) : provider.send(reply));
  } catch (e) {
    throw new Refusal('upstream', mode === 'draft' ? 'reply.draftFailed' : 'reply.sendFailed', { detail: errorMessage(e) });
  }
}

/** Hands over, then records what was handed over, by whom, and whether the proposal was edited. */
async function handOverAndRecord(world: World, actor: Actor, row: OwnedEmailRow, request: ReplyRequest, html: string, mode: ReplyMode): Promise<{ wasEdited: boolean }> {
  const { to, cc } = request;
  const proposal = request.proposalId ? await proposalOf(world.db, row.id, request.proposalId) : undefined;
  await giveToMailbox(world, row.account_id, { email: rowToEmail(row), to, cc, html, language: actor.member.language }, mode);
  const record = handOverRecord(html, proposal, request.changeReason);
  await recordReply(world.db, { emailId: row.id, memberId: actor.member.id, mode, to, cc, html, ...record });
  return { wasEdited: record.edited };
}

export async function handOver(world: World, actor: Actor, request: ReplyRequest, mode: ReplyMode): Promise<{ wasEdited: boolean }> {
  // `handingOver` holds the emails with a hand-over in flight, so that a double click cannot send twice.
  const inFlight = world.handingOver;
  const row = await emailFor(world.db, actor, request.emailId);
  const html = writtenSoFar(request.html);
  // Decided and claimed in the same breath, before anything else is awaited, so that a second request cannot slip in between.
  accepted(mayHandOver({ status: row.status, inFlight: inFlight.has(row.id), html, to: request.to, cc: request.cc }));
  inFlight.add(row.id);
  try {
    return await handOverAndRecord(world, actor, row, request, html, mode);
  } finally {
    inFlight.delete(row.id);
  }
}
