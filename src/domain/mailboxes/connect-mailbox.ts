// ConnectMailbox — a member connects a mailbox to their organisation, with credentials that
// were just seen to work. The two ways of getting such credentials are the two operations
// that end here: ConnectMailboxByServers and ConnectMailboxByHostSignIn.
//
//   DomPre   the organisation has no mailbox for this address
//   DomPost  it has one, owned by the member, shared or not, watching no folder yet
//   ReqPost  the credentials are kept sealed
//            only an administrator's mailbox is shared
//
// Deviation (OPERATIONS.md, decision 1): when the address is already connected, this renews
// its credentials instead — RenewMailboxCredentials hiding here.
//   ReqPre   then, the member manages that mailbox
//   DomPost  then, the mailbox has these credentials and this display name, and its last error is forgotten
import { mayRenew } from '../computations/mailboxes.ts';
import { accepted } from '../refusal.ts';
import { addMailbox, mailboxAt, renewCredentials } from '../state/mailboxes.ts';
import type { AccountKind, AccountRow, ImapCredentials, OAuthTokens } from '../../types.ts';
import type { Actor, World } from '../world.ts';

export interface MailboxToConnect {
  kind: AccountKind;
  address: string;
  displayName: string;
  shared: boolean;
}

export async function connectMailbox({ db, vault }: World, actor: Actor, { kind, address, displayName, shared }: MailboxToConnect, credentials: ImapCredentials | OAuthTokens): Promise<AccountRow> {
  const existing = await mailboxAt(db, actor.organization.id, kind, address);
  if (existing) {
    accepted(mayRenew(actor, existing));
    return renewCredentials(db, existing.id, vault.seal(credentials), displayName);
  }
  return addMailbox(db, { organizationId: actor.organization.id, ownerId: actor.member.id, shared, kind, address, displayName, sealedCredentials: vault.seal(credentials) });
}
