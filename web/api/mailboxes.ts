// Mailboxes: connecting one, renewing its access, choosing the folder to watch, fetching it,
// disconnecting it. One function per operation of OPERATIONS.md.
import { api } from '../api.ts';
import type { Problem } from '../api.ts';

export interface Account {
  id: number;
  kind: 'imap' | 'google' | 'microsoft';
  email: string;
  displayName: string;
  /** Used by every member of the organisation, not only by who connected it. */
  shared: boolean;
  /** Whether the signed-in user may change its folder or disconnect it. */
  canManage: boolean;
  /** The watched folder; null until the user has chosen it. */
  folder: string | null;
  folderName: string;
  lastSyncAt: string | null;
  lastError: Problem | null;
  /** Emails waiting in this mailbox. */
  todo: number;
}

/** Who hosts the mail of an address, and the servers to propose when that host is known. */
export interface MailHost {
  provider: 'google' | 'microsoft' | 'other';
  servers: { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number } | null;
}

export interface MailFolder {
  id: string;
  name: string;
}

export interface SyncResult {
  fetched: number;
  triaged: number;
  error: Problem | null;
}

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

export const readMailboxes = (): Promise<Account[]> => api<Account[]>('GET', '/accounts');
/** The folders of a mailbox, asked of its provider. */
export const readFolders = (id: number): Promise<MailFolder[]> => api<MailFolder[]>('GET', `/accounts/${id}/folders`);
/** Who hosts the mail of an address, asked of its domain. */
export const readMailHost = (address: string): Promise<MailHost> => api<MailHost>('GET', `/mail/host?email=${encodeURIComponent(address)}`);
export const connectMailboxByServers = (mailbox: MailboxByServers): Promise<unknown> => api('POST', '/accounts/imap', mailbox);
/** Where the browser goes to connect a mailbox by signing in at its host, or with `renew` to give one access again. */
export const hostSignInAddress = (kind: string, query = ''): string => `/api/oauth/${kind}/start${query}`;
export const renewMailboxCredentials = (id: number, password: string): Promise<unknown> => api('PUT', `/accounts/${id}/password`, { password });
export const chooseWatchedFolder = (id: number, folder: string): Promise<unknown> => api('PUT', `/accounts/${id}/folder`, { folder });
export const disconnectMailbox = (id: number): Promise<unknown> => api('DELETE', `/accounts/${id}`);
export const fetchMailbox = (id: number): Promise<SyncResult> => api<SyncResult>('POST', `/accounts/${id}/sync`);
