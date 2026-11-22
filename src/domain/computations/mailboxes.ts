// Pure decisions about mailboxes.
import { isEmailAddress } from '../../tooling/text.ts';
import type { AccountRow, ImapCredentials, MailFolder, ServerCredentials } from '../../types.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import type { Actor } from '../world.ts';
import { clipped } from './given.ts';

/** Derived notion "manages a mailbox": its owner; for a shared one, the administrators. */
export const manages = ({ member }: Actor, mailbox: Pick<AccountRow, 'shared' | 'user_id'>): boolean =>
  mailbox.shared ? member.role === 'admin' : mailbox.user_id === member.id;

/** ReqPre of changing or disconnecting a mailbox. */
export const mayManage = (actor: Actor, mailbox: Pick<AccountRow, 'shared' | 'user_id'>): Verdict<true> =>
  manages(actor, mailbox) ? accept(true) : refuse('forbidden', 'accounts.adminOnly');

/** Only administrators connect shared mailboxes; anyone else asking for one gets a personal one. */
export const connectsAsShared = ({ member }: Actor, asked: unknown): boolean => member.role === 'admin' && asked === true;

/** ReqPre of renewing credentials through ConnectMailbox: nobody takes over someone else's mailbox. */
export const mayRenew = (actor: Actor, existing: Pick<AccountRow, 'shared' | 'user_id'>): Verdict<true> =>
  manages(actor, existing) ? accept(true) : refuse('conflict', 'accounts.alreadyConnected');

/** A valid TCP port, or 0. */
export const portGiven = (value: unknown): number => (Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 65536 ? Number(value) : 0);

/** What a member fills in to connect a mailbox by its mail servers. */
export interface ServersGiven {
  email?: unknown;
  username?: unknown;
  password?: unknown;
  displayName?: unknown;
  shared?: unknown;
  imapHost?: unknown;
  imapPort?: unknown;
  imapSecure?: unknown;
  smtpHost?: unknown;
  smtpPort?: unknown;
  smtpSecure?: unknown;
}

export interface ServersToConnect {
  email: string;
  displayName: string;
  credentials: ImapCredentials;
}

/** ReqPre of ConnectMailboxByServers: an address, both servers with their ports, and a password. */
export function serversGiven(given: ServersGiven): Verdict<ServersToConnect> {
  const email = clipped(given.email, 320).toLowerCase();
  const server = (host: unknown, port: unknown, secure: unknown): ServerCredentials => ({
    host: clipped(host, 255),
    port: portGiven(port),
    secure: Boolean(secure),
    user: clipped(given.username, 320) || email,
    pass: String(given.password || ''),
  });
  const credentials: ImapCredentials = { imap: server(given.imapHost, given.imapPort, given.imapSecure), smtp: server(given.smtpHost, given.smtpPort, given.smtpSecure) };
  if (!isEmailAddress(email)) return refuse('invalid', 'auth.invalidEmail');
  if (!credentials.imap.host || !credentials.smtp.host || !credentials.imap.port || !credentials.smtp.port) return refuse('invalid', 'accounts.serversRequired');
  if (!credentials.imap.pass) return refuse('invalid', 'accounts.passwordRequired');
  return accept({ email, displayName: clipped(given.displayName, 200), credentials });
}

/** ReqPre of ChooseWatchedFolder: the folder is one of the mailbox's. */
export function folderAmong<F extends Pick<MailFolder, 'id'>>(folders: F[], wanted: string): Verdict<F> {
  const folder = folders.find((f) => f.id === wanted);
  return folder ? accept(folder) : refuse('invalid', 'accounts.unknownFolder');
}

/** What we remember, on our side, of a mailbox being connected through its host's sign-in. */
export interface HostSignIn {
  kind: string;
  state: string;
  shared: boolean;
}
export const rememberedSignIn = ({ kind, state, shared }: HostSignIn): string => `${kind}:${state}:${shared ? 'shared' : 'personal'}`;
export function signInRemembered(remembered: string | null | undefined): HostSignIn {
  const [kind = '', state = '', scope] = (remembered || '').split(':');
  return { kind, state, shared: scope === 'shared' };
}

/** ReqPre of completing a host sign-in: it answers the one we started, for the same host. */
export const answersSignIn = (remembered: HostSignIn, kind: string, state: unknown): Verdict<true> =>
  remembered.state && remembered.kind === kind && remembered.state === state ? accept(true) : refuse('gone', 'oauth.expired');
