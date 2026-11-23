// DisconnectMailbox — the one who manages a mailbox takes it away from saras.
//
//   DomPre   a mailbox of the organisation
//   DomPost  the organisation no longer has it; its emails, their proposals and the record of
//            their replies are gone with it
//   ReqPre   the member may use the mailbox, and manages it
//   ReqPost  nothing changes in the mailbox itself
import { mayManage } from '../computations/mailboxes.ts';
import { accepted } from '../refusal.ts';
import { forgetMailbox, mailboxFor } from '../state/mailboxes.ts';
import type { Actor, World } from '../world.ts';

export async function disconnectMailbox({ db }: World, actor: Actor, mailboxId: unknown): Promise<void> {
  const mailbox = await mailboxFor(db, actor, mailboxId);
  accepted(mayManage(actor, mailbox));
  await forgetMailbox(db, mailbox.id);
}
