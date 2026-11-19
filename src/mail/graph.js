import { escapeHtml } from '../text.js';

const API = 'https://graph.microsoft.com/v1.0';

const recipient = (r) => ({ name: r?.emailAddress?.name || '', address: String(r?.emailAddress?.address || '').toLowerCase() });
const toRecipients = (list) => list.map((address) => ({ emailAddress: { address } }));

/** Pure: Microsoft Graph message -> our email shape. */
export function graphToEmail(msg) {
  const header = (name) => msg.internetMessageHeaders?.find((h) => h.name.toLowerCase() === name)?.value || '';
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
export function injectReplyHtml(draftHtml, text) {
  const mine = `<div>${escapeHtml(text.trimEnd()).replace(/\n/g, '<br>')}</div><br>`;
  const html = String(draftHtml || '');
  return /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (tag) => `${tag}${mine}`) : `${mine}${html}`;
}

/** Outlook / Microsoft 365 through Microsoft Graph (scopes Mail.ReadWrite + Mail.Send). */
export function createGraphProvider(account, { getAccessToken, fetchImpl = fetch }) {
  async function api(path, init = {}) {
    const res = await fetchImpl(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${await getAccessToken()}`, 'content-type': 'application/json', ...init.headers },
    });
    if (!res.ok) throw new Error(`Microsoft Graph ${res.status} sur ${path.split('?')[0]}`);
    return res.status === 202 || res.status === 204 ? null : res.json();
  }

  return {
    async verify() {
      await api('/me?$select=id');
    },

    async listNew({ since, limit, known }) {
      const params = new URLSearchParams({
        $filter: `receivedDateTime ge ${since.toISOString()}`,
        $orderby: 'receivedDateTime desc',
        $top: String(limit),
        $select:
          'id,internetMessageId,conversationId,subject,from,replyTo,toRecipients,ccRecipients,receivedDateTime,body,internetMessageHeaders',
      });
      const page = await api(`/me/mailFolders/inbox/messages?${params}`, {
        headers: { prefer: 'outlook.body-content-type="text"' },
      });
      return (page.value || []).filter((m) => !known.has(m.id)).map(graphToEmail);
    },

    async send({ email, to, cc, text }) {
      // createReply gives a draft already threaded and quoting the original; we only add our text.
      const draft = await api(`/me/messages/${email.providerId}/createReply`, { method: 'POST', body: '{}' });
      await api(`/me/messages/${draft.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          toRecipients: toRecipients(to),
          ccRecipients: toRecipients(cc),
          body: { contentType: 'HTML', content: injectReplyHtml(draft.body?.content, text) },
        }),
      });
      await api(`/me/messages/${draft.id}/send`, { method: 'POST', body: '{}' });
    },
  };
}
