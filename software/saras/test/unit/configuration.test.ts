// env/base.env is where the configuration is described: every variable the server reads,
// with the value it takes when nothing is said. These tests hold the file to the code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseEnv } from 'node:util';
import { loadConfig } from '../../src/tooling/config.ts';

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const described = parseEnv(read('env/base.env')) as Record<string, string>;
const variablesReadBy = (source: string): string[] => [...new Set([...source.matchAll(/\benv\.([A-Z][A-Z0-9_]*)/g)].map((match) => match[1] ?? ''))].sort();
const SECRET = { APP_SECRET: 'a-secret-of-thirty-two-characters-or-more' };

test('env/base.env describes every variable the configuration reads, and no other', () => {
  assert.deepEqual(Object.keys(described).sort(), variablesReadBy(read('src/tooling/config.ts')));
});

test('the value it gives each is the one the server takes when the variable is not set', () => {
  assert.deepEqual(loadConfig({ ...described, ...SECRET }), loadConfig(SECRET));
});

test('it holds no secret: the master key is left empty, and the server refuses to start on it', () => {
  assert.equal(described.APP_SECRET, '');
  assert.throws(() => loadConfig(described), /APP_SECRET/);
});

test('.env.example names only variables that env/base.env describes', () => {
  const named = [...read('.env.example').matchAll(/^#? ?([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1] ?? '');
  assert.ok(named.includes('APP_SECRET'));
  assert.deepEqual(named.filter((name) => !(name in described)), []);
});
