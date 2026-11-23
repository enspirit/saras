// Pure: what is wrong in a rule, told to who writes it — where it is, in plain words, and
// the field that was probably meant when the rule names one an email does not have.
import type { RuleProblem } from '../../../shared/attribute.ts';
import type { Found } from '../../tooling/elo.ts';

/** How many single-letter changes turn one word into the other. */
export function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) next[j] = Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length] ?? 0;
}

/** The declared name closest to the one written, when it is close enough to be a slip of the hand. */
export function meant(written: string, declared: string[]): string | null {
  const near = declared.map((name) => ({ name, far: distance(written.toLowerCase(), name.toLowerCase()) })).sort((x, y) => x.far - y.far)[0];
  return near && near.far <= Math.max(1, Math.floor(written.length / 3)) ? near.name : null;
}

/** What Elo says of a field that does not exist: its name, and those that do. */
const UNKNOWN_FIELD = /^'([^']+)' is not a field of .*\. Declared: (.*)\.$/;

/** A problem as it is told: a field that does not exist is said so shortly, with the one probably meant. */
export function problemTold({ line, column, message }: Found): RuleProblem {
  const [, written, declared] = message.match(UNKNOWN_FIELD) ?? [];
  if (!written || !declared) return { line, column, length: 1, message, suggestion: null };
  const names = declared.split(', ');
  return { line, column, length: written.length, message: `'${written}' is not a field. Declared: ${names.join(', ')}.`, suggestion: meant(written, names) };
}
