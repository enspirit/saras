// Sorting by the AI: what is fetched from the watched folder is sorted in one request per
// batch, automated mail apart, and each email to handle may be given a suggested prompt.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, installTemplates, signUp } from './support/client.ts';
import { connectMailbox, watchFolder } from './support/connected-mailbox.ts';
import { lastOf, sortingRequests } from './support/llm-requests.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

interface EmailView {
  id: number;
  subject: string;
  priority: string;
  triageSource: string;
}

let stack: Stack;
const me = createClient(() => stack.url);
let accountId: number;
let todo: EmailView[];

// Bob has every ready-made prompt and a mailbox whose folder is not chosen yet.
before(async () => {
  stack = await startStack({ env: { TRIAGE_STRATEGY: 'ai' } });
  assert.equal((await signUp(me, 'bob@corp.example')).status, 201);
  await installTemplates(me);
  accountId = await connectMailbox(me, stack.imapAccount);
});
after(() => stack.stop());

const sortings = () => sortingRequests(stack.llmRequests);

test('choosing the watched folder fetches it and sorts it', async () => {
  const [account] = (await me('GET', '/mailboxes')).body;
  assert.equal(account.folder, null, 'nothing is watched until a folder is chosen');
  await watchFolder(me, accountId, 'INBOX');
  const result = (await me('POST', `/mailboxes/${accountId}/fetch`)).body;
  assert.deepEqual(result, { fetched: 0, triaged: 0, error: null }, 'choosing the folder already fetched and triaged it');
});

test('the inbox passes the AI gate in one batch; newsletters never reach the LLM', () => {
  assert.equal(sortings().length, 1, 'one request for the whole batch');
  assert.equal([...lastOf(sortings()).body.messages[1]!.content.matchAll(/<email id=/g)].length, 3);
  for (const call of stack.llmRequests) {
    assert.deepEqual(call.body.provider, { zdr: true, data_collection: 'deny' });
    assert.equal(call.authorization, 'Bearer sk-or-test');
    assert.ok(!JSON.stringify(call.body).includes('CONTENU-NEWSLETTER'));
  }
});

test('what needs a reply is to handle, the urgent first; the rest is set aside, by the AI or by a rule', async () => {
  const inbox = (await me('GET', '/emails?box=todo')).body;
  todo = inbox.emails;
  assert.deepEqual(todo.map((e: EmailView) => e.subject), ['Demande de devis pour 20 licences', 'Report de notre rendez-vous']);
  assert.equal(todo[0]!.priority, 'high');
  assert.deepEqual(inbox.counts, { todo: 2, none: 2, sent: 0, ignored: 0 });

  const none = (await me('GET', '/emails?box=none')).body.emails;
  assert.deepEqual(none.map((e: EmailView) => e.triageSource).sort(), ['ai', 'rule']);
});

test('fetching again imports nothing twice and asks the LLM nothing more', async () => {
  assert.deepEqual((await me('POST', `/mailboxes/${accountId}/fetch`)).body, { fetched: 0, triaged: 0, error: null });
  assert.equal(sortings().length, 1);
});

test('the AI suggests a prompt per email, the user may pick another one', async () => {
  const prompts: { id: number; name: string }[] = (await me('GET', '/prompts')).body;
  const rdv = (await me('GET', `/emails/${todo[1]!.id}`)).body;
  assert.equal(rdv.suggestedPromptId, prompts.find((p) => p.name === 'Appointment scheduling')?.id);
  assert.ok(rdv.suggestedPromptId, 'a prompt was suggested');
  const devis = (await me('GET', `/emails/${todo[0]!.id}`)).body;
  assert.equal(devis.suggestedPromptId, null);
  assert.deepEqual(devis.recipients, { to: ['claire@client.example'], cc: [] });
  assert.deepEqual(devis.recipientsAll.cc, ['paul@client.example']);
});
