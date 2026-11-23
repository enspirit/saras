// FetchMailbox, asked by a member — see fetch-mailbox.ts for what fetching does. The same
// happens on the server's own clock for every mailbox that watches a folder.
//
//   ReqPre   the member may use the mailbox
import { mailboxFor } from '../state/mailboxes.ts';
import type { Actor, World } from '../world.ts';
import type { SyncResult } from './fetch-mailbox.ts';

export const fetchMailboxNow = async (world: World, actor: Actor, mailboxId: unknown): Promise<SyncResult> =>
  world.fetching.syncAccount(await mailboxFor(world.db, actor, mailboxId));
