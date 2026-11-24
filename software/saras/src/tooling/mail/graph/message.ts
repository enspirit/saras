// Pure: Microsoft Graph message -> our email shape, and our reply into the draft Graph prepares.
import type { Address, IncomingEmail } from '../../../domain/model/email.ts';

/** The parts of a Microsoft Graph message that we read. */
export interface GraphRecipient {
  emailAddress?: { name?: string; address?: string };
}

export interface GraphMessage {
  id: string;
  internetMessageId?: string;
  conversationId?: string;
  subject?: string;
  receivedDateTime: string;
  from?: GraphRecipient;
  replyTo?: GraphRecipient[];
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  body?: { contentType?: string; content?: string };
  internetMessageHeaders?: { name: string; value: string }[];
  attachments?: { name?: string; contentType?: string; size?: number }[];
}

const recipient = (r: GraphRecipient | undefined): Address => ({
  name: r?.emailAddress?.name || '',
  address: String(r?.emailAddress?.address || '').toLowerCase(),
});
export const toRecipients = (list: string[]): GraphRecipient[] => list.map((address) => ({ emailAddress: { address } }));

type Header = (name: string) => string;
const headerOf = (msg: GraphMessage): Header => (name) => msg.internetMessageHeaders?.find((h) => h.name.toLowerCase() === name)?.value || '';

/** Who wrote, to whom, and whom to answer. */
function correspondents(msg: GraphMessage) {
  const from = recipient(msg.from);
  const replyTo = recipient(msg.replyTo?.[0]).address;
  return { fromName: from.name, fromAddr: from.address, replyTo, to: (msg.toRecipients || []).map(recipient), cc: (msg.ccRecipients || []).map(recipient) };
}

/** The headers that tell automated mail. */
const automationHeaders = (header: Header): IncomingEmail['headers'] => ({
  listUnsubscribe: header('list-unsubscribe'),
  listId: header('list-id'),
  autoSubmitted: header('auto-submitted'),
  precedence: header('precedence'),
});

export function graphToEmail(msg: GraphMessage): IncomingEmail {
  const header = headerOf(msg);
  return {
    providerId: msg.id,
    messageId: msg.internetMessageId || null,
    threadId: msg.conversationId || null,
    refs: header('references'),
    ...correspondents(msg),
    subject: msg.subject || '',
    date: new Date(msg.receivedDateTime).toISOString(),
    bodyText: String(msg.body?.content || '').trim(),
    // Graph is asked for the text of a message, and gives one body: no HTML is kept of these mailboxes yet.
    bodyHtml: '',
    attachments: (msg.attachments || []).map((a) => ({ name: a.name || '', type: a.contentType || 'application/octet-stream', size: a.size || 0 })),
    headers: automationHeaders(header),
    answered: false,
  };
}

/** Put the reply above the quoted original that Graph generated in the draft. */
export function injectReplyHtml(draftHtml: string | null | undefined, replyHtml: string): string {
  const mine = `<div>${replyHtml}</div><br>`;
  const html = String(draftHtml || '');
  return /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (tag) => `${tag}${mine}`) : `${mine}${html}`;
}
