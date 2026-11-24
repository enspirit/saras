// An email is shown as it was written, in a document that runs nothing and asks nothing of
// any host; and its files are opened from the mailbox, where they stay.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { erasePastRetention } from '../../src/domain/retention/erase-past-retention.ts';
import type { Config } from '../../src/tooling/config.ts';
import { createClient, join, signUp } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { INBOX, startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

const HTML = '<html><head><style>.big{font-size:20px}</style></head><body><p class="big" style="color:#336">Bonjour</p><script>alert(1)</script><img src="https://tracker.example/open.gif"><a href="https://client.example/devis" onclick="x()">le devis</a></body></html>';
const part = (headers: string[], content: string): string[] => ['--mix', ...headers, '', content];
/** A quote in HTML and in text, with two files: one a browser shows, one it must never open as a page of ours. */
const QUOTE = [
  'From: "Claire Martin" <claire@client.example>',
  'To: me@corp.example',
  'Subject: Le devis, en piece jointe',
  'Message-ID: <html-1@client.example>',
  `Date: ${new Date(Date.now() - 3_600_000).toUTCString()}`,
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="mix"',
  '',
  '--mix',
  'Content-Type: multipart/alternative; boundary="alt"',
  '',
  ...['--alt', 'Content-Type: text/plain; charset=utf-8', '', 'Bonjour, le devis est joint.', '--alt', 'Content-Type: text/html; charset=utf-8', '', HTML, '--alt--'],
  ...part(['Content-Type: text/plain; name="devis été.txt"', 'Content-Disposition: attachment; filename="devis.txt"', 'Content-Transfer-Encoding: base64'], Buffer.from('Total: 1200 EUR\n').toString('base64')),
  ...part(['Content-Type: text/html; name="page.html"', 'Content-Disposition: attachment; filename="page.html"'], '<script>alert(1)</script>'),
  '--mix--',
].join('\r\n');

let stack: Stack;
const me = createClient(() => stack.url);
const eve = createClient(() => stack.url);
let quote: number;
let plain: number;

before(async () => {
  stack = await startStack({ messages: [{ raw: QUOTE }, ...INBOX] });
  assert.equal((await signUp(me, 'bob@corp.example')).status, 201);
  await connectInbox(me, stack.imapAccount);
  const emails: { id: number; subject: string }[] = (await me('GET', '/emails?box=todo')).body.emails;
  quote = emails.find((email) => /piece jointe/.test(email.subject))!.id;
  plain = emails.find((email) => /Merci/.test(email.subject))!.id;
});
after(() => stack.stop());

test('an email that has HTML says so, and is read as text all the same', async () => {
  const { body } = await me('GET', `/emails/${quote}`);
  assert.deepEqual([body.hasHtml, body.hostedImagesHeld, body.attachmentsOpen], [true, true, true]);
  assert.equal(body.bodyText, 'Bonjour, le devis est joint.');
  assert.deepEqual(body.attachments.map((file: { name: string }) => file.name), ['devis.txt', 'page.html']);
  assert.ok(!('bodyHtml' in body), 'its HTML is a document of its own, not a part of this answer');
  const text = (await me('GET', `/emails/${plain}`)).body;
  assert.deepEqual([text.hasHtml, text.hostedImagesHeld, text.attachments], [false, false, []]);
  assert.equal((await me('GET', `/emails/${plain}/html`)).status, 404);
});

test('as it was written: its layout and its links, and neither its script nor the image that would tell it was opened', async () => {
  const shown = await me('GET', `/emails/${quote}/html`);
  const document = shown.raw.toString('utf8');
  assert.equal(shown.status, 200);
  assert.match(shown.headers.get('content-type') ?? '', /^text\/html/);
  assert.match(document, /<style>\.big\{font-size:20px\}<\/style>/);
  assert.match(document, /<p class="big" style="color:#336">Bonjour<\/p><img><a href="https:\/\/client\.example\/devis" target="_blank" rel="noopener noreferrer">le devis<\/a>/);
  assert.doesNotMatch(document, /alert|tracker\.example|onclick|<script/);
});

test('the document may run nothing and reach no host, whatever it holds; a page of ours frames it, and no other', async () => {
  const { headers } = await me('GET', `/emails/${quote}/html`);
  const policy = headers.get('content-security-policy') ?? '';
  for (const said of [/^sandbox allow-popups allow-popups-to-escape-sandbox;/, /default-src 'none'/, /img-src data:(;|$)/, /style-src 'unsafe-inline'/, /form-action 'none'/, /frame-ancestors 'self'/]) assert.match(policy, said);
  assert.doesNotMatch(policy, /script|allow-same-origin|https?:/);
  assert.equal(headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(headers.get('cache-control'), 'no-store');
  // Every other answer keeps the policy of the interface, which nothing frames.
  assert.equal((await me('GET', `/emails/${quote}`)).headers.get('x-frame-options'), 'DENY');
});

test('a file is read from the mailbox: shown when a browser runs nothing of it, saved otherwise', async () => {
  const text = await me('GET', `/emails/${quote}/attachments/0`);
  assert.equal(text.status, 200);
  assert.equal(text.raw.toString('utf8'), 'Total: 1200 EUR\n');
  assert.match(text.headers.get('content-type') ?? '', /^text\/plain/);
  assert.equal(text.headers.get('content-disposition'), "inline; filename*=UTF-8''devis.txt");
  assert.equal(text.headers.get('x-content-type-options'), 'nosniff');
  const page = await me('GET', `/emails/${quote}/attachments/1`);
  assert.equal(page.raw.toString('utf8').trim(), '<script>alert(1)</script>');
  assert.equal(page.headers.get('content-type'), 'application/octet-stream');
  assert.equal(page.headers.get('content-disposition'), "attachment; filename*=UTF-8''page.html");
  for (const place of ['2', '-1', 'x', '0x1']) assert.deepEqual([(await me('GET', `/emails/${quote}/attachments/${place}`)).status, place], [404, place]);
  assert.equal((await me('GET', `/emails/${quote}/attachments/7`)).body.code, 'emails.attachmentNotFound');
});

test('a colleague who does not use the mailbox sees neither the document nor a file', async () => {
  await join(me, eve, 'eve@corp.example');
  assert.equal((await eve('GET', `/emails/${quote}/html`)).status, 404);
  assert.equal((await eve('GET', `/emails/${quote}/attachments/0`)).status, 404);
});

test('past its retention, the HTML is erased with the text, and its files are no longer read from the mailbox', async () => {
  await stack.db.run(`UPDATE emails SET date = now() - interval '31 days' WHERE id = $1`, [quote]);
  assert.equal((await me('GET', `/emails/${quote}`)).body.attachmentsOpen, false);
  const file = await me('GET', `/emails/${quote}/attachments/0`);
  assert.deepEqual([file.status, file.body.code], [410, 'emails.contentErased']);
  await erasePastRetention({ db: stack.db, config: { retentionDays: 30 } as Config });
  const { body } = await me('GET', `/emails/${quote}`);
  assert.deepEqual([body.hasHtml, body.bodyText], [false, '']);
  assert.equal((await me('GET', `/emails/${quote}/html`)).status, 404);
});
