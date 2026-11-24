// Several servers on one database: what one server guarantees alone (a reply handed over
// once, one fetch at a time per mailbox) holds whichever of them is asked.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, signUp } from '../support/client.ts';
import { testDatabase } from '../support/database.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

let stack: Stack;
let secondUrl: string;
before(async () => {
  stack = await startStack();
  secondUrl = await stack.another();
});
after(() => stack.stop());

// The same member, signed in at each server.
const onFirst = createClient(() => stack.url);
const onSecond = createClient(() => secondUrl);
const moment = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const count = async (sql: string): Promise<number> => (await stack.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${sql}`))?.n ?? NaN;

test('a key is held by one at a time: who does not wait is told so, who waits has it next', async () => {
  const { db: first, another, drop } = await testDatabase();
  const second = another();
  const held = await first.holdIfFree('the-key');
  assert.ok(held);
  assert.equal(await second.holdIfFree('the-key'), null);
  assert.ok(await second.holdIfFree('another-key').then((release) => release?.().then(() => true)), 'a key keeps no other from being held');
  let itsTurn = false;
  const waiting = second.hold('the-key').then((release) => ((itsTurn = true), release));
  await moment(50);
  assert.equal(itsTurn, false);
  await held();
  const next = await waiting;
  assert.equal(await first.holdIfFree('the-key'), null);
  await next();
  await (await first.hold('the-key'))();
  await drop();
});

test('a member signed in at one server is known at the other', async () => {
  assert.equal((await signUp(onFirst, 'alice@acme.example')).status, 201);
  assert.equal((await onSecond('POST', '/auth/login', { email: 'alice@acme.example', password: 'un-bon-mot-de-passe' })).status, 200);
  assert.equal((await onSecond('GET', '/me')).body.email, 'alice@acme.example');
});

test('a mailbox fetched from two servers at the same moment is fetched by one after the other: nothing is prepared twice', async () => {
  assert.equal((await onFirst('PUT', '/organization', { writing: 'draft' })).status, 200);
  const mailbox = (await onFirst('POST', '/mailboxes/imap', stack.imapAccount)).body.id;
  // Choosing the folder starts a fetch at the first server; both are asked for one meanwhile.
  assert.equal((await onFirst('PUT', `/mailboxes/${mailbox}/folder`, { folder: 'INBOX' })).status, 200);
  const fetched = await Promise.all([onFirst('POST', `/mailboxes/${mailbox}/fetch`), onSecond('POST', `/mailboxes/${mailbox}/fetch`)]);
  assert.deepEqual(fetched.map((answer) => answer.status), [200, 200]);
  assert.deepEqual(fetched.map((answer) => answer.body.error), [null, null]);
  const toHandle = (await onFirst('GET', '/emails?box=todo')).body.emails.length;
  assert.equal(toHandle, 3);
  assert.equal(await count('drafts'), toHandle, 'one proposal per email to handle');
  assert.equal(stack.llmRequests.length, toHandle, 'and the LLM was asked for no more');
});

test('a reply sent from two servers at the same moment is sent once', async () => {
  const [email] = (await onFirst('GET', '/emails?box=todo')).body.emails;
  const reply = { html: '<p>Bien reçu, merci.</p>', to: ['claire@client.example'] };
  const answers = await Promise.all([onFirst('POST', `/emails/${email.id}/send`, reply), onSecond('POST', `/emails/${email.id}/send`, reply)]);
  assert.deepEqual(answers.map((answer) => answer.status).sort(), [200, 409]);
  assert.equal(stack.outbox.length, 1);
  assert.equal(await count('replies'), 1);
});
