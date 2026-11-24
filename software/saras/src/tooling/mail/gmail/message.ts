// Pure: Gmail API message (format=full) -> our email shape.
import type { Address, Attachment, IncomingEmail } from '../../../domain/model/email.ts';
import { htmlToText, parseAddress } from '../../text.ts';

/** The parts of a Gmail API message (format=full) that we read. */
interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  threadId?: string;
  /** Epoch milliseconds, as a string. */
  internalDate?: string;
  payload?: GmailPart;
}

const decode = (data: string | undefined): string => Buffer.from(data || '', 'base64url').toString('utf8');

/** Depth-first search for the first part of a MIME type that carries content. */
function findPart(payload: GmailPart | undefined, mimeType: string): GmailPart | null {
  if (!payload) return null;
  if (payload.mimeType === mimeType && payload.body?.data) return payload;
  for (const part of payload.parts || []) {
    const found = findPart(part, mimeType);
    if (found) return found;
  }
  return null;
}

/** Every part that carries a file name, however deep. */
function attachmentsOf(payload: GmailPart | undefined): Attachment[] {
  if (!payload) return [];
  const own = payload.filename ? [{ name: payload.filename, type: payload.mimeType || 'application/octet-stream', size: payload.body?.size || 0 }] : [];
  return [...own, ...(payload.parts || []).flatMap(attachmentsOf)];
}

/** Split an address list on the commas that are outside quoted display names. */
const splitAddresses = (value: string): Address[] =>
  value
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((s) => parseAddress(s))
    .filter((a) => a.address.includes('@'));

type Header = (name: string) => string;
const headerOf = (msg: GmailMessage): Header => (name) => msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value || '';

/** The plain text when there is one, else the HTML read as text. */
function textOf(msg: GmailMessage): string {
  const plain = findPart(msg.payload, 'text/plain');
  const html = findPart(msg.payload, 'text/html');
  return (plain ? decode(plain.body?.data) : htmlToText(html ? decode(html.body?.data) : '')).trim();
}

/** The HTML as it was written, when the message has some. */
const htmlOf = (msg: GmailMessage): string => decode(findPart(msg.payload, 'text/html')?.body?.data);

/** Who wrote, to whom, and whom to answer. */
function correspondents(header: Header) {
  const from = parseAddress(header('from'));
  const replyTo = header('reply-to') ? parseAddress(header('reply-to')).address : '';
  return { fromName: from.name, fromAddr: from.address, replyTo, to: splitAddresses(header('to')), cc: splitAddresses(header('cc')) };
}

/** The headers that tell automated mail. */
const automationHeaders = (header: Header): IncomingEmail['headers'] => ({
  listUnsubscribe: header('list-unsubscribe'),
  listId: header('list-id'),
  autoSubmitted: header('auto-submitted'),
  precedence: header('precedence'),
});

export function gmailToEmail(msg: GmailMessage): IncomingEmail {
  const header = headerOf(msg);
  return {
    providerId: msg.id,
    messageId: header('message-id') || null,
    threadId: msg.threadId || null,
    refs: header('references'),
    ...correspondents(header),
    subject: header('subject'),
    date: new Date(Number(msg.internalDate) || Date.now()).toISOString(),
    bodyText: textOf(msg),
    bodyHtml: htmlOf(msg),
    attachments: attachmentsOf(msg.payload),
    headers: automationHeaders(header),
    answered: false,
  };
}
