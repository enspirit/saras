// Observation — the folders of a mailbox, for the member to choose the one to watch.
//
//   ReqPre   the member may use the mailbox
//            the mailbox answers
import { errorMessage } from '../../tooling/errors.ts';
import { Refusal } from '../refusal.ts';
import { mailboxFor } from '../state/mailboxes.ts';
import type { AccountRow, MailFolder } from '../model/mailbox.ts';
import type { Actor, World } from '../world.ts';

export async function foldersOf({ mail }: Pick<World, 'mail'>, mailbox: AccountRow): Promise<MailFolder[]> {
  try {
    return await mail.providerFor(mailbox).listFolders();
  } catch (e) {
    throw new Refusal('upstream', 'mailboxes.foldersFailed', { detail: errorMessage(e) });
  }
}

export const listFolders = async (world: World, actor: Actor, mailboxId: unknown): Promise<MailFolder[]> => foldersOf(world, await mailboxFor(world.db, actor, mailboxId));
