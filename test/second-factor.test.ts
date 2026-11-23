// The second factor: where the installation requires one, nobody gets a session on a password alone.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { authenticatorUri, base32, codeAt, codeGiven, fromBase32, stepAt, stepMatching, withoutRecoveryCode } from '../src/domain/computations/second-factor.ts';
import { createClient } from './support/client.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

test('the code of a moment is the one authenticator apps compute (RFC 6238)', () => {
  const secret = base32(Buffer.from('12345678901234567890'));
  assert.equal(secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.equal(fromBase32(secret).toString(), '12345678901234567890');
  assert.equal(codeAt(secret, stepAt(59_000)), '287082');
  assert.equal(codeAt(secret, stepAt(1_111_111_109_000)), '081804');
  assert.equal(codeAt(secret, stepAt(20_000_000_000_000)), '353130');
});

test('a code is good around its moment, and once', () => {
  const secret = base32(Buffer.from('12345678901234567890'));
  const now = 1_700_000_000_000;
  const step = stepAt(now);
  assert.equal(stepMatching(secret, codeAt(secret, step), now, 0), step);
  assert.equal(stepMatching(secret, codeAt(secret, step - 1), now, 0), step - 1, 'a clock half a minute late');
  assert.equal(stepMatching(secret, codeAt(secret, step + 1), now, 0), step + 1);
  assert.equal(stepMatching(secret, codeAt(secret, step - 2), now, 0), null, 'a minute late is too late');
  assert.equal(stepMatching(secret, codeAt(secret, step), now, step), null, 'the same code a second time');
  assert.equal(stepMatching(secret, '000000', now, 0) === null || codeAt(secret, step) === '000000', true);
});

test('what is typed is read without spaces or dashes; a recovery code is spent by its use', () => {
  assert.equal(codeGiven(' 123 456 '), '123456');
  assert.equal(codeGiven('AB12C-3de45'), 'ab12c3de45');
  assert.deepEqual(withoutRecoveryCode(['a', 'b', 'c'], 'b'), ['a', 'c']);
  assert.equal(withoutRecoveryCode(['a', 'b'], 'x'), null);
  assert.match(authenticatorUri('saras', 'alex@acme.example', 'ABC'), /^otpauth:\/\/totp\/saras%3Aalex%40acme\.example\?secret=ABC&issuer=saras/);
});

let stack: Stack;
before(async () => (stack = await startStack({ env: { MFA_ENABLED: 'true' } })));
after(() => stack.stop());

const client = () => createClient(() => stack.url);
const alice = client();
const password = 'un-bon-mot-de-passe';
let secret: string;
let recoveryCodes: string[];
const codeNow = (): string => codeAt(secret, stepAt(Date.now()));

test('creating the organisation does not sign in: a second factor is to set up first', async () => {
  const signedUp = await alice('POST', '/auth/signup', { email: 'alice@acme.example', password, organization: 'Acme' });
  assert.equal(signedUp.status, 201);
  assert.equal(signedUp.body.secondFactor.step, 'enrol');
  assert.match(signedUp.body.secondFactor.uri, /^otpauth:\/\/totp\//);
  secret = signedUp.body.secondFactor.secret;
  assert.equal((await alice('GET', '/me')).status, 401, 'no session on a password alone');
});

test('a wrong code is refused; the right one sets the second factor up, signs in and gives recovery codes once', async () => {
  const wrong = await alice('POST', '/auth/second-factor', { code: codeNow() === '000000' ? '111111' : '000000' });
  assert.deepEqual([wrong.status, wrong.body.code], [401, 'auth.wrongCode']);
  assert.equal((await alice('GET', '/me')).status, 401);
  const right = await alice('POST', '/auth/second-factor', { code: codeNow() });
  assert.equal(right.status, 200);
  recoveryCodes = right.body.recoveryCodes;
  assert.equal(recoveryCodes.length, 8);
  assert.equal((await alice('GET', '/me')).status, 200);
  const kept = await stack.db.one<{ totp_secret_enc: string; recovery_codes_json: string }>('SELECT totp_secret_enc, recovery_codes_json FROM users');
  assert.ok(!kept!.totp_secret_enc.includes(secret), 'the secret is sealed');
  assert.ok(!kept!.recovery_codes_json.includes(recoveryCodes[0]!.replace('-', '')), 'only hashes of the recovery codes are kept');
});

test('signing in then asks for a code; the one just used is not good twice, a recovery code is, once', async () => {
  await alice('POST', '/auth/logout');
  const asked = await alice('POST', '/auth/login', { email: 'alice@acme.example', password });
  assert.deepEqual(asked.body.secondFactor, { step: 'code' }, 'the secret is not told again');
  assert.equal((await alice('GET', '/me')).status, 401);
  assert.equal((await alice('POST', '/auth/second-factor', { code: codeAt(secret, stepAt(Date.now()) - 1) })).body.code, 'auth.wrongCode', 'a code at or before the last one accepted');
  assert.equal((await alice('POST', '/auth/second-factor', { code: recoveryCodes[0] })).status, 200);
  assert.equal((await alice('GET', '/me')).status, 200);
  await alice('POST', '/auth/logout');
  await alice('POST', '/auth/login', { email: 'alice@acme.example', password });
  assert.equal((await alice('POST', '/auth/second-factor', { code: recoveryCodes[0] })).body.code, 'auth.wrongCode', 'a recovery code is spent by its use');
  assert.equal((await alice('POST', '/auth/second-factor', { code: recoveryCodes[1] })).status, 200);
});

test('a code without a sign-in in progress opens nothing', async () => {
  const nobody = await client()('POST', '/auth/second-factor', { code: '123456' });
  assert.deepEqual([nobody.status, nobody.body.code], [410, 'auth.signInExpired']);
});

test('an invited member sets theirs up too; an administrator can take it away, and they set a new one up', async () => {
  const bruno = client();
  const invitation = await alice('POST', '/invitations', { email: 'bruno@acme.example', role: 'user' });
  const token = String(invitation.body.link).split('#/invitation/')[1];
  const accepted = await bruno('POST', '/invitations/accept', { token, password });
  const first = accepted.body.secondFactor.secret;
  assert.equal((await bruno('POST', '/auth/second-factor', { code: codeAt(first, stepAt(Date.now())) })).status, 200);
  const [, listed] = (await alice('GET', '/members')).body;
  assert.equal(listed.secondFactor, true);
  assert.equal((await bruno('DELETE', `/members/${listed.id}/second-factor`)).status, 403);
  assert.equal((await alice('DELETE', `/members/${listed.id}/second-factor`)).status, 200);
  assert.equal((await bruno('GET', '/me')).status, 401, 'their sessions are closed');
  const again = await bruno('POST', '/auth/login', { email: 'bruno@acme.example', password });
  assert.equal(again.body.secondFactor.step, 'enrol');
  assert.notEqual(again.body.secondFactor.secret, first);
});
