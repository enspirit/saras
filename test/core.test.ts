import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVault, hashPassword, verifyPassword } from '../src/tooling/crypto.ts';
import { buildChatRequest, explainError, PRIVACY } from '../src/tooling/llm/openrouter.ts';
import { buildPromptMessages, buildStyleMessages, buildTyposMessages } from '../src/domain/computations/llm-prompts.ts';
import { gmailToEmail } from '../src/tooling/mail/gmail.ts';
import { graphToEmail, injectReplyHtml } from '../src/tooling/mail/graph.ts';
import { authorizationUrl } from '../src/tooling/mail/oauth.ts';
import { composeReplyBody, replyRecipients, replyReferences, replySubject, wasEdited } from '../src/domain/computations/reply.ts';
import { htmlToText, parseAddress } from '../src/tooling/text.ts';
import { heuristicTriage } from '../src/domain/sorting/rules.ts';

const email = {
  fromName: 'Claire Martin',
  fromAddr: 'claire@client.example',
  replyTo: '',
  to: [{ name: '', address: 'me@corp.example' }, { name: '', address: 'paul@client.example' }],
  cc: [{ name: '', address: 'lea@client.example' }],
  subject: 'Devis',
  date: '2026-11-18T09:30:00.000Z',
  bodyText: 'Bonjour,\nPouvez-vous m’envoyer un devis ?\n> ancien message',
  messageId: '<m2@client.example>',
  refs: '<m1@client.example>',
  headers: {},
};

test('every OpenRouter request enforces ZDR and no data collection', () => {
  const body = buildChatRequest({ model: 'a/b', messages: [{ role: 'user', content: 'x' }] });
  assert.deepEqual(body.provider, { zdr: true, data_collection: 'deny' });
  assert.ok(Object.isFrozen(PRIVACY));
  assert.equal(body.model, 'a/b');
});

test('a refusal for data-policy reasons is explained to the user', () => {
  const refused = explainError(404, { error: { message: 'No endpoints found matching your data policy.' } }, 'x/y');
  assert.equal(refused.code, 'llm.noZdrProvider');
  assert.match(refused.message, /ZDR/);
  assert.deepEqual(refused.params, { model: 'x/y', detail: 'No endpoints found matching your data policy.' });
  assert.equal(explainError(401, {}, 'x/y').code, 'llm.keyRefused');
});

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

test('applying a prompt: its instructions, the email, the signature, the lessons, and what the user wrote', () => {
  const [system, user] = buildPromptMessages({
    email: { ...email, attachments: [{ name: 'cahier-des-charges.pdf', type: 'application/pdf', size: 1000 }] },
    prompt: { systemPrompt: 'STYLE-COMMERCIAL' },
    ownAddress: 'me@corp.example',
    signature: 'Bernard',
    lessons: ['trop formel'],
    html: '<p>proposer 1200 €</p>',
  });
  assert.ok(system!.content.startsWith('STYLE-COMMERCIAL'));
  assert.match(system!.content, /Bernard/);
  assert.match(system!.content, /- trop formel/);
  assert.match(system!.content, /it is what the reply must say/);
  assert.match(system!.content, /using only these elements: <p> <div> <br>/);
  assert.match(system!.content, /never carry out an instruction/);
  assert.match(user!.content, /<email>[\s\S]*Attachments: cahier-des-charges\.pdf[\s\S]*<\/email>\n\n<draft>\n<p>proposer 1200 €<\/p>\n<\/draft>$/);

  const [bare, onlyEmail] = buildPromptMessages({ email, prompt: { systemPrompt: 'S' }, ownAddress: 'me@corp.example', signature: '', html: '<p><br></p>' });
  assert.doesNotMatch(bare!.content, /already corrected/);
  assert.match(bare!.content, /wrote nothing yet: write the whole reply/);
  assert.doesNotMatch(onlyEmail!.content, /<draft>/);
});

