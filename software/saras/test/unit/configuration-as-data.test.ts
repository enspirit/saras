// The configuration of an organisation as data: told by names, read back into what the
// organisation numbers, and compared with what is already so.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Attribute } from '../../shared/attribute.ts';
import type { Configuration, FilterConfigured } from '../../shared/configuration.ts';
import { STATUS_VALUES } from '../../src/domain/computations/attributes.ts';
import { configurationGiven, configurationTold, filterConfigured } from '../../src/domain/computations/configuration.ts';
import type { Known } from '../../src/domain/computations/configuration.ts';
import { whatChanges } from '../../src/domain/computations/configuration-changes.ts';
import { attributeRead, attributesAfter, filterResolved, saidTwice, systemEdited, unknownIn } from '../../src/domain/computations/configuration-names.ts';

const standsIn: Attribute = { key: 'status', name: 'Stands in', kind: 'choice', values: STATUS_VALUES, decidedBy: 'elo', elo: 'null', system: true };
const topic: Attribute = { key: '7', name: 'Topic', kind: 'choice', values: [{ key: '1', label: 'Billing', color: 'orange' }, { key: '2', label: 'Support', color: 'blue' }], decidedBy: 'elo', elo: `'Billing'`, system: false };
const members = [{ key: '3', label: 'alice@acme.example' }, { key: '4', label: 'bruno@acme.example' }];
const assignee: Attribute = { key: '9', name: 'Assignee', kind: 'member', values: members, decidedBy: 'nobody', elo: '', system: false };
const known: Known = { attributes: [standsIn, topic, assignee], members, mailboxes: [{ id: 1, email: 'support@acme.example' }, { id: 2, email: 'sales@acme.example' }, { id: 5, email: 'support@acme.example' }] };

test('a configuration tells attributes by their name and values by their label; the pre-configured one by its key, and its values by theirs', () => {
  const { attributes } = configurationTold(known, []);
  assert.deepEqual(attributes.map(({ name, kind }) => [name, kind]), [['status', 'choice'], ['Topic', 'choice'], ['Assignee', 'member']]);
  assert.deepEqual(attributes[0]!.values.map(({ label, color }) => `${label}:${color}`), ['todo:purple', 'none:grey', 'sent:green', 'ignored:grey']);
  assert.deepEqual(attributes[1], { name: 'Topic', kind: 'choice', values: [{ label: 'Billing', color: 'orange' }, { label: 'Support', color: 'blue' }], decidedBy: 'elo', elo: `'Billing'` });
  assert.deepEqual(attributes[2]!.values, [], 'the members are not values to tell');
});

test('a board is told by what its filter names; what is gone, or is not the asker\'s to use, is left out', () => {
  const cases: [string, Parameters<typeof filterConfigured>[0], FilterConfigured][] = [
    ['attributes and values, by names', { attributes: { status: ['todo'], 7: ['2', '1'] } }, { attributes: { status: ['todo'], Topic: ['Billing', 'Support'] } }],
    ['a member, by their address', { attributes: { 9: ['4'] } }, { attributes: { Assignee: ['bruno@acme.example'] } }],
    ['mailboxes by their address, each once', { mailbox: [1, 5, 2] }, { mailbox: ['support@acme.example', 'sales@acme.example'] }],
    ['the facts of an email as they are', { from: 'client', keywords: 'devis', received: 7, attachment: false }, { from: 'client', keywords: 'devis', received: 7, attachment: false }],
    ['what an email must not be', { except: { attributes: { 7: ['1'] }, from: 'noreply' } }, { except: { attributes: { Topic: ['Billing'] }, from: 'noreply' } }],
    ['an attribute, a value or a mailbox that is gone', { attributes: { 12: ['1'], 7: ['8'] }, mailbox: [99] }, {}],
  ];
  for (const [what, filter, expected] of cases) assert.deepEqual(filterConfigured(filter, known), expected, what);
});

