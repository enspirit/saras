// Organisations are tenants: signing up creates one, nothing crosses from one to another,
// and inside one a mailbox is either personal or shared by all its members.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, join } from './support/client.ts';
import type { ApiClient } from './support/client.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

let stack: Stack;
before(async () => (stack = await startStack()));
after(() => stack.stop());

const client = () => createClient(() => stack.url);
const alice = client(); // administrator of Acme
const bruno = client(); // member of Acme
const chloe = client(); // member of Acme
const zoe = client(); // administrator of another organisation

const signUp = (as: ApiClient, email: string, organization: string) => as('POST', '/auth/signup', { email, password: 'un-bon-mot-de-passe', organization });
const subjects = async (as: ApiClient, box = 'todo'): Promise<string[]> => (await as('GET', `/emails?box=${box}`)).body.emails.map((e: { subject: string }) => e.subject);
const profile = async (as: ApiClient) => (await as('GET', '/me')).body;

let sharedId: number;
let quote: { id: number };

test('signing up creates an organisation and makes its creator the administrator', async () => {
  assert.equal((await signUp(alice, 'alice@acme.example', 'Acme')).status, 201);
  assert.equal((await signUp(zoe, 'zoe@other.example', '')).status, 201);
  const a = await profile(alice);
  assert.deepEqual([a.role, a.organization.name, a.organization.triage], ['admin', 'Acme', 'none']);
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
  const listed = (await alice('GET', '/users')).body;
  assert.deepEqual(listed.map((u: { email: string; name: string }) => [u.email, u.name]), [['alice@acme.example', 'Alice Martin']]);
  const named = client();
  assert.equal((await named('POST', '/auth/signup', { email: 'yann@third.example', password: 'un-bon-mot-de-passe', organization: 'Third', name: 'Yann Leroy' })).status, 201);
  assert.equal((await profile(named)).name, 'Yann Leroy', 'given at sign-up');
});

test('each organisation has its own prompts, users and invitations', async () => {
  const mine = (await alice('GET', '/prompts')).body;
  const theirs = (await zoe('GET', '/prompts')).body;
  assert.equal(mine.length, 1);
  assert.equal(theirs.length, 1);
  assert.deepEqual(mine.map((p: { id: number }) => p.id).filter((id: number) => theirs.some((p: { id: number }) => p.id === id)), []);

  assert.equal((await zoe('PUT', `/prompts/${mine[0].id}`, { name: 'x', systemPrompt: 'y' })).status, 404);
  assert.equal((await zoe('DELETE', `/prompts/${mine[0].id}`)).status, 404);
  assert.equal((await zoe('GET', `/prompts/${mine[0].id}/corrections`)).status, 404);

  await join(alice, bruno, 'bruno@acme.example');
  await join(alice, chloe, 'chloe@acme.example');
  assert.deepEqual((await alice('GET', '/users')).body.map((u: { email: string }) => u.email), ['alice@acme.example', 'bruno@acme.example', 'chloe@acme.example']);
  assert.deepEqual((await zoe('GET', '/users')).body.map((u: { email: string }) => u.email), ['zoe@other.example']);
  assert.equal((await profile(bruno)).organization.name, 'Acme');
  assert.equal((await profile(bruno)).organization.hasKey, undefined, 'the organisation key is the administrators\' business');

  const bid = (await alice('GET', '/users')).body[1].id;
  assert.equal((await zoe('PUT', `/users/${bid}`, { role: 'admin' })).status, 404);
  assert.equal((await zoe('DELETE', `/users/${bid}`)).status, 404);

  const pending = (await alice('POST', '/invitations', { email: 'dan@acme.example' })).body;
  assert.deepEqual((await zoe('GET', '/invitations')).body, []);
  assert.equal((await zoe('DELETE', `/invitations/${pending.id}`)).status, 200);
  assert.equal((await alice('GET', '/invitations')).body.length, 1, 'another organisation cannot revoke it');
  // The same address may be invited by two organisations; the link decides which one is joined.
  assert.equal((await zoe('POST', '/invitations', { email: 'dan@acme.example' })).status, 201);
  assert.equal((await alice('GET', '/invitations')).body.length, 1);
});

