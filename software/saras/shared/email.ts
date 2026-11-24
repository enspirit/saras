// An email, where it stands, and the boxes members see their emails in.
import type { ValueOfEmail } from './attribute.ts';
import type { Proposal, Reply, ReplyMode } from './reply.ts';

/** Where an email stands: to handle, needing no reply, ignored, replied. */
export type EmailStatus = 'needs_reply' | 'no_reply' | 'ignored' | 'sent';
export type Priority = 'high' | 'normal' | 'low';

/** The boxes, and the statuses each one shows. */
export const BOXES = { todo: ['needs_reply'], none: ['no_reply'], sent: ['sent'], ignored: ['ignored'] } as const satisfies Record<string, readonly EmailStatus[]>;
export type Box = keyof typeof BOXES;

export interface Address {
  name: string;
  address: string;
}

/** A file attached to an email. Only its description is kept, never its content: it is read again from the mailbox when asked for. */
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
  /** Who decided where it stands: 'rule', 'user', or 'none' when nobody did ('ai' on an email the AI sorted, when it did). */
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

/** Where a list of emails is looked at: a box (or every box), or a board; and what is searched in it. */
export interface View {
  box?: Box | 'all';
  board?: number;
  search?: string;
}

/** The emails an action on several is for: those ticked in the list, or every email of a view, however many, named by the view rather than one by one. */
export type Selection = { ids: number[] } | { all: View };

/** What an action on several emails did: how many changed. A replied email is left as it is. */
export interface SelectionDone {
  changed: number;
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
  /** Whether it can be shown as it was written: `GET /emails/:id/html` is then a document for a frame. */
  hasHtml: boolean;
  /** Whether it shows images hosted elsewhere, which are not loaded. */
  hostedImagesHeld: boolean;
  attachments: Attachment[];
  /** Whether its files can be opened: `GET /emails/:id/attachments/:n`, the nth of the list above, from 0. */
  attachmentsOpen: boolean;
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
