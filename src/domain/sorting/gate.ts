import type { Address, Attachment, Priority } from '../model/email.ts';

/**
 * The triage gate: every fetched email passes through it, and it decides whether a reply
 * is needed and with which prompt.
 *
 * It is an abstraction with several strategies (see index.ts): none at all, an LLM, and
 * later others such as an external rules engine. A strategy sees a batch of mails and the
 * prompts it may choose from, and nothing else: no database, no mailbox.
 */

/** How many mails a gate is given at once, at most. */
export const TRIAGE_BATCH_SIZE = 20;

/** A prompt the gate may choose. */
export interface TriagePrompt {
  id: number;
  name: string;
  /** When to use it. */
  description: string;
}

/** A mail, as a gate sees it. */
export interface TriageMail {
  /** Identifies the mail within the batch; decisions refer to it. */
  id: number;
  from: Address;
  to: Address[];
  cc: Address[];
  subject: string;
  body: string;
  /** Names, types and sizes only: a gate never gets the content of an attachment. */
  attachments: Attachment[];
}

export interface TriageBatch {
  prompts: TriagePrompt[];
  /** At most TRIAGE_BATCH_SIZE mails. */
  mails: TriageMail[];
}

export interface TriageDecision {
  /** The `id` of the mail it is about. */
  mailId: number;
  replyNeeded: boolean;
  /** One of the prompts given, or null to leave the choice to the user. */
  promptId: number | null;
  /** Optional: why, in a sentence shown to the user. */
  reason?: string;
  /** Optional: how pressing the reply is. */
  priority?: Priority;
}

export interface TriageGate {
  /** Name of the strategy, recorded with each decision. */
  readonly name: string;
  /**
   * Decides about a batch. A mail left without a decision stays untriaged and is presented
   * again at the next fetch. Throwing leaves the whole batch untriaged.
   */
  decide(batch: TriageBatch): Promise<TriageDecision[]>;
}

/**
 * Passes mails through a gate in batches, and keeps only decisions that are about a mail of
 * their batch and choose a prompt that was offered.
 */
export async function runGate(gate: TriageGate, prompts: TriagePrompt[], mails: TriageMail[]): Promise<TriageDecision[]> {
  const offered = new Set(prompts.map((p) => p.id));
  const decisions: TriageDecision[] = [];
  for (let start = 0; start < mails.length; start += TRIAGE_BATCH_SIZE) {
    const batch = mails.slice(start, start + TRIAGE_BATCH_SIZE);
    const asked = new Set(batch.map((m) => m.id));
    const seen = new Set<number>();
    for (const decision of await gate.decide({ prompts, mails: batch })) {
      if (!asked.has(decision.mailId) || seen.has(decision.mailId)) continue;
      seen.add(decision.mailId);
      decisions.push({ ...decision, promptId: decision.promptId !== null && offered.has(decision.promptId) ? decision.promptId : null });
    }
  }
  return decisions;
}
