// The configuration of an organisation as data: read, checked and applied by names, whole or
// not at all. Whatever writes one — a person, a script, the assistant — has it applied this way.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, join } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

let stack: Stack;
const client = () => createClient(() => stack.url);
const alice = client(); // administrator
const bruno = client(); // member
let mailbox: number;

before(async () => {
  stack = await startStack();
  assert.equal((await alice('POST', '/auth/signup', { email: 'alice@acme.example', password: 'un-bon-mot-de-passe', organization: 'Acme', language: 'fr' })).status, 201);
  mailbox = await connectInbox(alice, stack.imapAccount);
});
after(() => stack.stop());

const topicRule = `if contains(lower(_.subject), 'devis') then 'Sales' else if contains(lower(_.subject), 'rendez-vous') then 'Planning' else null`;
const topic = { name: 'Topic', kind: 'choice', values: [{ label: 'Sales', color: 'green' }, { label: 'Planning', color: 'blue' }], decidedBy: 'elo', elo: topicRule };
const names = (list: { name: string }[]): string[] => list.map(({ name }) => name);
const attributeKeyed = async (name: string) => (await alice('GET', '/attributes')).body.find((a: { name: string }) => a.name === name);

test('an organisation tells its configuration by names: where an email stands by its key, its own attributes by their name, and the boards its members share', async () => {
  const { status, body } = await alice('GET', '/configuration');
  assert.equal(status, 200);
  assert.deepEqual(names(body.attributes), ['status', 'Priorité']);
  assert.deepEqual(body.attributes[1], { name: 'Priorité', kind: 'choice', values: [{ label: 'Haute', color: 'red' }, { label: 'Normale', color: 'grey' }, { label: 'Basse', color: 'blue' }], decidedBy: 'nobody', elo: '' });
  assert.deepEqual(body.boards, []);
});

test('applying one makes what the organisation does not have, by its name, and changes what it has; boards are shared, their filter kept as the organisation numbers it', async () => {
  await alice('POST', '/boards', { name: 'Sales', filter: { from: 'mine' } });
  const priority = { name: 'priorité', kind: 'choice', values: [{ label: 'Haute', color: 'red' }, { label: 'Normale', color: 'grey' }, { label: 'Basse', color: 'blue' }], decidedBy: 'elo', elo: `if contains(lower(_.subject), 'devis') then 'haute' else null` };
  const sales = { name: 'Sales', filter: { attributes: { topic: ['sales'], status: ['todo'] }, mailbox: [stack.imapAccount.email.toUpperCase()], received: 30 } };
  const applied = await alice('PUT', '/configuration', { attributes: [topic, priority], boards: [sales] });
  assert.equal(applied.status, 200);
  assert.deepEqual(names(applied.body.attributes), ['status', 'priorité', 'Topic'], 'the answer is the configuration as it now is');
  const made = await attributeKeyed('Topic');
  assert.deepEqual([made.decidedBy, made.elo, made.values], ['elo', topicRule, [{ key: '1', label: 'Sales', color: 'green' }, { key: '2', label: 'Planning', color: 'blue' }]]);
  assert.equal((await attributeKeyed('priorité')).decidedBy, 'elo', 'the priority it started with, now with a rule: named case aside');
  const boards = (await alice('GET', '/boards')).body;
  assert.deepEqual(boards.map((b: { name: string; shared: boolean }) => [b.name, b.shared]), [['Sales', true], ['Sales', false]], 'a member\'s own board of that name is not the organisation\'s');
  assert.deepEqual(boards[0].filter, { attributes: { [made.key]: ['1'], status: ['todo'] }, mailbox: [mailbox], received: 30 });
});

test('emails already kept stay as they were sorted, until a rule is applied to them as any rule is', async () => {
  const shown = async () => (await alice('GET', '/boards')).body[0].count;
  assert.equal(await shown(), 0);
  assert.equal((await alice('POST', `/attributes/${(await attributeKeyed('Topic')).key}/sort-again`)).body.changed, 2);
  assert.equal(await shown(), 1);
});

test('applied again, the same configuration changes nothing; told, then applied, an organisation is as it was', async () => {
  const before = (await alice('GET', '/configuration')).body;
  assert.deepEqual(before.boards, [{ name: 'Sales', filter: { attributes: { status: ['todo'], Topic: ['Sales'] }, mailbox: [stack.imapAccount.email], received: 30 } }]);
  assert.deepEqual((await alice('PUT', '/configuration', before)).body, before);
  assert.deepEqual([(await alice('GET', '/attributes')).body.length, (await alice('GET', '/boards')).body.length], [3, 2]);
});

test('what is not named is left as it is: nothing is deleted by a configuration', async () => {
  const before = (await alice('GET', '/configuration')).body;
  for (const given of [{}, { attributes: [], boards: [] }, { boards: [{ name: 'Planning', filter: { attributes: { Topic: ['Planning'] } } }] }]) assert.equal((await alice('PUT', '/configuration', given)).status, 200);
  const now = (await alice('GET', '/configuration')).body;
  assert.deepEqual([now.attributes, names(now.boards)], [before.attributes, ['Sales', 'Planning']]);
  const menu: number[] = (await alice('GET', '/boards')).body.map((board: { id: number }) => board.id);
  assert.equal((await alice('PUT', '/boards/order', { boards: menu.reverse() })).status, 200);
  assert.deepEqual(names((await alice('GET', '/configuration')).body.boards), ['Sales', 'Planning'], 'the order an administrator gave their own menu is not the organisation\'s');
});

