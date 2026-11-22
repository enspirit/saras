// End to end over real protocols: HTTP API -> IMAP fetch -> triage -> draft -> SMTP send.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, installTemplates, join } from './support/client.ts';
import type { ApiClient } from './support/client.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';
import type { ChatMessage } from '../src/types.ts';

let stack: Stack;
// This file exercises the AI triage strategy; test/folders.test.ts covers the default one.
before(async () => (stack = await startStack({ env: { TRIAGE_STRATEGY: 'ai' } })));
after(() => stack.stop());

const client = () => createClient(() => stack.url);

const me = client();
const triageCalls = () => stack.llmRequests.filter((r) => r.body.messages[0].content.includes('You triage the inbox'));
const draftCalls = () => stack.llmRequests.filter((r) => !r.body.messages[0].content.includes('You triage the inbox'));
/** What the API returns for a prompt and for a listed email, as far as these tests look. */
interface PromptView {
  id: number;
  name: string;
  description: string;
  systemPrompt: string;
}
interface EmailView {
  id: number;
  subject: string;
  priority: string;
  triageSource: string;
  replyMode: string | null;
}

let prompts: PromptView[];
let todo: EmailView[];

/** The last element of a list that the test expects not to be empty. */
function lastOf<T>(list: T[]): T {
  const last = list.at(-1);
  assert.ok(last !== undefined, 'expected a non-empty list');
  return last;
}

function promptNamed(name: string): PromptView {
  const prompt = prompts.find((p) => p.name === name);
  assert.ok(prompt, `no prompt named ${name}`);
  return prompt;
}

/** Chooses the folder to watch and waits for the fetch this starts. */
async function watchFolder(as: ApiClient, accountId: number, folder: string): Promise<void> {
  assert.equal((await as('PUT', `/accounts/${accountId}/folder`, { folder })).status, 200);
  await as('POST', `/accounts/${accountId}/sync`);
}

const lastDraftSystemPrompt = (): string => lastOf(draftCalls()).body.messages[0]?.content ?? '';

test('signup, and writes must be JSON', async () => {
  assert.equal((await me('GET', '/me')).status, 401);
  assert.equal((await me('POST', '/auth/signup', { email: 'bob@corp.example', password: 'short' })).status, 400);
  assert.equal((await me('POST', '/auth/signup', { email: 'bob@corp.example', password: 'un-bon-mot-de-passe' })).status, 201);
  const profile = (await me('GET', '/me')).body;
  assert.deepEqual(profile.privacy, { zdr: true, data_collection: 'deny' });
  assert.equal(profile.hasKey, true);
  const form = await me('POST', '/auth/logout', 'a=b', { 'content-type': 'application/x-www-form-urlencoded' });
  assert.equal(form.status, 415);
  prompts = (await me('GET', '/prompts')).body;
  assert.deepEqual(prompts.map((p) => p.name), ['Standard professional reply'], 'an organisation starts with one prompt');
  // The others are templates, added on demand; each can be added once.
  assert.equal((await me('GET', '/prompts/templates')).body.length, 4);
  await installTemplates(me);
  prompts = (await me('GET', '/prompts')).body;
  assert.equal(prompts.length, 5);
  assert.deepEqual((await me('GET', '/prompts/templates')).body, []);
});

