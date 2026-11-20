import { reasonCode } from './messages.ts';
import type { IncomingEmail, Priority } from './types.ts';

/**
 * Triage decisions, all pure.
 *
 * Step 1 (heuristicTriage) discards obvious non-conversations from headers alone, so
 * newsletters and notifications are never sent to the LLM at all.
 * Step 2 (parseTriageAnswer) interprets the LLM answer for what remains.
 */

export interface RuleVerdict {
  status: 'no_reply';
  /** A coded reason (see messages.ts), translated by the interface. */
  reason: string;
}

export interface TriageVerdict {
  status: 'needs_reply' | 'no_reply';
  reason: string;
  promptId: number | null;
  priority: Priority;
}

const PRIORITIES: Priority[] = ['high', 'normal', 'low'];
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

/** Extract the first JSON object of a model answer, tolerant to code fences and chatter. */
export function extractJson(text: string | null | undefined): Record<string, unknown> | null {
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * @param answer raw LLM text
 * @param promptIds ids the model was allowed to pick from
 * An unreadable answer falls back to "needs reply": a human should look rather than miss a mail.
 */
export function parseTriageAnswer(answer: string, promptIds: number[]): TriageVerdict {
  const json = extractJson(answer);
  if (!json || typeof json.needs_reply !== 'boolean') {
    return { status: 'needs_reply', reason: reasonCode('triage.unavailable'), promptId: null, priority: 'normal' };
  }
  const promptId = promptIds.includes(Number(json.prompt_id)) ? Number(json.prompt_id) : null;
  const priority = PRIORITIES.find((p) => p === json.priority) ?? 'normal';
  return {
    status: json.needs_reply ? 'needs_reply' : 'no_reply',
    reason: String(json.reason || '').slice(0, 300),
    promptId: json.needs_reply ? promptId : null,
    priority,
  };
}
