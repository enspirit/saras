import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { htmlToText } from '../text.js';
import { buildRawReply } from './mime.js';

const addresses = (field) =>
  [field]
    .flat()
    .filter(Boolean)
    .flatMap((f) => f.value || [])
    .filter((a) => a.address)
    .map((a) => ({ name: a.name || '', address: a.address.toLowerCase() }));

export function parsedToEmail(parsed, { providerId, answered }) {
  const from = addresses(parsed.from)[0] || { name: '', address: '' };
  const list = parsed.headers.get('list') || {};
  return {
    providerId,
    messageId: parsed.messageId || null,
    threadId: null,
    refs: [parsed.references].flat().filter(Boolean).join(' '),
    fromName: from.name,
    fromAddr: from.address,
    replyTo: addresses(parsed.replyTo)[0]?.address || '',
    to: addresses(parsed.to),
    cc: addresses(parsed.cc),
    subject: parsed.subject || '',
    date: (parsed.date || new Date()).toISOString(),
    bodyText: (parsed.text || htmlToText(parsed.html || '')).trim(),
    headers: {
      listUnsubscribe: list.unsubscribe ? 'yes' : '',
      listId: list.id ? 'yes' : '',
      autoSubmitted: String(parsed.headers.get('auto-submitted') || ''),
      precedence: String(parsed.headers.get('precedence') || ''),
    },
    answered,
  };
}

/**
 * Without direct TLS the connection must be upgraded with STARTTLS, or we refuse to log in:
 * a password or a mail never travels in clear. Loopback servers are exempt.
 */
const mustUpgrade = ({ host, secure }) => !secure && !/^(localhost|127\.\d+\.\d+\.\d+|::1)$/i.test(host);

/** Generic mailbox: IMAP to read, SMTP to send. */
export function createImapProvider(account, cfg) {
  /** A connected client; a failed login must not leave its socket open. */
  async function connected() {
    const client = imapClient();
    try {
      await client.connect();
    } catch (e) {
      client.close();
      throw e;
    }
    return client;
  }

  const imapClient = () =>
    new ImapFlow({
      host: cfg.imap.host,
      port: cfg.imap.port,
      secure: cfg.imap.secure,
      doSTARTTLS: mustUpgrade(cfg.imap) ? true : undefined,
      auth: { user: cfg.imap.user, pass: cfg.imap.pass },
      logger: false,
      disableAutoIdle: true,
    });

  const smtpTransport = () =>
    nodemailer.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.secure,
      requireTLS: mustUpgrade(cfg.smtp),
      auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined,
    });

  async function withInbox(fn) {
    const client = await connected();
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        return await fn(client);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  return {
    async verify() {
      await withInbox(async () => {});
      await smtpTransport().verify();
    },

    async listNew({ since, limit, known }) {
      return withInbox(async (client) => {
        const validity = String(client.mailbox.uidValidity);
        const uids = (await client.search({ since }, { uid: true })) || [];
        const fresh = uids.filter((uid) => !known.has(`${validity}:${uid}`)).slice(-limit);
        if (!fresh.length) return [];
        const out = [];
        for await (const msg of client.fetch(fresh, { uid: true, flags: true, source: true }, { uid: true })) {
          const parsed = await simpleParser(msg.source);
          out.push(parsedToEmail(parsed, { providerId: `${validity}:${msg.uid}`, answered: msg.flags.has('\\Answered') }));
        }
        return out;
      });
    },

    async send({ email, to, cc, text }) {
      const raw = await buildRawReply({ account, email, to, cc, text });
      await smtpTransport().sendMail({ envelope: { from: account.email, to: [...to, ...cc] }, raw });
      // The mail is sent. What follows is bookkeeping in the mailbox and must not fail the send.
      await this.fileSentCopy(raw, email).catch(() => {});
    },

    /** Leave the reply in the mailbox's Drafts folder, for the user to finish in their mail client. */
    async saveDraft({ email, to, cc, text }) {
      const raw = await buildRawReply({ account, email, to, cc, text });
      const client = await connected();
      try {
        const boxes = await client.list();
        const drafts =
          boxes.find((box) => box.specialUse === '\\Drafts') || boxes.find((box) => /^(drafts?|brouillons?)$/i.test(box.name));
        if (!drafts) throw new Error('aucun dossier Brouillons dans cette boîte');
        await client.append(drafts.path, raw, ['\\Draft', '\\Seen']);
      } finally {
        await client.logout().catch(() => {});
      }
    },

    /** Copy the reply to the Sent folder and flag the original as answered. */
    async fileSentCopy(raw, email) {
      const client = await connected();
      try {
        // Gmail files SMTP submissions in "Sent" by itself; appending would duplicate.
        if (!/g(oogle)?mail\./i.test(cfg.imap.host)) {
          const sent = (await client.list()).find((box) => box.specialUse === '\\Sent');
          if (sent) await client.append(sent.path, raw, ['\\Seen']);
        }
        const [validity, uid] = String(email.providerId).split(':');
        const lock = await client.getMailboxLock('INBOX');
        try {
          if (String(client.mailbox.uidValidity) === validity) {
            await client.messageFlagsAdd(uid, ['\\Answered'], { uid: true });
          }
        } finally {
          lock.release();
        }
      } finally {
        await client.logout().catch(() => {});
      }
    },
  };
}
