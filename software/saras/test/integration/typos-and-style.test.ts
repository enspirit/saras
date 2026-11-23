// Checking typos and improving style: two helps that work on what the member wrote and on
// nothing else. What comes back is cleaned, and the reply leaves as rich text.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, signUp } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

let stack: Stack;
const me = createClient(() => stack.url);
/** The first email to handle. */
let email: { id: number; subject: string };

before(async () => {
  stack = await startStack();
  assert.equal((await signUp(me, 'bob@corp.example')).status, 201);
  await connectInbox(me, stack.imapAccount);
  [email] = (await me('GET', '/emails?box=todo')).body.emails;
});
after(() => stack.stop());

const lastMessages = () => stack.llmRequests.at(-1)!.body.messages;

test('typos and style need something written, and no other help exists: neither costs a request', async () => {
  const before = stack.llmRequests.length;

  const nothing = await me('POST', `/emails/${email.id}/assist`, { action: 'typos', html: '<p><br></p>' });
  assert.deepEqual([nothing.status, nothing.body.code], [400, 'assist.nothingWritten']);
  assert.equal((await me('POST', `/emails/${email.id}/assist`, { action: 'translate', html: '<p>x</p>' })).body.code, 'assist.invalidAction');
  assert.equal(stack.llmRequests.length, before, 'neither costs a request');
});

test('typos work on what the user wrote alone, and the answer of the LLM is cleaned', async () => {
  const typos = await me('POST', `/emails/${email.id}/assist`, { action: 'typos', html: '<p onclick="x()">Voici ma <strong>reponse</strong>.</p><script>alert(1)</script>' });
  assert.equal(typos.status, 201);
  assert.deepEqual([typos.body.action, typos.body.promptId], ['typos', null]);
  assert.equal(typos.body.html, '<p>Voici ma <strong>réponse</strong>.</p>', 'corrected, its code fence removed, the formatting kept');
  const sent = lastMessages();
  assert.equal(sent[1]!.content, '<draft>\n<p>Voici ma <strong>reponse</strong>.</p>\n</draft>', 'what reaches the LLM is already cleaned');
  assert.doesNotMatch(JSON.stringify(sent), new RegExp(email.subject), 'the email received is not sent for typos');
});

test('style works on what the user wrote alone too; the latest proposal is what the reply area resumes with', async () => {
  const style = await me('POST', `/emails/${email.id}/assist`, { action: 'style', html: '<p>merci</p>' });
  assert.equal(style.body.html, '<p>Bien cordialement, merci</p>', 'a script and an image added by the model are gone');
  assert.doesNotMatch(JSON.stringify(lastMessages()), new RegExp(email.subject));

  // The latest proposal is what the reply area resumes with.
  const detail = (await me('GET', `/emails/${email.id}`)).body;
  assert.deepEqual([detail.proposal.action, detail.proposal.html], ['style', '<p>Bien cordialement, merci</p>']);
});

test('a reply leaves as HTML with a plain-text alternative, both quoting the original', async () => {
  const detail = (await me('GET', `/emails/${email.id}`)).body;
  const outbox = stack.outbox.length;
  const sent = await me('POST', `/emails/${email.id}/send`, {
    proposalId: detail.proposal.id,
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
});

test('the reply is kept in both forms, cleaned; typos and style teach no prompt', async () => {
  const stored = (await me('GET', `/emails/${email.id}`)).body.reply;
  assert.equal(stored.finalHtml, '<p>Bien cordialement, merci</p><ul><li>un</li><li>deux</li></ul><p><a href="https://example.com/doc">la doc</a></p>');
  assert.equal(stored.finalText, 'Bien cordialement, merci\n\n- un\n- deux\n\nla doc (https://example.com/doc)');
  // Typos and style teach no prompt: the reason given is kept with the reply, attached to none.
  assert.equal(stored.changeReason, 'ajout');
  assert.ok((await me('GET', '/prompts')).body.every((p: { edited: number }) => p.edited === 0));
});
