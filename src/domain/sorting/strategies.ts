import type { Config } from '../../tooling/config.ts';
import type { Vault } from '../../tooling/crypto.ts';
import { llmSettings } from '../computations/key-in-force.ts';
import type { Llm } from '../model/llm.ts';
import type { AccountRow } from '../model/mailbox.ts';
import type { UserRow } from '../model/member.ts';
import type { OrganizationRow } from '../model/organization.ts';
import { aiTriage } from './ai.ts';
import type { TriageGate } from './gate.ts';
import { noTriage } from './none.ts';

/** The strategies an organisation can choose. TRIAGE_STRATEGY sets the one a new organisation starts with. */
export const TRIAGE_STRATEGIES = ['none', 'ai'] as const;
export type TriageStrategy = (typeof TRIAGE_STRATEGIES)[number];
export const isTriageStrategy = (v: unknown): v is TriageStrategy => TRIAGE_STRATEGIES.includes(v as TriageStrategy);

interface Dependencies {
  config: Config;
  vault: Vault;
  llm: Llm;
}

/**
 * Gives the gate for a mailbox, according to its organisation's strategy. A new strategy is
 * added here: implement TriageGate, name it in TRIAGE_STRATEGIES, and return it below.
 */
export function createTriage({ config, vault, llm }: Dependencies) {
  return {
    /** @param owner who connected the mailbox: reasons are written in their language */
    gateFor(account: AccountRow, org: OrganizationRow, owner: UserRow): TriageGate {
      if (org.triage_strategy === 'ai') {
        return aiTriage({ llm, ...llmSettings(org, { config, vault }), ownAddress: account.email, language: owner.language });
      }
      return noTriage;
    },
  };
}

export type Triage = ReturnType<typeof createTriage>;
