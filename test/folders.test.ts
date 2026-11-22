// The default flow, without any AI: the user chooses the one folder to watch, and what is
// fetched from it passes the empty triage strategy.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient } from './support/client.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

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
  assert.equal((await me('GET', '/me')).body.organization.way, 'manual', 'no AI triage by default');
  assert.equal((await me('POST', '/accounts/imap', stack.imapAccount)).status, 201);
  const [account] = (await me('GET', '/accounts')).body;
  accountId = account.id;
  assert.equal(account.folder, null);
  const sync = (await me('POST', `/accounts/${accountId}/sync`)).body;
  assert.equal(sync.fetched, 0);
  assert.equal(sync.error.code, 'accounts.folderRequired');
  assert.deepEqual((await me('GET', '/emails?box=todo')).body.emails, []);
});

test('the folders of the mailbox are offered, the inbox first', async () => {
  const folders = (await me('GET', `/accounts/${accountId}/folders`)).body;
  assert.deepEqual(folders.map((f: { id: string }) => f.id), ['INBOX', 'Clients', 'Drafts', 'Sent']);
  const unknown = await me('PUT', `/accounts/${accountId}/folder`, { folder: 'Nope' });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.code, 'accounts.unknownFolder');
});

test('without AI, every mail of the watched folder is to be handled, automated mail apart', async () => {
  assert.deepEqual((await me('PUT', `/accounts/${accountId}/folder`, { folder: 'INBOX' })).body, { ok: true, folder: 'INBOX', folderName: 'Inbox' });
  await me('POST', `/accounts/${accountId}/sync`);

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
  assert.equal(detail.suggestedPromptId, null, 'the user picks the prompt');
  assert.equal(detail.folder, 'INBOX');
  assert.equal(stack.llmRequests.length, 0, 'fetching and sorting cost no LLM request');
  assert.equal((await me('GET', '/accounts')).body[0].folderName, 'Inbox');
});

test('another folder can be watched instead; what was fetched before is kept', async () => {
  assert.equal((await me('PUT', `/accounts/${accountId}/folder`, { folder: 'Clients' })).status, 200);
  const sync = (await me('POST', `/accounts/${accountId}/sync`)).body;
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
  const sent = await me('POST', `/emails/${contract.id}/send`, { draftId: draft.body.id, html: draft.body.html, to: ['hugo@client.example'] });
  assert.equal(sent.status, 200);
  assert.deepEqual(stack.folderFlags('Clients').map((flags) => flags.includes('\\Answered')), [true]);
});

test('typos and style work on what the user wrote alone, and the answer of the LLM is cleaned', async () => {
  const [email] = (await me('GET', '/emails?box=todo')).body.emails;
  const before = stack.llmRequests.length;

  const nothing = await me('POST', `/emails/${email.id}/assist`, { action: 'typos', html: '<p><br></p>' });
  assert.deepEqual([nothing.status, nothing.body.code], [400, 'assist.nothingWritten']);
  assert.equal((await me('POST', `/emails/${email.id}/assist`, { action: 'translate', html: '<p>x</p>' })).body.code, 'assist.invalidAction');
  assert.equal(stack.llmRequests.length, before, 'neither costs a request');

  const typos = await me('POST', `/emails/${email.id}/assist`, { action: 'typos', html: '<p onclick="x()">Voici ma <strong>reponse</strong>.</p><script>alert(1)</script>' });
  assert.equal(typos.status, 201);
  assert.deepEqual([typos.body.action, typos.body.promptId], ['typos', null]);
  assert.equal(typos.body.html, '<p>Voici ma <strong>réponse</strong>.</p>', 'corrected, its code fence removed, the formatting kept');
  const sent = stack.llmRequests.at(-1)!.body.messages;
  assert.equal(sent[1]!.content, '<draft>\n<p>Voici ma <strong>reponse</strong>.</p>\n</draft>', 'what reaches the LLM is already cleaned');
  assert.doesNotMatch(JSON.stringify(sent), new RegExp(email.subject), 'the email received is not sent for typos');

  const style = await me('POST', `/emails/${email.id}/assist`, { action: 'style', html: '<p>merci</p>' });
  assert.equal(style.body.html, '<p>Bien cordialement, merci</p>', 'a script and an image added by the model are gone');
  assert.doesNotMatch(JSON.stringify(stack.llmRequests.at(-1)!.body.messages), new RegExp(email.subject));

  // The latest proposal is what the reply area resumes with.
  const detail = (await me('GET', `/emails/${email.id}`)).body;
  assert.deepEqual([detail.draft.action, detail.draft.html], ['style', '<p>Bien cordialement, merci</p>']);
});

test('a reply leaves as HTML with a plain-text alternative, both quoting the original', async () => {
  const [email] = (await me('GET', '/emails?box=todo')).body.emails;
  const detail = (await me('GET', `/emails/${email.id}`)).body;
  const outbox = stack.outbox.length;
  const sent = await me('POST', `/emails/${email.id}/send`, {
    draftId: detail.draft.id,
    html: '<p>Bien cordialement, merci</p><ul><li>un</li><li>deux</li></ul><p><a href="https://example.com/doc" onclick="x()">la doc</a></p><img src="x">',
    to: detail.recipients.to,
    changeReason: 'ajout',
  });
  assert.deepEqual(sent.body, { ok: true, wasEdited: true });
  const raw = stack.outbox[outbox]!.raw.replace(/=\r\n/g, '');
  assert.match(raw, /^Content-Type: multipart\/alternative;/m);
  assert.match(raw, /Content-Type: text\/plain; charset=utf-8[\s\S]*Bien cordialement, merci\r\n\r\n- un\r\n- deux\r\n\r\nla doc \(https:\/\/example\.com\/doc\)/);
  assert.match(raw, /Content-Type: text\/html; charset=utf-8[\s\S]*<p>Bien cordialement, merci<\/p><ul><li>un<\/li><li>deux<\/li><\/ul><p><a href=3D"https:\/\/example\.com\/doc">la doc<\/a><\/p><br><div>On [\s\S]* wrote:<\/div><blockquote>/);
  assert.doesNotMatch(raw, /onclick|<img/);
  assert.doesNotMatch(raw, /[^\r]\n/, 'CRLF throughout');

  const stored = (await me('GET', `/emails/${email.id}`)).body.reply;
  assert.equal(stored.finalHtml, '<p>Bien cordialement, merci</p><ul><li>un</li><li>deux</li></ul><p><a href="https://example.com/doc">la doc</a></p>');
  assert.equal(stored.finalText, 'Bien cordialement, merci\n\n- un\n- deux\n\nla doc (https://example.com/doc)');
  // Typos and style teach no prompt: the reason given is kept with the reply, attached to none.
  assert.equal(stored.changeReason, 'ajout');
  assert.ok((await me('GET', '/prompts')).body.every((p: { edited: number }) => p.edited === 0));
});
