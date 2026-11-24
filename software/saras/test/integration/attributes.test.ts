// Attributes: what an organisation wants to know of each email, decided by rules written in
// Elo, or by hand.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { STATUS_VALUES, attributeGiven, decidedFrom, inColorsKept, recolored } from '../../src/domain/computations/attributes.ts';
import type { Verdict } from '../../src/domain/refusal.ts';
import { EloError, compileRule } from '../../src/tooling/elo.ts';
import { createClient, join } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

const outcome = (verdict: Verdict<unknown>): string => (verdict.ok ? 'ok' : `${verdict.refusal.kind}: ${verdict.refusal.problem.code}`);

test('a rule is an Elo expression on the email; it runs on plain data, and not for long', () => {
  const rule = compileRule(`if contains(lower(_.subject), 'devis') then 'Sales' else null`);
  assert.equal(rule.run({ subject: 'Demande de DEVIS' }), 'Sales');
  assert.equal(rule.run({ subject: 'Merci' }), null);
  assert.throws(() => compileRule('if 1 then'), EloError);
  assert.throws(() => compileRule(`'x'`.padEnd(5000, ' ')), EloError, 'a rule has a length');
  assert.equal(compileRule('_.a.b').run({}), null, 'what an email does not have is nothing, not a failure');
});

test('what a rule answers is taken as a value of the attribute, by key or by label, or as nothing', () => {
  const values = [{ key: '1', label: 'Sales' }, { key: '2', label: 'Support' }];
  assert.deepEqual(decidedFrom('support', values), { value: '2', reason: '' });
  assert.deepEqual(decidedFrom({ value: '1', reason: 'a quote is asked' }, values), { value: '1', reason: 'a quote is asked' });
  assert.deepEqual([decidedFrom(null, values), decidedFrom('Billing', values), decidedFrom(42, values)], [null, null, null]);
});

test('an attribute needs a name, and a choice two values; a rule decides it, or nobody: never the AI', () => {
  assert.equal(outcome(attributeGiven({ name: '', values: ['a', 'b'] })), 'invalid: attributes.nameRequired');
  assert.equal(outcome(attributeGiven({ name: 'Topic', values: ['a', 'a', ' '] })), 'invalid: attributes.valuesRequired');
  assert.equal(outcome(attributeGiven({ name: 'Assignee', kind: 'member' })), 'ok');
  const decider = (decidedBy: unknown) => { const given = attributeGiven({ name: 'Topic', values: ['a', 'b'], decidedBy }); return given.ok ? given.value.decidedBy : outcome(given); };
  assert.deepEqual(['elo', 'nobody', undefined].map(decider), ['elo', 'nobody', 'nobody'], 'nobody, when no way of deciding is given');
  assert.deepEqual(['ai', 'eloAi', 'magic', ''].map(decider), Array(4).fill('invalid: attributes.deciderUnknown'), 'a way of deciding that is not known is refused, not read as nobody');
});

test('the values of a pre-configured attribute take the colours given at their places, and keep theirs where none we know is given', () => {
  const colors = (given: unknown): (string | undefined)[] => recolored(STATUS_VALUES, given).map((value) => value.color);
  const cases: [string, unknown, string[]][] = [
    ['a colour for each', [{ color: 'red' }, { color: 'blue' }, { color: 'yellow' }, { color: 'orange' }], ['red', 'blue', 'yellow', 'orange']],
    ['for the first ones only', [{ label: 'x', color: 'red' }], ['red', 'grey', 'green', 'grey']],
    ['a colour we do not know', [{ color: 'pink' }, { color: 'blue' }], ['purple', 'blue', 'green', 'grey']],
    ['values as their labels alone', ['x', 'y'], ['purple', 'grey', 'green', 'grey']],
    ['nothing', undefined, ['purple', 'grey', 'green', 'grey']],
    ['not a list', { color: 'red' }, ['purple', 'grey', 'green', 'grey']],
  ];
  for (const [what, given, expected] of cases) assert.deepEqual(colors(given), expected, what);
  assert.deepEqual(recolored(STATUS_VALUES, [{ label: 'Renamed', key: 'x', color: 'red' }])[0], { key: 'todo', label: 'To handle', color: 'red' }, 'a value keeps its key and its label');
  const kept = (json: string | undefined): (string | undefined)[] => inColorsKept(STATUS_VALUES, json).map((value) => value.color);
  assert.deepEqual([kept(undefined), kept('[]')], [['purple', 'grey', 'green', 'grey'], ['purple', 'grey', 'green', 'grey']], 'kept with no colour, as before colours were kept');
  assert.deepEqual(kept('[{"key":"sent","color":"blue"},{"key":"gone","color":"red"}]'), ['purple', 'grey', 'blue', 'grey'], 'kept by the key of each value');
});

