// RenewMailboxCredentials — the one who manages a mailbox gives saras access to it again:
// after a password change, or when the access granted at the host was withdrawn or ran out.
//
//   DomPre   a mailbox of the organisation
//   DomPost  the same mailbox, with these credentials; its last error is forgotten
//   ReqPre   the member may use the mailbox, and manages it
//            the new credentials were just seen to work, for that very mailbox
//   ReqPost  the credentials are kept sealed
//            the folder watched, the emails kept and who owns the mailbox do not change
//   ReqTrig  a mailbox that watches a folder is fetched at once
//
// By password, here, for a mailbox reached by its servers. By sign-in at the host, for the
// others: that one starts and ends in connect-mailbox-by-host-sign-in.ts, which the member
// goes through the same way, and comes back here.
import { errorMessage } from '../../tooling/errors.ts';
import { isRenewedByPassword, mayManage, notLetIn, withNewPassword } from '../computations/mailboxes.ts';
import { accepted } from '../refusal.ts';
import { mailboxFor, renewCredentials } from '../state/mailboxes.ts';
import type { AccountRow, ImapCredentials, OAuthTokens } from '../model/mailbox.ts';
import type { Actor, World } from '../world.ts';

/** The mailbox, if the member may renew its access. */
export async function mailboxToRenew({ db }: World, actor: Actor, mailboxId: unknown): Promise<AccountRow> {
  const mailbox = await mailboxFor(db, actor, mailboxId);
  accepted(mayManage(actor, mailbox));
  return mailbox;
}

/** The common end of both ways: the mailbox has the new credentials, and is fetched again. */
export async function renewWith(world: World, mailbox: AccountRow, credentials: ImapCredentials | OAuthTokens): Promise<AccountRow> {
  const renewed = await renewCredentials(world.db, mailbox.id, world.vault.seal(credentials), mailbox.display_name);
  if (renewed.folder) world.fetching.inBackground(renewed);
  return renewed;
}

export async function renewMailboxPassword(world: World, actor: Actor, mailboxId: unknown, password: unknown): Promise<AccountRow> {
  const mailbox = await mailboxToRenew(world, actor, mailboxId);
  accepted(isRenewedByPassword(mailbox));
  const credentials = accepted(withNewPassword(world.vault.open<ImapCredentials>(mailbox.config_enc), password));
  try {
    await world.mail.imapProvider(mailbox, credentials).verify();
  } catch (e) {
    throw notLetIn(errorMessage(e));
  }
  return renewWith(world, mailbox, credentials);
}
