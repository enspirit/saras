// The small decisions of the domain, as pure functions: data in, verdict out.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOCK_OUT_MS, addressIsFree, isAdministrator, isAnAddress, isLockedOut, mayDeleteMember, mayOpenAccount, mayRemoveAdministratorRole, maySignUp, opensNewWindow, organizationNameFor, roleInvitedAs, signUpIsOpen } from '../src/domain/computations/access.ts';
import { addressGiven, addressesGiven, clipped, languageGiven } from '../src/domain/computations/given.ts';
import { promptContent } from '../src/domain/computations/prompts.ts';
import { modelGiven, proposalsGiven, sortingGiven } from '../src/domain/computations/settings.ts';
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

test('sign-up is open when the operator allows it, or when nobody has an account yet', () => {
  const cases: [boolean, boolean, string][] = [
    [true, false, 'ok'],
    [false, true, 'ok'],
    [true, true, 'ok'],
    [false, false, 'forbidden: auth.signupClosed'],
  ];
  for (const [allowed, empty, expected] of cases) assert.equal(outcome(maySignUp(signUpIsOpen(allowed, empty))), expected);
});

test('an account needs an address and a password of ten characters or more, and an address nobody has', () => {
  assert.equal(outcome(mayOpenAccount('alex@acme.example', 'a-good-password')), 'ok');
  assert.equal(outcome(mayOpenAccount('alex', 'a-good-password')), 'invalid: auth.invalidEmail');
  assert.equal(outcome(mayOpenAccount('alex@acme.example', 'too-short')), 'invalid: auth.passwordTooShort');
  assert.equal(outcome(mayOpenAccount('alex@acme.example', 1234567890)), 'invalid: auth.passwordTooShort', 'a password is text');
  assert.equal(outcome(mayOpenAccount('alex', 'short')), 'invalid: auth.invalidEmail', 'the address is judged first');
  assert.equal(outcome(isAnAddress('alex@acme.example')), 'ok');
  assert.equal(outcome(isAnAddress('')), 'invalid: auth.invalidEmail');
  assert.equal(outcome(addressIsFree(false)), 'ok');
  assert.equal(outcome(addressIsFree(true)), 'conflict: auth.emailTaken');
});

test('an organisation without a name is called after the domain of its creator', () => {
  assert.equal(organizationNameFor('Acme', 'zoe@other.example'), 'Acme');
  assert.equal(organizationNameFor('', 'zoe@other.example'), 'other.example');
  assert.equal(organizationNameFor('', 'zoe'), 'zoe');
});

test('an invitation grants the administrator role only when asked for', () => {
  assert.deepEqual(['admin', 'user', 'owner', undefined].map(roleInvitedAs), ['admin', 'user', 'user', 'user']);
});

test('an organisation keeps one administrator, and nobody deletes themselves', () => {
  assert.equal(outcome(mayRemoveAdministratorRole('admin', 2)), 'ok');
  assert.equal(outcome(mayRemoveAdministratorRole('admin', 1)), 'conflict: users.lastAdmin');
  assert.equal(outcome(mayRemoveAdministratorRole('user', 1)), 'ok', 'a user has no role to lose');
  assert.equal(outcome(mayDeleteMember(2, 1)), 'ok');
  assert.equal(outcome(mayDeleteMember(1, 1)), 'conflict: users.cannotDeleteSelf');
});

test('ten wrong guesses within fifteen minutes lock an origin out; the window then starts again', () => {
  const now = 1_000_000;
  const within = now + 1;
  assert.equal(isLockedOut(undefined, now), false);
  assert.equal(isLockedOut({ count: 9, reset: within }, now), false);
  assert.equal(isLockedOut({ count: 10, reset: within }, now), true);
  assert.equal(isLockedOut({ count: 25, reset: now }, now), false, 'a window that is over no longer counts');
  assert.equal(opensNewWindow(undefined, now), true);
  assert.equal(opensNewWindow({ count: 3, reset: now }, now), true);
  assert.equal(opensNewWindow({ count: 3, reset: within }, now), false);
  assert.equal(LOCK_OUT_MS, 15 * 60_000);
});

test('what a client gives is reduced, never refused', () => {
  assert.equal(clipped('  hello  '), 'hello');
  assert.equal(clipped('abcdef', 3), 'abc');
  assert.deepEqual([clipped(12), clipped(null), clipped({})], ['', '', '']);
  assert.equal(addressGiven('  Alex@Acme.Example '), 'alex@acme.example');
  assert.deepEqual(addressesGiven([' A@b.example ', '', 3, 'c@d.example']), ['a@b.example', 'c@d.example']);
  assert.deepEqual(addressesGiven('a@b.example'), [], 'anything but a list is an empty one');
  assert.deepEqual(['fr', 'en-GB', 'FR', 'français', 42].map(languageGiven), ['fr', 'en-GB', 'en', 'en', 'en']);
});

test('a model is named "provider/model", or not at all', () => {
  assert.deepEqual(modelGiven(' openai/gpt-4o-mini '), { ok: true, value: 'openai/gpt-4o-mini' });
  assert.deepEqual(modelGiven(''), { ok: true, value: null }, 'none: the one above applies');
  assert.equal(outcome(modelGiven('gpt-4o')), 'invalid: settings.invalidModel');
  assert.equal(outcome(modelGiven('open ai/gpt')), 'invalid: settings.invalidModel');
});

test('only the ways of sorting and of preparing replies we know are taken', () => {
  assert.deepEqual(['none', 'ai'].map((s) => outcome(sortingGiven(s))), ['ok', 'ok']);
  assert.equal(outcome(sortingGiven('magic')), 'invalid: organization.invalidTriage');
  assert.deepEqual(['none', 'draft', 'mailbox'].map((a) => outcome(proposalsGiven(a))), ['ok', 'ok', 'ok']);
  assert.equal(outcome(proposalsGiven('send')), 'invalid: organization.invalidAutomation');
  assert.equal(outcome(proposalsGiven(undefined)), 'invalid: organization.invalidAutomation');
});
