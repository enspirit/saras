// What looking a mail host up asks of the network: DNS records, and whether a server answers
// as the mail server it should be. Nothing here throws: no answer in time is no answer.
import { Resolver } from 'node:dns/promises';
import { connect as connectPlain } from 'node:net';
import type { Socket } from 'node:net';
import { connect as connectTls } from 'node:tls';
import { log } from '../log.ts';

export interface Endpoint {
  host: string;
  port: number;
}

export interface Network {
  /** The names a domain's MX records point at, best first. */
  mx(domain: string): Promise<string[]>;
  /** The servers an SRV record declares, best first; none when it declares that there is none ("."). */
  srv(name: string): Promise<Endpoint[]>;
  /** Whether a server greets us as an IMAP or an SMTP server does, over TLS where the port means it. */
  answers(kind: 'imap' | 'smtp', endpoint: Endpoint): Promise<boolean>;
}

const TIMEOUT_MS = 2500;
const resolver = (): Resolver => new Resolver({ timeout: TIMEOUT_MS, tries: 1 });

/** No answer is no record; why there was none is for whoever asks the log for everything. */
const none = (record: string, name: string) => (e: unknown): never[] => {
  log.debug('dns: no record', { record, name, code: (e as { code?: unknown } | null)?.code });
  return [];
};

async function mx(domain: string): Promise<string[]> {
  const records = await resolver().resolveMx(domain).catch(none('MX', domain));
  return records.sort((a, b) => a.priority - b.priority).map((record) => record.exchange);
}

async function srv(name: string): Promise<Endpoint[]> {
  const records = await resolver().resolveSrv(name).catch(none('SRV', name));
  return records.filter((record) => record.name && record.name !== '.').sort((a, b) => a.priority - b.priority).map((record) => ({ host: record.name, port: record.port }));
}

/** How each kind of server greets, and the ports where the greeting comes before TLS. */
const GREETING = { imap: /^\* OK/i, smtp: /^220[ -]/ };
const PLAIN_PORTS = new Set([587, 25, 143]);

/** Opens the connection: TLS at once, with a certificate valid for the name, except on the ports that start in clear. */
const opened = ({ host, port }: Endpoint): Socket => (PLAIN_PORTS.has(port) ? connectPlain({ host, port }) : connectTls({ host, port, servername: host }));

const answers = (kind: 'imap' | 'smtp', endpoint: Endpoint): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = opened(endpoint);
    const done = (answer: boolean, how: unknown): void => {
      socket.destroy();
      log.debug('mail host lookup: a usual server was asked', { kind, ...endpoint, answer, how });
      resolve(answer);
    };
    socket.setTimeout(TIMEOUT_MS, () => done(false, 'no answer in time'));
    socket.once('error', (e: NodeJS.ErrnoException) => done(false, e.code ?? e.message));
    socket.once('data', (data) => done(GREETING[kind].test(String(data)), 'spoke first'));
  });

export const realNetwork: Network = { mx, srv, answers };
