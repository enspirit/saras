// Reading a Microsoft message, and placing a reply above the original it quotes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { graphToEmail, injectReplyHtml } from '../../src/tooling/mail/graph/message.ts';

test('Microsoft Graph message mapping and reply injection', () => {
  const mapped = graphToEmail({
    id: 'AAA',
    internetMessageId: '<x@client.example>',
    conversationId: 'c1',
    subject: 'Devis',
    receivedDateTime: '2026-11-18T09:30:00Z',
    from: { emailAddress: { name: 'Claire', address: 'Claire@client.example' } },
    toRecipients: [{ emailAddress: { address: 'me@corp.example' } }],
    body: { contentType: 'text', content: 'Bonjour\r\n' },
    internetMessageHeaders: [{ name: 'Auto-Submitted', value: 'auto-generated' }],
  });
  assert.equal(mapped.fromAddr, 'claire@client.example');
  assert.equal(mapped.bodyText, 'Bonjour');
  assert.equal(mapped.headers.autoSubmitted, 'auto-generated');
  assert.equal(
    injectReplyHtml('<html><body dir="ltr"><hr>original</body></html>', '<p>A <strong>B</strong></p>'),
    '<html><body dir="ltr"><div><p>A <strong>B</strong></p></div><br><hr>original</body></html>',
  );
});
