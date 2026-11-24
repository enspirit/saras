// The log: what a line is, what it may not hold, and how much of a conversation with a mail
// server it may repeat.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { about, log, startLogging } from '../../src/tooling/log.ts';
import { handshake } from '../../src/tooling/mail/log/handshake.ts';
import { imapLogger } from '../../src/tooling/mail/log/imap.ts';
import { smtpLogger } from '../../src/tooling/mail/log/smtp.ts';
import { HIDDEN, hiding, redacted } from '../../src/tooling/redaction.ts';

const REDACTED: [string, unknown, unknown][] = [
  ['a text is kept', 'imap.example.com', 'imap.example.com'],
  ['numbers, booleans and null are kept', { ms: 12, secure: true, folder: null }, { ms: 12, secure: true, folder: null }],
  ['what is named as a secret is hidden, whatever it holds', { password: 'p', pass: 'p', apiKey: 'k', Authorization: 'Bearer x', 'set-cookie': ['sid=1'], refreshToken: 't', appSecret: 's' }, { password: HIDDEN, pass: HIDDEN, apiKey: HIDDEN, Authorization: HIDDEN, 'set-cookie': HIDDEN, refreshToken: HIDDEN, appSecret: HIDDEN }],
  ['and however deep it is', { smtp: { host: 'h', auth: { user: 'u', pass: 'p' } } }, { smtp: { host: 'h', auth: { user: 'u', pass: HIDDEN } } }],
  ['what is not a secret is not hidden for looking like one', { secure: true, authorized: true, port: 993 }, { secure: true, authorized: true, port: 993 }],
  ['a URL loses who signs in at it', 'connect to smtps://saras:s3cret@smtp.example.com:465 failed', `connect to smtps://${HIDDEN}@smtp.example.com:465 failed`],
  ['a database URL too, inside an error', new Error('no route to postgres://saras:pw@db:5432/saras'), `no route to postgres://${HIDDEN}@db:5432/saras`],
  ['an error is its message, the server’s answer first', Object.assign(new Error('Command failed'), { responseText: 'Mailbox is full' }), 'Mailbox is full'],
  ['an address is taken out of a text, whoever it is', 'Invalid login for bob@corp.example. Recipient <claire.martin+devis@client.example> refused', 'Invalid login for [address]. Recipient <[address]> refused'],
  ['what only looks like one is left', 'at node_modules/imapflow@1.7.8/lib and saras@10.0.0.4 on scp user@host:', 'at node_modules/imapflow@1.7.8/lib and saras@10.0.0.4 on scp user@host:'],
  ['a date is said in ISO', new Date('2026-01-02T03:04:05Z'), '2026-01-02T03:04:05.000Z'],
  ['bytes are counted, not shown', { raw: Buffer.from('Subject: secret') }, { raw: '[15 bytes]' }],
  ['a function is left out', { run: () => 1, ms: 1 }, { ms: 1 }],
  ['what is too deep is not followed', { a: { b: { c: { d: { e: 1 } } } } }, { a: { b: { c: { d: '[deeper]' } } } }],
];

test('what a log line may hold of what it is given', () => {
  for (const [what, given, held] of REDACTED) assert.deepEqual(JSON.parse(JSON.stringify(redacted(given))), held, what);
});

test('a text long enough to be a mail is cut, and says how long it was', () => {
  const cut = String(redacted('x'.repeat(5000)));
  assert.ok(cut.length < 2100);
  assert.match(cut, /… \(5000 characters\)$/);
});

test('a value known to be secret is hidden wherever a text holds it: as it is, between JSON quotes, in base64', () => {
  const hide = hiding(['bob', 'p"ss\\word', '']);
  assert.equal(hide('LOGIN "bob" ok'), `LOGIN "${HIDDEN}" ok`);
  assert.equal(hide(`said ${JSON.stringify('p"ss\\word')}`), `said "${HIDDEN}"`);
  assert.equal(hide(Buffer.from('bob').toString('base64')), HIDDEN);
  assert.equal(hide('nothing of it here'), 'nothing of it here');
});

/** The lines the logger writes while something is done, at a level. */
function written(level: 'debug' | 'info', what: () => void): Record<string, unknown>[] {
  const lines: string[] = [];
  startLogging(level, (line) => lines.push(line));
  what();
  return lines.map((line) => JSON.parse(line));
}

test('a line is one JSON object: its time, its level, its message, what surrounds it, then what it is about', () => {
  const [line, ...others] = written('info', () => {
    about({ req: 'r1' }, () => about({ mailbox: 7 }, () => log.warn('not signed in', { host: 'h', pass: 'p', level: 'forged', time: 'forged' })));
    log.debug('too much for this level');
  });
  assert.deepEqual(others, []);
  assert.deepEqual(Object.keys(line ?? {}), ['time', 'level', 'msg', 'req', 'mailbox', 'host', 'pass']);
  assert.deepEqual({ ...line, time: null }, { time: null, level: 'warn', msg: 'not signed in', req: 'r1', mailbox: 7, host: 'h', pass: HIDDEN });
  assert.ok(!Number.isNaN(Date.parse(String(line?.time))));
});

test('logging never fails what it tells of', () => {
  startLogging('info', () => {
    throw new Error('the output is closed');
  });
  assert.doesNotThrow(() => log.info('still running'));
});

