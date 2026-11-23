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

// What each stack changes of it: env/devel.env, then env/test.env under the suites.
const namesOf = (path: string): string[] => Object.keys(parseEnv(read(path)));
/** What env/devel.env takes from the environment (a laptop's .env), each with the value it has otherwise. */
const takenFromTheEnvironment = [...read('env/devel.env').matchAll(/^([A-Z][A-Z0-9_]*)=\$\{\1:-(.*)\}$/gm)].map((match) => ({ name: match[1] ?? '', otherwise: match[2] ?? '' }));

test('a stack changes only variables that env/base.env describes', () => {
  assert.deepEqual([...namesOf('env/devel.env'), ...namesOf('env/test.env')].filter((name) => !(name in described)), []);
});

/** What the development stack says of itself when `.env` does not: its secret, and where it publishes the server. */
const ITS_OWN = ['APP_SECRET', 'BASE_URL'];

test('what env/devel.env takes from the environment is, without it, the stack’s own or what env/base.env says', () => {
  assert.ok(takenFromTheEnvironment.some((taken) => taken.name === 'OPENROUTER_API_KEY'));
  const differing = takenFromTheEnvironment.filter((taken) => !ITS_OWN.includes(taken.name) && taken.otherwise !== described[taken.name]);
  assert.deepEqual(differing, []);
});

test('env/test.env pins everything env/devel.env takes from the environment: no suite sees a laptop’s .env', () => {
  const pinned = namesOf('env/test.env');
  assert.deepEqual(takenFromTheEnvironment.map((taken) => taken.name).filter((name) => !pinned.includes(name)), []);
});
