// ConnectMailbox — a member connects a mailbox to their organisation, with credentials that
// were just seen to work. The two ways of getting such credentials are the two operations
// that end here: ConnectMailboxByServers and ConnectMailboxByHostSignIn.
//
//   DomPre   the organisation has no mailbox for this address
//   DomPost  it has one, owned by the member, shared or not, watching no folder yet
//   ReqPost  the credentials are kept sealed
//            only an administrator's mailbox is shared
import { addressIsNotConnected } from '../computations/mailboxes.ts';
import { accepted } from '../refusal.ts';
import { addMailbox, mailboxAt } from '../state/mailboxes.ts';
import type { AccountKind, AccountRow, ImapCredentials, OAuthTokens } from '../model/mailbox.ts';
import type { Actor, World } from '../world.ts';

export interface MailboxToConnect {
  kind: AccountKind;
  address: string;
  displayName: string;
  shared: boolean;
}

export async function connectMailbox({ db, vault }: World, actor: Actor, { kind, address, displayName, shared }: MailboxToConnect, credentials: ImapCredentials | OAuthTokens): Promise<AccountRow> {
  accepted(addressIsNotConnected(await mailboxAt(db, actor.organization.id, kind, address)));
  return addMailbox(db, { organizationId: actor.organization.id, ownerId: actor.member.id, shared, kind, address, displayName, sealedCredentials: vault.seal(credentials) });
}
