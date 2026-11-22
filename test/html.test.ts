// Replies are rich text: what may be in them, and how they become mail.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBlankHtml, sanitizeHtml, stripCodeFence, textToHtml } from '../src/tooling/html.ts';
import { composeReplyHtml, wasEdited } from '../src/domain/computations/reply.ts';
import { htmlToText } from '../src/tooling/text.ts';

test('what an email needs is kept as it is', () => {
  const html = '<p>Bonjour <strong>Claire</strong>,</p><ul><li>un</li><li><em>deux</em></li></ul><p>Voir <a href="https://example.com/a?b=1&amp;c=2">ici</a><br>Merci</p><blockquote>cité</blockquote>';
  assert.equal(sanitizeHtml(html), html);
});

test('anything else is removed: scripts and styles with their content, other tags without it', () => {
  assert.equal(sanitizeHtml('<p>a</p><script>alert(1)</script><style>p{}</style><p>b</p>'), '<p>a</p><p>b</p>');
  assert.equal(sanitizeHtml('<h1>Titre</h1><span class="x">texte</span><img src="x" onerror="alert(1)">'), 'Titretexte');
  assert.equal(sanitizeHtml('<iframe src="https://evil.example"></iframe><svg><script>x</script></svg>ok'), 'ok');
  assert.equal(sanitizeHtml('<!-- note --><p>a<!-- <script>x</script> --></p>'), '<p>a</p>');
  assert.equal(sanitizeHtml('<table><tr><td>cellule</td></tr></table>'), 'cellule');
});

test('no attribute survives, except the address of a link to the web or to a mailbox', () => {
  assert.equal(sanitizeHtml('<p style="color:red" onclick="x()" class="a">a</p>'), '<p>a</p>');
  assert.equal(sanitizeHtml(`<a href='mailto:a@b.example' target="_blank" onclick="x()">écrire</a>`), '<a href="mailto:a@b.example">écrire</a>');
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)">x</a>'), '<a>x</a>');
  assert.equal(sanitizeHtml('<a href=" JaVaScRiPt:alert(1)">x</a>'), '<a>x</a>');
  assert.equal(sanitizeHtml('<a href="data:text/html,<script>x</script>">x</a>'), '<a>x</a>');
  assert.equal(sanitizeHtml('<a href=https://example.com/a?b=1><b>x</b></a>'), '<a href="https://example.com/a?b=1"><b>x</b></a>');
  assert.equal(sanitizeHtml('<a href="https://a.example" href="javascript:x">x</a>'), '<a href="https://a.example">x</a>');
});

test('markup that is broken or disguised does not get through', () => {
  // An unclosed script loses its tag and becomes harmless text; one never closed at all is escaped.
  assert.equal(sanitizeHtml('<p>a<script>alert(1)'), '<p>aalert(1)');
  assert.equal(sanitizeHtml('<p>a<script'), '<p>a&lt;script');
  // Removing an element must not let its neighbours join into a new one.
  assert.equal(sanitizeHtml('<scr<script>x</script>ipt>alert(1)</script>'), 'alert(1)');
  // A ">" inside an attribute ends the tag early: what follows is shown as text, never run.
  assert.equal(sanitizeHtml('<p title="><script>alert(1)</script>">t</p>'), '<p>">t</p>');
  assert.equal(sanitizeHtml('<a href="https://x.example" title="a>b" onclick="e()">t</a>'), '<a href="https://x.example">b" onclick="e()">t</a>');
  assert.equal(sanitizeHtml('a < b et c > d'), 'a &lt; b et c > d');
  assert.equal(sanitizeHtml('<P>Majuscules</P><BR/>'), '<p>Majuscules</p><br>');
  assert.equal(sanitizeHtml('<p/onmouseover=alert(1)>x'), '<p>x');
  // Whatever goes in, the result only holds tags this function wrote.
  for (const nasty of ['<img src=x onerror=alert(1)>', '<<p>>x', '<p <script>>y', '"><svg onload=alert(1)>', '<a href="x" onmouseover="alert(1)">z</a>']) {
    const clean = sanitizeHtml(nasty);
    // Every "<" left either opens one of our own tags or was escaped.
    for (const [tag] of clean.matchAll(/<[^>]*>?/g)) assert.match(tag, /^<\/?(p|div|br|strong|b|em|i|u|s|ul|ol|li|a|blockquote)>$|^<a href="[^"<>]*">$/, `${nasty} -> ${clean}`);
  }
  assert.equal(sanitizeHtml(null), '');
});

test('plain text becomes paragraphs, and back', () => {
  assert.equal(textToHtml('Bonjour,\n\nLigne 1\nLigne 2 <b>\n\n\nFin'), '<p>Bonjour,</p><p>Ligne 1<br>Ligne 2 &lt;b&gt;</p><p>Fin</p>');
  assert.equal(textToHtml('  '), '');
  assert.equal(htmlToText('<p>Bonjour,</p><p>Ligne 1<br>Ligne 2</p><p>Fin</p>'), 'Bonjour,\n\nLigne 1\nLigne 2\n\nFin');
});

test('the plain-text form keeps lists and the addresses of links', () => {
  assert.equal(htmlToText('<p>À faire :</p><ul><li>un</li><li><strong>deux</strong></li></ul><p>Fin</p>'), 'À faire :\n\n- un\n- deux\n\nFin');
  assert.equal(htmlToText('<p>Voir <a href="https://example.com/doc">la doc</a>.</p>'), 'Voir la doc (https://example.com/doc).');
  assert.equal(htmlToText('<a href="https://example.com">https://example.com</a>'), 'https://example.com');
  assert.equal(htmlToText('<a href="mailto:a@b.example">a@b.example</a>'), 'a@b.example');
});

test('blank is blank, whatever tags surround it', () => {
  for (const blank of ['', null, '<p></p>', '<p><br></p>', '<div>&nbsp; </div>\n']) assert.ok(isBlankHtml(blank), String(blank));
  assert.ok(!isBlankHtml('<p>a</p>'));
});

test('a code fence around the answer of the model is removed', () => {
  assert.equal(stripCodeFence('```html\n<p>a</p>\n```'), '<p>a</p>');
  assert.equal(stripCodeFence('```\n<p>a</p>\n```\n'), '<p>a</p>');
  assert.equal(stripCodeFence('<p>a ``` b</p>'), '<p>a ``` b</p>');
});

test('the HTML part of a reply quotes the original, escaped, in a blockquote', () => {
  const email = { date: '2026-11-18T09:30:00.000Z', fromName: 'Claire <script>', fromAddr: 'claire@client.example', bodyText: 'Ligne 1\n<b>pas du html</b>' };
  assert.equal(
    composeReplyHtml('<p>Bonjour</p>', email, 'fr'),
    '<p>Bonjour</p><br><div>Le 18 novembre 2026 à 09:30 (UTC), Claire &lt;script&gt; &lt;claire@client.example&gt; a écrit :</div><blockquote>Ligne 1<br>&lt;b&gt;pas du html&lt;/b&gt;</blockquote>',
  );
  assert.equal(composeReplyHtml('<p>Bonjour</p>', { ...email, bodyText: '' }), '<p>Bonjour</p>');
});

test('formatting alone is not an edit of the proposal', () => {
  assert.equal(wasEdited(htmlToText('<p>Bonjour,</p><p>OK.</p>'), htmlToText('<p>Bonjour,</p><p><strong>OK.</strong></p>')), false);
  assert.equal(wasEdited(htmlToText('<p>Bonjour, OK.</p>'), htmlToText('<p>Salut, OK.</p>')), true);
});
