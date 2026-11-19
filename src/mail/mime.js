import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { composeReplyBody, replyReferences, replySubject } from '../reply.js';
import { formatAddress } from '../text.js';

/** Build the RFC 822 reply (threading headers + quoted original) as a Buffer. */
export async function buildRawReply({ account, email, to, cc, text }) {
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
  return composer.compile().build();
}