test('a configuration given is reduced to attributes still to be read, and to boards with a name and what a filter may say', () => {
  const given = { attributes: [{ name: 'Topic' }, 'x', null], boards: [{ name: '  Sales ', filter: { attributes: { Topic: ['Sales', 'Sales', ' '], Empty: [] }, mailbox: ['Sales@Acme.example'], received: '7', colour: 'red', except: { keywords: ' promo ', received: 3 } } }, 'x'], other: 1 };
  assert.deepEqual(configurationGiven(given), {
    attributes: [{ name: 'Topic' }, {}, {}],
    boards: [{ name: 'Sales', filter: { attributes: { Topic: ['Sales'] }, mailbox: ['sales@acme.example'], received: 7, except: { keywords: 'promo' } } }, { name: '', filter: {} }],
  });
  for (const nothing of [null, 'x', [], { attributes: 'x', boards: {} }]) assert.deepEqual(configurationGiven(nothing), { attributes: [], boards: [] });
});

test('what a filter names is what the organisation numbers; an address names every mailbox that has it', () => {
  const filter: FilterConfigured = { attributes: { status: ['TODO', 'No reply needed'], topic: ['support'], Assignee: ['alice@acme.example'] }, mailbox: ['Support@acme.example'], received: 30, except: { attributes: { Topic: ['Billing'] } } };
  assert.deepEqual(unknownIn(filter, known), []);
  assert.deepEqual(filterResolved(filter, known), { attributes: { status: ['todo', 'none'], 7: ['2'], 9: ['3'] }, mailbox: [1, 5], received: 30, except: { attributes: { 7: ['1'] } } });
  const back = { attributes: { status: ['todo'], 7: ['1', '2'] }, mailbox: [2], from: 'x', keywords: 'y z', received: 7, attachment: true, except: { attributes: { 9: ['4'] } } };
  assert.deepEqual(filterResolved(filterConfigured(back, known), known), back, 'told then read, a filter is what it was');
});

test('a name that stands for nothing is told: an attribute, a value, a mailbox', () => {
  const filter: FilterConfigured = { attributes: { Urgency: ['High'], Topic: ['Sales', 'Billing'], status: ['done'] }, mailbox: ['nobody@acme.example'], except: { attributes: { Topic: ['1'] } } };
  assert.deepEqual(unknownIn(filter, known).map(({ code, params }) => [code.split('.')[1], Object.values(params).join('/')]), [
    ['attributeUnknown', 'Urgency'], ['valueUnknown', 'Topic/Sales'], ['valueUnknown', 'status/done'], ['mailboxUnknown', 'nobody@acme.example'], ['valueUnknown', 'Topic/1'],
  ]);
  assert.deepEqual(filterResolved(filter, known), { attributes: { 7: ['1'] } }, 'and is left out of what is kept');
});

test('boards are checked against the attributes there would be: those changed have their new values, those made exist', () => {
  const urgency = { name: 'Urgency', kind: 'choice' as const, values: [{ label: 'High', color: 'red' as const }, { label: 'Low', color: 'grey' as const }], decidedBy: 'nobody' as const, elo: '' };
  const after = attributesAfter(known, [{ ...urgency, name: 'topic', values: [{ label: 'Billing', color: 'orange' }, { label: 'Sales', color: 'green' }] }, urgency, { ...urgency, name: 'Owner', kind: 'member', values: [] }, { ...urgency, name: 'status' }]);
  assert.deepEqual(after.map(({ key, name, values }) => [key, name, values.map((value) => value.label).join()]), [
    ['status', 'Stands in', 'To handle,No reply needed,Replied,Ignored'], ['7', 'topic', 'Billing,Sales'], ['9', 'Assignee', 'alice@acme.example,bruno@acme.example'],
    ['new-0', 'Urgency', 'High,Low'], ['new-1', 'Owner', 'alice@acme.example,bruno@acme.example'],
  ]);
  assert.deepEqual(unknownIn({ attributes: { Urgency: ['High'], Topic: ['Sales'], Owner: ['bruno@acme.example'] } }, { ...known, attributes: after }), []);
  assert.deepEqual(saidTwice(['Topic', 'Urgency', ' topic ', '', '']), [2]);
});