let stack: Stack;
before(async () => (stack = await startStack()));
after(() => stack.stop());

const client = () => createClient(() => stack.url);
const alice = client(); // administrator
const bruno = client(); // member
const topicRule = `if contains(lower(_.subject), 'devis') then 'Sales' else if contains(lower(_.subject), 'rendez-vous') then 'Planning' else null`;
let topic: string;

test('an organisation starts with two attributes, whose logic is there to read: "Stands in" and "Priority"', async () => {
  assert.equal((await alice('POST', '/auth/signup', { email: 'alice@acme.example', password: 'un-bon-mot-de-passe', organization: 'Acme' })).status, 201);
  const [stands, priority] = (await alice('GET', '/attributes')).body;
  assert.deepEqual([stands.key, stands.system, stands.decidedBy, stands.values.map((v: { key: string }) => v.key)], ['status', true, 'elo', ['todo', 'none', 'sent', 'ignored']]);
  assert.match(stands.elo, /triage\.newsletter/, 'the automated-mail rule, written in Elo');
  assert.deepEqual([priority.key, priority.system, priority.decidedBy], ['priority', true, 'nobody']);
});

test('an administrator makes an attribute with its rule; a rule Elo cannot read is refused, and so is leaving it to the AI', async () => {
  assert.equal((await alice('POST', '/attributes', { name: 'Topic', values: ['Sales', 'Planning'], decidedBy: 'ai' })).body.code, 'attributes.deciderUnknown');
  assert.equal((await alice('POST', '/attributes', { name: 'Topic', values: ['Sales', 'Planning'], decidedBy: 'elo', elo: 'if then' })).body.code, 'attributes.ruleInvalid');
  assert.equal((await alice('POST', '/attributes', { name: 'Topic', values: ['Sales', 'Planning'], decidedBy: 'elo' })).body.code, 'attributes.ruleRequired');
  const made = await alice('POST', '/attributes', { name: 'Topic', values: ['Sales', 'Planning'], decidedBy: 'elo', elo: topicRule });
  assert.equal(made.status, 201);
  assert.deepEqual([made.body.name, made.body.system, made.body.values], ['Topic', false, [{ key: '1', label: 'Sales', color: 'grey' }, { key: '2', label: 'Planning', color: 'grey' }]]);
  topic = made.body.key;
});

test('emails fetched afterwards get its value from the rule; a board filters on it', async () => {
  await connectInbox(alice, stack.imapAccount);
  const emails = (await alice('GET', '/emails?box=todo')).body.emails;
  const valueOf = (subject: RegExp) => emails.find((e: { subject: string }) => subject.test(e.subject)).attributes[topic];
  assert.deepEqual(valueOf(/devis/), { value: '1', source: 'rule' });
  assert.deepEqual(valueOf(/rendez-vous/), { value: '2', source: 'rule' });
  assert.equal(valueOf(/Merci/), undefined, 'the rule said nothing');
  const board = await alice('POST', '/boards', { name: 'Sales', filter: { attributes: { [topic]: ['1'] } } });
  assert.equal(board.body.count, 1);
});

test('a rule is tried on recent emails before it is kept', async () => {
  const tried = (await alice('POST', '/attributes/try', { elo: topicRule, values: ['Sales', 'Planning'] })).body;
  assert.equal(tried.length, 4);
  assert.deepEqual(tried.map((t: { value: string | null }) => t.value).filter(Boolean).sort(), ['1', '2'], 'each value by its key');
  assert.ok(tried.every((t: { now: unknown }) => t.now === null), 'an attribute being made has no value yet on any email');
  assert.equal((await alice('POST', '/attributes/try', { elo: 'nope(', values: [] })).body.code, 'attributes.ruleInvalid');
});

