// The mailbox of the stack: a mail server holding the sample emails, and an outgoing server
// that keeps what it is given to send. Nothing leaves the machine, and nothing is kept when
// it stops.
//
//   IMAP  127.0.0.1:1143   user `testuser`, password `testpass`, no TLS
//   SMTP  127.0.0.1:1025   the same password, no TLS
//
// On 127.0.0.1 only: it runs in the network of the saras container, for which it is a local
// mail server, the one kind saras lets be without TLS.
import hoodiecrow from 'hoodiecrow-imap';
import { SMTPServer } from 'smtp-server';
import { AUTOMATED, CLIENTS } from './emails.ts';
import { message } from './messages.ts';

const HOST = '127.0.0.1';
const IMAP_PORT = 1143;
const SMTP_PORT = 1025;
const PASSWORD = 'testpass';

/** Every sample email in the inbox, the oldest first as a mailbox has them; and the folders a reply or a draft is filed in. */
const imap = hoodiecrow({
  plugins: ['ID', 'UIDPLUS', 'SPECIAL-USE', 'LITERALPLUS'],
  storage: {
    INBOX: { messages: [...CLIENTS, ...AUTOMATED].sort((a, b) => b.hoursAgo - a.hoursAgo).map(message) },
    '': { separator: '/', folders: { Sent: { 'special-use': '\\Sent' }, Drafts: { 'special-use': '\\Drafts' } } },
  },
});

/** Accepts one password; says what it was given to send, and sends nothing. */
const smtp = new SMTPServer({
  disabledCommands: ['STARTTLS'],
  allowInsecureAuth: true,
  onAuth: (auth, _session, done) => (auth.password === PASSWORD ? done(null, { user: auth.username }) : done(new Error('Invalid login'))),
  onData: (stream, session, done) => {
    stream.on('data', () => {});
    stream.on('end', () => {
      console.log(`A reply to ${session.envelope.rcptTo.map((to) => to.address).join(', ')} was handed to the mailbox of the stack; it goes nowhere.`);
      done();
    });
  },
});

imap.listen(IMAP_PORT, HOST, () => console.log(`IMAP on ${HOST}:${IMAP_PORT}, ${CLIENTS.length + AUTOMATED.length} sample emails in the inbox`));
smtp.listen(SMTP_PORT, HOST, () => console.log(`SMTP on ${HOST}:${SMTP_PORT}`));

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => process.exit(0));
