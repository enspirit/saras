/** The few parts of the in-process IMAP test server that the tests use. */
declare module 'hoodiecrow-imap' {
  import type { Server } from 'node:net';

  interface StoredMessage {
    raw: string;
    flags: string[];
  }

  interface ImapServer {
    server: Server;
    getMailbox(path: string): { messages: StoredMessage[] };
    close(callback?: () => void): void;
  }

  export default function hoodiecrow(options: { plugins?: string[]; storage?: Record<string, unknown> }): ImapServer;
}
