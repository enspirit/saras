// ShareMailbox — an administrator shares with the organisation a mailbox they connected as their own.
//
//   DomPre   a mailbox of the organisation
//   DomPost  the mailbox is shared: every member, present and future, may use it, and the
//            administrators manage it
//   ReqPre   the member may use the mailbox, manages it, and is an administrator
//   ReqPost  its owner, its credentials, the folder it watches and what was kept from it are
//            unchanged; a mailbox already shared stays as it is
import { mayManage, mayShareMailbox } from '../computations/mailboxes.ts';
import { accepted } from '../refusal.ts';
import { mailboxFor, shareMailbox as keepShared } from '../state/mailboxes.ts';
import type { Actor, World } from '../world.ts';

export async function shareMailbox({ db }: World, actor: Actor, mailboxId: unknown): Promise<void> {
  const mailbox = await mailboxFor(db, actor, mailboxId);
  accepted(mayManage(actor, mailbox));
  accepted(mayShareMailbox(actor));
  await keepShared(db, mailbox.id);
}
