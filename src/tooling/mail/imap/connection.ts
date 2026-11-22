// Reaching a mailbox by its servers: IMAP to read, SMTP to send.
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { ImapCredentials, ServerCredentials } from '../../../domain/model/mailbox.ts';

/**
 * Without direct TLS the connection must be upgraded with STARTTLS, or we refuse to log in:
 * a password or a mail never travels in clear. Loopback servers are exempt.
 */
const mustUpgrade = ({ host, secure }: ServerCredentials): boolean => !secure && !/^(localhost|127\.\d+\.\d+\.\d+|::1)$/i.test(host);

const imapClient = ({ imap }: ImapCredentials): ImapFlow =>
  new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    doSTARTTLS: mustUpgrade(imap) ? true : undefined,
    auth: { user: imap.user, pass: imap.pass },
    logger: false,
    disableAutoIdle: true,
  });

export const smtpTransport = ({ smtp }: ImapCredentials): Transporter =>
  nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: mustUpgrade(smtp),
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

/** A connected client; a failed login must not leave its socket open. */
async function connected(cfg: ImapCredentials): Promise<ImapFlow> {
  const client = imapClient(cfg);
  try {
    await client.connect();
  } catch (e) {
    client.close();
    throw e;
  }
  return client;
}

/** Runs `fn` with a connected client, then always logs out. */
export async function withMailbox<T>(cfg: ImapCredentials, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = await connected(cfg);
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

/** Runs `fn` with a folder selected and its UID validity, then always logs out. */
export const withFolder = <T>(cfg: ImapCredentials, folder: string, fn: (client: ImapFlow, uidValidity: string) => Promise<T>): Promise<T> =>
  withMailbox(cfg, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      return await fn(client, client.mailbox ? String(client.mailbox.uidValidity) : '');
    } finally {
      lock.release();
    }
  });
