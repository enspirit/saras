// Searching a list of emails, and acting on several at once: those ticked, or all of a box or a
// board as searched, named by the view and never one by one.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { searchConditions, searchGiven } from '../../src/domain/computations/search.ts';
import { TICKED_MAX, selectionGiven, viewGiven } from '../../src/domain/computations/selection.ts';
import { createClient, join } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

test('a search is trimmed and cut; each of its words is a condition on four columns, taken literally', () => {
  assert.equal(searchGiven('  devis  '), 'devis');
  assert.equal(searchGiven(42), '');
  assert.equal(searchGiven('x'.repeat(500)).length, 200);
  const { sql, params } = searchConditions('50%  off', 4);
  assert.deepEqual(params, ['%50\\%%', '%off%']);
  assert.equal(sql[1], '(e.from_name ILIKE $5 OR e.from_addr ILIKE $5 OR e.subject ILIKE $5 OR e.body_text ILIKE $5)');
  assert.deepEqual(searchConditions(' ', 3), { sql: [], params: [] });
});

test('a selection is emails ticked, a few hundred at most, or all of a view, named by the view', () => {
  const code = (value: unknown): string => {
    const verdict = selectionGiven(value);
    return verdict.ok ? JSON.stringify(verdict.value) : verdict.refusal.problem.code;
  };
  assert.equal(code({ ids: [3, '4', 3] }), '{"ids":[3,4]}');
  assert.equal(code({ ids: [] }), 'emails.selectionInvalid');
  assert.equal(code({ ids: [1, 'x'] }), 'emails.selectionInvalid');
  assert.equal(code({ ids: Array.from({ length: TICKED_MAX + 1 }, (_, i) => i + 1) }), 'emails.selectionInvalid');
  assert.equal(code({ all: { box: 'none', search: ' claire ' } }), '{"all":{"box":"none","search":"claire"}}');
  assert.equal(code({ all: { board: '7' } }), '{"all":{"board":7,"search":""}}');
  assert.equal(code(null), 'emails.selectionInvalid');
  assert.deepEqual(viewGiven({ box: 'nowhere' }), { box: 'todo', search: '' });
});

let stack: Stack;
before(async () => (stack = await startStack()));
after(() => stack.stop());

const alice = createClient(() => stack.url);
const bruno = createClient(() => stack.url);
const subjects = async (path: string): Promise<string[]> => (await alice('GET', path)).body.emails.map((e: { subject: string }) => e.subject).sort();
const box = async (name: string): Promise<{ subject: string; id: number; status: string; attributes: Record<string, { value: string; source: string }> }[]> =>
  (await alice('GET', `/emails?box=${name}`)).body.emails;

test('a box is searched in who sent each email, its subject and its text; every word must be found', async () => {
  assert.equal((await alice('POST', '/auth/signup', { email: 'alice@acme.example', password: 'un-bon-mot-de-passe', organization: 'Acme' })).status, 201);
  await connectInbox(alice, stack.imapAccount);
  assert.deepEqual(await subjects('/emails?box=todo&search=DEVIS'), ['Demande de devis pour 20 licences']);
  assert.deepEqual(await subjects('/emails?box=todo&search=claire'), ['Demande de devis pour 20 licences'], 'by the name of who sent it');
  assert.deepEqual(await subjects('/emails?box=todo&search=client.example'), ['Demande de devis pour 20 licences', 'Report de notre rendez-vous'], 'by their address');
  assert.deepEqual(await subjects('/emails?box=todo&search=client.example%20rendez-vous'), ['Report de notre rendez-vous']);
  assert.deepEqual(await subjects('/emails?box=todo&search=actus'), [], 'the newsletter is not in this box');
  assert.deepEqual(await subjects('/emails?box=all&search=actus'), ['Les 10 actus de la semaine'], 'it is among every box');
  assert.deepEqual(await subjects('/emails?box=todo&search=%25'), [], 'a % is a % and not "anything"');
});

test('what an email says is shown from a little before the word searched', async () => {
  const [found] = (await alice('GET', '/emails?box=todo&search=personnes')).body.emails;
  assert.match(found.snippet, /personnes/);
});

