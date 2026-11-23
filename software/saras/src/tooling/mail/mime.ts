import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { composeReplyBody, composeReplyHtml, replyReferences, replySubject } from '../../domain/computations/reply.ts';
import { formatAddress, htmlToText } from '../text.ts';
import type { Sender } from '../../domain/model/mailbox.ts';
import type { OutgoingReply } from '../../domain/model/reply.ts';

/**
 * Build the RFC 822 reply as a Buffer: threading headers, and the reply with the quoted
 * original both as HTML and as the plain text a mail client may prefer.
 */
export async function buildRawReply({ account, email, to, cc, html, language }: OutgoingReply & { account: Sender }): Promise<Buffer> {
  const references = replyReferences(email);
  const composer = new MailComposer({
    from: formatAddress({ name: account.display_name, address: account.email }),
    to,
    cc: cc?.length ? cc : undefined,
    subject: replySubject(email.subject),
    text: composeReplyBody(htmlToText(html), email, language),
    html: composeReplyHtml(html, email, language),
    inReplyTo: email.messageId || undefined,
    references: references.length ? references : undefined,
  });
  const raw = await composer.compile().build();
  // The composer keeps the line breaks of the text as typed; mail servers expect CRLF throughout.
  return Buffer.from(raw.toString('latin1').replace(/\r?\n/g, '\r\n'), 'latin1');
}
