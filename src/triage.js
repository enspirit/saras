/**
 * Triage decisions, all pure.
 *
 * Step 1 (heuristicTriage) discards obvious non-conversations from headers alone, so
 * newsletters and notifications are never sent to the LLM at all.
 * Step 2 (parseTriageAnswer) interprets the LLM answer for what remains.
 */

const NO_REPLY = /(^|[._+-])(no-?reply|do-?not-?reply|ne-?pas-?repondre|mailer-daemon|postmaster|bounces?|notifications?|newsletter)([._+-]|@|$)/i;

export function heuristicTriage(email, ownAddress) {
  const from = String(email.fromAddr || '').toLowerCase();
  const h = email.headers || {};
  if (!from) return { status: 'no_reply', reason: 'Expéditeur inconnu' };
  if (from === String(ownAddress || '').toLowerCase()) return { status: 'no_reply', reason: 'Message envoyé par vous-même' };
  if (email.answered) return { status: 'no_reply', reason: 'Déjà répondu depuis votre messagerie' };
  if (NO_REPLY.test(from.split('@')[0])) return { status: 'no_reply', reason: 'Adresse automatique (no-reply, notification…)' };
  if (h.autoSubmitted && h.autoSubmitted.toLowerCase() !== 'no') return { status: 'no_reply', reason: 'Message automatique (Auto-Submitted)' };
  if (h.listUnsubscribe || h.listId) return { status: 'no_reply', reason: 'Liste de diffusion ou newsletter' };
  if (/^(bulk|junk|list)$/i.test(h.precedence || '')) return { status: 'no_reply', reason: 'Envoi en masse' };
  return null;
}

/** Extract the first JSON object of a model answer, tolerant to code fences and chatter. */
export function extractJson(text) {
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
export function parseTriageAnswer(answer, promptIds) {
  const json = extractJson(answer);
  if (!json || typeof json.needs_reply !== 'boolean') {
    return { status: 'needs_reply', reason: 'Tri automatique indisponible : à vérifier', promptId: null, priority: 'normal' };
  }
  const promptId = promptIds.includes(Number(json.prompt_id)) ? Number(json.prompt_id) : null;
  const priority = ['high', 'normal', 'low'].includes(json.priority) ? json.priority : 'normal';
  return {
    status: json.needs_reply ? 'needs_reply' : 'no_reply',
    reason: String(json.reason || '').slice(0, 300),
    promptId: json.needs_reply ? promptId : null,
    priority,
  };
}
