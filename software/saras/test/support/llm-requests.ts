// What the language model was asked, told apart: to sort a batch of emails, or to write.
import assert from 'node:assert/strict';
import type { RecordedLlmRequest } from './language-model.ts';

const asksToSort = (request: RecordedLlmRequest): boolean => request.body.messages[0]?.content.includes('You triage the inbox') ?? false;

export const sortingRequests = (requests: RecordedLlmRequest[]): RecordedLlmRequest[] => requests.filter(asksToSort);
export const writingRequests = (requests: RecordedLlmRequest[]): RecordedLlmRequest[] => requests.filter((request) => !asksToSort(request));

/** The last element of a list that the test expects not to be empty. */
export function lastOf<T>(list: T[]): T {
  const last = list.at(-1);
  assert.ok(last !== undefined, 'expected a non-empty list');
  return last;
}
