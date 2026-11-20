import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { AddressObject, ParsedMail } from 'mailparser';
import nodemailer from 'nodemailer';
import { htmlToText } from '../text.ts';
import type { Address, Email, ImapCredentials, IncomingEmail, MailProvider, Sender, ServerCredentials } from '../types.ts';
import { buildRawReply } from './mime.ts';

/** mailparser gives one address object, several, or none, depending on the header. */
const addresses = (field: AddressObject | AddressObject[] | undefined): Address[] =>
  [field]
    .flat()
    .flatMap((f) => f?.value || [])
    .flatMap((a) => (a.address ? [{ name: a.name || '', address: a.address.toLowerCase() }] : []));

/** Pure: a parsed RFC 822 message -> our email shape. */
export function parsedToEmail(parsed: ParsedMail, { providerId, answered }: { providerId: string; answered: boolean }): IncomingEmail {
  const from = addresses(parsed.from)[0] || { name: '', address: '' };
  // mailparser groups the List-* headers under a single "list" entry.
  const list = (parsed.headers.get('list') || {}) as { unsubscribe?: unknown; id?: unknown };
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
    bodyText: (parsed.text || htmlToText(parsed.html)).trim(),
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
const mustUpgrade = ({ host, secure }: ServerCredentials): boolean => !secure && !/^(localhost|127\.\d+\.\d+\.\d+|::1)$/i.test(host);

/** Generic mailbox: IMAP to read, SMTP to send. */
export function createImapProvider(account: Sender, cfg: ImapCredentials): MailProvider {
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

  /** A connected client; a failed login must not leave its socket open. */
  async function connected(): Promise<ImapFlow> {
    const client = imapClient();
    try {
      await client.connect();
    } catch (e) {
      client.close();
      throw e;
    }
    return client;
  }

  /** Runs `fn` with the inbox selected, then always logs out. */
  async function withInbox<T>(fn: (client: ImapFlow, uidValidity: string) => Promise<T>): Promise<T> {
    const client = await connected();
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uidValidity = client.mailbox ? String(client.mailbox.uidValidity) : '';
        return await fn(client, uidValidity);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  /** Copy the reply to the Sent folder and flag the original as answered. */
  async function fileSentCopy(raw: Buffer, email: Email): Promise<void> {
    const client = await connected();
    try {
      // Gmail files SMTP submissions in "Sent" by itself; appending would duplicate.
      if (!/g(oogle)?mail\./i.test(cfg.imap.host)) {
        const sent = (await client.list()).find((box) => box.specialUse === '\\Sent');
        if (sent) await client.append(sent.path, raw, ['\\Seen']);
      }
    } finally {
      await client.logout().catch(() => {});
    }
    const [validity, uid] = email.providerId.split(':');
    if (!uid) return;
    await withInbox(async (inbox, uidValidity) => {
      if (uidValidity === validity) await inbox.messageFlagsAdd(uid, ['\\Answered'], { uid: true });
    });
  }

  return {
    async verify() {
      await withInbox(async () => {});
      await smtpTransport().verify();
    },

    async listNew({ since, limit, known }) {
      return withInbox(async (client, validity) => {
        const uids = (await client.search({ since }, { uid: true })) || [];
        const fresh = uids.filter((uid) => !known.has(`${validity}:${uid}`)).slice(-limit);
        if (!fresh.length) return [];
        const out: IncomingEmail[] = [];
        for await (const msg of client.fetch(fresh, { uid: true, flags: true, source: true }, { uid: true })) {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          out.push(parsedToEmail(parsed, { providerId: `${validity}:${msg.uid}`, answered: Boolean(msg.flags?.has('\\Answered')) }));
        }
        return out;
      });
    },

    async send(reply) {
      const { email, to, cc } = reply;
      const raw = await buildRawReply({ account, ...reply });
      await smtpTransport().sendMail({ envelope: { from: account.email, to: [...to, ...cc] }, raw });
      // The mail is sent. What follows is bookkeeping in the mailbox and must not fail the send.
      await fileSentCopy(raw, email).catch(() => {});
    },

    /** Leave the reply in the mailbox's Drafts folder, for the user to finish in their mail client. */
    async saveDraft(reply) {
      const { email } = reply;
      const raw = await buildRawReply({ account, ...reply });
      const client = await connected();
      try {
        const boxes = await client.list();
        const drafts =
          boxes.find((box) => box.specialUse === '\\Drafts') || boxes.find((box) => /^(drafts?|brouillons?)$/i.test(box.name));
        if (!drafts) throw new Error('this mailbox has no Drafts folder');
        await client.append(drafts.path, raw, ['\\Draft', '\\Seen']);
      } finally {
        await client.logout().catch(() => {});
      }
    },
  };
}
