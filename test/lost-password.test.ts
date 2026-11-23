// A lost password: a link to choose a new one, sent by the server when it has mail of its own,
// handed over by an administrator otherwise.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { resetLetter, resetLink } from '../src/domain/computations/password-reset.ts';
import { createClient, join } from './support/client.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

test('the letter carries the link, in the member\'s language', () => {
  const link = resetLink('https://mail.example', 'tok');
  assert.equal(link, 'https://mail.example/#/reset-password/tok');
  assert.match(resetLetter('a@b.example', 'fr', link, 60).text, /dans les 60 minutes :\nhttps:\/\/mail\.example\/#\/reset-password\/tok/);
  assert.match(resetLetter('a@b.example', 'de', link, 60).subject, /^Choose a new password/);
});

let stack: Stack;
before(async () => (stack = await startStack({ ownMail: true })));
after(() => stack.stop());

const client = () => createClient(() => stack.url);
const alice = client();
const visitor = client();
const tokenIn = (text: string): string => text.replace(/=\r?\n/g, '').match(/#\/reset-password\/([\w-]+)/)?.[1] ?? '';

test('a visitor asks for a link; the answer is the same whether the address is a member\'s or not', async () => {
  assert.equal((await alice('POST', '/auth/signup', { email: 'alice@acme.example', password: 'un-bon-mot-de-passe', organization: 'Acme' })).status, 201);
  assert.equal((await visitor('GET', '/public')).body.passwordResetByEmail, true);
  const unknown = await visitor('POST', '/auth/password-reset', { email: 'nobody@acme.example' });
  const known = await visitor('POST', '/auth/password-reset', { email: ' Alice@Acme.example ' });
  assert.deepEqual([unknown.status, unknown.body], [known.status, known.body]);
  assert.equal(stack.outbox.length, 1, 'one letter, to the member');
  assert.deepEqual(stack.outbox[0]!.to, ['alice@acme.example']);
  await visitor('POST', '/auth/password-reset', { email: 'alice@acme.example' });
  assert.equal(stack.outbox.length, 1, 'asking again at once sends nothing more');
});

test('the link lets its holder choose a new password, once; every session of the member is closed', async () => {
  const token = tokenIn(stack.outbox[0]!.raw);
  assert.ok(token);
  assert.deepEqual((await visitor('POST', '/auth/password-reset/check', { token })).body, { email: 'alice@acme.example' });
  assert.equal((await visitor('PUT', '/auth/password-reset', { token, password: 'court' })).body.code, 'auth.passwordTooShort');
  assert.equal((await visitor('PUT', '/auth/password-reset', { token, password: 'un-nouveau-mot-de-passe' })).status, 200);
  assert.equal((await alice('GET', '/me')).status, 401);
  assert.equal((await visitor('GET', '/me')).status, 401, 'the link signs nobody in');
  const again = await visitor('PUT', '/auth/password-reset', { token, password: 'encore-un-autre-mot' });
  assert.deepEqual([again.status, again.body.code], [404, 'auth.resetInvalid']);
  assert.equal((await alice('POST', '/auth/login', { email: 'alice@acme.example', password: 'un-bon-mot-de-passe' })).status, 401);
  assert.equal((await alice('POST', '/auth/login', { email: 'alice@acme.example', password: 'un-nouveau-mot-de-passe' })).status, 200);
});

test('an administrator gets a link for a member, to hand over; a member cannot', async () => {
  const bruno = client();
  await join(alice, bruno, 'bruno@acme.example');
  const [, listed] = (await alice('GET', '/members')).body;
  assert.equal((await bruno('POST', `/members/${listed.id}/password-reset`)).status, 403);
  const made = await alice('POST', `/members/${listed.id}/password-reset`);
  assert.equal(made.status, 201);
  assert.equal(made.body.validMinutes, 60);
  const token = String(made.body.link).split('#/reset-password/')[1];
  assert.equal((await visitor('PUT', '/auth/password-reset', { token, password: 'le-mot-de-passe-de-bruno' })).status, 200);
  assert.equal((await bruno('POST', '/auth/login', { email: 'bruno@acme.example', password: 'le-mot-de-passe-de-bruno' })).status, 200);
});
