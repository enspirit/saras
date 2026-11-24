// Reaching a mailbox by its servers: IMAP to read, SMTP to send.
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { ImapCredentials, ServerCredentials } from '../../../domain/model/mailbox.ts';
import { logs } from '../../log.ts';
import { attempted } from '../log/attempt.ts';
import { imapLogger } from '../log/imap.ts';
import { smtpLogger } from '../log/smtp.ts';

/**
 * Without direct TLS the connection must be upgraded with STARTTLS, or we refuse to log in:
 * a password or a mail never travels in clear. Loopback servers are exempt.
 */
const mustUpgrade = ({ host, secure }: ServerCredentials): boolean => !secure && !/^(localhost|127\.\d+\.\d+\.\d+|::1)$/i.test(host);

/**
 * How long a server is given to accept the connection, then to greet. Left to themselves the
 * libraries wait 90 seconds and two minutes, longer than a gateway waits for this server: a
 * port that answers nothing is then a gateway's timeout for the member, and never the refusal
 * that says what happened (decision 0012).
 */
const TIMEOUTS = { connectionTimeout: 15_000, greetingTimeout: 15_000 };

const imapClient = ({ imap }: ImapCredentials): ImapFlow =>
  new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    doSTARTTLS: mustUpgrade(imap) ? true : undefined,
    auth: { user: imap.user, pass: imap.pass },
    logger: imapLogger(imap),
    disableAutoIdle: true,
    ...TIMEOUTS,
  });

export const smtpTransport = ({ smtp }: ImapCredentials): Transporter =>
  nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: mustUpgrade(smtp),
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    logger: smtpLogger(smtp),
    // The commands and the answers, not the mail: they are logged while the handshake lasts.
    transactionLog: logs('debug'),
    ...TIMEOUTS,
  });

/** The outgoing server lets us in. */
export const smtpVerified = async (cfg: ImapCredentials): Promise<void> => void (await attempted('smtp', cfg.smtp, () => smtpTransport(cfg).verify()));

/** A connected client; a failed login must not leave its socket open. */
async function connected(cfg: ImapCredentials): Promise<ImapFlow> {
  const client = imapClient(cfg);
  try {
    await attempted('imap', cfg.imap, () => client.connect());
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
