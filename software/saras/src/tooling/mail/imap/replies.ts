// Handing a reply to a mailbox reached by its servers: sent over SMTP, or left in its drafts.
import type { Email } from '../../../domain/model/email.ts';
import type { ImapCredentials, Sender } from '../../../domain/model/mailbox.ts';
import type { OutgoingReply } from '../../../domain/model/reply.ts';
import { buildRawReply } from '../mime.ts';
import { smtpTransport, withFolder, withMailbox } from './connection.ts';

/** Gmail files SMTP submissions in "Sent" by itself; appending would duplicate. */
const filesSentItself = (cfg: ImapCredentials): boolean => /g(oogle)?mail\./i.test(cfg.imap.host);

const copyToSent = (cfg: ImapCredentials, raw: Buffer): Promise<void> =>
  withMailbox(cfg, async (client) => {
    const sent = (await client.list()).find((box) => box.specialUse === '\\Sent');
    if (sent) await client.append(sent.path, raw, ['\\Seen']);
  });

async function flagAnswered(cfg: ImapCredentials, email: Email): Promise<void> {
  const [validity, uid] = email.providerId.split(':');
  if (!uid) return;
  await withFolder(cfg, email.folder, async (folder, uidValidity) => {
    if (uidValidity === validity) await folder.messageFlagsAdd(uid, ['\\Answered'], { uid: true });
  });
}

/** Copy the reply to the Sent folder and flag the original as answered. */
async function fileSentCopy(cfg: ImapCredentials, raw: Buffer, email: Email): Promise<void> {
  if (!filesSentItself(cfg)) await copyToSent(cfg, raw);
  await flagAnswered(cfg, email);
}

export async function send(account: Sender, cfg: ImapCredentials, reply: OutgoingReply): Promise<void> {
  const raw = await buildRawReply({ account, ...reply });
  await smtpTransport(cfg).sendMail({ envelope: { from: account.email, to: [...reply.to, ...reply.cc] }, raw });
  // The mail is sent. What follows is bookkeeping in the mailbox and must not fail the send.
  await fileSentCopy(cfg, raw, reply.email).catch(() => {});
}

/** Leave the reply in the mailbox's Drafts folder, for the user to finish in their mail client. */
export async function saveDraft(account: Sender, cfg: ImapCredentials, reply: OutgoingReply): Promise<void> {
  const raw = await buildRawReply({ account, ...reply });
  await withMailbox(cfg, async (client) => {
    const boxes = await client.list();
    const drafts = boxes.find((box) => box.specialUse === '\\Drafts') || boxes.find((box) => /^(drafts?|brouillons?)$/i.test(box.name));
    if (!drafts) throw new Error('this mailbox has no Drafts folder');
    await client.append(drafts.path, raw, ['\\Draft', '\\Seen']);
  });
}
