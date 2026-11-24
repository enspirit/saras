// Pure: what a member searches in a list of emails, as conditions on the emails table. Each word
// must be found somewhere among who sent the email, its subject and its text, in any case.
import type { Conditions } from './boards.ts';
import { containing } from './boards.ts';

/** Longer than this, a search is cut: it is typed, not pasted from an email. */
export const SEARCH_MAX = 200;

/** The search asked for, trimmed: nothing when none was. */
export const searchGiven = (value: unknown): string => (typeof value === 'string' ? value.trim().slice(0, SEARCH_MAX) : '');

/** The words searched, each a condition of its own. */
export const wordsOf = (search: string): string[] => search.split(/\s+/).filter(Boolean);

/** The conditions a search puts on emails, its parameters numbered from `first`: one per word, which any of the four columns may hold. */
export function searchConditions(search: string, first: number): Conditions {
  const words = wordsOf(search);
  return {
    sql: words.map((_, index) => {
      const n = `$${first + index}`;
      return `(e.from_name ILIKE ${n} OR e.from_addr ILIKE ${n} OR e.subject ILIKE ${n} OR e.body_text ILIKE ${n})`;
    }),
    params: words.map(containing),
  };
}

/** Two sets of conditions as one: those of `more` follow, so their parameters must have been numbered after the first. */
export const both = (one: Conditions, more: Conditions): Conditions => ({ sql: [...one.sql, ...more.sql], params: [...one.params, ...more.params] });
