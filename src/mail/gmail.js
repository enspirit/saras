import { htmlToText, parseAddress } from '../text.js';
import { buildRawReply } from './mime.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

const decode = (data) => Buffer.from(data || '', 'base64url').toString('utf8');

function findPart(payload, mimeType) {
  if (!payload) return null;
  if (payload.mimeType === mimeType && payload.body?.data) return payload;
  for (const part of payload.parts || []) {
    const found = findPart(part, mimeType);
    if (found) return found;
  }
  return null;
}

const splitAddresses = (value) =>
  String(value || '')
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((s) => parseAddress(s))
    .filter((a) => a.address.includes('@'));

/** Pure: Gmail API message (format=full) -> our email shape. */
export function gmailToEmail(msg) {
  const header = (name) => msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value || '';
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
    bodyText: (plain ? decode(plain.body.data) : htmlToText(html ? decode(html.body.data) : '')).trim(),
    headers: {
      listUnsubscribe: header('list-unsubscribe'),
      listId: header('list-id'),
      autoSubmitted: header('auto-submitted'),
      precedence: header('precedence'),
    },
    answered: false,
  };
}

/** Gmail through its REST API (scopes gmail.readonly + gmail.send). */
export function createGmailProvider(account, { getAccessToken, fetchImpl = fetch }) {
  async function api(path, init = {}) {
    const res = await fetchImpl(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${await getAccessToken()}`, 'content-type': 'application/json', ...init.headers },
    });
    if (!res.ok) throw new Error(`Gmail API ${res.status} sur ${path.split('?')[0]}`);
    return res.json();
  }

  return {
    async verify() {
      await api('/profile');
    },

    async listNew({ since, limit, known }) {
      const after = Math.floor(since.getTime() / 1000);
      const q = encodeURIComponent(`in:inbox after:${after} -from:me`);
      const list = await api(`/messages?q=${q}&maxResults=${limit}`);
      const fresh = (list.messages || []).filter((m) => !known.has(m.id));
      const out = [];
      for (const { id } of fresh) out.push(gmailToEmail(await api(`/messages/${id}?format=full`)));
      return out;
    },

    async send({ email, to, cc, text }) {
      const raw = await buildRawReply({ account, email, to, cc, text });
      await api('/messages/send', {
        method: 'POST',
        body: JSON.stringify({ raw: raw.toString('base64url'), threadId: email.threadId || undefined }),
      });
    },
  };
}