test('only an administrator connects a shared mailbox', async () => {
  const asked = await bruno('POST', '/accounts/imap', { ...stack.imapAccount, shared: true });
  assert.equal(asked.status, 201);
  const [personal] = (await bruno('GET', '/accounts')).body;
  assert.equal(personal.shared, false, 'a member asking for a shared mailbox gets a personal one');
  assert.deepEqual((await alice('GET', '/accounts')).body, [], 'which nobody else sees, not even an administrator');
  assert.equal((await alice('PUT', `/accounts/${personal.id}/folder`, { folder: 'INBOX' })).status, 404);
  assert.equal((await bruno('DELETE', `/accounts/${personal.id}`)).status, 200);

  assert.equal((await alice('POST', '/accounts/imap', { ...stack.imapAccount, shared: true })).status, 201);
  const [shared] = (await alice('GET', '/accounts')).body;
  sharedId = shared.id;
  assert.deepEqual([shared.shared, shared.canManage, shared.folder], [true, true, null]);
});

test('a shared mailbox is there for every member, and managed by administrators only', async () => {
  const [seen] = (await bruno('GET', '/accounts')).body;
  assert.deepEqual([seen.id, seen.shared, seen.canManage], [sharedId, true, false]);
  assert.equal((await bruno('GET', `/accounts/${sharedId}/folders`)).status, 200, 'a member may look');
  const refused = await bruno('PUT', `/accounts/${sharedId}/folder`, { folder: 'INBOX' });
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, 'accounts.adminOnly');
  assert.equal((await bruno('DELETE', `/accounts/${sharedId}`)).status, 403);

  assert.equal((await alice('PUT', `/accounts/${sharedId}/folder`, { folder: 'INBOX' })).status, 200);
  assert.equal((await bruno('POST', `/accounts/${sharedId}/sync`)).body.error, null, 'a member may fetch it');

  const expected = ['Demande de devis pour 20 licences', 'Merci pour hier', 'Report de notre rendez-vous'];
  assert.deepEqual(await subjects(alice), expected);
  assert.deepEqual(await subjects(bruno), expected);
  assert.deepEqual(await subjects(chloe), expected, 'including someone who joined before it was connected');
  const listed = (await bruno('GET', '/emails?box=todo')).body;
  assert.deepEqual([listed.emails[0].account, listed.emails[0].shared, listed.counts.todo], ['me@corp.example', true, 3]);
});

test('nothing of an organisation is reachable from another', async () => {
  assert.deepEqual((await zoe('GET', '/accounts')).body, []);
  assert.deepEqual(await subjects(zoe), []);
  assert.deepEqual((await zoe('GET', '/emails?box=todo')).body.counts, { todo: 0, none: 0, sent: 0, ignored: 0 });
  const [email] = (await alice('GET', '/emails?box=todo')).body.emails;
  const [prompt] = (await zoe('GET', '/prompts')).body;
  assert.equal((await zoe('GET', `/emails/${email.id}`)).status, 404);
  assert.equal((await zoe('POST', `/emails/${email.id}/status`, { status: 'ignored' })).status, 404);
  assert.equal((await zoe('POST', `/emails/${email.id}/assist`, { action: 'prompt', promptId: prompt.id })).status, 404);
  assert.equal((await zoe('POST', `/emails/${email.id}/send`, { html: '<p>x</p>', to: ['a@b.example'] })).status, 404);
  assert.equal((await zoe('POST', `/accounts/${sharedId}/sync`)).status, 404);
  assert.equal((await zoe('GET', `/accounts/${sharedId}/folders`)).status, 404);
  // A member cannot use a prompt of another organisation on their own email either.
  assert.equal((await bruno('POST', `/emails/${email.id}/assist`, { action: 'prompt', promptId: prompt.id })).status, 404);
  // The same mailbox may be connected by another organisation: they are separate worlds.
  assert.equal((await zoe('POST', '/accounts/imap', stack.imapAccount)).status, 201);
});

