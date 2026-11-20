import { reasonCode } from '../messages.ts';
import type { IncomingEmail } from '../types.ts';

/**
 * Header rules applied before the triage gate: mail that is plainly automated (no-reply
 * senders, mailing lists, automatic replies, bulk mail) or already dealt with is set aside
 * without being shown to any gate, so that no strategy spends anything on it. Pure.
 */

export interface RuleVerdict {
  status: 'no_reply';
  /** A coded reason (see messages.ts), translated by the interface. */
  reason: string;
}

const NO_REPLY = /(^|[._+-])(no-?reply|do-?not-?reply|ne-?pas-?repondre|mailer-daemon|postmaster|bounces?|notifications?|newsletter)([._+-]|@|$)/i;

export function heuristicTriage(
  email: Pick<IncomingEmail, 'fromAddr'> & Partial<Pick<IncomingEmail, 'headers' | 'answered'>>,
  ownAddress: string,
): RuleVerdict | null {
  const from = String(email.fromAddr || '').toLowerCase();
  const h = email.headers || {};
  if (!from) return { status: 'no_reply', reason: reasonCode('triage.unknownSender') };
  if (from === String(ownAddress || '').toLowerCase()) return { status: 'no_reply', reason: reasonCode('triage.ownMessage') };
  if (email.answered) return { status: 'no_reply', reason: reasonCode('triage.alreadyAnswered') };
  if (NO_REPLY.test(from.split('@')[0])) return { status: 'no_reply', reason: reasonCode('triage.automatedAddress') };
  if (h.autoSubmitted && h.autoSubmitted.toLowerCase() !== 'no') return { status: 'no_reply', reason: reasonCode('triage.autoSubmitted') };
  if (h.listUnsubscribe || h.listId) return { status: 'no_reply', reason: reasonCode('triage.newsletter') };
  if (/^(bulk|junk|list)$/i.test(h.precedence || '')) return { status: 'no_reply', reason: reasonCode('triage.bulk') };
  return null;
}
