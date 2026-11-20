import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { composeReplyBody, replyReferences, replySubject } from '../reply.ts';
import { formatAddress } from '../text.ts';
import type { OutgoingReply, Sender } from '../types.ts';

/** Build the RFC 822 reply (threading headers + quoted original) as a Buffer. */
export async function buildRawReply({ account, email, to, cc, text }: OutgoingReply & { account: Sender }): Promise<Buffer> {
  const references = replyReferences(email);
  const composer = new MailComposer({
    from: formatAddress({ name: account.display_name, address: account.email }),
    to,
    cc: cc?.length ? cc : undefined,
    subject: replySubject(email.subject),
    text: composeReplyBody(text, email),
    inReplyTo: email.messageId || undefined,
    references: references.length ? references : undefined,
  });
  const raw = await composer.compile().build();
  // The composer keeps the line breaks of the text as typed; mail servers expect CRLF throughout.
  return Buffer.from(raw.toString('latin1').replace(/\r?\n/g, '\r\n'), 'latin1');
}
