// The mail hosts we know for sure, recognised by the end of the names a domain's MX records point at.
import type { MailHost, MailServers } from '../../../shared/mailbox.ts';

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
