// The mail servers of the few public domains we know for sure, proposed while the address is
// typed. For any other domain nothing is guessed: the server is asked who hosts it
// (GET /mail/host) and proposes servers only when it is sure of them.
import type { MailServers } from '../shared/mailbox.ts';

const server = (imapHost: string, smtpHost: string, smtpPort = 465): MailServers => ({ imapHost, imapPort: 993, smtpHost, smtpPort });

const KNOWN: Record<string, MailServers> = {
  'gmail.com': server('imap.gmail.com', 'smtp.gmail.com'),
  'googlemail.com': server('imap.gmail.com', 'smtp.gmail.com'),
  'outlook.com': server('outlook.office365.com', 'smtp.office365.com', 587),
  'hotmail.com': server('outlook.office365.com', 'smtp.office365.com', 587),
  'live.com': server('outlook.office365.com', 'smtp.office365.com', 587),
  'yahoo.com': server('imap.mail.yahoo.com', 'smtp.mail.yahoo.com'),
  'icloud.com': server('imap.mail.me.com', 'smtp.mail.me.com', 587),
  'me.com': server('imap.mail.me.com', 'smtp.mail.me.com', 587),
  'fastmail.com': server('imap.fastmail.com', 'smtp.fastmail.com'),
};

/** The domain of an address being typed, once it looks like one. */
export function domainOf(address: string): string | null {
  const domain = address.trim().toLowerCase().split('@')[1] ?? '';
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

/** The servers of an address at a domain we know; null for any other. */
export const serversFor = (address: string): MailServers | null => KNOWN[domainOf(address) ?? ''] ?? null;
