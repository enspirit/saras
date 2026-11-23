// A shared mailbox: connected and managed by the administrators, there for every member of
// the organisation, who reply from it in its name and see what the others did.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, join, signUp } from '../support/client.ts';
import type { ApiClient } from '../support/client.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

let stack: Stack;
const client = () => createClient(() => stack.url);
const alice = client(); // administrator of Acme
const bruno = client(); // member of Acme
const chloe = client(); // member of Acme
const zoe = client(); // administrator of another organisation

before(async () => {
  stack = await startStack();
  assert.equal((await signUp(alice, 'alice@acme.example', 'Acme')).status, 201);
  assert.equal((await signUp(zoe, 'zoe@other.example', '')).status, 201);
  await join(alice, bruno, 'bruno@acme.example');
  await join(alice, chloe, 'chloe@acme.example');
});
after(() => stack.stop());

const subjects = async (as: ApiClient, box = 'todo'): Promise<string[]> => (await as('GET', `/emails?box=${box}`)).body.emails.map((e: { subject: string }) => e.subject);

let sharedId: number;
let quote: { id: number };

test('only an administrator connects a shared mailbox', async () => {
  const asked = await bruno('POST', '/mailboxes/imap', { ...stack.imapAccount, shared: true });
  assert.equal(asked.status, 201);
  const [personal] = (await bruno('GET', '/mailboxes')).body;
  assert.equal(personal.shared, false, 'a member asking for a shared mailbox gets a personal one');
  assert.deepEqual((await alice('GET', '/mailboxes')).body, [], 'which nobody else sees, not even an administrator');
  assert.equal((await alice('PUT', `/mailboxes/${personal.id}/folder`, { folder: 'INBOX' })).status, 404);
  assert.equal((await bruno('DELETE', `/mailboxes/${personal.id}`)).status, 200);

  assert.equal((await alice('POST', '/mailboxes/imap', { ...stack.imapAccount, shared: true })).status, 201);
  const [shared] = (await alice('GET', '/mailboxes')).body;
  sharedId = shared.id;
  assert.deepEqual([shared.shared, shared.canManage, shared.folder], [true, true, null]);
});

test('a shared mailbox is there for every member, and managed by administrators only', async () => {
  const [seen] = (await bruno('GET', '/mailboxes')).body;
  assert.deepEqual([seen.id, seen.shared, seen.canManage], [sharedId, true, false]);
  assert.equal((await bruno('GET', `/mailboxes/${sharedId}/folders`)).status, 200, 'a member may look');
  const refused = await bruno('PUT', `/mailboxes/${sharedId}/folder`, { folder: 'INBOX' });
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, 'mailboxes.adminOnly');
  assert.equal((await bruno('DELETE', `/mailboxes/${sharedId}`)).status, 403);

  assert.equal((await alice('PUT', `/mailboxes/${sharedId}/folder`, { folder: 'INBOX' })).status, 200);
  assert.equal((await bruno('POST', `/mailboxes/${sharedId}/fetch`)).body.error, null, 'a member may fetch it');

  const expected = ['Demande de devis pour 20 licences', 'Merci pour hier', 'Report de notre rendez-vous'];
  assert.deepEqual(await subjects(alice), expected);
  assert.deepEqual(await subjects(bruno), expected);
  assert.deepEqual(await subjects(chloe), expected, 'including someone who joined before it was connected');
  const listed = (await bruno('GET', '/emails?box=todo')).body;
  assert.deepEqual([listed.emails[0].mailbox, listed.emails[0].shared, listed.counts.todo], ['me@corp.example', true, 3]);
});

test('a member replies from the shared mailbox; everyone sees it done, and by whom', async () => {
  const todo = (await bruno('GET', '/emails?box=todo')).body.emails;
  quote = todo.find((e: { subject: string }) => e.subject.startsWith('Demande de devis'));
  const [prompt] = (await bruno('GET', '/prompts')).body;
  const draft = (await bruno('POST', `/emails/${quote.id}/assist`, { action: 'prompt', promptId: prompt.id })).body;
  const sent = await bruno('POST', `/emails/${quote.id}/send`, {
    proposalId: draft.id,
    html: draft.html.replace('[À COMPLÉTER : montant]', '1200 euros'),
    to: ['claire@client.example'],
    changeReason: 'Bruno tutoie Claire',
  });
  assert.deepEqual(sent.body, { ok: true, wasEdited: true });
  assert.equal(stack.outbox[0]!.from, 'me@corp.example', 'sent in the name of the shared mailbox');

  assert.equal((await subjects(chloe)).length, 2, 'it left everyone\'s list');
  const seenByChloe = (await chloe('GET', `/emails/${quote.id}`)).body;
  assert.deepEqual([seenByChloe.status, seenByChloe.reply.by, seenByChloe.shared], ['sent', 'bruno@acme.example', true]);
  assert.equal((await chloe('POST', `/emails/${quote.id}/send`, { html: '<p>bis</p>', to: ['claire@client.example'] })).status, 409, 'nobody answers it twice');
});

test('a correction steers its author only; the administrators see them all', async () => {
  const [prompt] = (await alice('GET', '/prompts')).body;
  const [next] = (await chloe('GET', '/emails?box=todo')).body.emails;
  const system = async (as: ApiClient): Promise<string> => {
    await as('POST', `/emails/${next.id}/assist`, { action: 'prompt', promptId: prompt.id });
    return stack.llmRequests.at(-1)!.body.messages[0]!.content;
  };
  assert.match(await system(bruno), /- Bruno tutoie Claire/);
  assert.doesNotMatch(await system(chloe), /Bruno tutoie Claire/);
  const corrections = (await alice('GET', `/prompts/${prompt.id}/corrections`)).body;
  assert.deepEqual(corrections.map((c: { reason: string; user: string }) => [c.reason, c.user]), [['Bruno tutoie Claire', 'bruno@acme.example']]);
  assert.equal((await alice('GET', '/prompts')).body[0].edited, 1);
  assert.equal((await zoe('GET', '/prompts')).body[0].used, 0);
});

test('deleting a member keeps what belongs to the organisation', async () => {
  // Bruno becomes an administrator and connects nothing new; the shared mailbox was Alice's doing.
  const users = (await alice('GET', '/members')).body as { id: number; email: string }[];
  const idOf = (email: string) => users.find((u) => u.email === email)!.id;
  assert.equal((await alice('PUT', `/members/${idOf('bruno@acme.example')}`, { role: 'admin' })).status, 200);
  assert.equal((await bruno('DELETE', `/members/${idOf('alice@acme.example')}`)).status, 200);
  assert.equal((await alice('GET', '/me')).status, 401);
  const [stillThere] = (await bruno('GET', '/mailboxes')).body;
  assert.deepEqual([stillThere.id, stillThere.shared, stillThere.canManage], [sharedId, true, true], 'the shared mailbox outlives who connected it');
  assert.equal((await bruno('GET', '/prompts')).body.length, 1);
  assert.equal((await subjects(chloe, 'sent')).length, 1);
});
