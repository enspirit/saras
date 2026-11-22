// Emails as the server keeps them: the boxes they stand in, and one email in full.
import { api } from '../api.ts';
import type { Draft, SentReply } from './replying.ts';

export type EmailStatus = 'pending' | 'needs_reply' | 'no_reply' | 'ignored' | 'sent';
export type BoxId = 'todo' | 'none' | 'sent' | 'ignored';

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

export const readBox = (box: BoxId): Promise<EmailList> => api<EmailList>('GET', `/emails?box=${box}`);
export const readEmail = (id: number): Promise<EmailDetail> => api<EmailDetail>('GET', `/emails/${id}`);
