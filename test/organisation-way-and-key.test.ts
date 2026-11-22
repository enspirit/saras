// How an organisation works and with which key: both are set by its administrators and
// apply to all its members, and to them only.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, join, signUp } from './support/client.ts';
import type { ApiClient } from './support/client.ts';
import { connectInbox, connectMailbox } from './support/connected-mailbox.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

let stack: Stack;
const client = () => createClient(() => stack.url);
const alice = client(); // administrator of Acme
const bruno = client(); // member of Acme
const chloe = client(); // member of Acme
const zoe = client(); // administrator of another organisation

// Acme has a shared mailbox, fetched; the other organisation has connected the same one, not fetched yet.
before(async () => {
  stack = await startStack();
  assert.equal((await signUp(alice, 'alice@acme.example', 'Acme')).status, 201);
  assert.equal((await signUp(zoe, 'zoe@other.example', '')).status, 201);
  await join(alice, bruno, 'bruno@acme.example');
  await join(alice, chloe, 'chloe@acme.example');
  await connectInbox(alice, stack.imapAccount, true);
  await connectMailbox(zoe, stack.imapAccount);
});
after(() => stack.stop());

const profile = async (as: ApiClient) => (await as('GET', '/me')).body;

/** Has a proposal written for the first email to handle, and returns the key the LLM was called with. */
async function keyUsedBy(as: ApiClient): Promise<string | undefined> {
  const [prompt] = (await as('GET', '/prompts')).body;
  const [next] = (await as('GET', '/emails?box=todo')).body.emails;
  await as('POST', `/emails/${next.id}/assist`, { action: 'prompt', promptId: prompt.id });
  return stack.llmRequests.at(-1)!.authorization;
}

test('the way of working and the LLM key belong to the organisation', async () => {
  assert.equal((await bruno('PUT', '/organization', { way: 'sort' })).status, 403);
  assert.equal((await alice('PUT', '/organization', { way: 'magic' })).body.code, 'organization.invalidWay');
  assert.equal((await alice('PUT', '/organization', { name: 'Acme SA', way: 'sort', skipAutomated: false, openrouterKey: 'sk-or-acme' })).status, 200);
  const a = await profile(alice);
  assert.deepEqual([a.organization.name, a.organization.way, a.organization.skipAutomated, a.organization.hasKey], ['Acme SA', 'sort', false, true]);
  assert.equal((await profile(zoe)).organization.way, 'manual', 'another organisation keeps its own');
});

test('the key of the organisation is sealed at rest', async () => {
  const stored = await stack.db.one<{ k: string }>(`SELECT openrouter_key_enc AS k FROM organizations WHERE name = 'Acme SA'`);
  assert.ok(stored!.k.length > 20 && !stored!.k.includes('sk-or-acme'), 'encrypted at rest');
});

test('members draft with the key of the organisation, unless they have their own', async () => {
  // Members now draft with the organisation's key, unless they have their own.
  assert.equal(await keyUsedBy(bruno), 'Bearer sk-or-acme');
  await chloe('PUT', '/settings', { openrouterKey: 'sk-or-chloe' });
  assert.equal(await keyUsedBy(chloe), 'Bearer sk-or-chloe');
});

test('an organisation without a key falls back to the server\'s', async () => {
  const [zoeAccount] = (await zoe('GET', '/accounts')).body;
  await zoe('PUT', `/accounts/${zoeAccount.id}/folder`, { folder: 'INBOX' });
  await zoe('POST', `/accounts/${zoeAccount.id}/sync`);
  assert.equal(await keyUsedBy(zoe), 'Bearer sk-or-test', 'an organisation without a key falls back to the server\'s');
});
