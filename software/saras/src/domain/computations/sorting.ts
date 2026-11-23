// Pure decisions about where an email stands.
import type { EmailStatus } from '../model/email.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';

/** DomPre of the three corrections a member may make to the sorting: the email is not replied. */
export const mayBeSortedAgain = (status: EmailStatus): Verdict<true> => (status === 'sent' ? refuse('conflict', 'emails.alreadySent') : accept(true));
