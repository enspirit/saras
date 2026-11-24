// A received email shown as it was written: what is kept of its HTML, and what the document
// rebuilt from it may hold.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { htmlToKeep, isPastRetention } from '../../src/domain/computations/emails.ts';
import { holdsHostedImages, receivedDocument } from '../../src/tooling/received-html.ts';

/** What the document shows: its body. */
const shown = (html: string): string => receivedDocument(html).match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
const LINK = ' target="_blank" rel="noopener noreferrer"';
const PIXEL = 'data:image/png;base64,iVBORw0KGgo=';

const REBUILT: [string, string, string][] = [
  ['its layout is kept: tables, fonts, colours, styles', '<table width="600" bgcolor="#eee"><tr><td align="center" style="color:red">Hi <font face="Arial" size="2">there</font></td></tr></table>', '<table width="600" bgcolor="#eee"><tr><td align="center" style="color:red">Hi <font face="Arial" size="2">there</font></td></tr></table>'],
  ['a script goes with what it holds', '<p>a</p><script>alert(1)</script><p>b</p>', '<p>a</p><p>b</p>'],
  ['so do a form, a frame, an object, an SVG', '<form action="https://x.example"><input name="p"></form><iframe src="https://x.example"></iframe><object data="x"></object><svg onload="x()"><circle/></svg>ok', 'ok'],
  ['an element that is not of the list disappears, and its text stays', '<article><marquee>Hello</marquee> <input value="x">world</article>', 'Hello world'],
  ['what happens on an event is not an attribute of the list', '<p onclick="x()" onmouseover=y() id="a" class="b">t</p>', '<p class="b">t</p>'],
  ['nothing redirects, nor changes where addresses are read from', '<meta http-equiv="refresh" content="0;url=https://x.example"><base href="https://x.example/"><link rel="stylesheet" href="https://x.example/a.css">t', 't'],
  ['a link to the web opens in a tab of its own', '<a href="https://client.example/devis?a=1&amp;b=2" style="color:blue">le devis</a>', `<a style="color:blue" href="https://client.example/devis?a=1&amp;b=2"${LINK}>le devis</a>`],
  ['a link to an address is kept', "<a href='mailto:claire@client.example'>Claire</a>", `<a href="mailto:claire@client.example"${LINK}>Claire</a>`],
  ['a link that runs something leads nowhere', '<a href="javascript:alert(1)">x</a><a href="jav&#x09;ascript:alert(1)">y</a><a href=" data:text/html,x">z</a>', `<a${LINK}>x</a><a${LINK}>y</a><a${LINK}>z</a>`],
  ['an image hosted elsewhere is held back, with what it said of itself', '<img src="https://tracker.example/open.gif?id=42" width="1" height="1" alt="logo">', '<img width="1" height="1" alt="logo">'],
  ['so is one the message refers to without carrying it here', '<img src="cid:logo@client.example">', '<img>'],
  ['an image the HTML carries in itself is shown', `<img src="${PIXEL}" alt="x">`, `<img alt="x" src="${PIXEL}">`],
  ['one that is not an image is not', '<img src="data:text/html;base64,PHNjcmlwdD4=">', '<img>'],
  ['a quote inside a value cannot end it', `<p title='say "hi" <b>'>t</p>`, '<p title="say &quot;hi&quot; &lt;b&gt;">t</p>'],
  ['a ">" inside a value does not end the tag', '<p title="a > b" onclick="x()">t</p>', '<p title="a &gt; b">t</p>'],
  ['a "<" that opens nothing is text', 'a < b and <notatag', 'a &lt; b and &lt;notatag'],
  ['a script left open shows as text, and runs nothing', '<script>alert(1)', 'alert(1)'],
  ['comments go, and what a mail program hid in them', '<!--[if mso]><table><tr><td><![endif]-->t<!-- <script>x</script> -->', 't'],
];

test('a received email is rebuilt from a list of elements and attributes', () => {
  for (const [what, written, rebuilt] of REBUILT) assert.equal(shown(written), rebuilt, what);
});

test('its style sheets are kept, in the head, and cannot end the element they are put in', () => {
  const document = receivedDocument('<html><head><title>x</title><style type="text/css">.big{font-size:20px}</style></head><body><style>p{margin:0}</b<x</style><p class="big">t</p></body></html>');
  assert.match(document, /<head>.*<style>\.big\{font-size:20px\}<\/style><style>p\{margin:0\}\/bx<\/style><\/head><body><p class="big">t<\/p><\/body>/);
  assert.equal(document.match(/<\/style>/g)?.length, 3);
});

test('the document is one of its own: UTF-8, links opening elsewhere than in its frame, on white', () => {
  assert.match(receivedDocument('<p>é</p>'), /^<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html\{color-scheme:light;/);
});

test('an email that shows images hosted elsewhere is known as such', () => {
  assert.equal(holdsHostedImages('<p><IMG alt="x" SRC = "https://t.example/p.gif"></p>'), true);
  assert.equal(holdsHostedImages("<img src='//t.example/p.gif'>"), true);
  assert.equal(holdsHostedImages(`<img src="${PIXEL}"><a href="https://x.example">x</a>`), false);
});

test('the HTML of an email is kept whole or not at all, without what PostgreSQL cannot hold', () => {
  assert.equal(htmlToKeep('<p>a\u0000b</p>'), '<p>ab</p>');
  assert.equal(htmlToKeep('x'.repeat(500_000)).length, 500_000);
  assert.equal(htmlToKeep('x'.repeat(500_001)), '');
});

test('an email is past retention once older than the days the server keeps content for; never when it keeps it for good', () => {
  const now = new Date('2026-11-24T12:00:00Z');
  const daysAgo = (days: number): Date => new Date(now.getTime() - days * 86_400_000);
  assert.equal(isPastRetention(daysAgo(29), 30, now), false);
  assert.equal(isPastRetention(daysAgo(31), 30, now), true);
  assert.equal(isPastRetention(daysAgo(3000), 0, now), false);
});
