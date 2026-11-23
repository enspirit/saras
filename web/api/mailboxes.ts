// Mailboxes: connecting one, renewing its access, choosing the folder to watch, fetching it,
// disconnecting it. One function per operation of OPERATIONS.md.
import type { FetchResult, MailFolder, MailHost, Mailbox, WhatIsFetched } from '../../shared/mailbox.ts';
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
export const disconnectMailbox = (id: number): Promise<unknown> => api('DELETE', `/mailboxes/${id}`);
export const fetchMailbox = (id: number): Promise<FetchResult> => api<FetchResult>('POST', `/mailboxes/${id}/fetch`);
