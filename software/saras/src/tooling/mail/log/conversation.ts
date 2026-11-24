// What is logged of a conversation with a mail server, IMAP or SMTP: where the server is,
// each step of getting in, and what failed. Who signs in is never named, nor with what; and
// past the handshake a failure is told by its kind only: a server's own words may name a
// folder or a correspondent.
import type { ServerCredentials } from '../../../domain/model/mailbox.ts';
import { errorKind, errorMessage } from '../../errors.ts';
import { log } from '../../log.ts';
import type { Fields, Level } from '../../log.ts';
import { hiding } from '../../redaction.ts';
import { handshake } from './handshake.ts';

/** Takes out of a text who signs in at a server and with what, however the protocol carries them (SASL PLAIN joins them). */
export const hidingOf = ({ user, pass }: ServerCredentials): ((text: string) => string) => hiding([pass, user, `\0${user}\0${pass}`]);

export interface Conversation {
  /** A line of the protocol: logged while the handshake lasts, for whoever asks for everything. */
  sent(line: string, continuation: boolean): void;
  received(line: string): void;
  /** Something the library says happened, in its words, with what it may tell and the error if there is one. */
  happened(level: Level, text: string, fields: Fields, err?: unknown): void;
}

export function conversation(kind: 'imap' | 'smtp', server: ServerCredentials, commands: RegExp): Conversation {
  const hide = hidingOf(server);
  const shake = handshake(commands, hide);
  const at = { host: server.host, port: server.port };
  const exchanged = (way: string, line: string | null): void => {
    if (line !== null) log.debug(`${kind}: ${way}`, { ...at, line });
  };
  return {
    sent: (line, continuation) => exchanged('sent', shake.client(line, continuation)),
    received: (line) => exchanged('received', shake.server(line)),
    happened(level, text, fields, err) {
      const failed = err !== undefined || level === 'warn' || level === 'error';
      const worded = !failed || !shake.over();
      const error = err !== undefined && worded ? { error: hide(errorMessage(err)) } : {};
      log[level](`${kind}: ${worded && text ? hide(text) : 'failed'}`, { ...at, ...fields, ...errorKind(err), ...error });
    },
  };
}
