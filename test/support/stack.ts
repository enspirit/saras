// A complete local stack for tests and demos: a real IMAP server, a real SMTP server,
// a stand-in for the OpenRouter HTTP API, and the application wired to them.
import hoodiecrow from 'hoodiecrow-imap';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo, Server } from 'node:net';
import pg from 'pg';
import { SMTPServer } from 'smtp-server';
import { createApp } from '../../src/tooling/http/server.ts';
import { loadConfig } from '../../src/tooling/config.ts';
import { createVault } from '../../src/tooling/crypto.ts';
import { openDb } from '../../src/tooling/db.ts';
import type { Db } from '../../src/tooling/db.ts';
import { createOpenRouter } from '../../src/tooling/llm/openrouter.ts';
import { createMailService } from '../../src/tooling/mail/mail-service.ts';
import { createSync } from '../../src/domain/mailboxes/fetch-mailbox.ts';
import { createTriage } from '../../src/domain/sorting/index.ts';
import type { ChatMessage } from '../../src/domain/model/llm.ts';

/** Listen on a free local port and return it. */
const listen = (server: Server): Promise<number> =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));

const recent = (hoursAgo: number): string => new Date(Date.now() - hoursAgo * 3_600_000).toUTCString();

export const INBOX = [
  [
    'From: "Claire Martin" <claire@client.example>',
    'To: me@corp.example',
    'Cc: paul@client.example',
    'Subject: Demande de devis pour 20 licences',
    'Message-ID: <devis-1@client.example>',
    `Date: ${recent(2)}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Bonjour,',
    '',
    'Nous souhaitons equiper 20 personnes. Pouvez-vous nous envoyer un devis',
    'et nous indiquer vos disponibilites pour un appel la semaine prochaine ?',
    '',
    'Bien a vous,',
    'Claire Martin',
  ],
  [
    'From: "La Lettre Tech" <newsletter@media.example>',
    'To: me@corp.example',
    'Subject: Les 10 actus de la semaine',
    'Message-ID: <nl-1@media.example>',
    'List-Unsubscribe: <mailto:unsub@media.example>',
    `Date: ${recent(5)}`,
    '',
    'CONTENU-NEWSLETTER qui ne doit jamais partir vers le LLM.',
  ],
  [
    'From: "Marc Dubois" <marc@partner.example>',
    'To: me@corp.example',
    'Subject: Merci pour hier',
    'Message-ID: <merci-1@partner.example>',
    `Date: ${recent(8)}`,
    '',
    'Merci pour la reunion, tout est clair de notre cote.',
  ],
  [
    'From: "Sophie Leroy" <sophie@client.example>',
    'To: me@corp.example',
    'Subject: Report de notre rendez-vous',
    'Message-ID: <rdv-1@client.example>',
    `Date: ${recent(20)}`,
    '',
    'Bonjour, serait-il possible de decaler notre rendez-vous de jeudi ?',
  ],
].map((lines) => ({ raw: lines.join('\r\n') }));

/** Speaks just enough of the OpenRouter chat-completions protocol, and records what it was sent. */
/** A request received by the OpenRouter stand-in. */
export interface RecordedLlmRequest {
  authorization: string | undefined;
  body: { model: string; messages: ChatMessage[]; provider?: unknown };
}

/** A message accepted by the SMTP test server. */
export interface SentMail {
  from: string;
  to: string[];
  raw: string;
}

export type Stack = Awaited<ReturnType<typeof startStack>>;

function fakeOpenRouter() {
  const requests: RecordedLlmRequest[] = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw) as RecordedLlmRequest['body'];
      requests.push({ authorization: req.headers.authorization, body });
      const reply = (status: number, json: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(json));
      if (body.model === 'nozdr/model') {
        return reply(404, { error: { code: 404, message: 'No endpoints found matching your data policy.' } });
      }
      const [system, user] = body.messages as [ChatMessage, ChatMessage];
      let content: string;
      if (system.content.includes('You triage the inbox')) {
        // One decision per email of the batch, as the AI triage strategy asks.
        const promptId = Number(system.content.match(/id (\d+): (?:Appointment scheduling|Prise de rendez-vous)/)?.[1]) || null;
        const decisions = [...user.content.matchAll(/<email id="(\d+)">([\s\S]*?)<\/email>/g)].map(([, id, mail = '']) => {
          const needs = !/Merci pour la reunion/.test(mail);
          return {
            id: Number(id),
            needs_reply: needs,
            reason: needs ? 'Une réponse est attendue.' : 'Simple remerciement.',
            prompt_id: /rendez-vous/.test(mail) ? promptId : null,
            priority: /devis/.test(mail) ? 'high' : 'normal',
          };
        });
        content = JSON.stringify(decisions);
      } else {
        const written = user.content.match(/<draft>\n([\s\S]*)\n<\/draft>/)?.[1] ?? '';
        if (system.content.startsWith('You are a proofreader')) {
          // Corrects one known mistake and, like a careless model, wraps its answer in a code fence.
          content = '```html\n' + written.replace('reponse', 'réponse') + '\n```';
        } else if (system.content.startsWith('You are an editor')) {
          content = written.replace('<p>', '<p>Bien cordialement, ') + '<script>alert(1)</script><img src=x onerror=alert(2)>';
        } else {
          content = '<p>Bonjour,</p><p>Merci pour votre message. Voici notre proposition : [À COMPLÉTER : montant].</p><p>Cordialement</p>';
        }
      }
      reply(200, { model: body.model, provider: 'FakeZDR', choices: [{ message: { role: 'assistant', content } }] });
    });
  });
  return { server, requests };
}

interface StackOptions {
  /** Folders of the mailbox besides the inbox, Sent and Drafts, with their messages. */
  folders?: Record<string, { raw: string }[]>;
  messages?: { raw: string }[];
  /** Environment variables overriding the test defaults. */
  env?: Record<string, string>;
}

/**
 * The database of a test run: by default the embedded PostgreSQL, in memory. With
 * TEST_DATABASE_URL set, a PostgreSQL server instead, where each stack gets a schema of its
 * own so that test files running side by side do not see each other's rows.
 */
async function testDatabase(): Promise<{ db: Db; drop: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const db = await openDb();
    return { db, drop: () => db.close() };
  }
  const schema = `test_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set('options', `-c search_path=${schema}`);
  const db = await openDb({ databaseUrl: scoped.toString() });
  return {
    db,
    async drop() {
      await db.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    },
  };
}

export async function startStack({ messages = INBOX, folders = {}, env = {} }: StackOptions = {}) {
  const imap = hoodiecrow({
    plugins: ['ID', 'UIDPLUS', 'SPECIAL-USE', 'LITERALPLUS'],
    storage: {
      INBOX: { messages: structuredClone(messages) },
      '': {
        separator: '/',
        folders: {
          Sent: { 'special-use': '\\Sent' },
          Drafts: { 'special-use': '\\Drafts' },
          ...Object.fromEntries(Object.entries(folders).map(([name, list]) => [name, { messages: structuredClone(list) }])),
        },
      },
    },
  });
  const imapPort = await listen(imap.server);

  const outbox: SentMail[] = [];
  const smtp = new SMTPServer({
    disabledCommands: ['STARTTLS'],
    allowInsecureAuth: true,
    onAuth: (auth, session, cb) => (auth.password === 'testpass' ? cb(null, { user: auth.username }) : cb(new Error('Invalid login'))),
    onData(stream, session, cb) {
      let raw = '';
      stream.on('data', (c) => (raw += c));
      stream.on('end', () => {
        const { mailFrom, rcptTo } = session.envelope;
        outbox.push({ from: mailFrom ? mailFrom.address : '', to: rcptTo.map((r) => r.address), raw });
        cb();
      });
    },
  });
  const smtpPort = await listen(smtp.server);

  const openrouter = fakeOpenRouter();
  const openrouterPort = await listen(openrouter.server);

  const config = loadConfig({
    APP_SECRET: 'test-secret-test-secret-test-secret-0123',
    OPENROUTER_API_KEY: 'sk-or-test',
    OPENROUTER_BASE_URL: `http://127.0.0.1:${openrouterPort}`,
    OPENROUTER_MODEL: 'test/model',
    ALLOW_SIGNUP: 'true',
    ...env,
  });
  const { db, drop } = await testDatabase();
  const vault = createVault(config.appSecret);
  const mail = createMailService({ db, vault, config });
  const llm = createOpenRouter({ baseUrl: config.openrouter.baseUrl });
  const triage = createTriage({ config, vault, llm });
  const sync = createSync({ db, mail, triage, config, llm, vault });
  const http = createApp({ config, db, vault, mail, llm, sync }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => http.once('listening', () => resolve()));

  return {
    url: `http://127.0.0.1:${(http.address() as AddressInfo).port}`,
    db,
    outbox,
    llmRequests: openrouter.requests,
    sentFolder: () => imap.getMailbox('Sent').messages,
    draftsFolder: () => imap.getMailbox('Drafts').messages,
    inboxFlags: () => imap.getMailbox('INBOX').messages.map((m) => m.flags),
    folderFlags: (folder: string) => imap.getMailbox(folder).messages.map((m) => m.flags),
    imapAccount: {
      email: 'me@corp.example',
      displayName: 'Moi Test',
      username: 'testuser',
      password: 'testpass',
      imapHost: '127.0.0.1',
      imapPort,
      imapSecure: false,
      smtpHost: '127.0.0.1',
      smtpPort,
      smtpSecure: false,
    },
    async stop() {
      http.closeAllConnections();
      openrouter.server.closeAllConnections();
      await Promise.all([
        new Promise<void>((r) => http.close(() => r())),
        new Promise<void>((r) => smtp.close(() => r())),
        new Promise<void>((r) => openrouter.server.close(() => r())),
      ]);
      // The IMAP test server has no way to drop idle sockets: stop accepting and let the process exit.
      imap.close();
      imap.server.unref();
      await drop();
    },
  };
}
