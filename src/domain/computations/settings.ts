// Pure decisions about settings.
import { AUTOMATIONS } from '../../types.ts';
import type { Automation } from '../../types.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import { isTriageStrategy } from '../sorting/index.ts';
import type { TriageStrategy } from '../sorting/index.ts';
import { clipped } from './given.ts';

/** ReqPre of choosing a model: it is named "provider/model", or not at all (then the one above applies). */
export function modelGiven(value: unknown): Verdict<string | null> {
  const model = clipped(value, 200);
  if (model && !/^[\w.:-]+\/[\w.:-]+$/.test(model)) return refuse('invalid', 'settings.invalidModel');
  return accept(model || null);
}

/** ReqPre of ChooseSorting: a way of sorting we know. */
export const sortingGiven = (value: unknown): Verdict<TriageStrategy> => (isTriageStrategy(value) ? accept(value) : refuse('invalid', 'organization.invalidTriage'));

/** ReqPre of ChooseProposals: a way of preparing replies we know. */
export const proposalsGiven = (value: unknown): Verdict<Automation> =>
  AUTOMATIONS.includes(value as Automation) ? accept(value as Automation) : refuse('invalid', 'organization.invalidAutomation');
