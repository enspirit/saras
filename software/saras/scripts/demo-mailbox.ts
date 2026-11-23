// node scripts/demo-mailbox.ts <url> — connects the mailbox of the stack (world/mailbox) to
// the demo organisation of a saras server, as its administrator would in the interface, and
// fetches it. Part of `emb run demo`, after the seed: the access to a mailbox is sealed with
// the server's own APP_SECRET, so it is given to the server, not carried by a seed.
import { DEMO_ACCOUNT, caller, serverGiven } from './demo/api.ts';

/** The mailbox of the stack, as the server reaches it: a mail server of its own machine. */
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

const url = serverGiven('demo-mailbox.ts');
const call = caller(url);
await call('POST', '/auth/login', { email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password });
const connected = await call('POST', '/mailboxes/imap', MAILBOX);
// As far back as the sample emails go.
await call('PUT', `/mailboxes/${connected.id}/folder`, { folder: 'INBOX', days: 14, unreadOnly: false });
await call('POST', `/mailboxes/${connected.id}/fetch`);

const { counts } = await call<{ counts: Record<string, number> }>('GET', '/emails');
const fetched = Object.values(counts).reduce((sum, count) => sum + count, 0);
if (fetched === 0) {
  console.error('The mailbox of the stack is connected, but no email was fetched from it.');
  process.exit(1);
}
console.log(`The mailbox of the stack is connected to the demo organisation: ${fetched} emails.`);
