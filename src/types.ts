/** Shared shapes of the domain. Types only: nothing here exists at run time. */

export interface Address {
  name: string;
  address: string;
}

/** The few headers triage rules look at. */
export interface MailHeaders {
  listUnsubscribe?: string;
  listId?: string;
  autoSubmitted?: string;
  precedence?: string;
}

/** An email as a mail provider hands it over, before it is stored. */
export interface IncomingEmail {
  /** Identifier of the message at the provider (IMAP "uidvalidity:uid", Gmail or Graph id). */
  providerId: string;
  messageId: string | null;
  threadId: string | null;
  /** Space-separated Message-IDs of the References header. */
  refs: string;
  fromName: string;
  fromAddr: string;
  replyTo: string;
  to: Address[];
  cc: Address[];
  subject: string;
  /** ISO 8601. */
  date: string;
  bodyText: string;
  headers: MailHeaders;
  /** Already answered from the user's own mail client, when the provider can tell. */
  answered: boolean;
}

export type EmailStatus = 'pending' | 'needs_reply' | 'no_reply' | 'ignored' | 'sent';
export type Priority = 'high' | 'normal' | 'low';
export type TriageSource = 'rule' | 'ai' | 'user';
export type Role = 'admin' | 'user';
export type AccountKind = 'imap' | 'google' | 'microsoft';
export type OAuthKind = 'google' | 'microsoft';
/** How a reply was handed to the mailbox. */
export type ReplyMode = 'sent' | 'draft';

/** An email once stored. */
export interface Email extends Omit<IncomingEmail, 'headers' | 'answered'> {
  id: number;
  accountId: number;
  status: EmailStatus;
  triageSource: TriageSource | null;
  triageReason: string;
  priority: Priority;
  suggestedPromptId: number | null;
}

// ---- database rows (snake_case, as SQLite returns them) -----------------------------------

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: Role;
  model: string | null;
  signature: string;
  openrouter_key_enc: string | null;
  created_at: string;
}

export interface AccountRow {
  id: number;
  user_id: number;
  kind: AccountKind;
  email: string;
  display_name: string;
  /** Credentials, sealed by the vault. */
  config_enc: string;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
}

/** What identifies the sender of a reply: enough of an account to build the From header. */
export type Sender = Pick<AccountRow, 'email' | 'display_name'>;

export interface PromptRow {
  id: number;
  user_id: number;
  name: string;
  description: string;
  system_prompt: string;
  created_at: string;
}

export interface EmailRow {
  id: number;
  account_id: number;
  provider_id: string;
  message_id: string | null;
  thread_id: string | null;
  refs: string;
  from_name: string;
  from_addr: string;
  reply_to: string;
  to_json: string;
  cc_json: string;
  subject: string;
  date: string;
  body_text: string;
  status: EmailStatus;
  triage_source: TriageSource | null;
  triage_reason: string;
  priority: Priority;
  suggested_prompt_id: number | null;
  created_at: string;
}

export interface DraftRow {
  id: number;
  email_id: number;
  prompt_id: number | null;
  model: string;
  instructions: string;
  ai_text: string;
  created_at: string;
}

export interface InvitationRow {
  id: number;
  email: string;
  role: Role;
  token_hash: string;
  created_by: number | null;
  expires_at: string;
  created_at: string;
}

// ---- credentials kept in the vault ----------------------------------------------------------

export interface ServerCredentials {
  host: string;
  port: number;
  /** TLS from the first byte (ports 993 / 465); otherwise STARTTLS. */
  secure: boolean;
  user: string;
  pass: string;
}

export interface ImapCredentials {
  imap: ServerCredentials;
  smtp: ServerCredentials;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
}

// ---- mail providers -----------------------------------------------------------------------

/** A reply ready to leave: the stored email it answers, its recipients, and the user's text. */
export interface OutgoingReply {
  email: Email;
  to: string[];
  cc: string[];
  text: string;
}

export interface ListQuery {
  since: Date;
  limit: number;
  /** Provider ids already stored, not to be fetched again. */
  known: Set<string>;
}

/** What every kind of mailbox knows how to do. */
export interface MailProvider {
  /** Throws when the credentials do not work. */
  verify(): Promise<void>;
  /** Emails of the inbox that are not in `known` yet. */
  listNew(query: ListQuery): Promise<IncomingEmail[]>;
  send(reply: OutgoingReply): Promise<void>;
  /** Files the reply in the mailbox's drafts instead of sending it. */
  saveDraft(reply: OutgoingReply): Promise<unknown>;
}

// ---- LLM ------------------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatAnswer {
  text: string;
  /** The model that actually answered. */
  model: string;
  /** The provider OpenRouter routed to, when it says so. */
  provider: string | null;
}

export interface Llm {
  chat(request: ChatRequest): Promise<ChatAnswer>;
}

export type Fetch = typeof fetch;
