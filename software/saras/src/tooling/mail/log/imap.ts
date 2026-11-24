// What the IMAP library says of a connection, as this server logs it (see conversation.ts).
import type { ServerCredentials } from '../../../domain/model/mailbox.ts';
import type { Fields, Level } from '../../log.ts';
import { conversation } from './conversation.ts';

/** The commands of the handshake, each after its tag. SELECT, LIST, SEARCH, FETCH, APPEND… are past it. */
const COMMANDS = /^\S+ (CAPABILITY|STARTTLS|LOGIN|AUTHENTICATE|ID|ENABLE|NAMESPACE|COMPRESS|LOGOUT)\b/i;

/** How the library marks what answers a challenge while signing in. */
const ANSWERS_A_CHALLENGE = /^(Encoded|Error response)/;

/** What an entry of the library may tell besides its message: the connection it is about, and how it is secured. Not `user`. */
const TOLD = ['secure', 'address', 'authorized', 'algo', 'version'];

interface Entry {
  msg?: unknown;
  /** `c` and `s` for a line of the protocol, sent or received. */
  src?: unknown;
  err?: unknown;
  comment?: unknown;
  cid?: unknown;
  [name: string]: unknown;
}

const toldBy = (entry: Entry): Fields => ({ conn: entry.cid, ...Object.fromEntries(TOLD.filter((name) => name in entry).map((name) => [name, entry[name]])) });

/**
 * The logger an ImapFlow client is given. It has no `trace`: what the library traces names folders.
 * What the library calls an error is thrown to whoever asked, who tells it: here it is a warning.
 */
export function imapLogger(server: ServerCredentials) {
  const said = conversation('imap', server, COMMANDS);
  const tell = (level: Level) => (entry: Entry): void => {
    const text = typeof entry.msg === 'string' ? entry.msg : '';
    if (entry.src === 'c') return said.sent(text, ANSWERS_A_CHALLENGE.test(String(entry.comment ?? '')));
    if (entry.src === 's') return said.received(text);
    said.happened(level, text, toldBy(entry), entry.err ?? undefined);
  };
  return { debug: tell('debug'), info: tell('info'), warn: tell('warn'), error: tell('warn') };
}
