// ChangeMailboxServers — the one who manages a mailbox reached by its servers corrects them:
// a host that moved, a port, the user name, and the password if it changed too.
//
//   DomPre   a mailbox of the organisation, reached by its servers
//   DomPost  the same mailbox, reached by these servers; its last error is forgotten
//   ReqPre   the member may use the mailbox, and manages it
//            both servers with their ports; a password left empty keeps the one it has
//            the mailbox was just seen to answer there
//   ReqPost  the credentials are kept sealed
//            the address, the folder watched, the emails kept and who owns the mailbox do not change
//   ReqTrig  a mailbox that watches a folder is fetched at once
import type { MailboxServers } from '../../../shared/mailbox.ts';
import { errorMessage } from '../../tooling/errors.ts';
import { isRenewedByPassword, notLetIn, serversTold, withServers } from '../computations/mailboxes.ts';
import type { ServersGiven } from '../computations/mailboxes.ts';
import type { ImapCredentials } from '../model/mailbox.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';
import { mailboxToRenew, renewWith } from './renew-mailbox-credentials.ts';

/** Observation: the servers a mailbox is reached by, for who manages it. The password is never told. */
export async function mailboxServers(world: World, actor: Actor, mailboxId: unknown): Promise<MailboxServers> {
  const mailbox = await mailboxToRenew(world, actor, mailboxId);
  accepted(isRenewedByPassword(mailbox));
  return serversTold(world.vault.open<ImapCredentials>(mailbox.config_enc));
}

export async function changeMailboxServers(world: World, actor: Actor, mailboxId: unknown, given: ServersGiven): Promise<void> {
  const mailbox = await mailboxToRenew(world, actor, mailboxId);
  accepted(isRenewedByPassword(mailbox));
  const credentials = accepted(withServers(world.vault.open<ImapCredentials>(mailbox.config_enc), mailbox.email, given));
  try {
    await world.mail.imapProvider(mailbox, credentials).verify();
  } catch (e) {
    throw notLetIn(errorMessage(e));
  }
  await renewWith(world, mailbox, credentials);
}
