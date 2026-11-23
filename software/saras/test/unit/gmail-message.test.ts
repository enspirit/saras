// Reading a Gmail message: who wrote to whom, the plain text among its parts, its headers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gmailToEmail } from '../../src/tooling/mail/gmail/message.ts';
import { parseAddress } from '../../src/tooling/text.ts';

const b64 = (s: string) => Buffer.from(s).toString('base64url');

/** A message as the Gmail API returns it: HTML first, the plain text second. */
const message = {
  id: 'g1',
  threadId: 't1',
  internalDate: '1795000000000',
  payload: {
    mimeType: 'multipart/alternative',
    headers: [
      { name: 'From', value: '"Martin, Claire" <claire@client.example>' },
      { name: 'To', value: 'me@corp.example, "Durand, Paul" <paul@client.example>' },
      { name: 'Subject', value: 'Devis' },
      { name: 'Message-ID', value: '<g@client.example>' },
      { name: 'List-Unsubscribe', value: '<mailto:u@x>' },
    ],
    parts: [
      { mimeType: 'text/html', body: { data: b64('<p>HTML</p>') } },
      { mimeType: 'text/plain', body: { data: b64('Texte brut é') } },
    ],
  },
};

test('Gmail message mapping', () => {
  const mapped = gmailToEmail(message);
  assert.equal(mapped.fromAddr, 'claire@client.example');
  assert.deepEqual(mapped.to.map((a) => a.address), ['me@corp.example', 'paul@client.example']);
  assert.equal(mapped.bodyText, 'Texte brut é');
  assert.equal(mapped.threadId, 't1');
  assert.ok(mapped.headers.listUnsubscribe);
});

test('a correspondent is read as a name and an address, the address in lower case', () => {
  assert.deepEqual(parseAddress('"Martin, Claire" <Claire@X.example>'), { name: 'Martin, Claire', address: 'claire@x.example' });
  assert.deepEqual(parseAddress('a@b.example'), { name: '', address: 'a@b.example' });
});
