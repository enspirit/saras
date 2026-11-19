// End to end over real protocols: HTTP API -> IMAP fetch -> triage -> draft -> SMTP send.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startStack } from './support/stack.js';

let stack;
before(async () => (stack = await startStack()));
after(() => stack.stop());

function client() {
  let cookie = '';
  return async (method, path, body, headers = { 'content-type': 'application/json' }) => {
    const res = await fetch(`${stack.url}/api${path}`, {
      method,
      headers: { ...(method === 'GET' ? {} : headers), cookie },
      body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body || {}),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

const me = client();
const triageCalls = () => stack.llmRequests.filter((r) => r.body.messages[0].content.includes('Tu tries la boîte'));
const draftCalls = () => stack.llmRequests.filter((r) => !r.body.messages[0].content.includes('Tu tries la boîte'));
let prompts;
let todo;

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
  assert.equal(prompts.length, 5);
});

test('a wrong IMAP password is refused, a right one connects', async () => {
  const bad = await me('POST', '/accounts/imap', { ...stack.imapAccount, password: 'nope' });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /Connexion impossible/);
  assert.equal((await me('POST', '/accounts/imap', stack.imapAccount)).status, 201);
  const stored = stack.db.prepare('SELECT config_enc FROM accounts').get().config_enc;
  assert.ok(!stored.includes('testpass'), 'mailbox password must be encrypted at rest');
});

test('sync fetches the inbox and triages it; newsletters never reach the LLM', async () => {
  const [account] = (await me('GET', '/accounts')).body;
  const result = (await me('POST', `/accounts/${account.id}/sync`)).body;
  assert.deepEqual(result, { fetched: 4, triaged: 3, error: null });

  assert.equal(triageCalls().length, 3);
  for (const call of stack.llmRequests) {
    assert.deepEqual(call.body.provider, { zdr: true, data_collection: 'deny' });
    assert.equal(call.authorization, 'Bearer sk-or-test');
    assert.ok(!JSON.stringify(call.body).includes('CONTENU-NEWSLETTER'));
  }

  const inbox = (await me('GET', '/emails?box=todo')).body;
  todo = inbox.emails;
  assert.deepEqual(todo.map((e) => e.subject), ['Demande de devis pour 20 licences', 'Report de notre rendez-vous']);
  assert.equal(todo[0].priority, 'high');
  assert.deepEqual(inbox.counts, { todo: 2, none: 2, sent: 0, ignored: 0 });

  const none = (await me('GET', '/emails?box=none')).body.emails;
  assert.deepEqual(none.map((e) => e.triageSource).sort(), ['ai', 'rule']);

  // syncing again imports nothing twice and asks the LLM nothing more
  assert.deepEqual((await me('POST', `/accounts/${account.id}/sync`)).body, { fetched: 0, triaged: 0, error: null });
  assert.equal(triageCalls().length, 3);
});

test('the AI suggests a prompt per email, the user may pick another one', async () => {
  const rdv = (await me('GET', `/emails/${todo[1].id}`)).body;
  assert.equal(rdv.suggestedPromptId, prompts.find((p) => p.name === 'Prise de rendez-vous').id);
  const devis = (await me('GET', `/emails/${todo[0].id}`)).body;
  assert.equal(devis.suggestedPromptId, null);
  assert.deepEqual(devis.recipients, { to: ['claire@client.example'], cc: [] });
  assert.deepEqual(devis.recipientsAll.cc, ['paul@client.example']);
});

