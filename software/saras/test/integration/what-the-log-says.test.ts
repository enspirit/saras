// What the server logs of connecting a mailbox, fetching it and sending a reply: enough to
// follow a request to the mail server and back — and nothing of who signs in, with what, or
// of the mail. Read at the level that says everything.
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import type { Socket } from 'node:net';
import { after, before, test } from 'node:test';
import { startLogging } from '../../src/tooling/log.ts';
import { createClient, signUp } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { closed, listen } from '../support/listen.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

interface Line {
  time: string;
  level: string;
  msg: string;
  [field: string]: unknown;
}

let stack: Stack;
const me = createClient(() => stack.url);
const written: string[] = [];
const lines = (): Line[] => written.map((line) => JSON.parse(line) as Line);
const saying = (msg: string | RegExp): Line[] => lines().filter((line) => (typeof msg === 'string' ? line.msg === msg : msg.test(line.msg)));
/** The lines written while something is done. */
async function during(what: () => Promise<unknown>): Promise<Line[]> {
  const from = written.length;
  await what();
  return written.slice(from).map((line) => JSON.parse(line) as Line);
}

before(async () => {
  startLogging('debug', (line) => written.push(line));
  stack = await startStack();
  assert.equal((await signUp(me, 'bob@corp.example')).status, 201);
});
after(() => stack.stop());

test('a mailbox that does not let us in: the request, the server asked and its answer, under one id', async () => {
  const logged = await during(() => me('POST', '/mailboxes/imap', { ...stack.imapAccount, password: 'not-the-password' }));
  const refused = logged.find((line) => line.msg === 'imap: not signed in');
  assert.ok(refused, 'the failure is logged');
  assert.equal(refused.level, 'warn');
  assert.equal(refused.host, '127.0.0.1');
  assert.equal(refused.port, stack.imapAccount.imapPort);
  assert.deepEqual(refused.resolves, ['127.0.0.1']);
  assert.equal(typeof refused.ms, 'number');
  assert.ok(refused.error, 'with what the server answered');
  const answered = logged.find((line) => line.msg === 'request answered');
  assert.deepEqual({ method: answered?.method, route: answered?.route, status: answered?.status }, { method: 'POST', route: '/api/mailboxes/imap', status: 400 });
  assert.ok(answered?.req);
  assert.equal(refused.req, answered.req);
  assert.ok(logged.some((line) => line.msg === 'imap: received' && line.req === answered.req), 'the handshake is logged for whoever asks for everything');
});

test('a mailbox connected, fetched and replied from: each server signed in at, each step timed', async () => {
  const logged = await during(async () => {
    const id = await connectInbox(me, stack.imapAccount);
    const [email] = (await me('GET', '/emails?box=todo')).body.emails;
    assert.equal((await me('POST', `/emails/${email.id}/send`, { html: '<p>REPONSE-SECRETE</p>', to: ['claire@client.example'] })).status, 200);
    assert.equal(stack.outbox.length, 1);
    return id;
  });
  for (const kind of ['imap', 'smtp']) assert.ok(logged.some((line) => line.msg === `${kind}: signed in` && line.level === 'info' && typeof line.ms === 'number'), kind);
  const fetched = logged.find((line) => line.msg === 'mailbox fetched');
  assert.equal(fetched?.fetched, 4);
  assert.equal(typeof fetched?.mailbox, 'number');
  assert.ok(logged.some((line) => line.msg === 'smtp: sent' && /^EHLO /.test(String(line.line))), 'the SMTP handshake is logged');
});

test('every line is one JSON object, with its time, its level and its message first', () => {
  assert.ok(written.length > 20);
  for (const line of written) {
    assert.deepEqual(Object.keys(JSON.parse(line)).slice(0, 3), ['time', 'level', 'msg'], line);
    assert.doesNotMatch(line, /\n/);
  }
  assert.ok(lines().every((line) => ['debug', 'info', 'warn', 'error'].includes(line.level) && !Number.isNaN(Date.parse(line.time))));
});

