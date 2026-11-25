// Pure: what the assistant is asked on an administrator's behalf, and how what is wrong in
// what it proposed is told back to it.
import type { Answered, ConfigurationWanted } from '../../../shared/advice.ts';
import type { ConfigurationProblem } from '../../../shared/configuration.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import { clipped } from './given.ts';

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

/** The answers to what the assistant asked, an empty one included: it says "as you see fit". */
const answersGiven = (value: unknown): Answered[] =>
  (Array.isArray(value) ? value : []).map(record).map(({ question, answer }) => ({ question: clipped(question, 300), answer: clipped(answer, 600) })).filter(({ question }) => question).slice(0, 5);

/** ReqPre of ProposeConfiguration: something is said of the organisation. */
export function wantedGiven(given: unknown): Verdict<ConfigurationWanted> {
  const description = clipped(record(given).description, 4000);
  if (!description) return refuse('invalid', 'assistant.descriptionRequired');
  return accept({ description, answers: answersGiven(record(given).answers) });
}

/** A problem of a configuration as the model that wrote it is told: where, and what. */
export const objectionOf = ({ at, message }: ConfigurationProblem): string => `${at.replace(/\.(\d+)/g, '[$1]')}: ${message}`;
