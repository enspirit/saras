// Pure decisions about mailboxes.
import { FETCH_DAYS } from '../../../shared/mailbox.ts';
import type { MailboxServers } from '../../../shared/mailbox.ts';
import { isEmailAddress } from '../../tooling/text.ts';
import type { AccountRow, ImapCredentials, MailFolder, ServerCredentials } from '../model/mailbox.ts';
import { Refusal, accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import type { Actor } from '../world.ts';
import { clipped } from './given.ts';

/** Derived notion "manages a mailbox": its owner; for a shared one, the administrators. */
export const manages = ({ member }: Actor, mailbox: Pick<AccountRow, 'shared' | 'user_id'>): boolean =>
  mailbox.shared ? member.role === 'admin' : mailbox.user_id === member.id;

/** ReqPre of changing or disconnecting a mailbox. */
export const mayManage = (actor: Actor, mailbox: Pick<AccountRow, 'shared' | 'user_id'>): Verdict<true> =>
  manages(actor, mailbox) ? accept(true) : refuse('forbidden', 'mailboxes.adminOnly');

/** Only administrators connect shared mailboxes; anyone else asking for one gets a personal one. */
export const connectsAsShared = ({ member }: Actor, asked: unknown): boolean => member.role === 'admin' && asked === true;

/** ReqPre of ShareMailbox: only administrators decide what every member uses. */
export const mayShareMailbox = ({ member }: Actor): Verdict<true> => (member.role === 'admin' ? accept(true) : refuse('forbidden', 'mailboxes.sharedByAdministrators'));

/** DomPre of ConnectMailbox: an address is connected once per organisation. */
export const addressIsNotConnected = (existing: unknown): Verdict<true> => (existing ? refuse('conflict', 'mailboxes.alreadyConnected') : accept(true));

/** ReqPre of renewing by password: the mailbox is one reached by its servers. */
export const isRenewedByPassword = (mailbox: Pick<AccountRow, 'kind'>): Verdict<true> => (mailbox.kind === 'imap' ? accept(true) : refuse('invalid', 'mailboxes.renewAtHost'));

/** The same servers and user, with a new password. ReqPre: there is one. */
export function withNewPassword(credentials: ImapCredentials, password: unknown): Verdict<ImapCredentials> {
  const pass = String(password || '');
  if (!pass) return refuse('invalid', 'mailboxes.passwordRequired');
  return accept({ imap: { ...credentials.imap, pass }, smtp: { ...credentials.smtp, pass } });
}

/** ReqPre of renewing by sign-in at the host: the member signed in to that very mailbox. */
export const isSameMailbox = (mailbox: Pick<AccountRow, 'kind' | 'email'>, kind: string, address: string): Verdict<true> =>
  mailbox.kind === kind && mailbox.email.toLowerCase() === address.toLowerCase() ? accept(true) : refuse('conflict', 'mailboxes.otherMailbox');

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
  if (!credentials.imap.host || !credentials.smtp.host || !credentials.imap.port || !credentials.smtp.port) return refuse('invalid', 'mailboxes.serversRequired');
  if (!credentials.imap.pass) return refuse('invalid', 'mailboxes.passwordRequired');
  return accept({ email, displayName: clipped(given.displayName, 200), credentials });
}

/** The servers of a mailbox as they are told: everything but the password. */
export const serversTold = ({ imap, smtp }: ImapCredentials): MailboxServers =>
  ({ imapHost: imap.host, imapPort: imap.port, imapSecure: imap.secure, smtpHost: smtp.host, smtpPort: smtp.port, smtpSecure: smtp.secure, username: imap.user });

/** ReqPre of ChangeMailboxServers: both servers with their ports. A password left empty keeps the one the mailbox has. */
export function withServers(current: ImapCredentials, address: string, given: ServersGiven): Verdict<ImapCredentials> {
  const made = serversGiven({ ...given, email: address, password: String(given.password || '') || current.imap.pass });
  return made.ok ? accept(made.value.credentials) : made;
}

/** The name a mailbox shows to recipients, as it is given. */
export const mailboxNameGiven = (given: unknown): string => clipped(given, 200);

/** ReqPre of ChooseWatchedFolder: the folder is one of the mailbox's. */
export function folderAmong<F extends Pick<MailFolder, 'id'>>(folders: F[], wanted: string): Verdict<F> {
  const folder = folders.find((f) => f.id === wanted);
  return folder ? accept(folder) : refuse('invalid', 'mailboxes.unknownFolder');
}

/** How many days back a mailbox is fetched: what was chosen for it, else what the server is set up for; never further than what the server keeps. */
export const daysFetched = (chosen: number | null, { syncDays, retentionDays }: { syncDays: number; retentionDays: number }): number => Math.min(chosen ?? syncDays, retentionDays);

/** What is fetched, as it was given: a number of days among those offered, else left to the server; unread only when said so. */
export const whatIsFetchedGiven = (given: { days?: unknown; unreadOnly?: unknown }): { days: number | null; unreadOnly: boolean } =>
  ({ days: FETCH_DAYS.find((days) => days === Number(given.days)) ?? null, unreadOnly: given.unreadOnly === true });

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

/** How the TLS library says that a server answered in clear where TLS was to start at once: a port that upgrades with STARTTLS, asked for direct TLS. */
const ANSWERED_IN_CLEAR = /wrong version number/i;

/** The refusal of servers that did not let us in: what they answered; or, where one does not start in TLS, what to change, which its answer does not say. */
export const notLetIn = (detail: string): Refusal =>
  ANSWERED_IN_CLEAR.test(detail) ? new Refusal('invalid', 'mailboxes.notDirectTls') : new Refusal('invalid', 'mailboxes.connectionFailed', { detail });

/** The kinds of mailboxes that hand over a file attached to an email. Those reached by their servers, so far. */
export const handsFilesOver = (kind: string): boolean => kind === 'imap';
