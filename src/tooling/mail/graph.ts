// Outlook / Microsoft 365 through Microsoft Graph (scopes Mail.ReadWrite + Mail.Send).
import type { IncomingEmail } from '../../domain/model/email.ts';
import type { MailFolder, MailProvider, ListQuery, Sender } from '../../domain/model/mailbox.ts';
import type { OutgoingReply } from '../../domain/model/reply.ts';
import type { HostAccess } from './gmail.ts';
import { graphToEmail, injectReplyHtml, toRecipients } from './graph/message.ts';
import type { GraphMessage } from './graph/message.ts';

const API = 'https://graph.microsoft.com/v1.0';

/** Calls the API. Resolves to null for the bodiless answers (202, 204). */
type Api = <T>(path: string, init?: RequestInit, extraHeaders?: Record<string, string>) => Promise<T>;

const apiWith = ({ getAccessToken, fetchImpl = fetch }: HostAccess): Api => async <T>(path: string, init: RequestInit = {}, extraHeaders: Record<string, string> = {}): Promise<T> => {
  const headers = { authorization: `Bearer ${await getAccessToken()}`, 'content-type': 'application/json', ...extraHeaders };
  const res = await fetchImpl(`${API}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`Microsoft Graph ${res.status} on ${path.split('?')[0]}`);
  return (res.status === 202 || res.status === 204 ? null : await res.json()) as T;
};

interface GraphFolder {
  id: string;
  displayName: string;
}

/** Top-level folders only. The inbox is addressed by its well-known name, which stays valid whatever its id. */
async function listFolders(api: Api): Promise<MailFolder[]> {
  const page = await api<{ value?: GraphFolder[] }>('/me/mailFolders?$top=100&$select=id,displayName');
  const inbox = await api<GraphFolder>('/me/mailFolders/inbox?$select=id,displayName');
  const others = (page.value || []).filter((f) => f.id !== inbox.id).sort((a, b) => a.displayName.localeCompare(b.displayName));
  return [{ id: 'inbox', name: inbox.displayName }, ...others.map((f) => ({ id: f.id, name: f.displayName }))];
}

const SELECTED = 'id,internetMessageId,conversationId,subject,from,replyTo,toRecipients,ccRecipients,receivedDateTime,body,internetMessageHeaders';

async function listNew(api: Api, { folder, since, limit, known }: ListQuery): Promise<IncomingEmail[]> {
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${since.toISOString()}`,
    $orderby: 'receivedDateTime desc',
    $top: String(limit),
    $select: SELECTED,
    $expand: 'attachments($select=name,contentType,size)',
  });
  const page = await api<{ value?: GraphMessage[] }>(`/me/mailFolders/${encodeURIComponent(folder)}/messages?${params}`, {}, { prefer: 'outlook.body-content-type="text"' });
  return (page.value || []).filter((m) => !known.has(m.id)).map(graphToEmail);
}

/** createReply gives a draft already threaded and quoting the original; we only add our text. */
async function createDraft(api: Api, { email, to, cc, html }: OutgoingReply): Promise<string> {
  const draft = await api<GraphMessage>(`/me/messages/${email.providerId}/createReply`, { method: 'POST', body: '{}' });
  const body = { contentType: 'HTML', content: injectReplyHtml(draft.body?.content, html) };
  await api(`/me/messages/${draft.id}`, { method: 'PATCH', body: JSON.stringify({ toRecipients: toRecipients(to), ccRecipients: toRecipients(cc), body }) });
  return draft.id;
}

async function send(api: Api, reply: OutgoingReply): Promise<void> {
  const draftId = await createDraft(api, reply);
  await api(`/me/messages/${draftId}/send`, { method: 'POST', body: '{}' });
}

export function createGraphProvider(_account: Sender, access: HostAccess): MailProvider {
  const api = apiWith(access);
  return {
    verify: async () => void (await api('/me?$select=id')),
    listFolders: () => listFolders(api),
    listNew: (query) => listNew(api, query),
    saveDraft: async (reply) => void (await createDraft(api, reply)),
    send: (reply) => send(api, reply),
  };
}
