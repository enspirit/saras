// What is kept secret at rest: the credentials of mailboxes and the keys are sealed, the
// passwords of members are hashed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVault, hashPassword, verifyPassword } from '../../src/tooling/crypto.ts';

test('vault round-trips and rejects another key or tampering', () => {
  const vault = createVault('a'.repeat(32));
  const sealed = vault.seal({ pass: 's3cret' });
  assert.ok(!sealed.includes('s3cret'));
  assert.deepEqual(vault.open(sealed), { pass: 's3cret' });
  assert.throws(() => createVault('b'.repeat(32)).open(sealed));
  const tampered = Buffer.from(sealed, 'base64');
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => vault.open(tampered.toString('base64')));
});

test('passwords', () => {
  const hash = hashPassword('correct horse');
  assert.ok(verifyPassword('correct horse', hash));
  assert.ok(!verifyPassword('wrong', hash));
  assert.ok(!verifyPassword('x', 'garbage'));
});
