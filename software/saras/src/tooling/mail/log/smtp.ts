// What the SMTP library says of a connection, as this server logs it (see conversation.ts).
import { format } from 'node:util';
import type { ServerCredentials } from '../../../domain/model/mailbox.ts';
import type { Level } from '../../log.ts';
import { HIDDEN } from '../../redaction.ts';
import { conversation } from './conversation.ts';

/** The commands of the handshake. MAIL FROM, RCPT TO and DATA are past it: they name correspondents and carry the mail. */
const COMMANDS = /^(EHLO|HELO|LHLO|STARTTLS|AUTH|QUIT|NOOP|RSET)\b/i;

/** What answers a challenge while signing in: base64 and nothing else, which no command is but the two that carry mail. */
const ANSWERS_A_CHALLENGE = /^(?!DATA$|BDAT\b)[A-Za-z0-9+/=]*$/i;

/** `AUTH PLAIN` carries who signs in and with what in one base64 word: the mechanism is logged, the word never. */
const withoutProof = (line: string): string => line.replace(/^(AUTH\s+\S+)\s.*$/is, `$1 ${HIDDEN}`);

/** The kinds of entries that tell of the connection. Not `message` (the mail itself) nor `send` (its recipients). */
const TOLD = new Set(['dns', 'network', 'smtp']);

interface Entry {
  /** What the entry is about; `client` and `server` for a line of the protocol, sent or received. */
  tnx?: unknown;
  err?: unknown;
  sid?: unknown;
}

/**
 * The logger a nodemailer transport is given: every level it may call, each with an entry, a message and what it formats.
 * What the library calls an error is thrown to whoever asked, who tells it: here it is a warning.
 */
export function smtpLogger(server: ServerCredentials) {
  const said = conversation('smtp', server, COMMANDS);
  const tell = (level: Level) => (entry: Entry, message: unknown = '', ...args: unknown[]): void => {
    const text = format(message, ...args);
    if (entry.tnx === 'client') return said.sent(withoutProof(text), ANSWERS_A_CHALLENGE.test(text));
    if (entry.tnx === 'server') return said.received(text);
    if (typeof entry.tnx === 'string' && TOLD.has(entry.tnx)) said.happened(level, text, { conn: entry.sid }, entry.err ?? undefined);
  };
  return { trace: (): void => {}, debug: tell('debug'), info: tell('info'), warn: tell('warn'), error: tell('warn'), fatal: tell('warn') };
}