test('a member replies from the shared mailbox; everyone sees it done, and by whom', async () => {
  const todo = (await bruno('GET', '/emails?box=todo')).body.emails;
  quote = todo.find((e: { subject: string }) => e.subject.startsWith('Demande de devis'));
  const [prompt] = (await bruno('GET', '/prompts')).body;
  const draft = (await bruno('POST', `/emails/${quote.id}/assist`, { action: 'prompt', promptId: prompt.id })).body;
  const sent = await bruno('POST', `/emails/${quote.id}/send`, {
    draftId: draft.id,
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

test('the triage strategy and the LLM key belong to the organisation', async () => {
  assert.equal((await bruno('PUT', '/organization', { triage: 'ai' })).status, 403);
  assert.equal((await alice('PUT', '/organization', { triage: 'magic' })).body.code, 'organization.invalidTriage');
  assert.equal((await alice('PUT', '/organization', { name: 'Acme SA', triage: 'ai', skipAutomated: false, openrouterKey: 'sk-or-acme' })).status, 200);
  const a = await profile(alice);
  assert.deepEqual([a.organization.name, a.organization.triage, a.organization.skipAutomated, a.organization.hasKey], ['Acme SA', 'ai', false, true]);
  assert.equal((await profile(zoe)).organization.triage, 'none', 'another organisation keeps its own');

  const stored = await stack.db.one<{ k: string }>(`SELECT openrouter_key_enc AS k FROM organizations WHERE name = 'Acme SA'`);
  assert.ok(stored!.k.length > 20 && !stored!.k.includes('sk-or-acme'), 'encrypted at rest');

  // Members now draft with the organisation's key, unless they have their own.
  const [prompt] = (await bruno('GET', '/prompts')).body;
  const [next] = (await bruno('GET', '/emails?box=todo')).body.emails;
  await bruno('POST', `/emails/${next.id}/assist`, { action: 'prompt', promptId: prompt.id });
  assert.equal(stack.llmRequests.at(-1)!.authorization, 'Bearer sk-or-acme');
  await chloe('PUT', '/settings', { openrouterKey: 'sk-or-chloe' });
  await chloe('POST', `/emails/${next.id}/assist`, { action: 'prompt', promptId: prompt.id });
  assert.equal(stack.llmRequests.at(-1)!.authorization, 'Bearer sk-or-chloe');
  const [theirPrompt] = (await zoe('GET', '/prompts')).body;
  const [zoeAccount] = (await zoe('GET', '/accounts')).body;
  await zoe('PUT', `/accounts/${zoeAccount.id}/folder`, { folder: 'INBOX' });
  await zoe('POST', `/accounts/${zoeAccount.id}/sync`);
  const [theirEmail] = (await zoe('GET', '/emails?box=todo')).body.emails;
  await zoe('POST', `/emails/${theirEmail.id}/assist`, { action: 'prompt', promptId: theirPrompt.id });
  assert.equal(stack.llmRequests.at(-1)!.authorization, 'Bearer sk-or-test', 'an organisation without a key falls back to the server\'s');
});

test('deleting a member keeps what belongs to the organisation', async () => {
  // Bruno becomes an administrator and connects nothing new; the shared mailbox was Alice's doing.
  const users = (await alice('GET', '/users')).body as { id: number; email: string }[];
  const idOf = (email: string) => users.find((u) => u.email === email)!.id;
  assert.equal((await alice('PUT', `/users/${idOf('bruno@acme.example')}`, { role: 'admin' })).status, 200);
  assert.equal((await bruno('DELETE', `/users/${idOf('alice@acme.example')}`)).status, 200);
  assert.equal((await alice('GET', '/me')).status, 401);
  const [stillThere] = (await bruno('GET', '/accounts')).body;
  assert.deepEqual([stillThere.id, stillThere.shared, stillThere.canManage], [sharedId, true, true], 'the shared mailbox outlives who connected it');
  assert.equal((await bruno('GET', '/prompts')).body.length, 1);
  assert.equal((await subjects(chloe, 'sent')).length, 1);
});
