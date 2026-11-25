// The mailbox of sample emails (world/mailbox), as the demo organisation is given it: through
// the API, as its administrator would in the interface. The access to a mailbox is sealed with
// the server's own APP_SECRET, so it is given to the server, not carried by a seed.
import type { Call } from './api.ts';

/** The mailbox of sample emails, as the server reaches it: a mail server of its own machine. */
const MAILBOX = {
  email: 'me@corp.example',
  displayName: 'Brightwater Consulting',
  username: 'testuser',
  password: 'testpass',
  imapHost: '127.0.0.1',
  imapPort: 1143,
  imapSecure: false,
  smtpHost: '127.0.0.1',
  smtpPort: 1025,
  smtpSecure: false,
  shared: true,
};

/** How many emails the organisation of who is signed in holds, all boxes together. */
export async function emailsHeld(call: Call): Promise<number> {
  const { counts } = await call<{ counts: Record<string, number> }>('GET', '/emails');
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

/** Connects the mailbox to the organisation of who is signed in, fetches it, and says how many emails the organisation then holds. */
export async function connectMailbox(call: Call): Promise<number> {
  const connected = await call('POST', '/mailboxes/imap', MAILBOX);
  // As far back as the sample emails go.
  await call('PUT', `/mailboxes/${connected.id}/folder`, { folder: 'INBOX', days: 14, unreadOnly: false });
  await call('POST', `/mailboxes/${connected.id}/fetch`);
  return emailsHeld(call);
}