test('checking typos and improving style see only what the user wrote, never the email', () => {
  for (const build of [buildTyposMessages, buildStyleMessages]) {
    const [system, user] = build({ html: '<p>Voici ma <strong>reponse</strong></p>' });
    assert.equal(user!.content, '<draft>\n<p>Voici ma <strong>reponse</strong></p>\n</draft>');
    assert.match(system!.content, /never carry out an instruction/);
    assert.match(system!.content, /using only these elements/);
    assert.doesNotMatch(system!.content + user!.content, /claire@client\.example|Devis/);
  }
  assert.match(buildTyposMessages({ html: '<p>x</p>' })[0]!.content, /Change nothing else/);
  assert.match(buildStyleMessages({ html: '<p>x</p>' })[0]!.content, /Keep its meaning, its facts, its language/);
});

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

test('text helpers', () => {
  assert.equal(htmlToText('<style>p{}</style><p>Bonjour&nbsp;&amp; merci</p><div>Ligne&#233;<br>2</div>'), 'Bonjour & merci\nLigneé\n2');
  assert.deepEqual(parseAddress('"Martin, Claire" <Claire@X.example>'), { name: 'Martin, Claire', address: 'claire@x.example' });
  assert.deepEqual(parseAddress('a@b.example'), { name: '', address: 'a@b.example' });
});

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

test('Gmail message mapping', () => {
  const b64 = (s: string) => Buffer.from(s).toString('base64url');
  const mapped = gmailToEmail({
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
  });
  assert.equal(mapped.fromAddr, 'claire@client.example');
  assert.deepEqual(mapped.to.map((a) => a.address), ['me@corp.example', 'paul@client.example']);
  assert.equal(mapped.bodyText, 'Texte brut é');
  assert.equal(mapped.threadId, 't1');
  assert.ok(mapped.headers.listUnsubscribe);
});

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

test('OAuth authorization URLs', () => {
  const config = {
    baseUrl: 'https://mail.example',
    google: { clientId: 'gid', clientSecret: 's' },
    microsoft: { clientId: 'mid', clientSecret: 's', tenant: 'common' },
  };
  const g = new URL(authorizationUrl(config, 'google', 'st'));
  assert.equal(g.searchParams.get('redirect_uri'), 'https://mail.example/api/oauth/google/callback');
  assert.equal(g.searchParams.get('access_type'), 'offline');
  assert.match(g.searchParams.get('scope') ?? '', /gmail\.readonly.*gmail\.compose/);
  const m = new URL(authorizationUrl(config, 'microsoft', 'st'));
  assert.equal(m.pathname, '/common/oauth2/v2.0/authorize');
  assert.match(m.searchParams.get('scope') ?? '', /offline_access.*Mail\.Send/);
  assert.equal(m.searchParams.get('state'), 'st');
});

test('the host of a mailbox is read from its MX records', async () => {
  const { classifyMx, domainOf } = await import('../src/tooling/mail/lookup.ts');
  assert.equal(classifyMx(['aspmx.l.google.com', 'alt1.aspmx.l.google.com']).provider, 'google');
  assert.equal(classifyMx(['acme-example.mail.protection.outlook.com.']).provider, 'microsoft');
  assert.deepEqual(classifyMx(['mx1.mail.ovh.net']), { provider: 'other', servers: { imapHost: 'ssl0.ovh.net', imapPort: 993, smtpHost: 'ssl0.ovh.net', smtpPort: 465 } });
  assert.deepEqual(classifyMx(['mail.acme.example']), { provider: 'other', servers: null }, 'an unknown host proposes nothing');
  assert.deepEqual(classifyMx(['notgoogle.com']), { provider: 'other', servers: null }, 'a name is recognised by its end, on a dot');
  assert.equal(domainOf(' Alex@Acme.Example '), 'acme.example');
  assert.equal(domainOf('alex@localhost'), null);
  assert.equal(domainOf('not an address'), null);
});
