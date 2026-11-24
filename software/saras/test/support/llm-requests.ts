// What the language model was asked.
import assert from 'node:assert/strict';

/** The last element of a list that the test expects not to be empty. */
export function lastOf<T>(list: T[]): T {
  const last = list.at(-1);
  assert.ok(last !== undefined, 'expected a non-empty list');
  return last;
}