// Everything that was typed, sent or received above, and that a log is no place for.
const NEVER_LOGGED = [
  ['the password of the mailbox', /testpass|dGVzdHBhc3M|not-the-password/],
  // As it is, and as base64 carries it alone or after the empty identity of SASL PLAIN.
  ['who signs in at the mail servers', /testuser|dGVzdHVzZXI|AHRlc3R1c2Vy/],
  ['the address of the mailbox', /me@corp\.example/],
  ['the member', /bob@corp\.example|un-bon-mot-de-passe/],
  ['a correspondent', /claire@client\.example|Claire Martin|media\.example|partner\.example/],
  ['a mail received', /Demande de devis|20 licences|CONTENU-NEWSLETTER|Merci pour/],
  ['the reply', /REPONSE-SECRETE/],
  ['a folder', /INBOX|Drafts/],
  ['a session', /saras[._-]?(sid|session)=|set-cookie/i],
] as const;

test('no line holds a password, who signs in, an address, a folder or anything of a mail', () => {
  for (const [what, pattern] of NEVER_LOGGED) {
    assert.deepEqual(written.filter((line) => pattern.test(line)), [], what);
  }
  // Past the handshake, nothing of the protocol: no folder was selected, no mail given, as far as the log tells.
  assert.deepEqual(saying(/^(imap|smtp): (sent|received)$/).filter((line) => /SELECT|FETCH|SEARCH|APPEND|MAIL FROM|RCPT TO|DATA/i.test(String(line.line))), []);
});

test('the id a gateway gave a request is the one its lines carry, and the answer says it back', async () => {
  const res = await fetch(`${stack.url}/api/public`, { headers: { 'x-request-id': 'gateway-1234' } });
  assert.equal(res.headers.get('x-request-id'), 'gateway-1234');
  await res.arrayBuffer();
  assert.ok(lines().some((line) => line.msg === 'request answered' && line.req === 'gateway-1234' && line.route === '/api/public'));
  const forged = await fetch(`${stack.url}/api/public`, { headers: { 'x-request-id': 'x'.repeat(200) } });
  assert.match(forged.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
});

/** Asks to connect a mailbox whose incoming server is on this port, as a caller that waits 300 ms and leaves. */
async function askedThenLeft(imapPort: number): Promise<void> {
  const asked = fetch(`${stack.url}/api/mailboxes/imap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: await sessionOf(), 'x-request-id': 'gave-up' },
    body: JSON.stringify({ ...stack.imapAccount, email: 'other@corp.example', imapPort }),
    signal: AbortSignal.timeout(300),
  });
  await assert.rejects(asked);
}

test('a request whose caller gave up, as a gateway does on a server that answers nothing: said as left unanswered', async () => {
  // A mail server that accepts the connection and never greets.
  const held: Socket[] = [];
  const mute = createServer((socket) => held.push(socket));
  await askedThenLeft(await listen(mute));
  await until(() => saying(/^request left unanswered/).length > 0);
  const [left] = saying(/^request left unanswered/);
  assert.deepEqual({ level: left?.level, req: left?.req, route: left?.route }, { level: 'warn', req: 'gave-up', route: '/api/mailboxes/imap' });
  // The mail server goes away: what the server was doing ends, and says so under the same id.
  for (const socket of held) socket.destroy();
  await closed(mute);
  await until(() => saying('imap: not signed in').some((line) => line.req === 'gave-up'));
});

/** A session of its own for a request made by hand. */
async function sessionOf(): Promise<string> {
  const res = await fetch(`${stack.url}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'bob@corp.example', password: 'un-bon-mot-de-passe' }) });
  assert.equal(res.status, 200);
  return res.headers.getSetCookie().map((set) => set.split(';')[0]).join('; ');
}

async function until(seen: () => boolean): Promise<void> {
  for (let tries = 0; tries < 100 && !seen(); tries++) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(seen());
}