// The handshake: what is said before any folder, correspondent or mail is.
const IMAP = /^\S+ (CAPABILITY|LOGIN)\b/i;

test('the handshake of a conversation is repeated, and nothing after the first command past it', () => {
  const shake = handshake(IMAP, hiding(['bob']));
  assert.equal(shake.server('* OK ready'), '* OK ready');
  assert.equal(shake.client('1 LOGIN "bob" "(hidden)"', false), `1 LOGIN "${HIDDEN}" "(hidden)"`);
  assert.equal(shake.client('Ym9i', true), null, 'what answers a challenge is not logged');
  assert.equal(shake.server('1 OK welcome bob'), `1 OK welcome ${HIDDEN}`, 'and ends nothing');
  assert.equal(shake.over(), false);
  assert.equal(shake.client('2 SELECT "Clients/Dupont"', false), null);
  assert.equal(shake.server('* 3 FETCH (ENVELOPE ("Devis" …))'), null);
  assert.equal(shake.client('3 CAPABILITY', false), null, 'for good: a later command of the handshake does not open it again');
  assert.equal(shake.over(), true);
});

const SERVER = { host: 'mail.example.com', port: 465, secure: true, user: 'bob@corp.example', pass: 'hunter2' };
const sasl = Buffer.from('\0bob@corp.example\0hunter2').toString('base64');

/** A reply sent, as the SMTP library tells it to its logger. */
function replySent(): void {
  const smtp = smtpLogger(SERVER);
  smtp.info({ tnx: 'network' }, '%s established to %s:%s', 'Secure connection', '192.0.2.1', 465);
  smtp.debug({ tnx: 'client' }, 'EHLO saras');
  smtp.debug({ tnx: 'client' }, `AUTH PLAIN ${sasl}`);
  smtp.debug({ tnx: 'client' }, Buffer.from('bob@corp.example').toString('base64'));
  smtp.info({ tnx: 'smtp' }, 'User %s authenticated', '"bob@corp.example"');
  smtp.debug({ tnx: 'client' }, 'MAIL FROM:<bob@corp.example>');
  smtp.debug({ tnx: 'server' }, '250 Accepted');
  smtp.debug({ tnx: 'client' }, 'RCPT TO:<claire@client.example>');
  smtp.info({ tnx: 'send' }, 'Sending message %s to <%s>', '<id>', 'claire@client.example');
  smtp.debug({ tnx: 'message' }, 'Subject: Devis');
  smtp.error({ tnx: 'smtp', err: Object.assign(new Error('550 <claire@client.example> unknown'), { code: 'EENVELOPE' }) }, '%s', '550 <claire@client.example> unknown');
}

test('of an SMTP conversation: the handshake without who signs in, then neither a correspondent nor the mail', () => {
  const lines = written('debug', replySent);
  assert.deepEqual(lines.map((line) => [line.level, line.msg, line.line ?? line.code]), [
    ['info', 'smtp: Secure connection established to 192.0.2.1:465', undefined],
    ['debug', 'smtp: sent', 'EHLO saras'],
    ['debug', 'smtp: sent', `AUTH PLAIN ${HIDDEN}`],
    ['info', `smtp: User "${HIDDEN}" authenticated`, undefined],
    ['warn', 'smtp: failed', 'EENVELOPE'],
  ]);
  assert.doesNotMatch(JSON.stringify(lines), /bob@|claire|hunter2|Devis/);
});

test('of an IMAP conversation: the same, and what the library tells of the connection but not `user`', () => {
  const lines = written('debug', () => {
    const imap = imapLogger(SERVER);
    imap.info({ src: 'tls', msg: 'Established TLS session', cid: 'c1', authorized: true, version: 'TLSv1.3' });
    imap.debug({ src: 'c', msg: '1 LOGIN "bob@corp.example" "(* value hidden *)"', cid: 'c1' });
    imap.error({ err: Object.assign(new Error('Command failed'), { responseText: 'Invalid credentials for bob@corp.example', authenticationFailed: true }), cid: 'c1' });
    imap.info({ src: 'auth', msg: 'User authenticated', cid: 'c1', user: 'bob@corp.example' });
    imap.debug({ src: 'c', msg: '2 SELECT "Clients"', cid: 'c1' });
    imap.debug({ src: 's', msg: '* 1 FETCH (ENVELOPE ("Devis"))', cid: 'c1' });
    imap.warn({ msg: 'Partial FETCH response', err: new Error('no such folder Clients'), cid: 'c1' });
  });
  assert.deepEqual(lines.map(({ time: _time, host: _host, port: _port, ...rest }) => rest), [
    { level: 'info', msg: 'imap: Established TLS session', conn: 'c1', authorized: true, version: 'TLSv1.3' },
    { level: 'debug', msg: 'imap: sent', line: `1 LOGIN "${HIDDEN}" "(* value hidden *)"` },
    { level: 'warn', msg: 'imap: failed', conn: 'c1', authenticationFailed: true, error: `Invalid credentials for ${HIDDEN}` },
    { level: 'info', msg: 'imap: User authenticated', conn: 'c1' },
    { level: 'warn', msg: 'imap: failed', conn: 'c1' },
  ]);
});

test('the server says nothing but through its log: no `console` in its sources', () => {
  const sources = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'src/*.ts'], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(sources.filter((path) => /\bconsole\.\w+\(/.test(readFileSync(path, 'utf8'))), []);
});
