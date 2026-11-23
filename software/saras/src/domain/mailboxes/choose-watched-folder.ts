// ChooseWatchedFolder — the one who manages a mailbox chooses the one folder saras watches, and
// what is fetched from it: how far back, and whether only what is unread.
//
//   DomPre   (none)
//   DomPost  the mailbox watches this folder, this far back, unread only or not; its last error is forgotten
//   ReqPre   the member may use the mailbox, and manages it
//            the mailbox answers, and the folder is one of its folders
//            how far back is one of the spans offered; otherwise it is left to what the server is set up for
//   ReqPost  what was fetched before, from another folder or further back, is kept
//   ReqTrig  the mailbox is fetched at once
import { clipped } from '../computations/given.ts';
import { folderAmong, mayManage, whatIsFetchedGiven } from '../computations/mailboxes.ts';
import { accepted } from '../refusal.ts';
import { mailboxFor, watchFolder } from '../state/mailboxes.ts';
import type { MailFolder } from '../model/mailbox.ts';
import type { Actor, World } from '../world.ts';
import { foldersOf } from './list-folders.ts';

export async function chooseWatchedFolder(world: World, actor: Actor, mailboxId: unknown, given: { folder?: unknown; days?: unknown; unreadOnly?: unknown }): Promise<MailFolder> {
  const mailbox = await mailboxFor(world.db, actor, mailboxId);
  accepted(mayManage(actor, mailbox));
  const folder = accepted(folderAmong(await foldersOf(world, mailbox), clipped(given.folder, 1000)));
  world.fetching.inBackground(await watchFolder(world.db, mailbox.id, folder, whatIsFetchedGiven(given)));
  return folder;
}
