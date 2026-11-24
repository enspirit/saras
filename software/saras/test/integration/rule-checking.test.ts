// A rule checked as it is written: what is wrong, where, and what was probably meant.
// And the colour of a value, and the reason a rule gives for one.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { EMAIL_FIELDS, EMAIL_FOR_RULES } from '../../shared/attribute.ts';
import { RECIPES } from '../../shared/rule-recipes.ts';
import { ruleValue, valuesGiven } from '../../src/domain/computations/attributes.ts';
import { distance, meant, problemTold } from '../../src/domain/computations/rule-problems.ts';
import { valueAgain } from '../../src/domain/computations/sorting-again.ts';
import { compileRule, foundIn, problemsOf } from '../../src/tooling/elo.ts';
import { createClient, signUp } from '../support/client.ts';
import type { ApiClient } from '../support/client.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

test('the field probably meant is the closest declared one, when it is close', () => {
  assert.deepEqual([distance('subjet', 'subject'), distance('abc', 'abc'), distance('', 'ab')], [1, 0, 2]);
  assert.equal(meant('subjet', ['from', 'to', 'subject', 'text']), 'subject');
  assert.equal(meant('Adress', ['name', 'address']), 'address');
  assert.equal(meant('whatever', ['from', 'to', 'subject']), null, 'nothing is proposed that is far from what was written');
});

test('a problem is found with its place, and a field that does not exist with the one meant', () => {
  const [found] = foundIn('let\n  words = lower(_.subjet)\nin words', EMAIL_FOR_RULES);
  assert.deepEqual([found?.line, found?.column, found?.code], [2, 19, 'unknown-field']);
  const told = problemTold(found!);
  assert.deepEqual([told.length, told.suggestion], [6, 'subject']);
  assert.match(told.message, /^'subjet' is not a field\. Declared: from, to, cc, subject/);
});

test('a rule that cannot be read is one problem, where the reading stopped', () => {
  assert.deepEqual(foundIn('if _.answered then', EMAIL_FOR_RULES), [{ line: 1, column: 19, code: 'syntax', message: 'Unexpected token EOF' }]);
  assert.deepEqual(problemTold({ line: 1, column: 19, code: 'syntax', message: 'Unexpected token EOF' }), { line: 1, column: 19, length: 1, message: 'Unexpected token EOF', suggestion: null });
  assert.deepEqual(foundIn(`if _.answered then 'x' else null`, EMAIL_FOR_RULES), []);
});

test('every field shown to who writes a rule is one an email has', () => {
  for (const { path } of EMAIL_FIELDS) assert.deepEqual(problemsOf(path, EMAIL_FOR_RULES), [], path);
});

test('every recipe of the guide is a rule that fits the email', () => {
  assert.ok(RECIPES.length >= 4);
  for (const { key, elo } of RECIPES) {
    assert.deepEqual(problemsOf(elo, EMAIL_FOR_RULES), [], key);
    assert.doesNotThrow(() => compileRule(elo, EMAIL_FOR_RULES), key);
  }
});

test('a value is given with its colour, or alone and then grey; the same label counts once', () => {
  assert.deepEqual(valuesGiven(['Sales', { label: ' Support ', color: 'green' }, { label: 'Sales', color: 'red' }, { label: 'Other', color: 'pink' }, 3]), [
    { label: 'Sales', color: 'grey' },
    { label: 'Support', color: 'green' },
    { label: 'Other', color: 'grey' },
  ]);
});

test('the reason a rule gives is kept with the value', () => {
  assert.deepEqual(ruleValue({ value: '1', reason: 'a quote is asked' }), { value: '1', source: 'rule', reason: 'a quote is asked' });
  assert.deepEqual(ruleValue({ value: '1', reason: '' }), { value: '1', source: 'rule' });
  const again = valueAgain('7', { status: 'needs_reply', source: null, hasHeaders: true, attributes: {} }, { value: '2', reason: 'because' });
  assert.deepEqual(again?.attributes, { 7: { value: '2', source: 'rule', reason: 'because' } });
});

let stack: Stack;
let alice: ApiClient;
before(async () => {
  stack = await startStack();
  alice = createClient(() => stack.url);
  await signUp(alice, 'alice@acme.example', 'Acme');
});
after(() => stack.stop());

test('an administrator has a rule checked while writing it; nothing is kept', async () => {
  const wrong = await alice('POST', '/attributes/check', { elo: `if contains(_.subjet, 'x') then 'a' else null` });
  assert.equal(wrong.status, 200);
  assert.deepEqual(wrong.body.map((p: { line: number; column: number; suggestion: string }) => [p.line, p.column, p.suggestion]), [[1, 15, 'subject']]);
  assert.deepEqual((await alice('POST', '/attributes/check', { elo: `if contains(_.subject, 'x') then 'a' else null` })).body, []);
  assert.deepEqual((await alice('POST', '/attributes/check', { elo: '  ' })).body, [], 'nothing written yet is not a problem');
  assert.equal((await alice('GET', '/attributes')).body.length, 2);
});

test('the values of an attribute keep their colours; the attributes an organisation starts with have theirs', async () => {
  const made = await alice('POST', '/attributes', { name: 'Topic', values: [{ label: 'Billing', color: 'orange' }, 'Support'] });
  assert.deepEqual(made.body.values, [{ key: '1', label: 'Billing', color: 'orange' }, { key: '2', label: 'Support', color: 'grey' }]);
  const [status, priority] = (await alice('GET', '/attributes')).body;
  assert.deepEqual(priority.values.map((v: { color: string }) => v.color), ['red', 'grey', 'blue']);
  assert.equal(status.values[0].color, 'purple');
});
