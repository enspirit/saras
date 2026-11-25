// What `npm run design` makes sure of before it starts anything: that nothing listens where it
// will, that the server has its secret, that the packages are installed.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';

/** Whether a host of this machine accepts a connection on a port. */
const accepts = (host: string, port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect({ host, port });
    const answer = (yes: boolean) => (): void => {
      socket.destroy();
      resolve(yes);
    };
    socket.once('connect', answer(true)).once('error', answer(false)).setTimeout(1000, answer(false));
  });

/** Whether something on this machine already listens on a port, over IPv4 or IPv6. */
export const taken = async (port: number): Promise<boolean> => (await Promise.all(['127.0.0.1', '::1'].map((host) => accepts(host, port)))).some(Boolean);

/**
 * Gives the server its APP_SECRET when it has none, and says whether it did. The secret is made
 * once and kept in the env file: what the database holds of a mailbox is sealed with it, and
 * would be unreadable with another.
 */
export function secretKept(envFile: string): boolean {
  if (process.env.APP_SECRET) return false;
  const secret = randomBytes(32).toString('hex');
  // After what the file holds: of two lines naming a variable, the last one is read.
  appendFileSync(envFile, `${existsSync(envFile) ? '\n' : ''}APP_SECRET=${secret}\n`, { mode: 0o600 });
  process.env.APP_SECRET = secret;
  return true;
}

/** Installs the packages of a directory as its lock file states them, when it has none yet. */
export function installed(directory: string): void {
  if (existsSync(join(directory, 'node_modules'))) return;
  const install = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: directory, stdio: 'inherit', shell: process.platform === 'win32' });
  if (install.status !== 0) throw new Error(`the packages of ${directory} could not be installed`);
}
