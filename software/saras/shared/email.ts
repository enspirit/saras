// An email, where it stands, and the boxes members see their emails in.
import type { ValueOfEmail } from './attribute.ts';
import type { Proposal, Reply, ReplyMode } from './reply.ts';

/** Where an email stands: waiting to be sorted, to handle, needing no reply, ignored, replied. */
export type EmailStatus = 'pending' | 'needs_reply' | 'no_reply' | 'ignored' | 'sent';
export type Priority = 'high' | 'normal' | 'low';

/** The boxes, and the statuses each one shows. An email waiting to be sorted is to handle. */
export const BOXES = { todo: ['needs_reply', 'pending'], none: ['no_reply'], sent: ['sent'], ignored: ['ignored'] } as const satisfies Record<string, readonly EmailStatus[]>;
export type Box = keyof typeof BOXES;

export interface Address {
  name: string;
  address: string;
}

/** A file attached to an email. Only its description is kept, never its content. */
export interface Attachment {
  name: string;
  type: string;
  size: number;
}

/** An email as a line of a box. */
export interface EmailSummary {
  id: number;
  fromName: string;
  fromAddr: string;
  subject: string;
  date: string;
  status: EmailStatus;
  priority: Priority;
  /** 'rule', 'user', 'none', or the name of the strategy that sorted it. */
  triageSource: string | null;
  snippet: string;
  /** Address of the mailbox it arrived in, and whether that mailbox is shared. */
  mailbox: string;
  shared: boolean;
  /** How it was replied to, when it was. */
  replyMode: ReplyMode | null;
  /** Its values for the attributes of the organisation, by the attribute's key, and who decided each. */
  attributes: Record<string, ValueOfEmail>;
}

/** The most recent emails of a box, with how many each box holds. */
export interface EmailsOfBox {
  emails: EmailSummary[];
  counts: Record<Box, number>;
}

/** Who a reply goes to. */
export interface Recipients {
  to: string[];
  cc: string[];
}

/** One email as its reader sees it: its content, why it was sorted so, who a reply would go to, its proposal and its reply. */
export interface EmailWithItsReply {
  id: number;
  /** Address of the mailbox it arrived in, and whether that mailbox is shared. */
  mailbox: string;
  shared: boolean;
  fromName: string;
  fromAddr: string;
  to: Address[];
  cc: Address[];
  subject: string;
  date: string;
  bodyText: string;
  attachments: Attachment[];
  status: EmailStatus;
  priority: Priority;
  triageSource: string | null;
  /** Why it was sorted so, and the code of that reason when it is one of the server's own. */
  triageReason: string;
  triageReasonCode: string | null;
  /** The prompt that suits it best, by its attributes: the one offered first to who writes. None when no prompt names an attribute it has. */
  suggestedPromptId: number | null;
  /** Its values for the attributes of the organisation, by the attribute's key, and who decided each. */
  attributes: Record<string, ValueOfEmail>;
  recipients: Recipients;
  /** Recipients of a reply to all. */
  recipientsAll: Recipients;
  /** The latest proposal, to resume where the member left off. */
  proposal: Proposal | null;
  reply: Reply | null;
}
