// Pure decisions about settings.
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import { clipped } from './given.ts';

/** ReqPre of choosing a model: it is named "provider/model", or not at all (then the one above applies). */
export function modelGiven(value: unknown): Verdict<string | null> {
  const model = clipped(value, 200);
  if (model && !/^[\w.:-]+\/[\w.:-]+$/.test(model)) return refuse('invalid', 'settings.invalidModel');
  return accept(model || null);
}
