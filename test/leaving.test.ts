// Leaving: a member deletes their own account, an administrator deletes the organisation.
// The organisation never stays without an administrator, and keeps what was made for it.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, join, signUp } from './support/client.ts';
import { connectInbox } from './support/connected-mailbox.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

let stack: Stack;
const client = () => createClient(() => stack.url);
const bruno = client(); // the only administrator of Acme SA, which has a shared mailbox
const carl = client(); // joins as a second administrator
const zoe = client(); // administrator of another organisation

before(async () => {
  stack = await startStack();
  assert.equal((await signUp(bruno, 'bruno@acme.example', 'Acme SA')).status, 201);
  assert.equal((await signUp(zoe, 'zoe@other.example', '')).status, 201);
  await connectInbox(bruno, stack.imapAccount, true);
});
after(() => stack.stop());

const sharedMailboxes = async (): Promise<number[]> =>
  (await carl('GET', '/accounts')).body.filter((a: { shared: boolean }) => a.shared).map((a: { id: number }) => a.id);

test('the last administrator does not delete their own account', async () => {
  // Bruno is Acme's only administrator: he cannot leave it without one.
  assert.equal((await bruno('DELETE', '/me', { password: 'pas-le-bon-mot' })).body.code, 'auth.wrongPassword');
  const last = await bruno('DELETE', '/me', { password: 'un-bon-mot-de-passe' });
  assert.deepEqual([last.status, last.body.code], [409, 'users.lastAdmin']);
});

test('a member deletes their own account, with their password', async () => {
  // A user leaves freely: the right password ends their account and their session.
  const dora = client();
  await join(bruno, dora, 'dora@acme.example');
  assert.equal((await dora('DELETE', '/me', { password: 'un-bon-mot-de-passe' })).status, 200);
  assert.equal((await dora('GET', '/me')).status, 401);
  assert.ok(!(await bruno('GET', '/users')).body.some((u: { email: string }) => u.email === 'dora@acme.example'));
});

test('an administrator leaves once there is another; what they made stays', async () => {
  // With a second administrator, Bruno can leave; the shared mailbox and the prompts pass to that one.
  await join(bruno, carl, 'carl@acme.example', 'admin');
  const before = await sharedMailboxes();
  const prompts = (await carl('GET', '/prompts')).body.length;
  assert.ok(before.length > 0 && prompts > 0);
  assert.equal((await bruno('DELETE', '/me', { password: 'un-bon-mot-de-passe' })).status, 200);
  assert.equal((await bruno('GET', '/me')).status, 401);
  const after = await sharedMailboxes();
  assert.deepEqual(after, before);
  assert.equal((await carl('GET', '/prompts')).body.length, prompts);
  assert.equal((await carl('POST', `/accounts/${after[0]}/sync`)).body.error, null, 'the shared mailbox is still fetched, as its new owner');
});

test('an administrator deletes the organisation, with their password and its name; it ends for everyone', async () => {
  const carl = client();
  assert.equal((await carl('POST', '/auth/login', { email: 'carl@acme.example', password: 'un-bon-mot-de-passe' })).status, 200);
  const emma = client();
  await join(carl, emma, 'emma@acme.example');
  assert.equal((await emma('DELETE', '/organization', { password: 'un-bon-mot-de-passe', name: 'Acme SA' })).status, 403);
  assert.equal((await carl('DELETE', '/organization', { password: 'pas-le-bon-mot', name: 'Acme SA' })).body.code, 'auth.wrongPassword');
  assert.equal((await carl('DELETE', '/organization', { password: 'un-bon-mot-de-passe', name: 'Acme' })).body.code, 'organization.nameMismatch');
  assert.equal((await carl('GET', '/me')).status, 200);
  assert.equal((await carl('DELETE', '/organization', { password: 'un-bon-mot-de-passe', name: ' acme sa ' })).status, 200);
  assert.equal((await carl('GET', '/me')).status, 401);
  assert.equal((await emma('GET', '/me')).status, 401);
  assert.equal((await zoe('GET', '/me')).status, 200, 'another organisation is untouched');
  // Nothing is left of it: the address can start again.
  assert.equal((await client()('POST', '/auth/signup', { email: 'carl@acme.example', password: 'un-bon-mot-de-passe', organization: 'Acme again' })).status, 201);
});
