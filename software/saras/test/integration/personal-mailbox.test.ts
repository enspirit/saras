// A personal mailbox: connected by its servers and a password, sealed at rest, reached and
// managed by the member who connected it and by nobody else, and renewed without being lost.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, join, signUp } from '../support/client.ts';
import { watchFolder } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

let stack: Stack;
const me = createClient(() => stack.url);
const eve = createClient(() => stack.url); // a colleague, in the same organisation

before(async () => {
  stack = await startStack();
  assert.equal((await signUp(me, 'bob@corp.example')).status, 201);
});
after(() => stack.stop());

interface AccountView {
  id: number;
  folder: string | null;
  todo: number;
}
let account: AccountView;
let todo: { id: number }[];

test('a wrong IMAP password is refused, a right one connects', async () => {
  const bad = await me('POST', '/mailboxes/imap', { ...stack.imapAccount, password: 'nope' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'mailboxes.connectionFailed');
  assert.match(bad.body.error, /^Could not connect: /);
  assert.ok(bad.body.params.detail);
  // Direct TLS asked of a port that starts in clear, as 587 does: told as what to untick, not in the words of the TLS library.
  assert.equal((await me('POST', '/mailboxes/imap', { ...stack.imapAccount, smtpSecure: true })).body.code, 'mailboxes.notDirectTls');
  assert.equal((await me('POST', '/mailboxes/imap', stack.imapAccount)).status, 201);
  const stored = (await stack.db.one<{ config_enc: string }>('SELECT config_enc FROM accounts'))?.config_enc ?? '';
  assert.ok(stored.length > 20);
  assert.ok(!stored.includes('testpass'), 'mailbox password must be encrypted at rest');
});

test('its owner chooses the folder to watch and finds its emails to handle', async () => {
  const [connected] = (await me('GET', '/mailboxes')).body;
  await watchFolder(me, connected.id, 'INBOX');
  [account] = (await me('GET', '/mailboxes')).body;
  assert.equal(account.folder, 'INBOX');
  todo = (await me('GET', '/emails?box=todo')).body.emails;
  assert.equal(todo.length, 3);
});

test('a colleague does not reach a personal mailbox', async () => {
  await join(me, eve, 'eve@corp.example');
  const [prompt] = (await me('GET', '/prompts')).body;
  assert.deepEqual((await eve('GET', '/emails?box=sent')).body.emails, []);
  assert.equal((await eve('GET', `/emails/${todo[0]!.id}`)).status, 404);
  assert.equal((await eve('POST', `/emails/${todo[0]!.id}/assist`, { action: 'prompt', promptId: prompt.id })).status, 404);
  assert.equal((await eve('POST', `/emails/${todo[0]!.id}/file-as-draft`, { html: '<p>x</p>', to: ['a@b.example'] })).status, 404);
  assert.equal((await eve('POST', `/mailboxes/${account.id}/fetch`)).status, 404);
  assert.deepEqual((await eve('GET', '/mailboxes')).body, []);
  // An address is connected once per organisation: she cannot take the mailbox over either.
  const takeover = await eve('POST', '/mailboxes/imap', stack.imapAccount);
  assert.equal(takeover.status, 409);
  assert.equal(takeover.body.code, 'mailboxes.alreadyConnected');
});

test('a mailbox is connected once', async () => {
  const again = await me('POST', '/mailboxes/imap', stack.imapAccount);
  assert.equal(again.status, 409, 'not even by its owner: renewing is another operation');
  assert.equal(again.body.code, 'mailboxes.alreadyConnected');
});

test('a refused renewal of its access leaves the access as it was', async () => {
  assert.equal((await eve('PUT', `/mailboxes/${account.id}/password`, { password: stack.imapAccount.password })).status, 404);
  assert.equal((await me('PUT', `/mailboxes/${account.id}/password`, { password: '' })).body.code, 'mailboxes.passwordRequired');
  const wrong = await me('PUT', `/mailboxes/${account.id}/password`, { password: 'nope' });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.code, 'mailboxes.connectionFailed');
  assert.equal((await me('POST', `/mailboxes/${account.id}/fetch`)).body.error, null, 'a refused renewal leaves the access as it was');
});

test('its access is renewed by the one who manages it; the mailbox stays the same', async () => {
  assert.equal((await me('PUT', `/mailboxes/${account.id}/password`, { password: stack.imapAccount.password })).status, 200);
  const [renewed] = (await me('GET', '/mailboxes')).body;
  assert.deepEqual([renewed.id, renewed.folder, renewed.todo], [account.id, account.folder, account.todo], 'the folder watched and the emails kept do not change');
  assert.equal((await me('POST', `/mailboxes/${account.id}/fetch`)).body.error, null);
});
