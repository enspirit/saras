// Mailboxes: connecting one, renewing its access, choosing the folder to watch, fetching it,
// disconnecting it. One function per operation of doc/2-operations.md.
import type { FetchResult, MailFolder, MailHost, Mailbox, MailboxServers, WhatIsFetched } from '../../shared/mailbox.ts';
import { api } from '../api.ts';

/** What "Test and connect" sends for a mailbox reached by its servers. */
export interface MailboxByServers {
  email: string;
  displayName: string;
  username: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  shared: boolean;
}

export const readMailboxes = (): Promise<Mailbox[]> => api<Mailbox[]>('GET', '/mailboxes');
/** The folders of a mailbox, asked of its provider. */
export const readFolders = (id: number): Promise<MailFolder[]> => api<MailFolder[]>('GET', `/mailboxes/${id}/folders`);
/** Who hosts the mail of an address, asked of its domain. */
export const readMailHost = (address: string): Promise<MailHost> => api<MailHost>('GET', `/mail/host?email=${encodeURIComponent(address)}`);
export const connectMailboxByServers = (mailbox: MailboxByServers): Promise<unknown> => api('POST', '/mailboxes/imap', mailbox);
/** Where the browser goes to connect a mailbox by signing in at its host, or with `renew` to give one access again. */
export const hostSignInAddress = (kind: string, query = ''): string => `/api/oauth/${kind}/start${query}`;
export const renewMailboxCredentials = (id: number, password: string): Promise<unknown> => api('PUT', `/mailboxes/${id}/password`, { password });
export const chooseWatchedFolder = (id: number, folder: string, fetched: WhatIsFetched): Promise<unknown> => api('PUT', `/mailboxes/${id}/folder`, { folder, ...fetched });
/** The servers a mailbox is reached by, for who manages it; never its password. */
export const readMailboxServers = (id: number): Promise<MailboxServers> => api<MailboxServers>('GET', `/mailboxes/${id}/servers`);
/** ChangeMailboxServers: an empty password keeps the one the mailbox has. */
export const changeMailboxServers = (id: number, servers: MailboxServers & { password: string }): Promise<unknown> => api('PUT', `/mailboxes/${id}/servers`, servers);
/** NameMailbox: the name its replies show to recipients. */
export const nameMailbox = (id: number, displayName: string): Promise<unknown> => api('PUT', `/mailboxes/${id}/name`, { displayName });
/** ShareMailbox: every member of the organisation uses it from then on. */
export const shareMailbox = (id: number): Promise<unknown> => api('PUT', `/mailboxes/${id}/shared`);
export const disconnectMailbox = (id: number): Promise<unknown> => api('DELETE', `/mailboxes/${id}`);
export const fetchMailbox = (id: number): Promise<FetchResult> => api<FetchResult>('POST', `/mailboxes/${id}/fetch`);
