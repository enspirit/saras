// A complete local stack for tests and demos: a real IMAP server, a real SMTP server,
// a stand-in for the OpenRouter HTTP API, and the application wired to them.
import hoodiecrow from 'hoodiecrow-imap';
import { createServer } from 'node:http';
import { SMTPServer } from 'smtp-server';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { createVault } from '../../src/crypto.js';
import { openDb } from '../../src/db.js';
import { createOpenRouter } from '../../src/llm/openrouter.js';
import { createMailService } from '../../src/mail/index.js';
import { createSync } from '../../src/sync.js';

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

const recent = (hoursAgo) => new Date(Date.now() - hoursAgo * 3_600_000).toUTCString();

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
function fakeOpenRouter() {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw);
      requests.push({ authorization: req.headers.authorization, body });
      const reply = (status, json) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(json));
      if (body.model === 'nozdr/model') {
        return reply(404, { error: { code: 404, message: 'No endpoints found matching your data policy.' } });
      }
      const [system, user] = body.messages;
      let content;
      if (system.content.includes('Tu tries la boîte')) {
        const needs = !/Merci pour la reunion/.test(user.content);
        const promptId = Number(system.content.match(/id (\d+) : Prise de rendez-vous/)?.[1]) || null;
        content = JSON.stringify({
          needs_reply: needs,
          reason: needs ? 'Une réponse est attendue.' : 'Simple remerciement.',
          prompt_id: /rendez-vous/.test(user.content) ? promptId : null,
          priority: /devis/.test(user.content) ? 'high' : 'normal',
        });
      } else {
        content = 'Bonjour,\n\nMerci pour votre message. Voici notre proposition : [À COMPLÉTER : montant].\n\nCordialement';
      }
      reply(200, { model: body.model, provider: 'FakeZDR', choices: [{ message: { role: 'assistant', content } }] });
    });
  });
  return { server, requests };
}

export async function startStack({ dbPath = ':memory:', messages = INBOX, env = {} } = {}) {
  const imap = hoodiecrow({
    plugins: ['ID', 'UIDPLUS', 'SPECIAL-USE', 'LITERALPLUS'],
    storage: {
      INBOX: { messages: structuredClone(messages) },
      '': { separator: '/', folders: { Sent: { 'special-use': '\\Sent' } } },
    },
  });
  const imapPort = await listen(imap.server);

  const outbox = [];
  const smtp = new SMTPServer({
    disabledCommands: ['STARTTLS'],
    allowInsecureAuth: true,
    onAuth: (auth, session, cb) => (auth.password === 'testpass' ? cb(null, { user: auth.username }) : cb(new Error('Invalid login'))),
    onData(stream, session, cb) {
      let raw = '';
      stream.on('data', (c) => (raw += c));
      stream.on('end', () => {
        outbox.push({ from: session.envelope.mailFrom.address, to: session.envelope.rcptTo.map((r) => r.address), raw });
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
    ...env,
  });
  const db = openDb(dbPath);
  const vault = createVault(config.appSecret);
  const mail = createMailService({ db, vault, config });
  const llm = createOpenRouter({ baseUrl: config.openrouter.baseUrl });
  const sync = createSync({ db, mail, llm, config, vault });
  const http = createApp({ config, db, vault, mail, llm, sync }).listen(0, '127.0.0.1');
  await new Promise((resolve) => http.once('listening', resolve));

  return {
    url: `http://127.0.0.1:${http.address().port}`,
    db,
    outbox,
    llmRequests: openrouter.requests,
    sentFolder: () => imap.getMailbox('Sent').messages,
    inboxFlags: () => imap.getMailbox('INBOX').messages.map((m) => m.flags),
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
        new Promise((r) => http.close(r)),
        new Promise((r) => smtp.close(r)),
        new Promise((r) => openrouter.server.close(r)),
      ]);
      // The IMAP test server has no way to drop idle sockets: stop accepting and let the process exit.
      imap.close();
      imap.server.unref();
      db.close();
    },
  };
}
