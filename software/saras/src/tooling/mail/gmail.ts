// Gmail through its REST API (scopes gmail.readonly + gmail.compose).
import type { IncomingEmail } from '../../domain/model/email.ts';
import type { MailFolder, MailProvider, ListQuery, NewEmails, Sender } from '../../domain/model/mailbox.ts';
import type { OutgoingReply } from '../../domain/model/reply.ts';
import type { Fetch } from '../fetch.ts';
import { gmailToEmail } from './gmail/message.ts';
import type { GmailMessage } from './gmail/message.ts';
import { buildRawReply } from './mime.ts';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface HostAccess {
  getAccessToken: () => Promise<string>;
  fetchImpl?: Fetch;
}

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;

const apiWith = ({ getAccessToken, fetchImpl = fetch }: HostAccess): Api => async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetchImpl(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${await getAccessToken()}`, 'content-type': 'application/json' } });
  if (!res.ok) throw new Error(`Gmail API ${res.status} on ${path.split('?')[0]}`);
  return (await res.json()) as T;
};

/** System labels that are not places where mail waits for an answer. */
const HIDDEN = new Set(['SENT', 'DRAFT', 'TRASH', 'SPAM', 'CHAT', 'UNREAD']);
const rank = (id: string): number => (id === 'INBOX' ? 0 : 1);

/** In Gmail a folder is a label. */
async function listFolders(api: Api): Promise<MailFolder[]> {
  const { labels = [] } = await api<{ labels?: { id: string; name: string; type?: string }[] }>('/labels');
  return labels
    .filter((l) => !HIDDEN.has(l.id) && !l.id.startsWith('CATEGORY_'))
    .map((l): MailFolder => ({ id: l.id, name: l.id === 'INBOX' ? 'Inbox' : l.name }))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
}

/** Only the most recent messages are looked at, as many as the limit: older ones are not counted, and no later reading brings them. */
async function listNew(api: Api, { folder, since, unreadOnly, limit, known }: ListQuery): Promise<NewEmails> {
  const after = Math.floor(since.getTime() / 1000);
  const q = encodeURIComponent(`after:${after} -from:me${unreadOnly ? ' is:unread' : ''}`);
  const list = await api<{ messages?: { id: string }[] }>(`/messages?labelIds=${encodeURIComponent(folder)}&q=${q}&maxResults=${limit}`);
  const fresh = (list.messages || []).filter((m) => !known.has(m.id));
  const out: IncomingEmail[] = [];
  for (const { id } of fresh) out.push(gmailToEmail(await api<GmailMessage>(`/messages/${id}?format=full`)));
  return { emails: out, toCome: 0 };
}

/** The reply as Gmail takes it: the raw message, in the thread of the original. */
async function rawIn(account: Sender, reply: OutgoingReply): Promise<{ raw: string; threadId: string | undefined }> {
  const raw = await buildRawReply({ account, ...reply });
  return { raw: raw.toString('base64url'), threadId: reply.email.threadId || undefined };
}

const send = async (api: Api, account: Sender, reply: OutgoingReply): Promise<void> =>
  void (await api('/messages/send', { method: 'POST', body: JSON.stringify(await rawIn(account, reply)) }));

const saveDraft = async (api: Api, account: Sender, reply: OutgoingReply): Promise<void> =>
  void (await api('/drafts', { method: 'POST', body: JSON.stringify({ message: await rawIn(account, reply) }) }));

export function createGmailProvider(account: Sender, access: HostAccess): MailProvider {
  const api = apiWith(access);
  return {
    verify: async () => void (await api('/profile')),
    listFolders: () => listFolders(api),
    listNew: (query) => listNew(api, query),
    send: (reply) => send(api, account, reply),
    saveDraft: (reply) => saveDraft(api, account, reply),
  };
}
