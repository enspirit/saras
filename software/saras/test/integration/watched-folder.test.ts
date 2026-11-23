// The watched folder, without any AI: the member chooses the one folder to watch, and every
// mail fetched from it is to handle, automated mail apart.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient } from '../support/client.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

const clientMail = [
  'From: "Hugo Petit" <hugo@client.example>',
  'To: me@corp.example',
  'Subject: Contrat a signer',
  'Message-ID: <contrat-1@client.example>',
  `Date: ${new Date(Date.now() - 3_600_000).toUTCString()}`,
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="b1"',
  '',
  '--b1',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Bonjour, voici le contrat. Pouvez-vous le signer ?',
  '--b1',
  'Content-Type: application/pdf; name="contrat.pdf"',
  'Content-Disposition: attachment; filename="contrat.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQKJcTl8uXrp/Og0MTGCg==',
  '--b1--',
].join('\r\n');

let stack: Stack;
before(async () => (stack = await startStack({ folders: { Clients: [{ raw: clientMail }] } })));
after(() => stack.stop());

const me = createClient(() => stack.url);
let accountId: number;

test('a connected mailbox watches nothing until its folder is chosen', async () => {
  await me('POST', '/auth/signup', { email: 'bob@corp.example', password: 'un-bon-mot-de-passe' });
  assert.equal((await me('GET', '/me')).body.organization.sorting, 'none', 'no AI triage by default');
  assert.equal((await me('POST', '/mailboxes/imap', stack.imapAccount)).status, 201);
  const [account] = (await me('GET', '/mailboxes')).body;
  accountId = account.id;
  assert.equal(account.folder, null);
  const sync = (await me('POST', `/mailboxes/${accountId}/fetch`)).body;
  assert.equal(sync.fetched, 0);
  assert.equal(sync.error.code, 'mailboxes.folderRequired');
  assert.deepEqual((await me('GET', '/emails?box=todo')).body.emails, []);
});

test('the folders of the mailbox are offered, the inbox first', async () => {
  const folders = (await me('GET', `/mailboxes/${accountId}/folders`)).body;
  assert.deepEqual(folders.map((f: { id: string }) => f.id), ['INBOX', 'Clients', 'Drafts', 'Sent']);
  const unknown = await me('PUT', `/mailboxes/${accountId}/folder`, { folder: 'Nope' });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.code, 'mailboxes.unknownFolder');
});

test('without AI, every mail of the watched folder is to be handled, automated mail apart', async () => {
  assert.deepEqual((await me('PUT', `/mailboxes/${accountId}/folder`, { folder: 'INBOX' })).body, { ok: true, folder: 'INBOX', folderName: 'Inbox' });
  await me('POST', `/mailboxes/${accountId}/fetch`);

  const inbox = (await me('GET', '/emails?box=todo')).body;
  assert.deepEqual(
    inbox.emails.map((e: { subject: string }) => e.subject),
    ['Demande de devis pour 20 licences', 'Merci pour hier', 'Report de notre rendez-vous'],
    'the plain thanks is kept: nobody judged it',
  );
  assert.ok(inbox.emails.every((e: { triageSource: string; status: string }) => e.triageSource === 'none' && e.status === 'needs_reply'));
  const aside = (await me('GET', '/emails?box=none')).body.emails;
  assert.deepEqual(aside.map((e: { subject: string; triageSource: string }) => [e.subject, e.triageSource]), [['Les 10 actus de la semaine', 'rule']]);

  const detail = (await me('GET', `/emails/${inbox.emails[0].id}`)).body;
  assert.equal(detail.suggestedPromptId, null, 'no prompt says it suits such an email: the user picks');
  assert.equal(detail.folder, 'INBOX');
  assert.equal(stack.llmRequests.length, 0, 'fetching and sorting cost no LLM request');
  assert.equal((await me('GET', '/mailboxes')).body[0].folderName, 'Inbox');
});

test('another folder can be watched instead; what was fetched before is kept', async () => {
  assert.equal((await me('PUT', `/mailboxes/${accountId}/folder`, { folder: 'Clients' })).status, 200);
  const sync = (await me('POST', `/mailboxes/${accountId}/fetch`)).body;
  assert.equal(sync.error, null);
  const todo = (await me('GET', '/emails?box=todo')).body.emails;
  assert.equal(todo.length, 4);
  const contract = todo.find((e: { subject: string }) => e.subject === 'Contrat a signer');
  const detail = (await me('GET', `/emails/${contract.id}`)).body;
  assert.equal(detail.folder, 'Clients');
  assert.deepEqual(detail.attachments.map((a: { name: string; type: string }) => [a.name, a.type]), [['contrat.pdf', 'application/pdf']]);
  assert.ok(detail.attachments[0].size > 0);
});

test('a reply to a mail of that folder flags it answered there, and tells the LLM of the attachment', async () => {
  const todo = (await me('GET', '/emails?box=todo')).body.emails;
  const contract = todo.find((e: { subject: string }) => e.subject === 'Contrat a signer');
  const [prompt] = (await me('GET', '/prompts')).body;
  const draft = await me('POST', `/emails/${contract.id}/assist`, { action: 'prompt', promptId: prompt.id });
  assert.equal(draft.status, 201);
  assert.equal(stack.llmRequests.length, 1, 'the only LLM request is the draft that was asked for');
  assert.match(stack.llmRequests[0]!.body.messages[1]!.content, /Attachments: contrat\.pdf/);
  const sent = await me('POST', `/emails/${contract.id}/send`, { proposalId: draft.body.id, html: draft.body.html, to: ['hugo@client.example'] });
  assert.equal(sent.status, 200);
  assert.deepEqual(stack.folderFlags('Clients').map((flags) => flags.includes('\\Answered')), [true]);
});
