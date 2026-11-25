// npm run design — saras on this machine, for who works on its design: the interface, rebundled
// when a file is saved; a mailbox of sample emails beside it (world/mailbox); and the demo
// organisation, set up the first time. Node.js alone: the embedded database, no Docker.
// DESIGN.md, at the root of the repository, says what to look at and what to change.
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { DEMO_ACCOUNT } from './demo/api.ts';
import { demoOn } from './design/demo.ts';
import { installed, secretKept, taken } from './design/ground.ts';

const SARAS = fileURLToPath(new URL('../', import.meta.url));
const MAILBOX = fileURLToPath(new URL('../../../world/mailbox/', import.meta.url));
/** Where the mailbox of sample emails listens: IMAP, SMTP. */
const MAILBOX_PORTS = [1143, 1025];
const ENV_FILE = join(SARAS, '.env');

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const port = Number(process.env.PORT || 3000);
const url = `http://localhost:${port}`;
const started: ChildProcess[] = [];

/** Stops what was started, and this command with it. */
function end(code: number, why = ''): never {
  if (why) console.error(`\n${why}`);
  for (const child of started) child.kill();
  process.exit(code);
}

/** Starts a Node.js process of the session, which ends when one of them does. */
function start(args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): void {
  const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit' });
  child.once('exit', (code) => end(code ?? 1));
  started.push(child);
}

/**
 * Refuses to go on when something already listens where the server or the mailbox would. The
 * demo is set up through whatever answers on the server's port: it must be the server started
 * here, never another saras that holds someone's mail.
 */
async function portsAreFree(): Promise<void> {
  if (await taken(port)) end(1, `Something already listens on port ${port}: another saras, or the Docker stack. Take another port: PORT=${port + 1} npm run design`);
  for (const mail of MAILBOX_PORTS) {
    if (await taken(mail)) end(1, `Something already listens on port ${mail}, where the mailbox of sample emails would: is \`npm run design\` running in another terminal?`);
  }
}

/** Waits for the server to answer, a minute at most. */
async function serverAnswers(): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await fetch(`${url}/api/public`).then((answer) => answer.ok, () => false)) return;
    await sleep(500);
  }
  end(1, 'The server did not answer within a minute. What it said is above.');
}

/** The demo, set up if it was not; or why it could not be, which does not keep the style guide from being looked at. */
const demo = (): Promise<string> =>
  demoOn(url).then(
    (emails) => `Sign in with   ${DEMO_ACCOUNT.email}\n  Password       ${DEMO_ACCOUNT.password}\n\n  The demo organisation holds ${emails} sample emails. A reply you send goes nowhere.`,
    (error: Error) => `The demo organisation could not be set up: the database of this server holds something else.\n  (${error.message})`,
  );

await portsAreFree();
if (secretKept(ENV_FILE)) console.log('An APP_SECRET was made for this checkout and is kept in software/saras/.env, which is not committed.');
installed(SARAS);
installed(MAILBOX);
// Once before the server starts, which refuses to without the interface; then on every change.
if (spawnSync(process.execPath, ['scripts/build.ts'], { cwd: SARAS, stdio: 'inherit' }).status !== 0) end(1, 'The interface could not be bundled.');

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => end(0));
start(['scripts/build.ts', '--watch'], SARAS);
// The server says what goes wrong, and leaves the terminal to what the bundler says.
start(['--watch', 'src/main.ts'], SARAS, { ...process.env, LOG_LEVEL: process.env.LOG_LEVEL || 'warn' });
start(['server.ts'], MAILBOX);
await serverAnswers();

console.log(`
saras, for who works on its design. Ctrl-C stops it.

  Style guide    ${url}/styleguide.html
  Interface      ${url}
  ${await demo()}

  A file saved under web/ or public/design/ is rebundled: refresh the page.
  Another brand: BRAND_DIR=./brands/klaro npm run design
`);
