import { htmlToText, parseAddress } from '../text.ts';
import type { Address, Attachment, Fetch, IncomingEmail, MailFolder, MailProvider, Sender } from '../../types.ts';
import { buildRawReply } from './mime.ts';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

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

/** Pure: Gmail API message (format=full) -> our email shape. */
export function gmailToEmail(msg: GmailMessage): IncomingEmail {
  const header = (name: string): string => msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value || '';
  const from = parseAddress(header('from'));
  const plain = findPart(msg.payload, 'text/plain');
  const html = findPart(msg.payload, 'text/html');
  return {
    providerId: msg.id,
    messageId: header('message-id') || null,
    threadId: msg.threadId || null,
    refs: header('references'),
    fromName: from.name,
    fromAddr: from.address,
    replyTo: header('reply-to') ? parseAddress(header('reply-to')).address : '',
    to: splitAddresses(header('to')),
    cc: splitAddresses(header('cc')),
    subject: header('subject'),
    date: new Date(Number(msg.internalDate) || Date.now()).toISOString(),
    bodyText: (plain ? decode(plain.body?.data) : htmlToText(html ? decode(html.body?.data) : '')).trim(),
    attachments: attachmentsOf(msg.payload),
    headers: {
      listUnsubscribe: header('list-unsubscribe'),
      listId: header('list-id'),
      autoSubmitted: header('auto-submitted'),
      precedence: header('precedence'),
    },
    answered: false,
  };
}

interface Dependencies {
  getAccessToken: () => Promise<string>;
  fetchImpl?: Fetch;
}

/** Gmail through its REST API (scopes gmail.readonly + gmail.compose). */
export function createGmailProvider(account: Sender, { getAccessToken, fetchImpl = fetch }: Dependencies): MailProvider {
  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchImpl(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${await getAccessToken()}`, 'content-type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Gmail API ${res.status} on ${path.split('?')[0]}`);
    return (await res.json()) as T;
  }

  return {
    async verify() {
      await api('/profile');
    },

    /** In Gmail a folder is a label. */
    async listFolders() {
      const { labels = [] } = await api<{ labels?: { id: string; name: string; type?: string }[] }>('/labels');
      // System labels that are not places where mail waits for an answer.
      const hidden = new Set(['SENT', 'DRAFT', 'TRASH', 'SPAM', 'CHAT', 'UNREAD']);
      const rank = (id: string) => (id === 'INBOX' ? 0 : 1);
      return labels
        .filter((l) => !hidden.has(l.id) && !l.id.startsWith('CATEGORY_'))
        .map((l): MailFolder => ({ id: l.id, name: l.id === 'INBOX' ? 'Inbox' : l.name }))
        .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
    },

    async listNew({ folder, since, limit, known }) {
      const after = Math.floor(since.getTime() / 1000);
      const q = encodeURIComponent(`after:${after} -from:me`);
      const list = await api<{ messages?: { id: string }[] }>(`/messages?labelIds=${encodeURIComponent(folder)}&q=${q}&maxResults=${limit}`);
      const fresh = (list.messages || []).filter((m) => !known.has(m.id));
      const out: IncomingEmail[] = [];
      for (const { id } of fresh) out.push(gmailToEmail(await api<GmailMessage>(`/messages/${id}?format=full`)));
      return out;
    },

    async send(reply) {
      const { email, to, cc } = reply;
      const raw = await buildRawReply({ account, ...reply });
      await api('/messages/send', {
        method: 'POST',
        body: JSON.stringify({ raw: raw.toString('base64url'), threadId: email.threadId || undefined }),
      });
    },

    async saveDraft(reply) {
      const { email } = reply;
      const raw = await buildRawReply({ account, ...reply });
      await api('/drafts', {
        method: 'POST',
        body: JSON.stringify({ message: { raw: raw.toString('base64url'), threadId: email.threadId || undefined } }),
      });
    },
  };
}
