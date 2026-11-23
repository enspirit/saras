// Where the mail of an address is hosted, and the servers to reach it by. Only what is sure is
// proposed: a host we know by the domain's MX records, servers the domain itself declares
// (SRV records), or usual names that were just seen to answer as mail servers. Otherwise nothing.
import type { MailHost, MailServers } from '../../../shared/mailbox.ts';
import { classifyMx } from './known-hosts.ts';
import { realNetwork } from './network.ts';
import type { Endpoint, Network } from './network.ts';

const UNKNOWN: MailHost = { provider: 'other', servers: null };

/** The domain of an address, when it looks like one that can be looked up. */
export function domainOf(address: string): string | null {
  const domain = address.trim().toLowerCase().split('@')[1] ?? '';
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) && domain.length <= 253 ? domain : null;
}

/** Pure: where a domain's servers usually are, most likely first. A mail exchanger of its own often serves the mailboxes too. */
export function usualServers(domain: string, exchanges: string[]): { imap: Endpoint[]; smtp: Endpoint[] } {
  const own = exchanges.map((name) => name.toLowerCase().replace(/\.$/, '')).filter((name) => name.endsWith(`.${domain}`));
  const imapHosts = [...new Set([`imap.${domain}`, `mail.${domain}`, ...own])];
  const smtpHosts = [...new Set([`smtp.${domain}`, `mail.${domain}`, ...own])];
  return {
    imap: imapHosts.map((host) => ({ host, port: 993 })),
    smtp: [...smtpHosts.map((host) => ({ host, port: 465 })), ...smtpHosts.map((host) => ({ host, port: 587 }))],
  };
}

const paired = (imap: Endpoint | null, smtp: Endpoint | null): MailServers | null =>
  imap && smtp ? { imapHost: imap.host, imapPort: imap.port, smtpHost: smtp.host, smtpPort: smtp.port } : null;

/** The first of these that answers as the mail server it should be; all are asked at once. */
async function firstAnswering(net: Network, kind: 'imap' | 'smtp', candidates: Endpoint[]): Promise<Endpoint | null> {
  const answers = await Promise.all(candidates.map((candidate) => net.answers(kind, candidate)));
  return candidates.find((_, index) => answers[index]) ?? null;
}

/** What the domain declares for itself (RFC 6186), then its usual names, each kept only if it answers. */
async function serversSeenToAnswer(net: Network, domain: string, exchanges: string[]): Promise<MailServers | null> {
  const [imaps, submissions, submission] = await Promise.all([net.srv(`_imaps._tcp.${domain}`), net.srv(`_submissions._tcp.${domain}`), net.srv(`_submission._tcp.${domain}`)]);
  const usual = usualServers(domain, exchanges);
  const [imap, smtp] = await Promise.all([
    firstAnswering(net, 'imap', [...imaps, ...usual.imap]),
    firstAnswering(net, 'smtp', [...submissions, ...submission, ...usual.smtp]),
  ]);
  return paired(imap, smtp);
}

/** A domain that does not answer in time is unknown, never an error. */
export async function lookupMailHost(address: string, net: Network = realNetwork): Promise<MailHost> {
  const domain = domainOf(address);
  if (!domain) return UNKNOWN;
  const exchanges = await net.mx(domain);
  const known = classifyMx(exchanges);
  if (known.servers) return known;
  return { provider: 'other', servers: await serversSeenToAnswer(net, domain, exchanges) };
}
