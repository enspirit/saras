// What an organisation may have prepared at fetch for the emails that need a reply: nothing
// (proposals on demand), a proposal to review, or a proposal filed in the mailbox's drafts.
// In no case is anything sent.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient } from './support/client.ts';
import type { ApiClient } from './support/client.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

let stack: Stack;
before(async () => (stack = await startStack()));
after(() => stack.stop());

const client = () => createClient(() => stack.url);
const alice = client(); // her organisation reviews proposals in the application
const zoe = client(); // hers has them filed in the mailbox

interface Listed {
  id: number;
  subject: string;
  replyMode: string | null;
}
const box = async (as: ApiClient, name: string): Promise<Listed[]> => (await as('GET', `/emails?box=${name}`)).body.emails;
const proposals = () => stack.llmRequests.filter((r) => !r.body.messages[0]?.content.includes('You triage the inbox'));

/** Signs up, connects the test mailbox and watches its inbox; returns the mailbox's id. */
async function start(as: ApiClient, email: string, organization: unknown = {}): Promise<number> {
  assert.equal((await as('POST', '/auth/signup', { email, password: 'un-bon-mot-de-passe', organization: email })).status, 201);
  assert.equal((await as('PUT', '/organization', organization)).status, 200);
  const account = await as('POST', '/mailboxes/imap', stack.imapAccount);
  assert.equal(account.status, 201);
  assert.equal((await as('PUT', `/mailboxes/${account.body.id}/folder`, { folder: 'INBOX' })).status, 200);
  await as('POST', `/mailboxes/${account.body.id}/fetch`);
  return account.body.id;
}

let mailbox: number;

test('by default nothing is written at fetch: proposals are on demand', async () => {
  mailbox = await start(alice, 'alice@acme.example');
  assert.equal((await alice('GET', '/me')).body.organization.writing, 'none');
  const todo = await box(alice, 'todo');
  assert.equal(todo.length, 3);
  assert.equal(proposals().length, 0);
  assert.equal((await alice('GET', `/emails/${todo[0]!.id}`)).body.proposal, null);
});

test('an unknown way of preparing replies is refused: nothing sends by itself', async () => {
  const refused = await alice('PUT', '/organization', { writing: 'send' });
  assert.equal(refused.status, 400);
  assert.equal(refused.body.code, 'organization.invalidWriting');
});

test('"draft" prepares a proposal for each email to handle, to review in the application', async () => {
  // Chosen after the first fetch, with AI sorting: what was let through unsorted is sorted again.
  assert.equal((await alice('PUT', '/organization', { sorting: 'ai', writing: 'draft' })).status, 200);
  assert.equal((await alice('POST', '/organization/sort-again')).status, 200);
  await alice('POST', `/mailboxes/${mailbox}/fetch`);
  const todo = await box(alice, 'todo');
  assert.deepEqual(todo.map((e) => e.subject).sort(), ['Demande de devis pour 20 licences', 'Report de notre rendez-vous'], 'the thank-you note was set aside by the AI');
  assert.equal(proposals().length, 2);
  for (const email of todo) {
    const { proposal: draft, status } = (await alice('GET', `/emails/${email.id}`)).body;
    assert.equal(draft.action, 'prompt');
    assert.match(draft.html, /Voici notre proposition/);
    assert.equal(status, 'needs_reply', 'it still waits for its reader');
  }
  // A later fetch does not write them again.
  await alice('POST', `/mailboxes/${mailbox}/fetch`);
  assert.equal(proposals().length, 2);
  assert.equal(stack.draftsFolder().length, 0);
  assert.equal(stack.outbox.length, 0);
});

test('"mailbox" also files each proposal in the drafts of the mailbox; nothing is sent', async () => {
  await start(zoe, 'zoe@other.example', { writing: 'mailbox' });
  assert.deepEqual(await box(zoe, 'todo'), []);
  const replied = await box(zoe, 'sent');
  assert.equal(replied.length, 3, 'nobody sorts in this organisation: every email is to handle, and gets its proposal');
  assert.ok(replied.every((e) => e.replyMode === 'draft'));
  assert.equal(stack.draftsFolder().length, 3);
  assert.equal(stack.outbox.length, 0);
  const { reply } = (await zoe('GET', `/emails/${replied[0]!.id}`)).body;
  assert.deepEqual([reply.mode, reply.wasEdited, reply.by], ['draft', false, 'zoe@other.example']);
});
