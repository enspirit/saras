// ConnectMailboxByServers — a member connects a mailbox by naming its mail servers and giving
// its password.
//
//   DomPre, DomPost  those of ConnectMailbox
//   ReqPre   an address, the incoming and outgoing servers with their ports, a password
//            the incoming server lets us in with them
//   ReqPost  nothing is fetched yet: the member first chooses the folder to watch
import { errorMessage } from '../../tooling/errors.ts';
import { connectsAsShared, serversGiven } from '../computations/mailboxes.ts';
import type { ServersGiven } from '../computations/mailboxes.ts';
import { Refusal, accepted } from '../refusal.ts';
import type { AccountRow } from '../model/mailbox.ts';
import type { Actor, World } from '../world.ts';
import { connectMailbox } from './connect-mailbox.ts';

export async function connectMailboxByServers(world: World, actor: Actor, given: ServersGiven): Promise<AccountRow> {
  const { email, displayName, credentials } = accepted(serversGiven(given));
  const shared = connectsAsShared(actor, given.shared);
  try {
    await world.mail.imapProvider({ email, display_name: displayName }, credentials).verify();
  } catch (e) {
    throw new Refusal('invalid', 'mailboxes.connectionFailed', { detail: errorMessage(e) });
  }
  return connectMailbox(world, actor, { kind: 'imap', address: email, displayName, shared }, credentials);
}
