// A member of an organisation, an invitation to become one, and what a member is told about themselves.
import type { Organization } from './organization.ts';

export type Role = 'admin' | 'user';

/** A member, as the administrators see them. */
export interface Member {
  id: number;
  email: string;
  /** How the other members see this person; empty until given. */
  name: string;
  role: Role;
  createdAt: string;
  /** Number of personal mailboxes they connected. */
  mailboxes: number;
  /** Whether they have set their second factor up. */
  secondFactor: boolean;
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

/** What opening an invitation link tells: who is invited, and where. */
export interface InvitationOpened {
  email: string;
  organization: string;
}

/** What a signed-in member is told about themselves, their organisation and this server. */
export interface Profile {
  email: string;
  name: string;
  organization: Organization;
  role: Role;
  /** The language the server last knew this member to use. */
  language: string;
  signature: string;
  /** The model in force for them, and the one that applies when they choose none. */
  model: string;
  defaultModel: string;
  hasOwnKey: boolean;
  /** A key is in force for them: their own, the organisation's or the server's. */
  hasKey: boolean;
  /** The mail hosts this server lets members sign in at. */
  oauth: { google: boolean; microsoft: boolean };
  /** The retention policy sent with every request to the AI. */
  privacy: Record<string, unknown>;
  /** Days after which email content is erased; 0 when it is kept. */
  retentionDays: number;
}

/** What anyone may know before signing in. */
export interface WhatVisitorsAreTold {
  allowSignup: boolean;
  /** Whether a lost password can be replaced by a link sent by email; otherwise an administrator gives the link. */
  passwordResetByEmail: boolean;
  /** No account exists yet: the next one created administers the installation. */
  firstAccount: boolean;
  retentionDays: number;
}
