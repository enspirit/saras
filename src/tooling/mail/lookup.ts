// Who hosts the mail of a domain, read from its MX records: enough to steer a newcomer to
// the right way of connecting, and to propose the servers of the hosts we know.
import type { MailHost } from '../../../shared/mailbox.ts';
import { Resolver } from 'node:dns/promises';

export interface MailServers {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

/** 'google' and 'microsoft' can be connected by signing in at the provider; 'other' goes through IMAP / SMTP. */
const servers = (imapHost: string, smtpHost: string, smtpPort = 465): MailServers => ({ imapHost, imapPort: 993, smtpHost, smtpPort });

/** Hosts recognised by the end of their MX names. */
const HOSTS: { suffixes: string[]; host: MailHost }[] = [
  { suffixes: ['.google.com', '.googlemail.com'], host: { provider: 'google', servers: servers('imap.gmail.com', 'smtp.gmail.com') } },
  { suffixes: ['.outlook.com', '.office365.com'], host: { provider: 'microsoft', servers: servers('outlook.office365.com', 'smtp.office365.com', 587) } },
  { suffixes: ['.messagingengine.com'], host: { provider: 'other', servers: servers('imap.fastmail.com', 'smtp.fastmail.com') } },
  { suffixes: ['.mail.ovh.net'], host: { provider: 'other', servers: servers('ssl0.ovh.net', 'ssl0.ovh.net') } },
  { suffixes: ['.gandi.net'], host: { provider: 'other', servers: servers('mail.gandi.net', 'mail.gandi.net') } },
  { suffixes: ['.infomaniak.ch', '.infomaniak.com'], host: { provider: 'other', servers: servers('mail.infomaniak.com', 'mail.infomaniak.com') } },
  { suffixes: ['.zoho.eu'], host: { provider: 'other', servers: servers('imap.zoho.eu', 'smtp.zoho.eu') } },
  { suffixes: ['.zoho.com'], host: { provider: 'other', servers: servers('imap.zoho.com', 'smtp.zoho.com') } },
  { suffixes: ['.yahoodns.net'], host: { provider: 'other', servers: servers('imap.mail.yahoo.com', 'smtp.mail.yahoo.com') } },
  { suffixes: ['.icloud.com'], host: { provider: 'other', servers: servers('imap.mail.me.com', 'smtp.mail.me.com', 587) } },
];

const UNKNOWN: MailHost = { provider: 'other', servers: null };

/** Pure: the host that a list of MX names points at; unknown when none is recognised. */
export function classifyMx(exchanges: string[]): MailHost {
  for (const exchange of exchanges) {
    const name = `.${exchange.toLowerCase().replace(/\.$/, '')}`;
    const known = HOSTS.find((h) => h.suffixes.some((suffix) => name.endsWith(suffix)));
    if (known) return known.host;
  }
  return UNKNOWN;
}

/** The domain of an address, when it looks like one that can be looked up. */
export function domainOf(address: string): string | null {
  const domain = address.trim().toLowerCase().split('@')[1] ?? '';
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) && domain.length <= 253 ? domain : null;
}

/** Looks the domain's MX records up, best first. A domain that does not answer in time is unknown, never an error. */
export async function lookupMailHost(address: string): Promise<MailHost> {
  const domain = domainOf(address);
  if (!domain) return UNKNOWN;
  try {
    const records = await new Resolver({ timeout: 2000, tries: 1 }).resolveMx(domain);
    return classifyMx(records.sort((a, b) => a.priority - b.priority).map((r) => r.exchange));
  } catch {
    return UNKNOWN;
  }
}
