// The key and the model in force: the organisation's when it has them, else the server's.
// A model that no provider serves without keeping data is refused, never routed elsewhere.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, signUp } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { lastOf } from '../support/llm-requests.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

let stack: Stack;
const me = createClient(() => stack.url);
let promptId: number;

before(async () => {
  stack = await startStack({ env: { TRIAGE_STRATEGY: 'ai' } });
  assert.equal((await signUp(me, 'bob@corp.example')).status, 201);
  await connectInbox(me, stack.imapAccount);
  promptId = (await me('GET', '/prompts')).body[0].id;
});
after(() => stack.stop());

test('a model without ZDR provider fails loudly instead of being routed elsewhere', async () => {
  assert.equal((await me('PUT', '/organization', { model: 'not a model' })).status, 400);
  assert.equal((await me('PUT', '/organization', { model: 'nozdr/model' })).status, 200);
  assert.equal((await me('GET', '/me')).body.model, 'nozdr/model');
  const none = (await me('GET', '/emails?box=none')).body.emails;
  await me('POST', `/emails/${none[0].id}/status`, { status: 'needs_reply' });
  const draft = await me('POST', `/emails/${none[0].id}/assist`, { action: 'prompt', promptId });
  assert.equal(draft.status, 502);
  assert.match(draft.body.error, /ZDR/);
  await me('PUT', '/organization', { model: '' });
});

test('the key of the organisation replaces the server key and is stored encrypted', async () => {
  await me('PUT', '/organization', { openrouterKey: 'sk-or-personal' });
  const key = (await stack.db.one<{ k: string }>('SELECT openrouter_key_enc AS k FROM organizations WHERE openrouter_key_enc IS NOT NULL'))?.k ?? '';
  assert.ok(key.length > 20 && !key.includes('sk-or-personal'));
  const none = (await me('GET', '/emails?box=todo')).body.emails;
  await me('POST', `/emails/${none[0].id}/assist`, { action: 'prompt', promptId });
  assert.equal(lastOf(stack.llmRequests).authorization, 'Bearer sk-or-personal');
});