test('a member sets a value by hand, or takes it away; "Stands in" is not set this way', async () => {
  const [email] = (await alice('GET', '/emails?box=todo')).body.emails.filter((e: { subject: string }) => /Merci/.test(e.subject));
  assert.equal((await alice('PUT', `/emails/${email.id}/attributes/${topic}`, { value: '9' })).body.code, 'attributes.valueUnknown');
  assert.equal((await alice('PUT', `/emails/${email.id}/attributes/${topic}`, { value: '2' })).status, 200);
  assert.deepEqual((await alice('GET', `/emails/${email.id}`)).body.attributes[topic], { value: '2', source: 'user' });
  assert.equal((await alice('PUT', `/emails/${email.id}/attributes/priority`, { value: 'high' })).status, 200);
  assert.equal((await alice('GET', `/emails/${email.id}`)).body.priority, 'high');
  assert.equal((await alice('PUT', `/emails/${email.id}/attributes/${topic}`, { value: null })).status, 200);
  assert.equal((await alice('GET', `/emails/${email.id}`)).body.attributes[topic], undefined);
  assert.equal((await alice('PUT', `/emails/${email.id}/attributes/status`, { value: 'none' })).body.code, 'attributes.valueUnknown');
});

test('whether its rule decides "Stands in" is the organisation\'s setting; its values cannot be changed, nor it deleted', async () => {
  const skipsAutomated = async () => (await alice('GET', '/me')).body.organization.skipAutomated;
  assert.equal((await alice('PUT', '/attributes/status', { decidedBy: 'nobody' })).body.decidedBy, 'nobody');
  assert.equal(await skipsAutomated(), false);
  const edited = await alice('PUT', '/attributes/status', { name: 'Renamed', values: ['x', 'y'], decidedBy: 'elo', elo: `if _.from.address == '' then 'none' else null` });
  assert.deepEqual([edited.body.name, edited.body.values.length, edited.body.decidedBy], ['Stands in', 4, 'elo']);
  assert.equal(await skipsAutomated(), true);
  assert.equal((await alice('PUT', '/attributes/status', { decidedBy: 'eloAi', elo: 'null' })).body.code, 'attributes.deciderUnknown');
  assert.equal(await skipsAutomated(), true, 'a way of deciding that is not known does not switch its rule off');
  assert.equal((await alice('DELETE', '/attributes/status')).body.code, 'attributes.systemFixed');
});

test('the colours of a pre-configured attribute are the organisation\'s: given with its values, kept until others are given', async () => {
  const colors = async (key: string) => (await alice('GET', '/attributes')).body.find((a: { key: string }) => a.key === key).values.map((v: { color: string }) => v.color);
  assert.deepEqual([await colors('status'), await colors('priority')], [['purple', 'grey', 'green', 'grey'], ['red', 'grey', 'blue']], 'what they start with');
  const edited = await alice('PUT', '/attributes/priority', { decidedBy: 'nobody', values: [{ label: 'High', color: 'orange' }, { label: 'Normal', color: 'pink' }, { label: 'Low', color: 'green' }] });
  assert.deepEqual(edited.body.values, [{ key: 'high', label: 'High', color: 'orange' }, { key: 'normal', label: 'Normal', color: 'grey' }, { key: 'low', label: 'Low', color: 'green' }]);
  const { elo } = (await alice('GET', '/attributes')).body[0];
  assert.equal((await alice('PUT', '/attributes/status', { decidedBy: 'elo', elo, values: [{ color: 'blue' }, { color: 'yellow' }] })).status, 200);
  assert.equal((await alice('PUT', '/attributes/status', { decidedBy: 'elo', elo })).status, 200, 'changing how it is decided, with no value given');
  assert.deepEqual([await colors('status'), await colors('priority')], [['blue', 'yellow', 'green', 'grey'], ['orange', 'grey', 'green']]);
});

test('members read the attributes; only administrators change them', async () => {
  await join(alice, bruno, 'bruno@acme.example');
  assert.equal((await bruno('GET', '/attributes')).body.length, 3);
  assert.equal((await bruno('POST', '/attributes', { name: 'Mine', values: ['a', 'b'] })).status, 403);
  assert.equal((await bruno('DELETE', `/attributes/${topic}`)).status, 403);
  assert.equal((await alice('DELETE', `/attributes/${topic}`)).status, 200);
  assert.equal((await alice('GET', '/attributes')).body.length, 2);
});
