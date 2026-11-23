// How a reply is composed from the email it answers: its subject, its recipients, its
// references, the quoted original; and what counts as an edit of a proposal.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeReplyBody, replyRecipients, replyReferences, replySubject, wasEdited } from '../../src/domain/computations/reply.ts';
import { email } from '../support/email-from-claire.ts';

test('reply shaping', () => {
  assert.equal(replySubject('Devis'), 'Re: Devis');
  assert.equal(replySubject('RE: Devis'), 'RE: Devis');
  assert.deepEqual(replyRecipients(email, 'me@corp.example'), { to: ['claire@client.example'], cc: [] });
  assert.deepEqual(replyRecipients(email, 'me@corp.example', true), {
    to: ['claire@client.example'],
    cc: ['paul@client.example', 'lea@client.example'],
  });
  assert.deepEqual(replyRecipients({ ...email, replyTo: 'sav@client.example' }, 'me@corp.example').to, ['sav@client.example']);
  assert.deepEqual(replyReferences(email), ['<m1@client.example>', '<m2@client.example>']);
  const body = composeReplyBody('Bonjour Claire,\nVoici.', email);
  assert.match(body, /^Bonjour Claire,\nVoici\.\n\nOn November 18, 2026 at 9:30\sAM \(UTC\), Claire Martin <claire@client\.example> wrote:/);
  assert.match(composeReplyBody('Bonjour', email, 'fr'), /\n\nLe 18 novembre 2026 à 09:30 \(UTC\), Claire Martin <claire@client\.example> a écrit :/);
  assert.match(composeReplyBody('Hallo', email, 'de'), /\n\nOn November 18, 2026/, 'English for a language we have no line for');
  assert.match(body, /> Bonjour,\n> Pouvez-vous/);
  assert.match(body, />> ancien message/);
});

test('an edit is a change of words, not of whitespace', () => {
  assert.equal(wasEdited('Bonjour,\n\nOK.', 'Bonjour,\nOK. '), false);
  assert.equal(wasEdited('Bonjour, OK.', 'Salut, OK.'), true);
});
