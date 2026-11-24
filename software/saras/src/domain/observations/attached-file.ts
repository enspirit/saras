// Observation — a file attached to an email, read again from the mailbox it is in: saras keeps
// its description only, and nothing of what it reads here.
//
//   ReqPre   the member may use the mailbox the email arrived in
//            the email is not past its retention: what is erased here is not read there either
//            the mailbox is of a kind that hands files over, and answers
//            it still has the message, and the message that file
import { errorMessage } from '../../tooling/errors.ts';
import { isPastRetention } from '../computations/emails.ts';
import type { AttachedFile } from '../model/mailbox.ts';
import { Refusal } from '../refusal.ts';
import { emailFor } from '../state/emails.ts';
import type { OwnedEmailRow } from '../state/emails.ts';
import { mailboxFor } from '../state/mailboxes.ts';
import type { Actor, World } from '../world.ts';

/** The place of a file in the list of an email's attachments, from 0; -1 for what is not one. */
const placeOf = (index: unknown): number => (/^\d{1,4}$/.test(String(index)) ? Number(index) : -1);

async function readFrom({ db, mail }: Pick<World, 'db' | 'mail'>, actor: Actor, email: OwnedEmailRow, place: number): Promise<AttachedFile | null> {
  const provider = mail.providerFor(await mailboxFor(db, actor, email.account_id));
  if (!provider.attachment) throw new Refusal('invalid', 'emails.attachmentsNotRead');
  try {
    return await provider.attachment({ providerId: email.provider_id, folder: email.folder }, place);
  } catch (e) {
    throw new Refusal('upstream', 'emails.attachmentFailed', { detail: errorMessage(e) });
  }
}

export async function attachedFile(world: Pick<World, 'db' | 'mail' | 'config'>, actor: Actor, emailId: unknown, index: unknown): Promise<AttachedFile> {
  const email = await emailFor(world.db, actor, emailId);
  if (isPastRetention(email.date, world.config.retentionDays)) throw new Refusal('gone', 'emails.contentErased');
  const file = placeOf(index) >= 0 ? await readFrom(world, actor, email, placeOf(index)) : null;
  if (!file) throw new Refusal('notFound', 'emails.attachmentNotFound');
  return file;
}
