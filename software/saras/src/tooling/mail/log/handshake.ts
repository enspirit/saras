// The part of a conversation with a mail server that a log may repeat: the handshake — the
// greeting, what the server can do, the upgrade to TLS, signing in. What is said once in
// names folders, correspondents and mail, and is repeated by no log: the first command that
// is not of the handshake ends it, for good. Pure.

export interface Handshake {
  /** A line the client sends, as a log may hold it; null when it may not. What only continues a command (the answer to a challenge) is never logged, and ends nothing. */
  client(line: string, continuation: boolean): string | null;
  /** A line the server sends: logged while the handshake lasts. */
  server(line: string): string | null;
  /** Whether the conversation has gone past it. */
  over(): boolean;
}

/** `commands` recognises the commands of the handshake; `hide` takes out of a line who signs in and with what. */
export function handshake(commands: RegExp, hide: (text: string) => string): Handshake {
  let over = false;
  return {
    client(line, continuation) {
      if (continuation) return null;
      if (!commands.test(line)) over = true;
      return over ? null : hide(line);
    },
    server: (line) => (over ? null : hide(line)),
    over: () => over,
  };
}
