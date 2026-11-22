// Where the mail servers of an address are likely to be, so that a newcomer does not have
// to look them up. A few large providers are known; for any other domain the usual names
// are proposed. Nothing is trusted: the connection is tested before anything is saved.

export interface MailServers {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

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

/** The servers to propose for an address, or null while it has no domain. */
export function serversFor(address: string): MailServers | null {
  const domain = address.trim().toLowerCase().split('@')[1] ?? '';
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return null;
  return KNOWN[domain] ?? server(`imap.${domain}`, `smtp.${domain}`);
}
