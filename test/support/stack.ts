// A complete local stack for tests and demos: a real IMAP server, a real SMTP server,
// a stand-in for the OpenRouter HTTP API, and the application wired to them.
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createSync } from '../../src/domain/mailboxes/fetch-mailbox.ts';
import { createTriage } from '../../src/domain/sorting/strategies.ts';
import { loadConfig } from '../../src/tooling/config.ts';
import type { Config } from '../../src/tooling/config.ts';
import { createVault } from '../../src/tooling/crypto.ts';
import type { Db } from '../../src/tooling/db.ts';
import { createApp } from '../../src/tooling/http/server.ts';
import { createOpenRouter } from '../../src/tooling/llm/openrouter.ts';
import { createMailService } from '../../src/tooling/mail/mail-service.ts';
import { testDatabase } from './database.ts';
import { fakeOpenRouter } from './language-model.ts';
import { closed, listen } from './listen.ts';
import { startMailbox } from './mailbox.ts';
import type { Messages } from './mailbox.ts';
import { INBOX } from './received-emails.ts';

export { INBOX } from './received-emails.ts';
export type { RecordedLlmRequest } from './language-model.ts';
export type { SentMail } from './mailbox.ts';
export type Stack = Awaited<ReturnType<typeof startStack>>;

interface StackOptions {
  /** Folders of the mailbox besides the inbox, Sent and Drafts, with their messages. */
  folders?: Record<string, Messages>;
  messages?: Messages;
  /** Environment variables overriding the test defaults. */
  env?: Record<string, string>;
}

const testConfig = (openrouterPort: number, env: Record<string, string>): Config =>
  loadConfig({
    APP_SECRET: 'test-secret-test-secret-test-secret-0123',
    OPENROUTER_API_KEY: 'sk-or-test',
    OPENROUTER_BASE_URL: `http://127.0.0.1:${openrouterPort}`,
    OPENROUTER_MODEL: 'test/model',
    ALLOW_SIGNUP: 'true',
    ...env,
  });

/** The application, wired as main.ts wires it, listening on a free port. */
async function startApplication(config: Config, db: Db): Promise<Server> {
  const vault = createVault(config.appSecret);
  const mail = createMailService({ db, vault, config });
  const llm = createOpenRouter({ baseUrl: config.openrouter.baseUrl });
  const sync = createSync({ db, mail, triage: createTriage({ config, vault, llm }), config, llm, vault });
  const http = createApp({ config, db, vault, mail, llm, sync }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => http.once('listening', () => resolve()));
  return http;
}

type Mailbox = Awaited<ReturnType<typeof startMailbox>>;

/** What tests look at in the mailbox after the fact. */
const seenInMailbox = ({ imap }: Mailbox) => ({
  sentFolder: () => imap.getMailbox('Sent').messages,
  draftsFolder: () => imap.getMailbox('Drafts').messages,
  inboxFlags: () => imap.getMailbox('INBOX').messages.map((m) => m.flags),
  folderFlags: (folder: string) => imap.getMailbox(folder).messages.map((m) => m.flags),
});

async function stopAll(http: Server, llm: Server, { imap, smtp }: Mailbox, drop: () => Promise<void>): Promise<void> {
  http.closeAllConnections();
  llm.closeAllConnections();
  await Promise.all([closed(http), closed(smtp), closed(llm)]);
  // The IMAP test server has no way to drop idle sockets: stop accepting and let the process exit.
  imap.close();
  imap.server.unref();
  await drop();
}

export async function startStack({ messages = INBOX, folders = {}, env = {} }: StackOptions = {}) {
  const mailbox = await startMailbox(messages, folders);
  const openrouter = fakeOpenRouter();
  const { db, drop } = await testDatabase();
  const http = await startApplication(testConfig(await listen(openrouter.server), env), db);
  return {
    url: `http://127.0.0.1:${(http.address() as AddressInfo).port}`,
    db,
    outbox: mailbox.outbox,
    llmRequests: openrouter.requests,
    ...seenInMailbox(mailbox),
    imapAccount: mailbox.imapAccount,
    stop: () => stopAll(http, openrouter.server, mailbox, drop),
  };
}
