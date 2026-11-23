// The prompt that suits an email follows from its attributes: sorting gives the email its
// attributes, each prompt says which values it suits, and no AI is asked to choose.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, signUp } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

let stack: Stack;
const alice = createClient(() => stack.url);
const topicRule = `if contains(lower(_.subject), 'devis') then 'Sales' else if contains(lower(_.subject), 'rendez-vous') then 'Planning' else null`;
let topic: string;
let first: number;
let quotes: number;
const suggestedFor = async (): Promise<Record<string, number | null>> => {
  const emails = (await alice('GET', '/emails?box=todo')).body.emails as { id: number; subject: string }[];
  const suggested: Record<string, number | null> = {};
  for (const email of emails) suggested[email.subject] = (await alice('GET', `/emails/${email.id}`)).body.suggestedPromptId;
  return suggested;
};

before(async () => {
  stack = await startStack();
  await signUp(alice, 'alice@acme.example', 'Acme');
  topic = (await alice('POST', '/attributes', { name: 'Topic', values: ['Sales', 'Planning'], decidedBy: 'elo', elo: topicRule })).body.key;
  first = (await alice('GET', '/prompts')).body[0].id;
});
after(() => stack.stop());

test('a prompt says which emails it suits, by their attributes; what is not an attribute is not kept', async () => {
  const made = await alice('POST', '/prompts', { name: 'Quotes', systemPrompt: 'You answer requests for quotes.', affinity: { [topic]: ['1'], nonsense: ['x'] } });
  assert.equal(made.status, 201);
  quotes = made.body.id;
  const prompts = (await alice('GET', '/prompts')).body as { id: number; affinity: unknown }[];
  assert.deepEqual(prompts.map((p) => [p.id, p.affinity]), [[first, {}], [quotes, { [topic]: ['1'] }]]);
});

test('once sorted by its rule, an email is offered the prompt that suits its attributes; the others none', async () => {
  await connectInbox(alice, stack.imapAccount);
  assert.deepEqual(await suggestedFor(), { 'Demande de devis pour 20 licences': quotes, 'Merci pour hier': null, 'Report de notre rendez-vous': null });
  assert.equal(stack.llmRequests.length, 0, 'no AI was asked anything');
});

test('changing what a prompt suits changes what is offered, at once', async () => {
  assert.equal((await alice('PUT', `/prompts/${quotes}`, { name: 'Quotes', systemPrompt: 'You answer requests for quotes.', affinity: { [topic]: ['2'], priority: ['normal'] } })).status, 200);
  assert.deepEqual(await suggestedFor(), { 'Demande de devis pour 20 licences': null, 'Merci pour hier': null, 'Report de notre rendez-vous': quotes });
});

test('proposals written at fetch use the prompt that suits each email, else the first of the list', async () => {
  assert.equal((await alice('PUT', '/organization', { writing: 'draft' })).status, 200);
  const [mailbox] = (await alice('GET', '/mailboxes')).body;
  await alice('POST', `/mailboxes/${mailbox.id}/fetch`);
  const emails = (await alice('GET', '/emails?box=todo')).body.emails as { id: number; subject: string }[];
  const used: Record<string, number> = {};
  for (const email of emails) used[email.subject] = (await alice('GET', `/emails/${email.id}`)).body.proposal.promptId;
  assert.deepEqual(used, { 'Demande de devis pour 20 licences': first, 'Merci pour hier': first, 'Report de notre rendez-vous': quotes });
  assert.ok(stack.llmRequests.every((r) => !r.body.messages[0]?.content.includes('You triage the inbox')), 'the AI wrote, it did not sort or choose');
});
