// The small decisions of the domain, as pure functions: data in, verdict out.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAdministrator } from '../src/domain/computations/access.ts';
import { promptContent } from '../src/domain/computations/prompts.ts';
import { mayBeSortedAgain } from '../src/domain/computations/sorting.ts';
import type { Verdict } from '../src/domain/refusal.ts';
import type { Actor } from '../src/domain/world.ts';
import type { EmailStatus } from '../src/types.ts';

const outcome = (verdict: Verdict<unknown>): string => (verdict.ok ? 'ok' : `${verdict.refusal.kind}: ${verdict.refusal.problem.code}`);

test('maintaining the organisation is for its administrators', () => {
  const as = (role: string) => ({ member: { role }, organization: {} }) as Actor;
  assert.equal(outcome(isAdministrator(as('admin'))), 'ok');
  assert.equal(outcome(isAdministrator(as('user'))), 'forbidden: auth.adminOnly');
});

test('an email can be sorted again by a member until it is replied', () => {
  const cases: [EmailStatus, string][] = [
    ['pending', 'ok'],
    ['needs_reply', 'ok'],
    ['no_reply', 'ok'],
    ['ignored', 'ok'],
    ['sent', 'conflict: emails.alreadySent'],
  ];
  for (const [status, expected] of cases) assert.equal(outcome(mayBeSortedAgain(status)), expected, status);
});

test('a prompt has a name and instructions; what is given is trimmed and capped', () => {
  const full = promptContent({ name: '  Refusal ', description: ' Declining. ', systemPrompt: ' You decline. ' });
  assert.deepEqual(full.ok && full.value, { name: 'Refusal', description: 'Declining.', systemPrompt: 'You decline.' });
  assert.equal(outcome(promptContent({ name: 'Refusal', systemPrompt: 'You decline.' })), 'ok', 'the description is optional');
  assert.equal(outcome(promptContent({ name: '   ', systemPrompt: 'You decline.' })), 'invalid: prompts.incomplete');
  assert.equal(outcome(promptContent({ name: 'Refusal', systemPrompt: '' })), 'invalid: prompts.incomplete');
  assert.equal(outcome(promptContent({ name: 12, systemPrompt: ['x'] })), 'invalid: prompts.incomplete', 'anything but text counts as nothing');
  const long = promptContent({ name: 'n'.repeat(500), systemPrompt: 's'.repeat(30_000) });
  assert.deepEqual(long.ok && [long.value.name.length, long.value.systemPrompt.length], [120, 20_000]);
});
