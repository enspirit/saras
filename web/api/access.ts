// Access: creating the organisation, signing in and out, invitations, members and their roles,
// passwords, and leaving. One function per operation of OPERATIONS.md, and the lists they act on.
import { api } from '../api.ts';

export type Role = 'admin' | 'user';

export interface PublicInfo {
  allowSignup: boolean;
  /** No account exists yet: the next one created administers the installation. */
  firstAccount?: boolean;
  /** Days after which email content is erased; 0 or absent when it is kept. */
  retentionDays?: number;
}

/** What the sign-in form sends; the organisation and the name count only when one is created. */
export interface SignInDetails {
  email: string;
  password: string;
  organization: string;
  name: string;
  language: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  /** Number of connected mailboxes. */
  accounts: number;
}

export interface Invitation {
  id: number;
  email: string;
  role: Role;
  expiresAt: string;
  expired: boolean;
}

/** Returned once, when the invitation is created: the link cannot be shown again. */
export interface NewInvitation {
  id: number;
  email: string;
  link: string;
  validDays: number;
}

/** What the installation says of itself to a visitor. */
export const readPublicInfo = (): Promise<PublicInfo> => api<PublicInfo>('GET', '/public');
export const createOrganization = (details: SignInDetails): Promise<unknown> => api('POST', '/auth/signup', details);
export const signIn = (details: SignInDetails): Promise<unknown> => api('POST', '/auth/login', details);
export const signOut = (): Promise<unknown> => api('POST', '/auth/logout');

/** Whom the invitation is for, and in which organisation. */
export const checkInvitation = (token: string): Promise<{ email: string; organization: string }> => api<{ email: string; organization: string }>('POST', '/invitations/check', { token });
export const acceptInvitation = (accepted: { token: string; password: string; name: string; language: string }): Promise<unknown> =>
  api('POST', '/invitations/accept', accepted);
export const readInvitations = (): Promise<Invitation[]> => api<Invitation[]>('GET', '/invitations');
export const inviteMember = (email: string, role: string): Promise<NewInvitation> => api<NewInvitation>('POST', '/invitations', { email, role });
export const revokeInvitation = (id: number): Promise<unknown> => api('DELETE', `/invitations/${id}`);

export const readMembers = (): Promise<User[]> => api<User[]>('GET', '/users');
export const appointAdministrator = (id: number): Promise<unknown> => api('PUT', `/users/${id}`, { role: 'admin' });
export const removeAdministratorRole = (id: number): Promise<unknown> => api('PUT', `/users/${id}`, { role: 'user' });
export const deleteMember = (id: number): Promise<unknown> => api('DELETE', `/users/${id}`);

export const changePassword = (current: string, next: string): Promise<unknown> => api('PUT', '/auth/password', { current, next });
export const deleteOwnAccount = (password: string): Promise<unknown> => api('DELETE', '/me', { password });
/** `name` is the organisation's, typed as it is: the server checks it. */
export const deleteOrganization = (password: string, name: string): Promise<unknown> => api('DELETE', '/organization', { password, name });
