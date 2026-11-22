// ChooseWatchedFolder — the one who manages a mailbox chooses the one folder saras watches.
//
//   DomPre   (none)
//   DomPost  the mailbox watches this folder; its last error is forgotten
//   ReqPre   the member may use the mailbox, and manages it
//            the mailbox answers, and the folder is one of its folders
//   ReqPost  what was fetched from another folder before is kept
//   ReqTrig  the mailbox is fetched at once
import { clipped } from '../computations/given.ts';
import { folderAmong, mayManage } from '../computations/mailboxes.ts';
import { accepted } from '../refusal.ts';
import { mailboxFor, watchFolder } from '../state/mailboxes.ts';
import type { MailFolder } from '../../types.ts';
import type { Actor, World } from '../world.ts';
import { foldersOf } from './list-folders.ts';

export async function chooseWatchedFolder(world: World, actor: Actor, mailboxId: unknown, wanted: unknown): Promise<MailFolder> {
  const mailbox = await mailboxFor(world.db, actor, mailboxId);
  accepted(mayManage(actor, mailbox));
  const folder = accepted(folderAmong(await foldersOf(world, mailbox), clipped(wanted, 1000)));
  world.fetching.inBackground(await watchFolder(world.db, mailbox.id, folder));
  return folder;
}
