// A board can say which prompt its emails are replied with: work organised by boards chooses
// the prompt, where no AI was asked to.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, signUp } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

let stack: Stack;
const alice = createClient(() => stack.url);
let first: number;
let quotes: number;
let board: number;

before(async () => {
  stack = await startStack();
  await signUp(alice, 'alice@acme.example', 'Acme');
  first = (await alice('GET', '/prompts')).body[0].id;
  quotes = (await alice('POST', '/prompts', { name: 'Quotes', description: 'A request for a quote.', systemPrompt: 'You answer requests for quotes.' })).body.id;
});
after(() => stack.stop());

test('a board is given a prompt of the organisation, or none', async () => {
  assert.equal((await alice('POST', '/boards', { name: 'Quotes', promptId: 9999 })).body.code, 'prompts.notFound');
  const made = await alice('POST', '/boards', { name: 'Quotes', shared: true, filter: { keywords: 'devis' }, promptId: quotes });
  assert.deepEqual([made.status, made.body.promptId], [201, quotes]);
  board = made.body.id;
  assert.equal((await alice('POST', '/boards', { name: 'Everything' })).body.promptId, null);
});

test('proposals written at fetch use the prompt of the shared board that shows the email, without any AI choosing', async () => {
  assert.equal((await alice('PUT', '/organization', { writing: 'draft' })).status, 200);
  await connectInbox(alice, stack.imapAccount);
  const emails = (await alice('GET', '/emails?box=todo')).body.emails as { id: number; subject: string }[];
  const used: Record<string, number> = {};
  for (const email of emails) used[email.subject] = (await alice('GET', `/emails/${email.id}`)).body.proposal.promptId;
  assert.deepEqual(used, { 'Demande de devis pour 20 licences': quotes, 'Merci pour hier': first, 'Report de notre rendez-vous': first });
  assert.ok(stack.llmRequests.every((r) => !r.body.messages[0]?.content.includes('You triage the inbox')), 'no request asked the AI to sort or to suggest a prompt');
});

test('an email read from a board comes with that board\'s prompt; read from elsewhere, with none', async () => {
  const [{ id }] = (await alice('GET', `/boards/${board}/emails`)).body.emails;
  assert.equal((await alice('GET', `/emails/${id}?board=${board}`)).body.boardPromptId, quotes);
  assert.equal((await alice('GET', `/emails/${id}`)).body.boardPromptId, null);
  assert.equal((await alice('GET', `/emails/${id}?board=9999`)).status, 404, 'a board one does not see is no board');
});

test('a board whose prompt is deleted has none any more', async () => {
  assert.equal((await alice('DELETE', `/prompts/${quotes}`)).status, 200);
  assert.equal((await alice('GET', '/boards')).body.find((b: { id: number }) => b.id === board).promptId, null);
});
