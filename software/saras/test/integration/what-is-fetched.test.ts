// What is fetched from a mailbox is chosen with its folder: how far back, and whether only
// what has not been read yet.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { daysFetched, whatIsFetchedGiven } from '../../src/domain/computations/mailboxes.ts';
import { createClient, signUp } from '../support/client.ts';
import { connectMailbox } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

const DAY = 86_400_000;
const mail = (subject: string, daysAgo: number): string =>
  [`From: "Hugo Petit" <hugo@client.example>`, 'To: me@corp.example', `Subject: ${subject}`, `Message-ID: <${subject.replaceAll(' ', '-')}@client.example>`, `Date: ${new Date(Date.now() - daysAgo * DAY).toUTCString()}`, '', 'Bonjour.'].join('\r\n');
/** A message as the mailbox holds it: received when it says, read or not. */
const held = (subject: string, daysAgo: number, read = false) => ({ raw: mail(subject, daysAgo), internaldate: new Date(Date.now() - daysAgo * DAY), flags: read ? ['\\Seen'] : [] });

test('how far back is one of the spans offered, else left to the server; never further than what the server keeps', () => {
  assert.deepEqual(whatIsFetchedGiven({ days: 14, unreadOnly: true }), { days: 14, unreadOnly: true });
  assert.deepEqual(whatIsFetchedGiven({ days: '30' }), { days: 30, unreadOnly: false });
  assert.deepEqual(whatIsFetchedGiven({ days: 365, unreadOnly: 'yes' }), { days: null, unreadOnly: false });
  assert.equal(daysFetched(null, { syncDays: 7, retentionDays: 30 }), 7);
  assert.equal(daysFetched(30, { syncDays: 7, retentionDays: 10 }), 10);
});

let stack: Stack;
const me = createClient(() => stack.url);
let id: number;
const subjects = async (): Promise<string[]> => (await me('GET', '/emails?box=todo')).body.emails.map((e: { subject: string }) => e.subject).sort();

before(async () => {
  stack = await startStack({ folders: { Clients: [held('Today unread', 0), held('Today read', 0, true), held('Ten days ago', 10), held('Twenty days ago read', 20, true)] } });
  await signUp(me, 'bob@corp.example');
  id = await connectMailbox(me, stack.imapAccount);
});
after(() => stack.stop());

test('a mailbox says how far back it is fetched: what the server is set up for, until one chooses', async () => {
  const [mailbox] = (await me('GET', '/mailboxes')).body;
  assert.deepEqual([mailbox.fetchDays, mailbox.unreadOnly], [7, false]);
});

test('unread only, one day back: what was read in the mailbox, and what is older, is left there', async () => {
  assert.equal((await me('PUT', `/mailboxes/${id}/folder`, { folder: 'Clients', days: 1, unreadOnly: true })).status, 200);
  await me('POST', `/mailboxes/${id}/fetch`);
  assert.deepEqual(await subjects(), ['Today unread']);
  const [mailbox] = (await me('GET', '/mailboxes')).body;
  assert.deepEqual([mailbox.fetchDays, mailbox.unreadOnly], [1, true]);
});

test('further back, read or not: the rest comes in, and what was already here stays', async () => {
  assert.equal((await me('PUT', `/mailboxes/${id}/folder`, { folder: 'Clients', days: 14, unreadOnly: false })).status, 200);
  await me('POST', `/mailboxes/${id}/fetch`);
  assert.deepEqual(await subjects(), ['Ten days ago', 'Today read', 'Today unread']);
  await me('PUT', `/mailboxes/${id}/folder`, { folder: 'Clients', days: 30 });
  await me('POST', `/mailboxes/${id}/fetch`);
  assert.deepEqual(await subjects(), ['Ten days ago', 'Today read', 'Today unread', 'Twenty days ago read']);
});

test('who manages a mailbox reads its servers, never its password, and changes the name its replies show', async () => {
  const servers = (await me('GET', `/mailboxes/${id}/servers`)).body;
  assert.deepEqual(servers, { imapHost: '127.0.0.1', imapPort: stack.imapAccount.imapPort, imapSecure: false, smtpHost: '127.0.0.1', smtpPort: stack.imapAccount.smtpPort, smtpSecure: false, username: 'testuser' });
  assert.equal((await me('PUT', `/mailboxes/${id}/name`, { displayName: '  Bob, Corp  ' })).status, 200);
  assert.equal((await me('GET', '/mailboxes')).body[0].displayName, 'Bob, Corp');
});

test('its servers are changed only once the mailbox was seen to answer there; an empty password keeps the one it has', async () => {
  const servers = (await me('GET', `/mailboxes/${id}/servers`)).body;
  const wrong = await me('PUT', `/mailboxes/${id}/servers`, { ...servers, imapPort: 1, password: '' });
  assert.deepEqual([wrong.status, wrong.body.code], [400, 'mailboxes.connectionFailed']);
  assert.equal((await me('PUT', `/mailboxes/${id}/servers`, { ...servers, imapHost: '' })).body.code, 'mailboxes.serversRequired');
  assert.equal((await me('PUT', `/mailboxes/${id}/servers`, { ...servers, password: 'not-the-password' })).body.code, 'mailboxes.connectionFailed');
  assert.equal((await me('PUT', `/mailboxes/${id}/servers`, { ...servers, username: 'testuser', password: '' })).status, 200, 'the password it had still works');
  assert.deepEqual((await me('GET', `/mailboxes/${id}/servers`)).body, servers);
  const fetched = await me('POST', `/mailboxes/${id}/fetch`);
  assert.equal(fetched.body.error ?? null, null);
});

test('a member who does not manage the mailbox neither reads nor changes any of it', async () => {
  const other = createClient(() => stack.url);
  await signUp(other, 'eve@other.example');
  assert.equal((await other('GET', `/mailboxes/${id}/servers`)).status, 404);
  assert.equal((await other('PUT', `/mailboxes/${id}/name`, { displayName: 'Eve' })).status, 404);
  assert.equal((await other('PUT', `/mailboxes/${id}/servers`, {})).status, 404);
});
