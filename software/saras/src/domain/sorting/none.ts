import type { TriageGate } from './gate.ts';

/**
 * The empty strategy: no decision is taken on the user's behalf. Every mail of the watched
 * folder is to be handled, and the user picks the prompt. It costs nothing and sends nothing
 * anywhere; the folder the user chose to watch is the filter.
 */
export const noTriage: TriageGate = {
  name: 'none',
  decide: async ({ mails }) => mails.map((mail) => ({ mailId: mail.id, replyNeeded: true, promptId: null })),
};
