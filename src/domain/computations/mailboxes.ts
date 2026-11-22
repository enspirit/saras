// Pure decisions about mailboxes.
import { isEmailAddress } from '../../tooling/text.ts';
import type { AccountRow, ImapCredentials, MailFolder, ServerCredentials } from '../model/mailbox.ts';
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

/** DomPre of ConnectMailbox: an address is connected once per organisation. */
export const addressIsNotConnected = (existing: unknown): Verdict<true> => (existing ? refuse('conflict', 'accounts.alreadyConnected') : accept(true));

/** ReqPre of renewing by password: the mailbox is one reached by its servers. */
export const isRenewedByPassword = (mailbox: Pick<AccountRow, 'kind'>): Verdict<true> => (mailbox.kind === 'imap' ? accept(true) : refuse('invalid', 'accounts.renewAtHost'));

/** The same servers and user, with a new password. ReqPre: there is one. */
export function withNewPassword(credentials: ImapCredentials, password: unknown): Verdict<ImapCredentials> {
  const pass = String(password || '');
  if (!pass) return refuse('invalid', 'accounts.passwordRequired');
  return accept({ imap: { ...credentials.imap, pass }, smtp: { ...credentials.smtp, pass } });
}

/** ReqPre of renewing by sign-in at the host: the member signed in to that very mailbox. */
export const isSameMailbox = (mailbox: Pick<AccountRow, 'kind' | 'email'>, kind: string, address: string): Verdict<true> =>
  mailbox.kind === kind && mailbox.email.toLowerCase() === address.toLowerCase() ? accept(true) : refuse('conflict', 'accounts.otherMailbox');

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

/** What we remember, on our side, of a sign-in under way at a mail host: to connect a mailbox, or to renew one. */
export interface HostSignIn {
  kind: string;
  state: string;
  shared: boolean;
  /** The mailbox whose access is renewed, when it is not a new one being connected. */
  renews: number | null;
}
export const rememberedSignIn = ({ kind, state, shared, renews }: HostSignIn): string => `${kind}:${state}:${shared ? 'shared' : 'personal'}${renews ? `:${renews}` : ''}`;
export function signInRemembered(remembered: string | null | undefined): HostSignIn {
  const [kind = '', state = '', scope, renews] = (remembered || '').split(':');
  return { kind, state, shared: scope === 'shared', renews: Number(renews) || null };
}

/** ReqPre of completing a host sign-in: it answers the one we started, for the same host. */
export const answersSignIn = (remembered: HostSignIn, kind: string, state: unknown): Verdict<true> =>
  remembered.state && remembered.kind === kind && remembered.state === state ? accept(true) : refuse('gone', 'oauth.expired');