test('of where an email stands, a configuration changes how it is decided and the colours it gives; its name and its values stay', async () => {
  const rule = `if _.headers.listId != '' then 'none' else null`;
  const given = { name: 'status', kind: 'member', values: [{ label: 'none', color: 'yellow' }, { label: 'archived', color: 'red' }, { label: 'todo' }], decidedBy: 'elo', elo: rule };
  assert.equal((await alice('PUT', '/configuration', { attributes: [given] })).status, 200);
  const [stands] = (await alice('GET', '/attributes')).body;
  assert.deepEqual([stands.name, stands.kind, stands.elo], ['Stands in', 'choice', rule]);
  assert.deepEqual(stands.values.map((v: { key: string; color: string }) => `${v.key}:${v.color}`), ['todo:purple', 'none:yellow', 'sent:green', 'ignored:grey']);
  assert.equal((await alice('PUT', '/configuration', { attributes: [{ name: 'status', decidedBy: 'nobody' }] })).status, 200);
  assert.equal((await alice('GET', '/me')).body.organization.skipAutomated, false, 'whether its rule decides it is the organisation\'s setting');
});

test('a configuration is applied whole or not at all: what is wrong anywhere in it refuses all of it', async () => {
  const before = (await alice('GET', '/configuration')).body;
  const urgency = { name: 'Urgency', kind: 'choice', values: ['Now', 'Later'], decidedBy: 'nobody' };
  const refused = async (given: object): Promise<unknown[]> => { const { status, body } = await alice('PUT', '/configuration', given); return [status, body.code]; };
  assert.deepEqual(await refused({ attributes: [urgency, { ...topic, elo: 'if then' }] }), [400, 'attributes.ruleInvalid']);
  assert.deepEqual(await refused({ attributes: [urgency, { ...topic, elo: '_.subjet' }] }), [400, 'attributes.ruleInvalid'], 'a rule is checked against the email, as when it is saved');
  assert.deepEqual(await refused({ attributes: [urgency, { ...topic, decidedBy: 'ai' }] }), [400, 'attributes.deciderUnknown']);
  assert.deepEqual(await refused({ attributes: [urgency, { ...urgency, name: ' urgency ' }] }), [400, 'configuration.namedTwice']);
  assert.deepEqual(await refused({ attributes: [urgency], boards: [{ name: 'Now', filter: { attributes: { Urgency: ['Soon'] } } }] }), [400, 'configuration.valueUnknown']);
  assert.deepEqual(await refused({ attributes: [urgency], boards: [{ name: 'Now', filter: { attributes: { Importance: ['High'] } } }] }), [400, 'configuration.attributeUnknown']);
  assert.deepEqual(await refused({ attributes: [urgency], boards: [{ name: 'Now', filter: { mailbox: ['other@acme.example'] } }] }), [400, 'configuration.mailboxUnknown']);
  assert.deepEqual(await refused({ attributes: [urgency], boards: [{ filter: {} }] }), [400, 'boards.nameRequired']);
  assert.deepEqual((await alice('GET', '/configuration')).body, before, 'the attribute that was right was not made either');
  assert.equal((await alice('PUT', '/configuration', { attributes: [urgency], boards: [{ name: 'Now', filter: { attributes: { Urgency: ['Now'] } } }] })).status, 200, 'a board may name an attribute made with it');
});

test('a configuration is checked without being applied: everything wrong in it, each with its place', async () => {
  const before = (await alice('GET', '/configuration')).body;
  const given = {
    attributes: [{ name: 'Channel', values: ['Web'] }, { ...topic, elo: 'if then' }, { name: 'Team', values: ['A', 'B'] }, { name: 'team', values: ['A', 'B'] }],
    boards: [{ name: 'A', filter: { attributes: { Team: ['C'], Channel: ['Web'] }, except: { mailbox: ['x@y.example'] } } }, { name: 'a', filter: {} }],
  };
  const problems = (await alice('POST', '/configuration/check', given)).body;
  assert.deepEqual(problems.map((p: { at: string; code: string }) => [p.at, p.code]), [
    ['attributes.0', 'attributes.valuesRequired'], ['attributes.1', 'attributes.ruleInvalid'], ['attributes.3', 'configuration.namedTwice'],
    ['boards.1', 'configuration.namedTwice'], ['boards.0.filter', 'configuration.valueUnknown'], ['boards.0.filter', 'configuration.attributeUnknown'], ['boards.0.filter', 'configuration.mailboxUnknown'],
  ]);
  assert.match(problems[1].message, /^The rule cannot be read: /);
  assert.deepEqual(problems[4].params, { attribute: 'Team', value: 'C' });
  assert.deepEqual((await alice('POST', '/configuration/check', before)).body, [], 'nothing wrong in what the organisation has');
  assert.deepEqual((await alice('GET', '/configuration')).body, before, 'checking changes nothing');
});

test('the configuration is the administrators\': a member neither reads it as data, nor checks one, nor applies one', async () => {
  await join(alice, bruno, 'bruno@acme.example');
  assert.deepEqual([(await bruno('GET', '/configuration')).status, (await bruno('POST', '/configuration/check', {})).status, (await bruno('PUT', '/configuration', {})).status], [403, 403, 403]);
  const assignee = { name: 'Assignee', kind: 'member', decidedBy: 'nobody' };
  const mine = { name: 'Bruno', filter: { attributes: { Assignee: ['bruno@acme.example'] } } };
  assert.equal((await alice('PUT', '/configuration', { attributes: [assignee], boards: [mine] })).status, 200, 'a member is named by their address');
  const kept = (await alice('GET', '/boards')).body.find((b: { name: string }) => b.name === 'Bruno');
  const bob = (await alice('GET', '/members')).body.find((m: { email: string }) => m.email === 'bruno@acme.example');
  assert.deepEqual(Object.values(kept.filter.attributes), [[String(bob.id)]]);
  assert.deepEqual((await alice('GET', '/configuration')).body.boards.at(-1), mine);
});
