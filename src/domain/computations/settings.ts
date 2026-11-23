// Pure decisions about settings.
import { SORTING, WRITING } from '../../../shared/organization.ts';
import type { Sorting, Writing } from '../../../shared/organization.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import { clipped } from './given.ts';

/** ReqPre of choosing a model: it is named "provider/model", or not at all (then the one above applies). */
export function modelGiven(value: unknown): Verdict<string | null> {
  const model = clipped(value, 200);
  if (model && !/^[\w.:-]+\/[\w.:-]+$/.test(model)) return refuse('invalid', 'settings.invalidModel');
  return accept(model || null);
}

/** ReqPre of ChooseSorting: nobody, or the AI. */
export const sortingGiven = (value: unknown): Verdict<Sorting> => (SORTING.includes(value as Sorting) ? accept(value as Sorting) : refuse('invalid', 'organization.invalidSorting'));

/** ReqPre of ChooseWriting: on demand, at fetch, or at fetch and filed in the mailbox. Nothing sends by itself. */
export const writingGiven = (value: unknown): Verdict<Writing> => (WRITING.includes(value as Writing) ? accept(value as Writing) : refuse('invalid', 'organization.invalidWriting'));
