// NameMailbox — the one who manages a mailbox changes the name its replies show to recipients.
//
//   DomPre   a mailbox of the organisation
//   DomPost  the mailbox shows this name; none, and replies show its address alone
//   ReqPre   the member may use the mailbox, and manages it
//   ReqPost  replies already sent are not changed
import { mailboxNameGiven, mayManage } from '../computations/mailboxes.ts';
import { accepted } from '../refusal.ts';
import { mailboxFor, nameMailbox as keepName } from '../state/mailboxes.ts';
import type { Actor, World } from '../world.ts';

export async function nameMailbox({ db }: World, actor: Actor, mailboxId: unknown, name: unknown): Promise<void> {
  const mailbox = await mailboxFor(db, actor, mailboxId);
  accepted(mayManage(actor, mailbox));
  await keepName(db, mailbox.id, mailboxNameGiven(name));
}
