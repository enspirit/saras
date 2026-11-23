// npm run demo — saras on this machine, with a mailbox of sample emails already connected:
// nothing to set up, nothing kept when it stops, and no email leaves the machine. With an
// OpenRouter key in the environment (or in .env), the AI is the real one; without, everything
// that needs no AI works: reading, sorting by rules, attributes, boards, writing by hand.
import { createSync } from '../src/domain/mailboxes/fetch-mailbox.ts';
import { createTriage } from '../src/domain/sorting/strategies.ts';
import { loadConfig, loadDotEnv } from '../src/tooling/config.ts';
import { createVault } from '../src/tooling/crypto.ts';
import { openDb } from '../src/tooling/db.ts';
import { createApp } from '../src/tooling/http/server.ts';
import { createOpenRouter } from '../src/tooling/llm/openrouter.ts';
import { createMailService } from '../src/tooling/mail/mail-service.ts';
import type { SentMail } from '../test/support/mailbox.ts';
import { startDemoMailbox } from './demo/mailbox.ts';
import { DEMO_ACCOUNT, setUpDemo } from './demo/setup.ts';

loadDotEnv();
const port = process.env.DEMO_PORT || '3210';
// A demo of its own: its own port and secret, an in-memory database, and the sample emails as far back as they go.
const config = loadConfig({ ...process.env, PORT: port, BASE_URL: `http://localhost:${port}`, APP_SECRET: 'demo-secret-demo-secret-demo-secret-0123', ALLOW_SIGNUP: 'true', MFA_ENABLED: 'false', SMTP_URL: '', DATABASE_URL: '', SYNC_DAYS: '14' });
const withAi = Boolean(config.openrouter.apiKey);

/** Says in the terminal what the demo mailbox was given to send: it goes no further. */
function sayWhatIsSent(outbox: SentMail[]): void {
  let said = 0;
  setInterval(() => {
    for (const sent of outbox.slice(said)) console.log(`  (demo) a reply to ${sent.to.join(', ')} was handed to the demo mail server; it goes nowhere.`);
    said = outbox.length;
  }, 1000).unref();
}

const db = await openDb();
const vault = createVault(config.appSecret);
const mail = createMailService({ db, vault, config });
const llm = createOpenRouter({ baseUrl: config.openrouter.baseUrl });
const sync = createSync({ db, mail, triage: createTriage({ config, vault, llm }), config, llm, vault });
const demoMailbox = await startDemoMailbox();
const server = createApp({ config, db, vault, mail, llm, sync }).listen(config.port, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', () => resolve()));

await setUpDemo(config.baseUrl, demoMailbox.imapAccount, withAi);
sayWhatIsSent(demoMailbox.outbox);

console.log(`
saras demo — ${config.baseUrl}

  Sign in with   ${DEMO_ACCOUNT.email}
  Password       ${DEMO_ACCOUNT.password}

  The mailbox holds sample emails; replies you send go nowhere, and nothing is kept when you stop (Ctrl+C).
  ${withAi ? `The AI is the real one (${config.openrouter.model}): it sorts what the rules leave, and writes proposals.` : 'No OpenRouter key: sorting by rules, attributes, boards and writing by hand work; set OPENROUTER_API_KEY to have the AI sort and write.'}
`);
