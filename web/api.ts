/**
 * The HTTP API as the browser sees it: one typed call function, and the shape of what each
 * route returns. These shapes mirror the JSON built in src/app.ts.
 */

import { t } from './i18n.ts';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error || t('common.httpError', { status: res.status }), res.status);
  return data as T;
}

/** True for the error of a request refused because the session is over. */
export const isSignedOut = (e: unknown): boolean => e instanceof ApiError && e.status === 401;

export type Role = 'admin' | 'user';
export type EmailStatus = 'pending' | 'needs_reply' | 'no_reply' | 'ignored' | 'sent';
export type BoxId = 'todo' | 'none' | 'sent' | 'ignored';

export interface PublicInfo {
  allowSignup: boolean;
  /** No account exists yet: the next one created administers the installation. */
  firstAccount?: boolean;
}

export interface Me {
  email: string;
  role: Role;
  signature: string;
  model: string;
  defaultModel: string;
  hasOwnKey: boolean;
  /** An OpenRouter key is available, the user's own or the server's. */
  hasKey: boolean;
  oauth: { google: boolean; microsoft: boolean };
  privacy: Record<string, unknown>;
  retentionDays: number;
}

export interface Account {
  id: number;
  kind: 'imap' | 'google' | 'microsoft';
  email: string;
  displayName: string;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Emails waiting in this mailbox. */
  todo: number;
}

export interface SyncResult {
  fetched: number;
  triaged: number;
  error: string | null;
}

/** A prompt as every user sees it; administrators also get the instructions and usage. */
export interface Prompt {
  id: number;
  name: string;
  description: string;
  systemPrompt?: string;
  used?: number;
  edited?: number;
}

export interface Correction {
  reason: string;
  user: string;
  at: string;
}

export interface EmailSummary {
  id: number;
  fromName: string;
  fromAddr: string;
  subject: string;
  date: string;
  status: EmailStatus;
  priority: 'high' | 'normal' | 'low';
  snippet: string;
  replyMode: 'sent' | 'draft' | null;
}

export interface EmailList {
  emails: EmailSummary[];
  counts: Record<BoxId, number>;
}

export interface Draft {
  id: number;
  promptId: number | null;
  model: string;
  instructions?: string;
  aiText: string;
  provider?: string | null;
}

export interface SentReply {
  finalText: string;
  wasEdited: boolean;
  changeReason: string;
  mode: 'sent' | 'draft';
  to: string[];
  cc: string[];
  sentAt: string;
}

export interface Recipients {
  to: string[];
  cc: string[];
}

export interface EmailDetail {
  id: number;
  /** Address of the mailbox the email arrived in. */
  account: string;
  fromName: string;
  fromAddr: string;
  to: { name: string; address: string }[];
  cc: { name: string; address: string }[];
  subject: string;
  date: string;
  bodyText: string;
  status: EmailStatus;
  triageSource: 'rule' | 'ai' | 'user' | null;
  triageReason: string;
  suggestedPromptId: number | null;
  recipients: Recipients;
  /** Recipients of a reply to all. */
  recipientsAll: Recipients;
  draft: Draft | null;
  reply: SentReply | null;
}

export interface User {
  id: number;
  email: string;
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
