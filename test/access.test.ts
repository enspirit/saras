// Access: signing up creates an organisation and its first administrator; a member then has
// a name, a password they can change, and sessions that end.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, join, signUp } from './support/client.ts';
import type { ApiClient } from './support/client.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

let stack: Stack;
before(async () => (stack = await startStack()));
after(() => stack.stop());

const client = () => createClient(() => stack.url);
const alice = client(); // administrator of Acme
const bruno = client(); // member of Acme
const zoe = client(); // administrator of another organisation
const bob = client(); // signs up without naming an organisation

const profile = async (as: ApiClient) => (await as('GET', '/me')).body;

test('signing up creates an organisation and makes its creator the administrator', async () => {
  assert.equal((await signUp(alice, 'alice@acme.example', 'Acme')).status, 201);
  assert.equal((await signUp(zoe, 'zoe@other.example', '')).status, 201);
  const a = await profile(alice);
  assert.deepEqual([a.role, a.organization.name, a.organization.way], ['admin', 'Acme', 'manual']);
  const z = await profile(zoe);
  assert.deepEqual([z.role, z.organization.name], ['admin', 'other.example'], 'named after the address when no name is given');
  assert.equal((await signUp(client(), 'alice@acme.example', 'Imposter')).status, 409, 'an address has one account');
  const organizations = await stack.db.query('SELECT name FROM organizations ORDER BY id');
  assert.deepEqual(organizations, [{ name: 'Acme' }, { name: 'other.example' }], 'a refused sign-up leaves no organisation behind');
});

test('a member has a name, which the administrators see in place of the address', async () => {
  assert.equal((await profile(alice)).name, '', 'none until given');
  assert.equal((await alice('PUT', '/settings', { name: 'Alice Martin' })).status, 200);
  assert.equal((await profile(alice)).name, 'Alice Martin');
  const listed = (await alice('GET', '/members')).body;
  assert.deepEqual(listed.map((u: { email: string; name: string }) => [u.email, u.name]), [['alice@acme.example', 'Alice Martin']]);
  const named = client();
  assert.equal((await named('POST', '/auth/signup', { email: 'yann@third.example', password: 'un-bon-mot-de-passe', organization: 'Third', name: 'Yann Leroy' })).status, 201);
  assert.equal((await profile(named)).name, 'Yann Leroy', 'given at sign-up');
});

test('signup, and writes must be JSON', async () => {
  assert.equal((await bob('GET', '/me')).status, 401);
  assert.equal((await bob('POST', '/auth/signup', { email: 'bob@corp.example', password: 'short' })).status, 400);
  assert.equal((await bob('POST', '/auth/signup', { email: 'bob@corp.example', password: 'un-bon-mot-de-passe' })).status, 201);
  const signedIn = await profile(bob);
  assert.deepEqual(signedIn.privacy, { zdr: true, data_collection: 'deny' });
  assert.equal(signedIn.hasKey, true);
  const form = await bob('POST', '/auth/logout', 'a=b', { 'content-type': 'application/x-www-form-urlencoded' });
  assert.equal(form.status, 415);
});

test('a member changes their own password, knowing the current one; their other sessions are closed', async () => {
  await join(alice, bruno, 'bruno@acme.example');
  const elsewhere = createClient(() => stack.url);
  assert.equal((await elsewhere('POST', '/auth/login', { email: 'bruno@acme.example', password: 'un-bon-mot-de-passe' })).status, 200);
  const wrong = await bruno('PUT', '/auth/password', { current: 'pas-le-bon-mot', next: 'un-autre-mot-de-passe' });
  assert.deepEqual([wrong.status, wrong.body.code], [401, 'auth.wrongPassword']);
  assert.equal((await bruno('GET', '/me')).status, 200, 'a wrong password is not a signed-out session');
  assert.equal((await bruno('PUT', '/auth/password', { current: 'un-bon-mot-de-passe', next: 'court' })).body.code, 'auth.passwordTooShort');
  assert.equal((await bruno('PUT', '/auth/password', { current: 'un-bon-mot-de-passe', next: 'un-autre-mot-de-passe' })).status, 200);
  assert.equal((await bruno('GET', '/me')).status, 200, 'the session that made the change stays');
  assert.equal((await elsewhere('GET', '/me')).status, 401);
  assert.equal((await elsewhere('POST', '/auth/login', { email: 'bruno@acme.example', password: 'un-bon-mot-de-passe' })).status, 401);
  assert.equal((await elsewhere('POST', '/auth/login', { email: 'bruno@acme.example', password: 'un-autre-mot-de-passe' })).status, 200);
});

test('logout ends the session', async () => {
  assert.equal((await bob('POST', '/auth/logout')).status, 200);
  assert.equal((await bob('GET', '/me')).status, 401);
});
