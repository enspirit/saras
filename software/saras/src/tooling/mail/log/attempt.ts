// Getting in at a mail server, as an operator needs it told: which server, whether it let us
// in, in how long — and when it did not, what kind of failure, the server's answer, and what
// its name resolves to from where this server runs.
import { lookup } from 'node:dns/promises';
import type { ServerCredentials } from '../../../domain/model/mailbox.ts';
import { errorKind, errorMessage } from '../../errors.ts';
import { log, logs } from '../../log.ts';
import { hidingOf } from './conversation.ts';

const RESOLVING_MS = 2_000;

const where = ({ host, port, secure }: ServerCredentials) => ({ host, port, secure });

const codeOf = (e: unknown): string => String((e as { code?: unknown } | null)?.code ?? 'failed');

/** The addresses a name resolves to here, or why none: told with a failure, and never worth holding its answer back. */
function resolves(host: string): Promise<string[] | string> {
  const asked = lookup(host, { all: true }).then((found) => found.map((one) => one.address), codeOf);
  const tooLate = new Promise<string>((resolve) => setTimeout(() => resolve('no answer in time'), RESOLVING_MS).unref());
  return Promise.race([asked, tooLate]);
}

async function notLetIn(kind: 'imap' | 'smtp', server: ServerCredentials, started: number, e: unknown): Promise<void> {
  if (!logs('warn')) return;
  const ms = Date.now() - started;
  log.warn(`${kind}: not signed in`, { ...where(server), ms, ...errorKind(e), error: hidingOf(server)(errorMessage(e)), resolves: await resolves(server.host) });
}

/** Runs what connects and signs in at a server, and logs how it ended. What it throws is thrown again. */
export async function attempted<T>(kind: 'imap' | 'smtp', server: ServerCredentials, run: () => Promise<T>): Promise<T> {
  const started = Date.now();
  log.debug(`${kind}: connecting`, where(server));
  try {
    const result = await run();
    log.info(`${kind}: signed in`, { ...where(server), ms: Date.now() - started });
    return result;
  } catch (e) {
    await notLetIn(kind, server, started, e);
    throw e;
  }
}