test('a wrong IMAP password is refused, a right one connects', async () => {
  const bad = await me('POST', '/accounts/imap', { ...stack.imapAccount, password: 'nope' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'accounts.connectionFailed');
  assert.match(bad.body.error, /^Could not connect: /);
  assert.ok(bad.body.params.detail);
  assert.equal((await me('POST', '/accounts/imap', stack.imapAccount)).status, 201);
  const stored = (await stack.db.one<{ config_enc: string }>('SELECT config_enc FROM accounts'))?.config_enc ?? '';
  assert.ok(stored.length > 20);
  assert.ok(!stored.includes('testpass'), 'mailbox password must be encrypted at rest');
});

test('the inbox is fetched and passes the AI gate in one batch; newsletters never reach the LLM', async () => {
  const [account] = (await me('GET', '/accounts')).body;
  assert.equal(account.folder, null, 'nothing is watched until a folder is chosen');
  await watchFolder(me, account.id, 'INBOX');
  const result = (await me('POST', `/accounts/${account.id}/sync`)).body;
  assert.deepEqual(result, { fetched: 0, triaged: 0, error: null }, 'choosing the folder already fetched and triaged it');

  assert.equal(triageCalls().length, 1, 'one request for the whole batch');
  assert.equal([...lastOf(triageCalls()).body.messages[1]!.content.matchAll(/<email id=/g)].length, 3);
  for (const call of stack.llmRequests) {
    assert.deepEqual(call.body.provider, { zdr: true, data_collection: 'deny' });
    assert.equal(call.authorization, 'Bearer sk-or-test');
    assert.ok(!JSON.stringify(call.body).includes('CONTENU-NEWSLETTER'));
  }

  const inbox = (await me('GET', '/emails?box=todo')).body;
  todo = inbox.emails;
  assert.deepEqual(todo.map((e: EmailView) => e.subject), ['Demande de devis pour 20 licences', 'Report de notre rendez-vous']);
  assert.equal(todo[0].priority, 'high');
  assert.deepEqual(inbox.counts, { todo: 2, none: 2, sent: 0, ignored: 0 });

  const none = (await me('GET', '/emails?box=none')).body.emails;
  assert.deepEqual(none.map((e: EmailView) => e.triageSource).sort(), ['ai', 'rule']);

  // syncing again imports nothing twice and asks the LLM nothing more
  assert.deepEqual((await me('POST', `/accounts/${account.id}/sync`)).body, { fetched: 0, triaged: 0, error: null });
  assert.equal(triageCalls().length, 1);
});

test('the AI suggests a prompt per email, the user may pick another one', async () => {
  const rdv = (await me('GET', `/emails/${todo[1].id}`)).body;
  assert.equal(rdv.suggestedPromptId, promptNamed('Appointment scheduling').id);
  const devis = (await me('GET', `/emails/${todo[0].id}`)).body;
  assert.equal(devis.suggestedPromptId, null);
  assert.deepEqual(devis.recipients, { to: ['claire@client.example'], cc: [] });
  assert.deepEqual(devis.recipientsAll.cc, ['paul@client.example']);
});

test('draft, edit, explain the change, send', async () => {
  const support = promptNamed('Customer support');
  const draft = await me('POST', `/emails/${todo[0].id}/assist`, { action: 'prompt', promptId: support.id, html: '<p>proposer 1200 euros</p>' });
  assert.equal(draft.status, 201);
  assert.match(draft.body.html, /Voici notre proposition/);
  const [system, user] = lastOf(draftCalls()).body.messages as [ChatMessage, ChatMessage];
  assert.ok(system.content.startsWith(support.systemPrompt));
  assert.match(user.content, /proposer 1200 euros/);
  assert.match(user.content, /equiper 20 personnes/);

  const finalText = draft.body.html.replace('[À COMPLÉTER : montant]', '1200 euros HT');
  const sent = await me('POST', `/emails/${todo[0].id}/send`, {
    draftId: draft.body.id,
    html: finalText,
    to: ['claire@client.example'],
    cc: ['paul@client.example'],
    changeReason: 'Toujours donner le prix hors taxes',
  });
  assert.deepEqual(sent.body, { ok: true, wasEdited: true });

  assert.equal(stack.outbox.length, 1);
  const mail = stack.outbox[0];
  assert.equal(mail.from, 'me@corp.example');
  assert.deepEqual(mail.to, ['claire@client.example', 'paul@client.example']);
  assert.match(mail.raw, /^From: "?Moi Test"? <me@corp\.example>/m);
  assert.match(mail.raw, /^Subject: Re: Demande de devis pour 20 licences/m);
  assert.match(mail.raw, /^In-Reply-To: <devis-1@client\.example>/m);
  assert.match(mail.raw, /^References: <devis-1@client\.example>/m);
  // Long lines are folded by the quoted-printable encoding: undo it before reading the body.
  const body = mail.raw.replace(/=\r\n/g, '');
  assert.match(body, /1200 euros HT/);
  assert.match(body, /On .* \(UTC\), Claire Martin <claire@client\.example> wrote:/, 'the quote line follows the user\'s language');
  assert.match(body, /> Nous souhaitons equiper 20 personnes/);

  assert.equal(stack.sentFolder().length, 1, 'a copy is filed in the Sent folder');

  const after = (await me('GET', `/emails/${todo[0].id}`)).body;
  assert.equal(after.status, 'sent');
  assert.equal(after.reply.wasEdited, true);
  assert.equal(after.reply.changeReason, 'Toujours donner le prix hors taxes');

  const again = await me('POST', `/emails/${todo[0].id}/send`, { html: '<p>bis</p>', to: ['claire@client.example'] });
  assert.equal(again.status, 409);
  assert.equal(stack.outbox.length, 1);
});

test('the reason of a correction is given to the next draft made with the same prompt', async () => {
  const support = promptNamed('Customer support');
  const rdvPrompt = promptNamed('Appointment scheduling');
  await me('POST', `/emails/${todo[1].id}/assist`, { action: 'prompt', promptId: support.id });
  assert.match(lastDraftSystemPrompt(), /- Toujours donner le prix hors taxes/);
  await me('POST', `/emails/${todo[1].id}/assist`, { action: 'prompt', promptId: rdvPrompt.id });
  assert.doesNotMatch(lastDraftSystemPrompt(), /prix hors taxes/);
});

test('sending the proposal untouched is recorded as not edited, and the original is flagged answered', async () => {
  const detail = (await me('GET', `/emails/${todo[1].id}`)).body;
  const sent = await me('POST', `/emails/${todo[1].id}/send`, {
    draftId: detail.draft.id,
    html: detail.draft.html,
    to: detail.recipients.to,
    changeReason: 'ignored because nothing changed',
  });
  assert.deepEqual(sent.body, { ok: true, wasEdited: false });
  assert.equal((await me('GET', `/emails/${todo[1].id}`)).body.reply.changeReason, '');
  assert.deepEqual(stack.outbox[1].to, ['sophie@client.example']);
  assert.deepEqual(stack.inboxFlags().map((flags) => flags.includes('\\Answered')), [true, false, false, true]);
});

test('a model without ZDR provider fails loudly instead of being routed elsewhere', async () => {
  assert.equal((await me('PUT', '/settings', { model: 'not a model' })).status, 400);
  assert.equal((await me('PUT', '/settings', { model: 'nozdr/model' })).status, 200);
  const none = (await me('GET', '/emails?box=none')).body.emails;
  await me('POST', `/emails/${none[0].id}/status`, { status: 'needs_reply' });
  const draft = await me('POST', `/emails/${none[0].id}/assist`, { action: 'prompt', promptId: prompts[0].id });
  assert.equal(draft.status, 502);
  assert.match(draft.body.error, /ZDR/);
  await me('PUT', '/settings', { model: '' });
});

test('a personal OpenRouter key replaces the server key and is stored encrypted', async () => {
  await me('PUT', '/settings', { openrouterKey: 'sk-or-personal' });
  const key = (await stack.db.one<{ k: string }>('SELECT openrouter_key_enc AS k FROM users WHERE openrouter_key_enc IS NOT NULL'))?.k ?? '';
  assert.ok(key.length > 20 && !key.includes('sk-or-personal'));
  const none = (await me('GET', '/emails?box=todo')).body.emails;
  await me('POST', `/emails/${none[0].id}/assist`, { action: 'prompt', promptId: prompts[0].id });
  assert.equal(lastOf(stack.llmRequests).authorization, 'Bearer sk-or-personal');
});

test('saving as a draft files the reply in the mailbox without sending it', async () => {
  const [email] = (await me('GET', '/emails?box=todo')).body.emails;
  const detail = (await me('GET', `/emails/${email.id}`)).body;
  const sentBefore = stack.outbox.length;
  const saved = await me('POST', `/emails/${email.id}/save-draft`, {
    draftId: detail.draft.id,
    html: `${detail.draft.html}<p>PS : à finir dans ma messagerie.</p>`,
    to: detail.recipients.to,
    changeReason: 'Ajout d’un post-scriptum',
  });
  assert.deepEqual(saved.body, { ok: true, wasEdited: true });
  assert.equal(stack.outbox.length, sentBefore, 'nothing is sent');

  const [draft] = stack.draftsFolder();
  assert.ok(draft.flags.includes('\\Draft'));
  assert.match(draft.raw, new RegExp(`^To: ${detail.recipients.to[0].replace('.', '\\.')}`, 'm'));
  assert.match(draft.raw, new RegExp(`^In-Reply-To: ${detail.messageId}`, 'm'));
  assert.match(draft.raw, /PS : =C3=A0 finir dans ma/);
  assert.doesNotMatch(draft.raw, /[^\r]\n/, 'CRLF line endings throughout');

  const after = (await me('GET', `/emails/${email.id}`)).body;
  assert.equal(after.reply.mode, 'draft');
  const listed = (await me('GET', '/emails?box=sent')).body.emails;
  assert.deepEqual(listed.map((e: EmailView) => e.replyMode).sort(), ['draft', 'sent', 'sent']);
  assert.equal((await me('POST', `/emails/${email.id}/send`, { html: '<p>bis</p>', to: detail.recipients.to })).status, 409);
});

const eve = client();

test('a colleague does not reach a personal mailbox', async () => {
  await join(me, eve, 'eve@corp.example');
  assert.deepEqual((await eve('GET', '/emails?box=sent')).body.emails, []);
  assert.equal((await eve('GET', `/emails/${todo[0].id}`)).status, 404);
  assert.equal((await eve('POST', `/emails/${todo[0].id}/assist`, { action: 'prompt', promptId: prompts[0].id })).status, 404);
  assert.equal((await eve('POST', `/emails/${todo[0].id}/save-draft`, { html: '<p>x</p>', to: ['a@b.example'] })).status, 404);
  const [account] = (await me('GET', '/accounts')).body;
  assert.equal((await eve('POST', `/accounts/${account.id}/sync`)).status, 404);
  assert.deepEqual((await eve('GET', '/accounts')).body, []);
  // An address is connected once per organisation: she cannot take the mailbox over either.
  const takeover = await eve('POST', '/accounts/imap', stack.imapAccount);
  assert.equal(takeover.status, 409);
  assert.equal(takeover.body.code, 'accounts.alreadyConnected');
});

test('prompts belong to the organisation; only its administrators manage them', async () => {
  assert.equal((await me('GET', '/me')).body.role, 'admin', 'who creates the organisation administers it');
  assert.equal((await eve('GET', '/me')).body.role, 'user');

  // a user sees the shared catalogue, without the instructions
  const seen = (await eve('GET', '/prompts')).body;
  assert.deepEqual(seen.map((p: PromptView) => p.id), prompts.map((p: PromptView) => p.id));
  assert.deepEqual(Object.keys(seen[0]), ['id', 'name', 'description']);

  const support = promptNamed('Customer support');
  assert.equal((await eve('PUT', `/prompts/${support.id}`, { name: 'x', systemPrompt: 'y' })).status, 403);
  assert.equal((await eve('POST', '/prompts', { name: 'x', systemPrompt: 'y' })).status, 403);
  assert.equal((await eve('DELETE', `/prompts/${support.id}`)).status, 403);
  assert.equal((await eve('GET', `/prompts/${support.id}/corrections`)).status, 403);
  assert.equal((await eve('GET', '/users')).status, 403);
  assert.equal((await eve('PUT', '/users/1', { role: 'admin' })).status, 403);

  // the administrator sees who corrected what
  const corrections = (await me('GET', `/prompts/${support.id}/corrections`)).body;
  assert.deepEqual(corrections.map((c: { reason: string; user: string }) => [c.reason, c.user]), [['Toujours donner le prix hors taxes', 'bob@corp.example']]);
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

test('logout ends the session', async () => {
  assert.equal((await me('POST', '/auth/logout')).status, 200);
  assert.equal((await me('GET', '/me')).status, 401);
});
