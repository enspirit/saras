// A mailbox connected as one's own, then shared with the organisation: what was a personal
// mailbox becomes one every member uses, with what was already fetched from it.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, join, signUp } from '../support/client.ts';
import { connectInbox, connectMailbox } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

let stack: Stack;
const client = () => createClient(() => stack.url);
const alice = client(); // administrator of Acme
const bruno = client(); // member of Acme
const chloe = client(); // another administrator of Acme
const zoe = client(); // administrator of another organisation

before(async () => {
  stack = await startStack();
  assert.equal((await signUp(alice, 'alice@acme.example', 'Acme')).status, 201);
  assert.equal((await signUp(zoe, 'zoe@other.example', '')).status, 201);
  await join(alice, bruno, 'bruno@acme.example');
  await join(alice, chloe, 'chloe@acme.example', 'admin');
});
after(() => stack.stop());

let mailbox: number;

test('a member who is not an administrator does not share their mailbox, and nobody shares the mailbox of another', async () => {
  const own = await connectMailbox(bruno, stack.imapAccount);
  assert.equal((await bruno('PUT', `/mailboxes/${own}/shared`)).body.code, 'mailboxes.sharedByAdministrators');
  assert.equal((await alice('PUT', `/mailboxes/${own}/shared`)).status, 404, 'what an administrator may not see, they do not share');
  assert.equal((await bruno('GET', '/mailboxes')).body[0].shared, false);
  assert.equal((await bruno('DELETE', `/mailboxes/${own}`)).status, 200);
});

test('an administrator shares a mailbox they connected as their own: every member uses it, with what it already held', async () => {
  mailbox = await connectInbox(alice, stack.imapAccount);
  assert.deepEqual((await bruno('GET', '/mailboxes')).body, []);
  assert.equal((await bruno('GET', '/emails?box=todo')).body.emails.length, 0);
  assert.equal((await zoe('PUT', `/mailboxes/${mailbox}/shared`)).status, 404, 'not from another organisation');

  assert.equal((await alice('PUT', `/mailboxes/${mailbox}/shared`)).status, 200);
  const [seen] = (await bruno('GET', '/mailboxes')).body;
  assert.deepEqual([seen.id, seen.shared, seen.canManage, seen.folder], [mailbox, true, false, 'INBOX'], 'it watches the folder it watched');
  assert.equal((await bruno('GET', '/emails?box=todo')).body.emails.length, 3, 'the emails fetched before it was shared are there');
});

test('once shared it is managed by the administrators, and sharing it again changes nothing', async () => {
  assert.equal((await chloe('GET', '/mailboxes')).body[0].canManage, true);
  assert.equal((await bruno('PUT', `/mailboxes/${mailbox}/shared`)).body.code, 'mailboxes.adminOnly');
  assert.equal((await chloe('PUT', `/mailboxes/${mailbox}/shared`)).status, 200);
  const [kept] = (await alice('GET', '/mailboxes')).body;
  assert.deepEqual([kept.shared, kept.canManage, kept.todo], [true, true, 3]);
});
