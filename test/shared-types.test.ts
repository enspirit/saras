// The domain objects are declared once, in shared/, for the server and the browser alike.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const tracked = (...patterns: string[]): string[] =>
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...patterns], { encoding: 'utf8' }).trim().split('\n').filter(existsSync);

/** The names a file declares itself: re-exports of what another file declares do not count. */
const declaredIn = (path: string): string[] => [...readFileSync(path, 'utf8').matchAll(/^export (?:interface|type|const) (\w+)\b(?! *,| *\})/gm)].map((match) => match[1] ?? '');

const shared = tracked('shared/*.ts');
const sharedNames = new Set(shared.flatMap(declaredIn));

test('shared/ declares the domain objects, and depends on nothing but itself', () => {
  assert.ok(sharedNames.has('Mailbox') && sharedNames.has('EmailWithItsReply') && sharedNames.has('Proposal'));
  for (const path of shared) {
    const imports = [...readFileSync(path, 'utf8').matchAll(/from '([^']+)'/g)].map((match) => match[1] ?? '');
    assert.deepEqual(imports.filter((from) => !/^\.\/[\w-]+\.ts$/.test(from)), [], `${path} imports from outside shared/`);
  }
});

test('neither the server nor the browser declares a domain object of its own under a shared name', () => {
  const again = tracked('src/*.ts', 'web/*.ts').flatMap((path) => declaredIn(path).filter((name) => sharedNames.has(name)).map((name) => `${path}: ${name}`));
  assert.deepEqual(again, []);
});

test('the browser takes what the server returns from shared/: its API files declare only what it sends', () => {
  const declared = tracked('web/api/*.ts', 'web/api.ts').flatMap((path) => declaredIn(path).filter((name) => /^[A-Z][a-z]/.test(name)).map((name) => `${path}: ${name}`));
  assert.deepEqual(declared.map((entry) => entry.split(': ')[1]).sort(), ['MailboxByServers', 'PromptContent', 'ReplyToHandOver', 'SignInDetails'].sort(), declared.join(', '));
});
