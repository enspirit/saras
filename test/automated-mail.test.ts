// Sorting by rules: plainly automated mail is set aside from its headers alone, before anyone
// or anything else looks at it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heuristicTriage } from '../src/domain/sorting/rules.ts';
import { email } from './support/email-from-claire.ts';

test('header rules set automated mail aside before any triage gate', () => {
  const own = 'me@corp.example';
  assert.equal(heuristicTriage(email, own), null);
  assert.equal(heuristicTriage({ ...email, fromAddr: 'no-reply@shop.example' }, own)?.status, 'no_reply');
  assert.equal(heuristicTriage({ ...email, fromAddr: 'notifications@github.example' }, own)?.status, 'no_reply');
  assert.equal(heuristicTriage({ ...email, headers: { listUnsubscribe: '<mailto:x>' } }, own)?.status, 'no_reply');
  assert.equal(heuristicTriage({ ...email, headers: { autoSubmitted: 'auto-replied' } }, own)?.status, 'no_reply');
  assert.equal(heuristicTriage({ ...email, headers: { autoSubmitted: 'no' } }, own), null);
  assert.equal(heuristicTriage({ ...email, fromAddr: 'ME@corp.example' }, own)?.status, 'no_reply');
  assert.equal(heuristicTriage({ ...email, answered: true }, own)?.status, 'no_reply');
  // "reply" inside a normal name must not match
  assert.equal(heuristicTriage({ ...email, fromAddr: 'replyman@corp.example' }, own), null);
});
