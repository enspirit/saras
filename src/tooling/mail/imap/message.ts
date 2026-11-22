// Pure: a parsed RFC 822 message -> our email shape.
import type { AddressObject, ParsedMail } from 'mailparser';
import type { Address, Attachment, IncomingEmail } from '../../../domain/model/email.ts';
import { htmlToText } from '../../text.ts';

/** mailparser gives one address object, several, or none, depending on the header. */
const addresses = (field: AddressObject | AddressObject[] | undefined): Address[] =>
  [field]
    .flat()
    .flatMap((f) => f?.value || [])
    .flatMap((a) => (a.address ? [{ name: a.name || '', address: a.address.toLowerCase() }] : []));

const attachmentsOf = (parsed: ParsedMail): Attachment[] =>
  parsed.attachments.map((a) => ({ name: a.filename || '', type: a.contentType || 'application/octet-stream', size: a.size || 0 }));

/** The headers that tell automated mail. mailparser groups the List-* headers under a single "list" entry. */
function automationHeaders(parsed: ParsedMail): IncomingEmail['headers'] {
  const list = (parsed.headers.get('list') || {}) as { unsubscribe?: unknown; id?: unknown };
  return {
    listUnsubscribe: list.unsubscribe ? 'yes' : '',
    listId: list.id ? 'yes' : '',
    autoSubmitted: String(parsed.headers.get('auto-submitted') || ''),
    precedence: String(parsed.headers.get('precedence') || ''),
  };
}

/** Who wrote, to whom, and whom to answer. */
function correspondents(parsed: ParsedMail) {
  const from = addresses(parsed.from)[0] || { name: '', address: '' };
  return { fromName: from.name, fromAddr: from.address, replyTo: addresses(parsed.replyTo)[0]?.address || '', to: addresses(parsed.to), cc: addresses(parsed.cc) };
}

export const parsedToEmail = (parsed: ParsedMail, { providerId, answered }: { providerId: string; answered: boolean }): IncomingEmail => ({
  providerId,
  messageId: parsed.messageId || null,
  threadId: null,
  refs: [parsed.references].flat().filter(Boolean).join(' '),
  ...correspondents(parsed),
  subject: parsed.subject || '',
  date: (parsed.date || new Date()).toISOString(),
  bodyText: (parsed.text || htmlToText(parsed.html)).trim(),
  attachments: attachmentsOf(parsed),
  headers: automationHeaders(parsed),
  answered,
});
