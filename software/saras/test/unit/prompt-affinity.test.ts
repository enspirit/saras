// Which prompt suits an email, from the email's attributes: a table of cases.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { affinityGiven, bestPrompt, valuesOf } from '../../src/domain/computations/prompt-affinity.ts';
import { promptContent } from '../../src/domain/computations/prompts.ts';

const standard = { id: 1, affinity: {} };
const quotes = { id: 2, affinity: { 7: ['sales'] } };
const urgentQuotes = { id: 3, affinity: { 7: ['sales', 'renewal'], 8: ['high'] } };
const support = { id: 4, affinity: { 7: ['support'] } };
const prompts = [standard, quotes, urgentQuotes, support];
const suited = (values: Record<string, string>): number | undefined => bestPrompt(prompts, values)?.id;

test('an email has a value for where it stands, and for each attribute it was given', () => {
  assert.deepEqual(valuesOf({ status: 'needs_reply', attributes: { 7: { value: 'sales', source: 'rule' }, 8: { value: 'high', source: 'user' } } }), { 7: 'sales', 8: 'high', status: 'todo' });
  assert.deepEqual(valuesOf({ status: 'no_reply', attributes: {} }), { status: 'none' }, 'an attribute it was given nothing for has no value: not even a priority');
  assert.equal(valuesOf({ status: 'sent', attributes: { status: { value: 'todo', source: 'user' } } }).status, 'sent', 'where it stands is where the email is, wherever else it is written');
});

test('the prompt that suits best names the most attributes, all of which hold', () => {
  assert.equal(suited({ 7: 'sales', 8: 'normal' }), 2);
  assert.equal(suited({ 7: 'sales', 8: 'high' }), 3, 'two attributes named and held beat one');
  assert.equal(suited({ 7: 'renewal', 8: 'high' }), 3, 'any of the values of an attribute will do');
  assert.equal(suited({ 7: 'renewal', 8: 'low' }), undefined, 'every attribute named must hold');
  assert.equal(suited({ 7: 'support' }), 4);
});

test('a prompt that names nothing suits every email alike, and is never the best; ties go to the first of the list', () => {
  assert.equal(suited({ 8: 'normal' }), undefined);
  assert.equal(bestPrompt([standard], { 7: 'sales' }), undefined);
  assert.equal(bestPrompt([{ id: 8, affinity: { 7: ['sales'] } }, quotes], { 7: 'sales' })?.id, 8);
});

test('an affinity is kept reduced to attributes we know how to name, each with at least one value', () => {
  assert.deepEqual(affinityGiven({ 7: ['sales', 'sales', ' '], status: ['todo'], priority: ['high'], 8: [], other: ['x'], 9: 'sales' }), { 7: ['sales'], status: ['todo'] }, 'the priority is named by its number, like any attribute of the organisation');
  assert.deepEqual([affinityGiven(null), affinityGiven('x'), affinityGiven([])], [{}, {}, {}]);
  const content = promptContent({ name: 'Quotes', systemPrompt: 'Answer.', affinity: { 7: ['sales'] } });
  assert.deepEqual(content.ok && content.value.affinity, { 7: ['sales'] });
});
