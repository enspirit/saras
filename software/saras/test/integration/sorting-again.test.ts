// Sorting again: the rule of an attribute applied to the emails already kept.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { standsAgain, valueAgain } from '../../src/domain/computations/sorting-again.ts';
import type { KeptSorting } from '../../src/domain/computations/sorting-again.ts';
import { createClient, join } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

const kept = (over: Partial<KeptSorting> = {}): KeptSorting => ({ status: 'needs_reply', source: 'none', hasHeaders: true, attributes: {}, ...over });
const none = { value: 'none', reason: 'why' };

test('where an email stands follows its rule again, unless a member placed it, it was replied, or it cannot be judged', () => {
  assert.deepEqual(standsAgain(kept(), none), { status: 'no_reply', source: 'rule', reason: 'why' });
  assert.equal(standsAgain(kept({ status: 'no_reply', source: 'rule' }), none), null, 'already there, by the rule');
  assert.equal(standsAgain(kept({ source: 'user' }), none), null, 'a member placed it');
  assert.equal(standsAgain(kept({ status: 'sent' }), none), null, 'replied');
  assert.equal(standsAgain(kept({ hasHeaders: false }), none), null, 'fetched before its headers were kept');
  assert.equal(standsAgain(kept(), { value: 'sent', reason: '' }), null, 'a rule cannot mark an email as replied');
  assert.equal(standsAgain(kept(), null), null, 'the rule says nothing of an email it had not placed');
  assert.deepEqual(standsAgain(kept({ status: 'no_reply', source: 'rule' }), null), { status: 'needs_reply', source: 'none', reason: '' }, 'the rule no longer places it: it is to handle, as nobody\'s decision');
});

test('a value follows its rule again; one set by hand stays, one the rule had given goes when the rule is silent', () => {
  const two = { value: '2', reason: '' };
  assert.deepEqual(valueAgain('7', kept(), two), { attributes: { 7: { value: '2', source: 'rule' } } });
  assert.equal(valueAgain('7', kept({ attributes: { 7: { value: '2', source: 'rule' } } }), two), null);
  assert.equal(valueAgain('7', kept({ attributes: { 7: { value: '1', source: 'user' } } }), two), null);
  assert.deepEqual(valueAgain('7', kept({ attributes: { 7: { value: '1', source: 'rule' }, 8: { value: 'x', source: 'user' } } }), null), { attributes: { 8: { value: 'x', source: 'user' } } });
  assert.deepEqual(valueAgain('7', kept({ attributes: { 7: { value: '1', source: 'nobody' } } }), two), { attributes: { 7: { value: '2', source: 'rule' } } }, 'a value nobody decided follows the rule');
  assert.equal(valueAgain('7', kept({ attributes: { 7: { value: '1', source: 'nobody' } } }), null), null, 'and stays when the rule is silent');
});

let stack: Stack;
before(async () => (stack = await startStack()));
after(() => stack.stop());

const client = () => createClient(() => stack.url);
const alice = client();
const subjects = async (box: string): Promise<string[]> => (await alice('GET', `/emails?box=${box}`)).body.emails.map((e: { subject: string }) => e.subject).sort();
const topicOf = async (subject: RegExp, key: string) => (await alice('GET', '/emails?box=todo')).body.emails.find((e: { subject: string }) => subject.test(e.subject)).attributes[key];
let topic: string;

test('an attribute made after the emails were fetched has no value for them, until its rule is applied again', async () => {
  assert.equal((await alice('POST', '/auth/signup', { email: 'alice@acme.example', password: 'un-bon-mot-de-passe', organization: 'Acme' })).status, 201);
  await connectInbox(alice, stack.imapAccount);
  const rule = `if contains(lower(_.subject), 'devis') then 'Sales' else if contains(lower(_.subject), 'merci') then 'Other' else null`;
  topic = (await alice('POST', '/attributes', { name: 'Topic', values: ['Sales', 'Other'], decidedBy: 'elo', elo: rule })).body.key;
  assert.equal(await topicOf(/devis/, topic), undefined);
  const again = await alice('POST', `/attributes/${topic}/sort-again`);
  assert.deepEqual(again.body, { examined: 4, changed: 2 });
  assert.deepEqual(await topicOf(/devis/, topic), { value: '1', source: 'rule' });
  assert.deepEqual((await alice('POST', `/attributes/${topic}/sort-again`)).body, { examined: 4, changed: 0 }, 'applying it twice changes nothing more');
});

test('a value set by hand survives; a value the rule gave follows the rule when it changes', async () => {
  const [merci] = (await alice('GET', '/emails?box=todo')).body.emails.filter((e: { subject: string }) => /Merci/.test(e.subject));
  assert.equal((await alice('PUT', `/emails/${merci.id}/attributes/${topic}`, { value: '1' })).status, 200);
  const rule = `if contains(lower(_.subject), 'rendez-vous') then 'Other' else null`;
  assert.equal((await alice('PUT', `/attributes/${topic}`, { name: 'Topic', values: ['Sales', 'Other'], decidedBy: 'elo', elo: rule })).status, 200);
  assert.deepEqual((await alice('POST', `/attributes/${topic}/sort-again`)).body, { examined: 4, changed: 2 });
  assert.deepEqual(await topicOf(/Merci/, topic), { value: '1', source: 'user' }, 'set by hand');
  assert.equal(await topicOf(/devis/, topic), undefined, 'the rule no longer speaks of it');
  assert.deepEqual(await topicOf(/rendez-vous/, topic), { value: '2', source: 'rule' });
});

test('"Stands in" is sorted again by its rule: what it now sets aside leaves the emails to handle', async () => {
  assert.deepEqual(await subjects('none'), ['Les 10 actus de la semaine']);
  const rule = `if contains(lower(_.subject), 'merci') then {value: 'none', reason: 'A thank-you note.'} else null`;
  assert.equal((await alice('PUT', '/attributes/status', { decidedBy: 'elo', elo: rule })).status, 200);
  const again = (await alice('POST', '/attributes/status/sort-again')).body;
  assert.equal(again.examined, 4);
  assert.deepEqual(await subjects('none'), ['Merci pour hier'], 'the newsletter, which the rule no longer places, is to handle again');
  const [aside] = (await alice('GET', '/emails?box=none')).body.emails;
  assert.equal((await alice('GET', `/emails/${aside.id}`)).body.triageReason, 'A thank-you note.');
});

test('an email a member placed stays where they put it; only administrators sort again, and only attributes that have a rule', async () => {
  const [todo] = (await alice('GET', '/emails?box=todo')).body.emails.filter((e: { subject: string }) => /devis/.test(e.subject));
  assert.equal((await alice('POST', `/emails/${todo.id}/status`, { status: 'ignored' })).status, 200);
  assert.equal((await alice('PUT', '/attributes/status', { decidedBy: 'elo', elo: `'none'` })).status, 200);
  await alice('POST', '/attributes/status/sort-again');
  assert.deepEqual(await subjects('ignored'), ['Demande de devis pour 20 licences']);
  const priority = (await alice('GET', '/attributes')).body.find((a: { name: string }) => a.name === 'Priority').key;
  assert.equal((await alice('POST', `/attributes/${priority}/sort-again`)).body.code, 'attributes.ruleRequired');
  const bruno = client();
  await join(alice, bruno, 'bruno@acme.example');
  assert.equal((await bruno('POST', `/attributes/${topic}/sort-again`)).status, 403);
});
