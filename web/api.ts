/**
 * The HTTP API as the browser sees it: one typed call function, and the shape of what each
 * route returns. These shapes mirror the JSON built in src/tooling/http/app.ts.
 */

import { hasMessage, t } from './i18n.ts';

export class ApiError extends Error {
  status: number;
  /** The server's message code, when it gave one. */
  code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; params?: Problem['params'] };
  if (!res.ok) {
    const text = data.code ? problemText({ code: data.code, params: data.params || {}, message: data.error || '' }) : data.error;
    throw new ApiError(text || t('common.httpError', { status: res.status }), res.status, data.code ?? null);
  }
  return data as T;
}

/** Something the server reports: a code the translation files may know, and its English text. */
export interface Problem {
  code: string;
  params: Record<string, string | number>;
  message: string;
}

/** A server message in the user's language, or its English text when it has no translation. */
export function problemText(problem: Problem): string {
  const key = `server.${problem.code}`;
  return hasMessage(key) ? t(key, problem.params) : problem.message;
}

/**
 * True for the error of a request refused because the session is over. Told by its code, not
 * by the 401 status, which a wrong password also gets.
 */
export const isSignedOut = (e: unknown): boolean => e instanceof ApiError && e.code === 'auth.signedOut';

export type Role = 'admin' | 'user';
export type EmailStatus = 'pending' | 'needs_reply' | 'no_reply' | 'ignored' | 'sent';
export type BoxId = 'todo' | 'none' | 'sent' | 'ignored';

export interface PublicInfo {
  allowSignup: boolean;
  /** No account exists yet: the next one created administers the installation. */
  firstAccount?: boolean;
  /** Days after which email content is erased; 0 or absent when it is kept. */
  retentionDays?: number;
}

/** The organisation of the signed-in user. Its key and model are told to administrators only. */
export interface Organization {
  name: string;
  /** Name of the triage strategy its mailboxes go through. */
  triage: 'none' | 'ai';
  skipAutomated: boolean;
  /** What is prepared at fetch for an email that needs a reply: nothing, a proposal to review here, or one filed in the mailbox's drafts. */
  automation: 'none' | 'draft' | 'mailbox';
  model?: string;
  hasKey?: boolean;
}

export interface Me {
  email: string;
  /** How the other members see this person; empty until given. */
  name: string;
  organization: Organization;
  role: Role;
  /** The language the server last knew this user to use. */
  language: string;
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

/** A prompt as every user sees it; administrators also get the instructions and usage. */
export interface Prompt {
  id: number;
  name: string;
  description: string;
  systemPrompt?: string;
  used?: number;
  edited?: number;
}

/** A ready-made prompt the organisation does not have yet. */
export interface PromptTemplate {
  name: string;
  description: string;
  systemPrompt: string;
}

export interface Correction {
  reason: string;
  /** Address of who made it, and their name when they gave one. */
  user: string;
  userName: string;
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
  /** Address of the mailbox it arrived in, and whether that mailbox is shared. */
  account: string;
  shared: boolean;
  replyMode: 'sent' | 'draft' | null;
}

export interface EmailList {
  emails: EmailSummary[];
  counts: Record<BoxId, number>;
}

/** A proposal by the AI: the result of one of the three kinds of assistance. */
export interface Draft {
  id: number;
  action: 'typos' | 'style' | 'prompt';
  promptId: number | null;
  model: string;
  /** The proposed reply, as HTML. */
  html: string;
  provider?: string | null;
}

export interface SentReply {
  finalText: string;
  /** The reply as rich text; empty for a reply sent before replies were rich text. */
  finalHtml: string;
  wasEdited: boolean;
  changeReason: string;
  mode: 'sent' | 'draft';
  to: string[];
  cc: string[];
  sentAt: string;
  /** Who replied: in a shared mailbox, not necessarily the reader. Their address, and their name when they gave one. */
  by: string | null;
  byName: string | null;
}

export interface Recipients {
  to: string[];
  cc: string[];
}

export interface EmailDetail {
  id: number;
  /** Address of the mailbox the email arrived in, and whether that mailbox is shared. */
  account: string;
  shared: boolean;
  fromName: string;
  fromAddr: string;
  to: { name: string; address: string }[];
  cc: { name: string; address: string }[];
  subject: string;
  date: string;
  bodyText: string;
  attachments: { name: string; type: string; size: number }[];
  status: EmailStatus;
  /** 'rule', 'user', or the name of the triage strategy that decided. */
  triageSource: string | null;
  /** The reason of the triage verdict, and its code when it is one of the server's own. */
  triageReason: string;
  triageReasonCode: string | null;
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
