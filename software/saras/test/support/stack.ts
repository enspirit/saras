// A complete local stack for tests and demos: a real IMAP server, a real SMTP server,
// a stand-in for the OpenRouter HTTP API, and the application wired to them.
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createSync } from '../../src/domain/mailboxes/fetch-mailbox.ts';
import { loadConfig } from '../../src/tooling/config.ts';
import type { Config } from '../../src/tooling/config.ts';
import { createVault } from '../../src/tooling/crypto.ts';
import type { Db } from '../../src/tooling/db.ts';
import { createApp } from '../../src/tooling/http/server.ts';
import { createOpenRouter } from '../../src/tooling/llm/openrouter.ts';
import { createPostman } from '../../src/tooling/postman.ts';
import type { Postman } from '../../src/tooling/postman.ts';
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
  /** Gives the server its own outgoing mail, through the test SMTP server: what it sends lands in the outbox. */
  ownMail?: boolean;
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
async function startApplication(config: Config, db: Db, postman: Postman): Promise<Server> {
  const vault = createVault(config.appSecret);
  const mail = createMailService({ db, vault, config });
  const llm = createOpenRouter({ baseUrl: config.openrouter.baseUrl });
  const sync = createSync({ db, mail, config, llm, vault });
  const http = createApp({ config, db, vault, mail, llm, sync, postman }).listen(0, '127.0.0.1');
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

async function stopAll(https: Server[], llm: Server, { imap, smtp }: Mailbox, drop: () => Promise<void>): Promise<void> {
  for (const http of https) http.closeAllConnections();
  llm.closeAllConnections();
  await Promise.all([...https.map(closed), closed(smtp), closed(llm)]);
  // The IMAP test server has no way to drop idle sockets: stop accepting and let the process exit.
  imap.close();
  imap.server.unref();
  await drop();
}

/** The server's own mail: through the test SMTP server when asked, none otherwise. */
const postmanFor = (ownMail: boolean, smtpPort: number): Postman =>
  createPostman({ smtpUrl: ownMail ? `smtp://saras:testpass@127.0.0.1:${smtpPort}` : '', mailFrom: 'saras@server.example' });

const urlOf = (http: Server): string => `http://127.0.0.1:${(http.address() as AddressInfo).port}`;

export async function startStack({ messages = INBOX, folders = {}, env = {}, ownMail = false }: StackOptions = {}) {
  const mailbox = await startMailbox(messages, folders);
  const openrouter = fakeOpenRouter();
  const { db, another, drop } = await testDatabase();
  const config = testConfig(await listen(openrouter.server), env);
  const postman = postmanFor(ownMail, mailbox.imapAccount.smtpPort);
  const servers = [await startApplication(config, db, postman)];
  return {
    url: urlOf(servers[0] as Server),
    /** A second server on the same database, set up as the first: where it is reached. */
    another: async (): Promise<string> => urlOf(servers[servers.push(await startApplication(config, another(), postman)) - 1] as Server),
    db,
    outbox: mailbox.outbox,
    llmRequests: openrouter.requests,
    ...seenInMailbox(mailbox),
    imapAccount: mailbox.imapAccount,
    stop: () => stopAll(servers, openrouter.server, mailbox, drop),
  };
}