test('a board is searched among what it shows', async () => {
  const board = (await alice('POST', '/boards', { name: 'Clients', filter: { from: 'client.example' } })).body.id;
  assert.deepEqual(await subjects(`/boards/${board}/emails?search=rendez-vous`), ['Report de notre rendez-vous']);
  assert.deepEqual(await subjects(`/boards/${board}/emails?search=actus`), []);
});

test('emails ticked are said to need no reply at once, and put back all together by the view they now stand in', async () => {
  const claire = (await box('todo')).filter((e) => /client/.test(e.subject) || /devis|rendez-vous/.test(e.subject)).map((e) => e.id);
  const done = await alice('POST', '/emails/selection/status', { selection: { ids: claire }, status: 'no_reply' });
  assert.deepEqual([done.status, done.body], [200, { changed: 2 }]);
  assert.deepEqual((await box('none')).map((e) => e.subject).sort(), ['Demande de devis pour 20 licences', 'Les 10 actus de la semaine', 'Report de notre rendez-vous']);
  const back = await alice('POST', '/emails/selection/status', { selection: { all: { box: 'none', search: 'client.example' } }, status: 'needs_reply' });
  assert.deepEqual(back.body, { changed: 2 }, 'all of a search: the newsletter is left where it is');
  assert.equal((await box('todo')).length, 3);
  assert.equal((await alice('POST', '/emails/selection/status', { selection: { all: { box: 'todo' } }, status: 'sent' })).body.code, 'emails.invalidStatus');
  assert.equal((await alice('POST', '/emails/selection/status', { selection: { ids: [] }, status: 'ignored' })).body.code, 'emails.selectionInvalid');
});

test('a value is given to all the emails of a box at once, by hand, and taken away the same way; their other values stay', async () => {
  const topic = (await alice('POST', '/attributes', { name: 'Topic', values: ['Sales', 'Planning'] })).body.key;
  assert.deepEqual((await alice('POST', `/emails/selection/attributes/${topic}`, { selection: { all: { box: 'todo' } }, value: '1' })).body, { changed: 3 });
  assert.ok((await box('todo')).every((e) => e.attributes[topic]?.value === '1' && e.attributes[topic]?.source === 'user'));
  const [first] = await box('todo');
  const priority = (await alice('GET', '/attributes')).body.find((a: { name: string }) => a.name === 'Priority').key;
  assert.deepEqual((await alice('POST', `/emails/selection/attributes/${priority}`, { selection: { ids: [first!.id] }, value: '1' })).body, { changed: 1 });
  const high = (await box('todo')).find((e) => e.id === first!.id)!;
  assert.deepEqual([high.attributes[priority], high.attributes[topic]?.value], [{ value: '1', source: 'user' }, '1'], 'the priority is given like any attribute; the topic stays');
  assert.deepEqual((await alice('POST', `/emails/selection/attributes/${topic}`, { selection: { all: { box: 'todo', search: 'devis' } }, value: null })).body, { changed: 1 });
  assert.equal((await box('todo')).filter((e) => e.attributes[topic]).length, 2);
  assert.equal((await alice('POST', '/emails/selection/attributes/status', { selection: { all: { box: 'todo' } }, value: 'none' })).body.code, 'attributes.valueUnknown', 'where an email stands is changed by acting on it');
  assert.equal((await alice('POST', `/emails/selection/attributes/${topic}`, { selection: { all: { box: 'todo' } }, value: '9' })).body.code, 'attributes.valueUnknown');
});

test('what a member may not see is not acted on, whether ticked or in a board that is not theirs', async () => {
  await join(alice, bruno, 'bruno@acme.example');
  const ids = (await box('todo')).map((e) => e.id);
  assert.deepEqual((await bruno('POST', '/emails/selection/status', { selection: { ids }, status: 'ignored' })).body, { changed: 0 }, "alice's mailbox is her own");
  const board = (await alice('POST', '/boards', { name: 'Mine', filter: {} })).body.id;
  assert.equal((await bruno('POST', '/emails/selection/status', { selection: { all: { board } }, status: 'ignored' })).status, 404);
  assert.equal((await box('todo')).length, 3);
});
