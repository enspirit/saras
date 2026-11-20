import { escapeHtml } from '../text.ts';
import type { Address, Fetch, IncomingEmail, MailProvider, OutgoingReply, Sender } from '../types.ts';

const API = 'https://graph.microsoft.com/v1.0';

/** The parts of a Microsoft Graph message that we read. */
interface GraphRecipient {
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
const toRecipients = (list: string[]): GraphRecipient[] => list.map((address) => ({ emailAddress: { address } }));

/** Pure: Microsoft Graph message -> our email shape. */
export function graphToEmail(msg: GraphMessage): IncomingEmail {
  const header = (name: string): string => msg.internetMessageHeaders?.find((h) => h.name.toLowerCase() === name)?.value || '';
  const from = recipient(msg.from);
  return {
    providerId: msg.id,
    messageId: msg.internetMessageId || null,
    threadId: msg.conversationId || null,
    refs: header('references'),
    fromName: from.name,
    fromAddr: from.address,
    replyTo: recipient(msg.replyTo?.[0]).address,
    to: (msg.toRecipients || []).map(recipient),
    cc: (msg.ccRecipients || []).map(recipient),
    subject: msg.subject || '',
    date: new Date(msg.receivedDateTime).toISOString(),
    bodyText: String(msg.body?.content || '').trim(),
    attachments: (msg.attachments || []).map((a) => ({ name: a.name || '', type: a.contentType || 'application/octet-stream', size: a.size || 0 })),
    headers: {
      listUnsubscribe: header('list-unsubscribe'),
      listId: header('list-id'),
      autoSubmitted: header('auto-submitted'),
      precedence: header('precedence'),
    },
    answered: false,
  };
}

/** Pure: put the reply text above the quoted original that Graph generated in the draft. */
export function injectReplyHtml(draftHtml: string | null | undefined, text: string): string {
  const mine = `<div>${escapeHtml(text.trimEnd()).replace(/\n/g, '<br>')}</div><br>`;
  const html = String(draftHtml || '');
  return /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (tag) => `${tag}${mine}`) : `${mine}${html}`;
}

interface Dependencies {
  getAccessToken: () => Promise<string>;
  fetchImpl?: Fetch;
}

/** Outlook / Microsoft 365 through Microsoft Graph (scopes Mail.ReadWrite + Mail.Send). */
export function createGraphProvider(_account: Sender, { getAccessToken, fetchImpl = fetch }: Dependencies): MailProvider {
  /** Calls the API. Resolves to null for the bodiless answers (202, 204). */
  async function api<T>(path: string, init: RequestInit = {}, extraHeaders: Record<string, string> = {}): Promise<T> {
    const res = await fetchImpl(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${await getAccessToken()}`, 'content-type': 'application/json', ...extraHeaders },
    });
    if (!res.ok) throw new Error(`Microsoft Graph ${res.status} on ${path.split('?')[0]}`);
    return (res.status === 202 || res.status === 204 ? null : await res.json()) as T;
  }

  /** createReply gives a draft already threaded and quoting the original; we only add our text. */
  async function createDraft({ email, to, cc, text }: OutgoingReply): Promise<string> {
    const draft = await api<GraphMessage>(`/me/messages/${email.providerId}/createReply`, { method: 'POST', body: '{}' });
    await api(`/me/messages/${draft.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        toRecipients: toRecipients(to),
        ccRecipients: toRecipients(cc),
        body: { contentType: 'HTML', content: injectReplyHtml(draft.body?.content, text) },
      }),
    });
    return draft.id;
  }

  return {
    async verify() {
      await api('/me?$select=id');
    },

    /** Top-level folders only. */
    async listFolders() {
      const page = await api<{ value?: { id: string; displayName: string }[] }>('/me/mailFolders?$top=100&$select=id,displayName');
      const inbox = await api<{ id: string; displayName: string }>('/me/mailFolders/inbox?$select=id,displayName');
      const others = (page.value || []).filter((f) => f.id !== inbox.id).sort((a, b) => a.displayName.localeCompare(b.displayName));
      // The inbox is addressed by its well-known name, which stays valid whatever its id.
      return [{ id: 'inbox', name: inbox.displayName }, ...others.map((f) => ({ id: f.id, name: f.displayName }))];
    },

    async listNew({ folder, since, limit, known }) {
      const params = new URLSearchParams({
        $filter: `receivedDateTime ge ${since.toISOString()}`,
        $orderby: 'receivedDateTime desc',
        $top: String(limit),
        $select:
          'id,internetMessageId,conversationId,subject,from,replyTo,toRecipients,ccRecipients,receivedDateTime,body,internetMessageHeaders',
        $expand: 'attachments($select=name,contentType,size)',
      });
      const page = await api<{ value?: GraphMessage[] }>(`/me/mailFolders/${encodeURIComponent(folder)}/messages?${params}`, {}, { prefer: 'outlook.body-content-type="text"' });
      return (page.value || []).filter((m) => !known.has(m.id)).map(graphToEmail);
    },

    saveDraft: createDraft,

    async send(reply) {
      const draftId = await createDraft(reply);
      await api(`/me/messages/${draftId}/send`, { method: 'POST', body: '{}' });
    },
  };
}