test('draft, edit, explain the change, send', async () => {
  const support = prompts.find((p) => p.name === 'Support client');
  const draft = await me('POST', `/emails/${todo[0].id}/draft`, { promptId: support.id, instructions: 'proposer 1200 euros' });
  assert.equal(draft.status, 201);
  assert.match(draft.body.aiText, /Voici notre proposition/);
  const [system, user] = draftCalls().at(-1).body.messages;
  assert.ok(system.content.startsWith(support.systemPrompt));
  assert.match(user.content, /proposer 1200 euros/);
  assert.match(user.content, /equiper 20 personnes/);

  const finalText = draft.body.aiText.replace('[À COMPLÉTER : montant]', '1200 euros HT');
  const sent = await me('POST', `/emails/${todo[0].id}/send`, {
    draftId: draft.body.id,
    text: finalText,
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
  assert.match(mail.raw, /1200 euros HT/);
  assert.match(mail.raw, /> Nous souhaitons equiper 20 personnes/);

  assert.equal(stack.sentFolder().length, 1, 'a copy is filed in the Sent folder');

  const after = (await me('GET', `/emails/${todo[0].id}`)).body;
  assert.equal(after.status, 'sent');
  assert.equal(after.reply.wasEdited, true);
  assert.equal(after.reply.changeReason, 'Toujours donner le prix hors taxes');

  const again = await me('POST', `/emails/${todo[0].id}/send`, { text: 'bis', to: ['claire@client.example'] });
  assert.equal(again.status, 409);
  assert.equal(stack.outbox.length, 1);
});

test('the reason of a correction is given to the next draft made with the same prompt', async () => {
  const support = prompts.find((p) => p.name === 'Support client');
  const rdvPrompt = prompts.find((p) => p.name === 'Prise de rendez-vous');
  await me('POST', `/emails/${todo[1].id}/draft`, { promptId: support.id });
  assert.match(draftCalls().at(-1).body.messages[0].content, /- Toujours donner le prix hors taxes/);
  await me('POST', `/emails/${todo[1].id}/draft`, { promptId: rdvPrompt.id });
  assert.doesNotMatch(draftCalls().at(-1).body.messages[0].content, /prix hors taxes/);
});

test('sending the proposal untouched is recorded as not edited, and the original is flagged answered', async () => {
  const detail = (await me('GET', `/emails/${todo[1].id}`)).body;
  const sent = await me('POST', `/emails/${todo[1].id}/send`, {
    draftId: detail.draft.id,
    text: `${detail.draft.aiText}\n`,
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
  const draft = await me('POST', `/emails/${none[0].id}/draft`, { promptId: prompts[0].id });
  assert.equal(draft.status, 502);
  assert.match(draft.body.error, /ZDR/);
  await me('PUT', '/settings', { model: '' });
});

test('a personal OpenRouter key replaces the server key and is stored encrypted', async () => {
  await me('PUT', '/settings', { openrouterKey: 'sk-or-personal' });
  assert.ok(!stack.db.prepare('SELECT openrouter_key_enc AS k FROM users').get().k.includes('sk-or-personal'));
  const none = (await me('GET', '/emails?box=todo')).body.emails;
  await me('POST', `/emails/${none[0].id}/draft`, { promptId: prompts[0].id });
  assert.equal(stack.llmRequests.at(-1).authorization, 'Bearer sk-or-personal');
});

test('users are isolated from each other', async () => {
  const eve = client();
  await eve('POST', '/auth/signup', { email: 'eve@corp.example', password: 'un-autre-mot-de-passe' });
  assert.deepEqual((await eve('GET', '/emails?box=sent')).body.emails, []);
  assert.equal((await eve('GET', `/emails/${todo[0].id}`)).status, 404);
  assert.equal((await eve('POST', `/emails/${todo[0].id}/draft`, { promptId: prompts[0].id })).status, 404);
  assert.equal((await eve('PUT', `/prompts/${prompts[0].id}`, { name: 'x', systemPrompt: 'y' })).status, 404);
  const [account] = (await me('GET', '/accounts')).body;
  assert.equal((await eve('POST', `/accounts/${account.id}/sync`)).status, 404);
});

test('logout ends the session', async () => {
  assert.equal((await me('POST', '/auth/logout')).status, 200);
  assert.equal((await me('GET', '/me')).status, 401);
});
