// Boards: named views of emails, defined by a filter on their attributes.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { boardGiven, conditionsOf, filterGiven, managesBoard, mayShare } from '../../src/domain/computations/boards.ts';
import type { Verdict } from '../../src/domain/refusal.ts';
import type { Actor } from '../../src/domain/world.ts';
import { createClient, join } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

const outcome = (verdict: Verdict<unknown>): string => (verdict.ok ? 'ok' : `${verdict.refusal.kind}: ${verdict.refusal.problem.code}`);
const actorWith = (id: number, role: 'admin' | 'user') => ({ member: { id, role }, organization: { id: 1 } }) as Actor;

test('a filter is kept reduced to the attributes we know, and to the conditions that say something', () => {
  const given = { mailbox: [3, '4', 'x', 3], attributes: { status: ['todo'], 12: ['2', '2'], colour: ['red'], priority: [] }, received: '7', from: '  claire ', keywords: ' devis ', attachment: true, colour: 'red' };
  assert.deepEqual(filterGiven(given), { attributes: { 12: ['2'], status: ['todo'] }, mailbox: [3, 4], received: 7, from: 'claire', keywords: 'devis', attachment: true });
  assert.deepEqual(filterGiven({ box: ['todo'], priority: ['high'] }), { attributes: { status: ['todo'], priority: ['high'] } }, 'a filter made before attributes existed');
  assert.deepEqual(filterGiven({ mailbox: [], attributes: { status: 'todo' }, received: -2, from: ' ', attachment: 'yes' }), {});
  assert.deepEqual(filterGiven(null), {});
});

test('what an email must not be is kept the same way, for the conditions that can be said both ways', () => {
  const except = { attributes: { 12: ['1', '1'], colour: ['red'] }, mailbox: ['4', 'x'], from: ' noreply ', keywords: ' promo ', received: 7, attachment: true, except: { from: 'x' } };
  assert.deepEqual(filterGiven({ from: 'client.example', except }), { from: 'client.example', except: { attributes: { 12: ['1'] }, mailbox: [4], from: 'noreply', keywords: 'promo' } });
  assert.deepEqual(filterGiven({ except: { from: ' ', mailbox: [], attributes: {} } }), {}, 'an exclusion that says nothing is not kept');
  assert.deepEqual(filterGiven({ except: 'noreply' }), {});
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
  assert.deepEqual(params, [['2'], ['needs_reply', 'sent'], [3], 7, '%50\\%\\_off%', '%devis%', '%licences%']);
  assert.equal(sql.length, 8);
  assert.equal(sql[0], `(e.attributes_json::jsonb -> '12' ->> 'value') = ANY($3)`);
  assert.equal(sql[1], 'e.status = ANY($4)');
  assert.match(sql[6]!, /subject ILIKE \$9 OR e\.body_text ILIKE \$9/);
  assert.equal(sql[7], `e.attachments_json = '[]'`);
  assert.deepEqual(conditionsOf({}, 3), { sql: [], params: [] }, 'an empty filter shows every email');
  // Whatever a filter holds, its values travel as parameters; of the key of an attribute only a number is written.
  const hostile = conditionsOf({ attributes: { "1' OR '1'='1": ["x' OR '1'='1"] }, from: "'; DROP TABLE emails; --" }, 3);
  assert.deepEqual(hostile.sql, [`(e.attributes_json::jsonb -> 'NaN' ->> 'value') = ANY($3)`, '(e.from_name ILIKE $4 OR e.from_addr ILIKE $4)']);
  assert.deepEqual(hostile.params, [["x' OR '1'='1"], "%'; DROP TABLE emails; --%"]);
});

test('what an email must not be is the same condition, not true: after the others, each word on its own', () => {
  const { sql, params } = conditionsOf({ attributes: { status: ['todo'] }, attachment: true, except: { attributes: { 12: ['2'] }, mailbox: [3], from: 'no_reply', keywords: 'promo soldes' } }, 3);
  assert.deepEqual(params, [['needs_reply'], ['2'], [3], '%no\\_reply%', '%promo%', '%soldes%']);
  assert.deepEqual(sql, [
    'e.status = ANY($3)',
    `((e.attributes_json::jsonb -> '12' ->> 'value') = ANY($4)) IS NOT TRUE`,
    '(e.account_id = ANY($5)) IS NOT TRUE',
    '((e.from_name ILIKE $6 OR e.from_addr ILIKE $6)) IS NOT TRUE',
    '((e.subject ILIKE $7 OR e.body_text ILIKE $7)) IS NOT TRUE',
    '((e.subject ILIKE $8 OR e.body_text ILIKE $8)) IS NOT TRUE',
    `e.attachments_json <> '[]'`,
  ]);
  assert.deepEqual(conditionsOf({ except: {} }, 3), { sql: [], params: [] });
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

test('a condition is said the other way round: the sender is not, the keywords do not appear, the attribute is not', async () => {
  const board = async (filter: unknown): Promise<number> => (await alice('POST', '/boards', { name: 'x', filter })).body.count;
  assert.equal(await board({ except: { from: 'client.example' } }), 2, 'the newsletter and the thank-you note');
  assert.equal(await board({ except: { from: 'CLAIRE MARTIN' } }), 3, 'by the name as by the address, whatever the case');
  assert.equal(await board({ from: 'client.example', except: { from: 'sophie' } }), 1, 'a sender, but not this one');
  assert.equal(await board({ from: 'client.example', except: { keywords: 'rendez-vous' } }), 1);
  assert.equal(await board({ except: { keywords: 'devis rendez-vous' } }), 2, 'none of the words may appear');
  assert.equal(await board({ except: { attributes: { status: ['none'] } } }), 3, 'all but the newsletter');
  assert.equal(await board({ except: { attributes: { status: ['todo', 'none'] } } }), 0);
  assert.equal(await board({ except: { mailbox: [999] } }), 4);
  const topic = (await alice('POST', '/attributes', { name: 'Topic', values: ['Sales', 'Planning'] })).body.key;
  assert.deepEqual([await board({ attributes: { [topic]: ['1'] } }), await board({ except: { attributes: { [topic]: ['1'] } } })], [0, 4], 'an email without a value for an attribute is not that value');
  const kept = (await alice('GET', '/boards')).body.at(-1);
  assert.deepEqual(kept.filter, { except: { attributes: { [topic]: ['1'] } } }, 'a board keeps what it leaves out');
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

test('a filter is tried before any board keeps it: how many emails it would show, and the most recent', async () => {
  const before = (await alice('GET', '/boards')).body.length;
  const tried = (await alice('POST', '/boards/try', { filter: { keywords: 'devis', unknown: 'x' } })).body;
  assert.deepEqual([tried.count, tried.emails.map((e: { subject: string }) => e.subject)], [1, ['Demande de devis pour 20 licences']]);
  assert.equal((await alice('POST', '/boards/try', {})).body.count, 4, 'no condition keeps every email');
  assert.equal((await bruno('POST', '/boards/try', { filter: {} })).body.count, 0, 'each through the mailboxes they may use');
  assert.equal((await alice('GET', '/boards')).body.length, before, 'nothing is kept');
});
