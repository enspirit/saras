// A real mailbox for tests: an IMAP server holding its folders, and an SMTP server that
// records what it is given to send.
import hoodiecrow from 'hoodiecrow-imap';
import { SMTPServer } from 'smtp-server';
import type { SMTPServerDataStream, SMTPServerSession } from 'smtp-server';
import { listen } from './listen.ts';

export type Messages = { raw: string; flags?: string[]; internaldate?: Date }[];

/** A message accepted by the SMTP test server. */
export interface SentMail {
  from: string;
  to: string[];
  raw: string;
}

/** The inbox, Sent, Drafts, and the other folders given. */
export function imapServer(messages: Messages, folders: Record<string, Messages>) {
  const others = Object.fromEntries(Object.entries(folders).map(([name, list]) => [name, { messages: structuredClone(list) }]));
  return hoodiecrow({
    plugins: ['ID', 'UIDPLUS', 'SPECIAL-USE', 'LITERALPLUS'],
    storage: {
      INBOX: { messages: structuredClone(messages) },
      '': { separator: '/', folders: { Sent: { 'special-use': '\\Sent' }, Drafts: { 'special-use': '\\Drafts' }, ...others } },
    },
  });
}

const collect = (outbox: SentMail[]) => (stream: SMTPServerDataStream, session: SMTPServerSession, done: () => void): void => {
  let raw = '';
  stream.on('data', (chunk) => (raw += chunk));
  stream.on('end', () => {
    const { mailFrom, rcptTo } = session.envelope;
    outbox.push({ from: mailFrom ? mailFrom.address : '', to: rcptTo.map((r) => r.address), raw });
    done();
  });
};

/** Accepts one password, and keeps what it is given to send in the outbox. */
export const smtpServer = (outbox: SentMail[]): SMTPServer =>
  new SMTPServer({
    disabledCommands: ['STARTTLS'],
    allowInsecureAuth: true,
    onAuth: (auth, _session, cb) => (auth.password === 'testpass' ? cb(null, { user: auth.username }) : cb(new Error('Invalid login'))),
    onData: collect(outbox),
  });

/** What a member fills in to connect this mailbox by its servers. */
export const credentialsFor = (imapPort: number, smtpPort: number) => ({
  email: 'me@corp.example',
  displayName: 'Moi Test',
  username: 'testuser',
  password: 'testpass',
  imapHost: '127.0.0.1',
  imapPort,
  imapSecure: false,
  smtpHost: '127.0.0.1',
  smtpPort,
  smtpSecure: false,
});

/** Both servers listening, with what tests look at afterwards. */
export async function startMailbox(messages: Messages, folders: Record<string, Messages>) {
  const imap = imapServer(messages, folders);
  const outbox: SentMail[] = [];
  const smtp = smtpServer(outbox);
  const imapAccount = credentialsFor(await listen(imap.server), await listen(smtp.server));
  return { imap, smtp, outbox, imapAccount };
}
