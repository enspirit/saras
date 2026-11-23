// Boards: named views of emails, defined by a filter on their attributes.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { boardGiven, conditionsOf, filterGiven, managesBoard, mayShare } from '../src/domain/computations/boards.ts';
import type { Verdict } from '../src/domain/refusal.ts';
import type { Actor } from '../src/domain/world.ts';
import { createClient, join } from './support/client.ts';
import { connectInbox } from './support/connected-mailbox.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

const outcome = (verdict: Verdict<unknown>): string => (verdict.ok ? 'ok' : `${verdict.refusal.kind}: ${verdict.refusal.problem.code}`);
const actorWith = (id: number, role: 'admin' | 'user') => ({ member: { id, role }, organization: { id: 1 } }) as Actor;

test('a filter is kept reduced to the attributes we know, and to the conditions that say something', () => {
  const given = { mailbox: [3, '4', 'x', 3], attributes: { status: ['todo'], 12: ['2', '2'], colour: ['red'], priority: [] }, received: '7', from: '  claire ', keywords: ' devis ', attachment: true, colour: 'red' };
  assert.deepEqual(filterGiven(given), { attributes: { 12: ['2'], status: ['todo'] }, mailbox: [3, 4], received: 7, from: 'claire', keywords: 'devis', attachment: true });
  assert.deepEqual(filterGiven({ box: ['todo'], priority: ['high'] }), { attributes: { status: ['todo'], priority: ['high'] } }, 'a filter made before attributes existed');
  assert.deepEqual(filterGiven({ mailbox: [], attributes: { status: 'todo' }, received: -2, from: ' ', attachment: 'yes' }), {});
  assert.deepEqual(filterGiven(null), {});
});

test('a board needs a name; only administrators share one; its owner manages it, administrators when it is shared', () => {
  assert.equal(outcome(boardGiven({ name: ' ' })), 'invalid: boards.nameRequired');
  assert.deepEqual(boardGiven({ name: ' Quotes ', filter: { attributes: { status: ['todo'] } } }), { ok: true, value: { name: 'Quotes', shared: false, filter: { attributes: { status: ['todo'] } } } });
  assert.equal(outcome(mayShare(actorWith(1, 'user'), true)), 'forbidden: boards.sharedByAdministrators');
  assert.deepEqual([outcome(mayShare(actorWith(1, 'user'), false)), outcome(mayShare(actorWith(1, 'admin'), true))], ['ok', 'ok']);
  assert.equal(managesBoard(actorWith(7, 'user'), { shared: false, user_id: 7 }), true);
  assert.equal(managesBoard(actorWith(8, 'admin'), { shared: false, user_id: 7 }), false);
  assert.equal(managesBoard(actorWith(7, 'user'), { shared: true, user_id: 7 }), false);
});

test('each condition of a filter is one condition on emails, with its own parameter', () => {
  const { sql, params } = conditionsOf({ attributes: { status: ['todo', 'sent'], 12: ['2'] }, mailbox: [3], received: 7, from: '50%_off', keywords: 'devis  licences', attachment: false }, 3);
  assert.deepEqual(params, [['2'], ['needs_reply', 'pending', 'sent'], [3], 7, '%50\\%\\_off%', '%devis%', '%licences%']);
  assert.equal(sql.length, 8);
  assert.equal(sql[0], `(e.attributes_json::jsonb -> '12' ->> 'value') = ANY($3)`);
  assert.equal(sql[1], 'e.status = ANY($4)');
  assert.match(sql[6]!, /subject ILIKE \$9 OR e\.body_text ILIKE \$9/);
  assert.equal(sql[7], `e.attachments_json = '[]'`);
  assert.deepEqual(conditionsOf({}, 3), { sql: [], params: [] }, 'an empty filter shows every email');
});

let stack: Stack;
before(async () => (stack = await startStack()));
after(() => stack.stop());

const client = () => createClient(() => stack.url);
const alice = client(); // administrator
const bruno = client(); // member
const subjectsOf = async (as: typeof alice, boardId: number): Promise<string[]> => (await as('GET', `/boards/${boardId}/emails`)).body.emails.map((e: { subject: string }) => e.subject).sort();
let quotes: number;

test('a member makes a board; it shows the emails its filter keeps, and says how many', async () => {
  assert.equal((await alice('POST', '/auth/signup', { email: 'alice@acme.example', password: 'un-bon-mot-de-passe', organization: 'Acme' })).status, 201);
  await connectInbox(alice, stack.imapAccount);
  assert.equal((await alice('POST', '/boards', { name: '' })).body.code, 'boards.nameRequired');
  const made = await alice('POST', '/boards', { name: 'Devis', filter: { keywords: 'devis', attributes: { status: ['todo'] } } });
  assert.equal(made.status, 201);
  assert.deepEqual([made.body.name, made.body.shared, made.body.canManage, made.body.count], ['Devis', false, true, 1]);
  quotes = made.body.id;
  assert.deepEqual(await subjectsOf(alice, quotes), ['Demande de devis pour 20 licences']);
});

test('the attributes combine: sender, how recent, attachments, where the email stands', async () => {
  const board = async (filter: unknown): Promise<number> => (await alice('POST', '/boards', { name: 'x', filter })).body.count;
  assert.equal(await board({}), 4, 'no condition: every email kept from the mailbox, the newsletter set aside included');
  assert.equal(await board({ from: 'client.example' }), 2);
  assert.equal(await board({ from: 'client.example', keywords: 'rendez-vous' }), 1);
  assert.equal(await board({ received: 1 }), 4);
  assert.equal(await board({ attributes: { status: ['none'] } }), 1, 'the newsletter, set aside by rule');
  assert.equal(await board({ attachment: true }), 0);
  assert.equal(await board({ attributes: { status: ['sent', 'ignored'] } }), 0);
  assert.equal(await board({ mailbox: [999] }), 0, 'a mailbox one does not have shows nothing');
});

test('a personal board is its owner\'s alone; an administrator shares one with every member', async () => {
  await join(alice, bruno, 'bruno@acme.example');
  assert.deepEqual((await bruno('GET', '/boards')).body, []);
  assert.equal((await bruno('GET', `/boards/${quotes}/emails`)).status, 404);
  assert.equal((await bruno('POST', '/boards', { name: 'À moi', shared: true })).body.code, 'boards.sharedByAdministrators');
  assert.equal((await alice('PUT', `/boards/${quotes}`, { name: 'Devis', shared: true, filter: { keywords: 'devis' } })).status, 200);
  const [seen] = (await bruno('GET', '/boards')).body;
  assert.deepEqual([seen.name, seen.shared, seen.canManage, seen.count], ['Devis', true, false, 0], 'he sees the board, not the emails of a mailbox that is not his');
  assert.deepEqual(await subjectsOf(bruno, quotes), []);
  assert.equal((await bruno('PUT', `/boards/${quotes}`, { name: 'Pris' })).body.code, 'boards.notYours');
  assert.equal((await bruno('DELETE', `/boards/${quotes}`)).status, 403);
});

test('deleting a board leaves its emails where they were', async () => {
  assert.equal((await alice('DELETE', `/boards/${quotes}`)).status, 200);
  assert.equal((await alice('GET', `/boards/${quotes}/emails`)).status, 404);
  assert.equal((await alice('GET', '/emails?box=todo')).body.emails.length, 3);
});
