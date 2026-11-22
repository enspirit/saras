// Prompts are the organisation's ways of replying: it starts with one and takes the ready-made
// ones it wants. Only its administrators maintain them, and that role is handed over.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, installTemplates, join, signUp } from './support/client.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

interface PromptView {
  id: number;
  name: string;
}

let stack: Stack;
const me = createClient(() => stack.url); // who created the organisation
const eve = createClient(() => stack.url); // a member invited into it
let prompts: PromptView[];

before(async () => {
  stack = await startStack({ env: { TRIAGE_STRATEGY: 'ai' } });
  assert.equal((await signUp(me, 'bob@corp.example')).status, 201);
});
after(() => stack.stop());

test('an organisation starts with one prompt; each ready-made prompt can be added, once', async () => {
  prompts = (await me('GET', '/prompts')).body;
  assert.deepEqual(prompts.map((p) => p.name), ['Standard professional reply'], 'an organisation starts with one prompt');
  // The others are templates, added on demand; each can be added once.
  assert.equal((await me('GET', '/prompts/templates')).body.length, 4);
  await installTemplates(me);
  prompts = (await me('GET', '/prompts')).body;
  assert.equal(prompts.length, 5);
  assert.deepEqual((await me('GET', '/prompts/templates')).body, []);
});

test('prompts belong to the organisation: a member sees the catalogue, without the instructions', async () => {
  await join(me, eve, 'eve@corp.example');
  assert.equal((await me('GET', '/me')).body.role, 'admin', 'who creates the organisation administers it');
  assert.equal((await eve('GET', '/me')).body.role, 'user');

  // a user sees the shared catalogue, without the instructions
  const seen = (await eve('GET', '/prompts')).body;
  assert.deepEqual(seen.map((p: PromptView) => p.id), prompts.map((p: PromptView) => p.id));
  assert.deepEqual(Object.keys(seen[0]), ['id', 'name', 'description']);
});

test('only the administrators of the organisation manage its prompts and its members', async () => {
  const support = prompts.find((p) => p.name === 'Customer support');
  assert.ok(support, 'no prompt named Customer support');
  assert.equal((await eve('PUT', `/prompts/${support.id}`, { name: 'x', systemPrompt: 'y' })).status, 403);
  assert.equal((await eve('POST', '/prompts', { name: 'x', systemPrompt: 'y' })).status, 403);
  assert.equal((await eve('DELETE', `/prompts/${support.id}`)).status, 403);
  assert.equal((await eve('GET', `/prompts/${support.id}/corrections`)).status, 403);
  assert.equal((await eve('GET', '/users')).status, 403);
  assert.equal((await eve('PUT', '/users/1', { role: 'admin' })).status, 403);
});

test('roles can be handed over, but one administrator always remains', async () => {
  const users = (await me('GET', '/users')).body;
  assert.deepEqual(users.map((u: { email: string; role: string }) => [u.email, u.role]), [['bob@corp.example', 'admin'], ['eve@corp.example', 'user']]);
  const [bob, evie] = users as { id: number }[];
  assert.equal((await me('PUT', `/users/${bob!.id}`, { role: 'user' })).status, 409);
  assert.equal((await me('PUT', `/users/${evie!.id}`, { role: 'admin' })).status, 200);
  assert.equal((await eve('POST', '/prompts', { name: 'Nouveau', systemPrompt: 'S' })).status, 201);
  assert.equal((await me('PUT', `/users/${bob!.id}`, { role: 'user' })).status, 200);
  assert.equal((await me('GET', `/prompts/${prompts[0]!.id}/corrections`)).status, 403);
  assert.equal((await eve('PUT', `/users/${evie!.id}`, { role: 'user' })).status, 409);
});
