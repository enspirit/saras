// Translations: the message formatter, and the consistency of the translation files with
// each other and with the code that uses them.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { flatten, format, formatRich, parameterNames } from '../web/i18n/format.ts';

const root = new URL('../', import.meta.url);
const readJson = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const catalogue = readJson('public/i18n/index.json') as { default: string; languages: { tag: string; name: string }[] };
const messages = Object.fromEntries(catalogue.languages.map((l) => [l.tag, flatten(readJson(`public/i18n/${l.tag}.json`))]));
const source = messages[catalogue.default] ?? {};

/** Every TypeScript file of the interface, with its content. */
const webSources = (readdirSync(new URL('web', root), { recursive: true }) as string[])
  .filter((file) => file.endsWith('.ts'))
  .map((file) => ({ file, code: readFileSync(new URL(`web/${file}`, root), 'utf8') }));

const tagsOf = (message: string): string[] => [...message.matchAll(/<(\w+)>/g)].map((m) => m[1] ?? '').sort();

test('parameters, and a missing one left visible', () => {
  assert.equal(format('Bonjour {name} !', { name: 'Léa' }), 'Bonjour Léa !');
  assert.equal(format('{a} et {b}', { a: 1, b: 'x' }), '1 et x');
  assert.equal(format('Bonjour {name}'), 'Bonjour {name}');
});

test('plurals follow the rules of the language', () => {
  const fr = '{count, plural, =0 {Aucun email} one {# email} other {# emails}}';
  assert.equal(format(fr, { count: 0 }, 'fr'), 'Aucun email');
  assert.equal(format(fr, { count: 1 }, 'fr'), '1 email');
  assert.equal(format(fr, { count: 2 }, 'fr'), '2 emails');
  // French counts zero as singular, English as plural.
  assert.equal(format('{n, plural, one {# jour} other {# jours}}', { n: 0 }, 'fr'), '0 jour');
  assert.equal(format('{n, plural, one {# day} other {# days}}', { n: 0 }, 'en'), '0 days');
  assert.equal(format('{n, plural, one {# day} other {# days}}', { n: 1500 }, 'en'), '1,500 days');
});

test('select, nesting and several arguments in one message', () => {
  const message = '{kind, select, draft {Brouillon} other {Envoyé}} à {to} ({n, plural, one {# copie} other {# copies}})';
  assert.equal(format(message, { kind: 'draft', to: 'a@b.example', n: 2 }, 'fr'), 'Brouillon à a@b.example (2 copies)');
  assert.equal(format(message, { kind: 'x', to: 'a@b.example', n: 1 }, 'fr'), 'Envoyé à a@b.example (1 copie)');
  assert.equal(format('{n, plural, other {{who} a # messages}}', { n: 3, who: 'Léa' }, 'fr'), 'Léa a 3 messages');
});

test('apostrophes: literal in text, quoting braces, doubled for one', () => {
  assert.equal(format("L'email de {name}", { name: 'Léa' }), "L'email de Léa");
  assert.equal(format("Use '{braces}' as is", {}), 'Use {braces} as is');
  assert.equal(format("It''s {n}", { n: 1 }), "It's 1");
  assert.equal(format('#{n}', { n: 4 }), '#4', '# is only special inside a plural');
});

test('rich messages are cut at their tags, and a parameter cannot forge one', () => {
  assert.deepEqual(formatRich('Voir <link>Réglages</link> pour {what}.', { what: 'la clé' }), ['Voir ', { tag: 'link', text: 'Réglages' }, ' pour la clé.']);
  assert.deepEqual(formatRich('De <strong>{sender}</strong>', { sender: 'Eve <link>x</link>' }), ['De ', { tag: 'strong', text: 'Eve <link>x</link>' }]);
  assert.deepEqual(formatRich('Sans balise'), ['Sans balise']);
});

test('nested JSON is flattened on dots, as Tolgee stores it', () => {
  assert.deepEqual(flatten({ a: { b: 'x', c: { d: 'y' } }, e: 'z' }), { 'a.b': 'x', 'a.c.d': 'y', e: 'z' });
});

test('every language has a file, a name, and exactly the keys of the source language', () => {
  assert.ok(catalogue.languages.some((l) => l.tag === catalogue.default), 'the default language is listed');
  const expected = Object.keys(source).sort();
  assert.ok(expected.length > 100);
  for (const { tag, name } of catalogue.languages) {
    assert.ok(name, `${tag} has a name`);
    assert.deepEqual(Object.keys(messages[tag] ?? {}).sort(), expected, `keys of ${tag}.json`);
  }
});

test('a translation keeps the parameters and the tags of its source', () => {
  for (const { tag } of catalogue.languages) {
    for (const [key, message] of Object.entries(messages[tag] ?? {})) {
      assert.ok(message.trim(), `${tag}: ${key} is empty`);
      assert.deepEqual(parameterNames(message), parameterNames(source[key] ?? ''), `${tag}: parameters of ${key}`);
      assert.deepEqual(tagsOf(message), tagsOf(source[key] ?? ''), `${tag}: tags of ${key}`);
    }
  }
});

test('every key the interface asks for exists, and every key is used', () => {
  const namespaces = new Set(Object.keys(source).map((key) => key.split('.')[0]));
  const literals = new Set<string>();
  for (const { code } of webSources) {
    for (const [, literal] of code.matchAll(/'([a-zA-Z]+(?:\.[a-zA-Z0-9]+)+)'/g)) {
      if (literal && namespaces.has(literal.split('.')[0])) literals.add(literal);
    }
  }
  for (const key of literals) assert.ok(key in source, `${key} is used but not translated`);
  for (const key of Object.keys(source)) assert.ok(literals.has(key), `${key} is translated but never used`);
});

test('no wording is written in the code: it all comes from the translation files', () => {
  for (const { file, code } of webSources) {
    const withoutComments = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const [literal] of withoutComments.matchAll(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g)) {
      const text = literal.slice(1, -1).replace(/\$\{[^}]*\}/g, '');
      const looksLikeProse = /[À-ÿ’«»]/.test(text) || /[A-Za-z]{3,} [a-z]{3,} [a-z]{2,}/.test(text);
      assert.ok(!looksLikeProse, `${file}: ${literal}`);
    }
  }
});
