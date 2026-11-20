import type { Config } from '../config.ts';
import type { Vault } from '../crypto.ts';
import { llmSettings } from '../llm/settings.ts';
import type { AccountRow, Llm, UserRow } from '../types.ts';
import { aiTriage } from './ai.ts';
import type { TriageGate } from './gate.ts';
import { noTriage } from './none.ts';

/** The strategies an installation can choose with TRIAGE_STRATEGY. */
export const TRIAGE_STRATEGIES = ['none', 'ai'] as const;
export type TriageStrategy = (typeof TRIAGE_STRATEGIES)[number];

interface Dependencies {
  config: Config;
  vault: Vault;
  llm: Llm;
}

/**
 * Gives the gate for a mailbox, according to the installation's strategy. A new strategy is
 * added here: implement TriageGate, name it in TRIAGE_STRATEGIES, and return it below.
 */
export function createTriage({ config, vault, llm }: Dependencies) {
  return {
    gateFor(account: AccountRow, user: UserRow): TriageGate {
      if (config.triageStrategy === 'ai') {
        return aiTriage({ llm, ...llmSettings(user, { config, vault }), ownAddress: account.email, language: user.language });
      }
      return noTriage;
    },
  };
}

export type Triage = ReturnType<typeof createTriage>;
