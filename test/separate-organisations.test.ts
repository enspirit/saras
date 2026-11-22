// Organisations are tenants: each has its own prompts, members, invitations and mailboxes,
// and nothing crosses from one to another.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, join, signUp } from './support/client.ts';
import type { ApiClient } from './support/client.ts';
import { connectInbox } from './support/connected-mailbox.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

let stack: Stack;
const client = () => createClient(() => stack.url);
const alice = client(); // administrator of Acme
const bruno = client(); // member of Acme
const chloe = client(); // member of Acme
const zoe = client(); // administrator of another organisation

before(async () => {
  stack = await startStack();
  assert.equal((await signUp(alice, 'alice@acme.example', 'Acme')).status, 201);
  assert.equal((await signUp(zoe, 'zoe@other.example', '')).status, 201);
});
after(() => stack.stop());

const subjects = async (as: ApiClient, box = 'todo'): Promise<string[]> => (await as('GET', `/emails?box=${box}`)).body.emails.map((e: { subject: string }) => e.subject);
const profile = async (as: ApiClient) => (await as('GET', '/me')).body;

test('each organisation has its own prompts', async () => {
  const mine = (await alice('GET', '/prompts')).body;
  const theirs = (await zoe('GET', '/prompts')).body;
  assert.equal(mine.length, 1);
  assert.equal(theirs.length, 1);
  assert.deepEqual(mine.map((p: { id: number }) => p.id).filter((id: number) => theirs.some((p: { id: number }) => p.id === id)), []);

  assert.equal((await zoe('PUT', `/prompts/${mine[0].id}`, { name: 'x', systemPrompt: 'y' })).status, 404);
  assert.equal((await zoe('DELETE', `/prompts/${mine[0].id}`)).status, 404);
  assert.equal((await zoe('GET', `/prompts/${mine[0].id}/corrections`)).status, 404);
});

test('each organisation has its own members', async () => {
  await join(alice, bruno, 'bruno@acme.example');
  await join(alice, chloe, 'chloe@acme.example');
  assert.deepEqual((await alice('GET', '/members')).body.map((u: { email: string }) => u.email), ['alice@acme.example', 'bruno@acme.example', 'chloe@acme.example']);
  assert.deepEqual((await zoe('GET', '/members')).body.map((u: { email: string }) => u.email), ['zoe@other.example']);
  assert.equal((await profile(bruno)).organization.name, 'Acme');
  assert.equal((await profile(bruno)).organization.hasKey, undefined, 'the organisation key is the administrators\' business');

  const bid = (await alice('GET', '/members')).body[1].id;
  assert.equal((await zoe('PUT', `/members/${bid}`, { role: 'admin' })).status, 404);
  assert.equal((await zoe('DELETE', `/members/${bid}`)).status, 404);
});

test('each organisation has its own invitations', async () => {
  const pending = (await alice('POST', '/invitations', { email: 'dan@acme.example' })).body;
  assert.deepEqual((await zoe('GET', '/invitations')).body, []);
  assert.equal((await zoe('DELETE', `/invitations/${pending.id}`)).status, 200);
  assert.equal((await alice('GET', '/invitations')).body.length, 1, 'another organisation cannot revoke it');
  // The same address may be invited by two organisations; the link decides which one is joined.
  assert.equal((await zoe('POST', '/invitations', { email: 'dan@acme.example' })).status, 201);
  assert.equal((await alice('GET', '/invitations')).body.length, 1);
});

test('nothing of an organisation is reachable from another', async () => {
  const sharedId = await connectInbox(alice, stack.imapAccount, true);
  assert.deepEqual((await zoe('GET', '/mailboxes')).body, []);
  assert.deepEqual(await subjects(zoe), []);
  assert.deepEqual((await zoe('GET', '/emails?box=todo')).body.counts, { todo: 0, none: 0, sent: 0, ignored: 0 });
  const [email] = (await alice('GET', '/emails?box=todo')).body.emails;
  const [prompt] = (await zoe('GET', '/prompts')).body;
  assert.equal((await zoe('GET', `/emails/${email.id}`)).status, 404);
  assert.equal((await zoe('POST', `/emails/${email.id}/status`, { status: 'ignored' })).status, 404);
  assert.equal((await zoe('POST', `/emails/${email.id}/assist`, { action: 'prompt', promptId: prompt.id })).status, 404);
  assert.equal((await zoe('POST', `/emails/${email.id}/send`, { html: '<p>x</p>', to: ['a@b.example'] })).status, 404);
  assert.equal((await zoe('POST', `/mailboxes/${sharedId}/fetch`)).status, 404);
  assert.equal((await zoe('GET', `/mailboxes/${sharedId}/folders`)).status, 404);
  // A member cannot use a prompt of another organisation on their own email either.
  assert.equal((await bruno('POST', `/emails/${email.id}/assist`, { action: 'prompt', promptId: prompt.id })).status, 404);
  // The same mailbox may be connected by another organisation: they are separate worlds.
  assert.equal((await zoe('POST', '/mailboxes/imap', stack.imapAccount)).status, 201);
});
