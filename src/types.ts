/** Shared shapes of the domain. Types only: nothing here exists at run time. */

export interface Address {
  name: string;
  address: string;
}

/** What we keep of an attachment: never its content. */
export interface Attachment {
  name: string;
  /** MIME type. */
  type: string;
  /** In bytes. */
  size: number;
}

/** A folder of a mailbox that can be watched. */
export interface MailFolder {
  /** What the provider identifies it by (IMAP path, Gmail label id, Graph folder id). */
  id: string;
  name: string;
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
  attachments: Attachment[];
  headers: MailHeaders;
  /** Already answered from the user's own mail client, when the provider can tell. */
  answered: boolean;
}

export type EmailStatus = 'pending' | 'needs_reply' | 'no_reply' | 'ignored' | 'sent';
export type Priority = 'high' | 'normal' | 'low';
/** Who decided: the header rules, the user, or a triage strategy by its name ('none', 'ai'…). */
export type TriageSource = string;
export type Role = 'admin' | 'user';
export type AccountKind = 'imap' | 'google' | 'microsoft';
export type OAuthKind = 'google' | 'microsoft';
/** How a reply was handed to the mailbox. */
export type ReplyMode = 'sent' | 'draft';

/** An email once stored. */
export interface Email extends Omit<IncomingEmail, 'headers' | 'answered'> {
  id: number;
  accountId: number;
  /** The folder it was fetched from. */
  folder: string;
  status: EmailStatus;
  triageSource: TriageSource | null;
  triageReason: string;
  priority: Priority;
  suggestedPromptId: number | null;
}

// ---- database rows (snake_case, as PostgreSQL returns them) -------------------------------

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: Role;
  /** Language of the interface as the user last used it: what the server writes for them follows it. */
  language: string;
  model: string | null;
  signature: string;
  openrouter_key_enc: string | null;
  created_at: Date;
}

export interface AccountRow {
  id: number;
  user_id: number;
  kind: AccountKind;
  email: string;
  display_name: string;
  /** Credentials, sealed by the vault. */
  config_enc: string;
  /** The one folder watched, by its provider id. Null until the user has chosen it. */
  folder: string | null;
  folder_name: string;
  last_sync_at: Date | null;
  last_error: string | null;
  created_at: Date;
}

/** What identifies the sender of a reply: enough of an account to build the From header. */
export type Sender = Pick<AccountRow, 'email' | 'display_name'>;

export interface PromptRow {
  id: number;
  user_id: number;
  name: string;
  description: string;
  system_prompt: string;
  created_at: Date;
}

export interface EmailRow {
  id: number;
  account_id: number;
  folder: string;
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
  date: Date;
  body_text: string;
  attachments_json: string;
  status: EmailStatus;
  triage_source: TriageSource | null;
  triage_reason: string;
  priority: Priority;
  suggested_prompt_id: number | null;
  created_at: Date;
}

export interface DraftRow {
  id: number;
  email_id: number;
  prompt_id: number | null;
  model: string;
  instructions: string;
  ai_text: string;
  created_at: Date;
}

export interface InvitationRow {
  id: number;
  email: string;
  role: Role;
  token_hash: string;
  created_by: number | null;
  expires_at: Date;
  created_at: Date;
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
  /** Language of the line introducing the quoted original. */
  language: string;
}

export interface ListQuery {
  /** Provider id of the folder to read. */
  folder: string;
  since: Date;
  limit: number;
  /** Provider ids already stored, not to be fetched again. */
  known: Set<string>;
}

/** What every kind of mailbox knows how to do. */
export interface MailProvider {
  /** Throws when the credentials do not work. */
  verify(): Promise<void>;
  /** The folders that can be watched, the inbox first. */
  listFolders(): Promise<MailFolder[]>;
  /** Emails of a folder that are not in `known` yet. */
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