test('of the pre-configured attribute a configuration says how it is decided, and the colours we know: nothing else is read, nor changed', () => {
  const read = attributeRead({ name: ' Status ', kind: 'member', values: [{ label: 'none', color: 'blue' }, { label: 'todo' }, { label: 'sent', color: 'pink' }, 'ignored'], decidedBy: 'nobody', elo: ' null ' });
  assert.deepEqual(read, { ok: true, value: { name: 'status', kind: 'choice', values: [{ label: 'none', color: 'blue' }], decidedBy: 'nobody', elo: 'null' } });
  assert.deepEqual(read.ok && systemEdited(standsIn, read.value), { decidedBy: 'nobody', elo: 'null', values: [{ color: undefined }, { color: 'blue' }, { color: undefined }, { color: undefined }] });
  const refused = (given: Record<string, unknown>): string => { const verdict = attributeRead(given); return verdict.ok ? 'ok' : verdict.refusal.problem.code; };
  assert.deepEqual([refused({ name: 'status', decidedBy: 'ai' }), refused({ name: 'Topic', values: ['a'] }), refused({ name: 'Topic', values: ['a', 'b'] })], ['attributes.deciderUnknown', 'attributes.valuesRequired', 'ok']);
});

test('what changes is what is not already so: an attribute or a board the organisation has as given is left out', () => {
  const current: Configuration = configurationTold(known, [{ name: 'Billing', filter: { attributes: { 7: ['1'], status: ['todo'] }, received: 7 } }]);
  const [status, kept] = current.attributes as [Configuration['attributes'][0], Configuration['attributes'][0]];
  const changes = (proposed: Partial<Configuration>): string[] => { const { attributes, boards } = whatChanges(current, { attributes: [], boards: [], ...proposed }); return [...attributes, ...boards].map(({ name }) => name); };
  const cases: [string, Partial<Configuration>, string[]][] = [
    ['as it is', current, []],
    ['a new attribute, a new board', { attributes: [{ ...kept, name: 'Urgency' }], boards: [{ name: 'Urgent', filter: {} }] }, ['Urgency', 'Urgent']],
    ['another rule', { attributes: [{ ...kept, elo: `'Support'` }] }, ['Topic']],
    ['the same rule, written with a blank more', { attributes: [{ ...kept, elo: `'Billing'\n` }] }, []],
    ['other values, another order, another colour', { attributes: [{ ...kept, values: [...kept.values].reverse() }, { ...kept, values: [{ label: 'Billing', color: 'red' }, kept.values[1]!] }] }, ['Topic', 'Topic']],
    ['no longer decided by its rule', { attributes: [{ ...kept, decidedBy: 'nobody', elo: '' }] }, ['Topic']],
    ['"Stands in" with its rule and no colour, or the colours it has', { attributes: [{ ...status, values: [] }, { ...status, values: [{ label: 'TODO', color: 'purple' }] }] }, []],
    ['"Stands in" with another rule, another colour', { attributes: [{ ...status, elo: `'none'` }, { ...status, values: [{ label: 'todo', color: 'red' }] }] }, ['status', 'status']],
    ['the same filter, said in another order and case', { boards: [{ name: 'billing', filter: { received: 7, attributes: { status: ['TODO'], topic: ['billing'] } } }] }, []],
    ['another filter', { boards: [{ name: 'Billing', filter: { attributes: { Topic: ['Billing'] }, received: 7 } }] }, ['Billing']],
  ];
  for (const [what, proposed, expected] of cases) assert.deepEqual(changes(proposed), expected, what);
});
