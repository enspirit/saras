// Runs the scanners over the repository: `emb run harness:lint`. Says what it found and
// fails when it found something.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { crossings } from './boundaries.ts';
import type { Boundary } from './boundaries.ts';
import { brokenLinks } from './links.ts';

const root = new URL('../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');
const exists = (path: string): boolean => existsSync(new URL(path, root));

/** The files of the repository, tracked or about to be, that still exist. */
const files = (...patterns: string[]): string[] =>
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...patterns], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter((path) => path !== '' && exists(path));

/** The rules of software/saras/README.md, "Must not", that are about who imports whom. */
const BOUNDARIES: Boundary[] = [
  { within: 'software/saras/src/domain', mayNotImport: ['express', 'software/saras/src/tooling/http'], why: 'the domain knows nothing of HTTP' },
  { within: 'software/saras/web', mayNotImport: ['software/saras/src', 'software/saras/test'], why: 'the browser reaches the server through /api, and shares only shared/ with it' },
  { within: 'software/saras/src', mayNotImport: ['software/saras/web', 'software/saras/test'], why: 'the server ships without the browser code and without the tests' },
  { within: 'software/saras/src/assistant', mayNotImport: ['express', 'software/saras/src/domain', 'software/saras/src/tooling', 'software/saras/src/main.ts'], why: 'the assistant is given what it asks a model with and what judges its answers: it knows neither the domain nor the tooling' },
  { within: 'software/saras/src/tooling', mayNotImport: ['software/saras/src/assistant'], why: 'the assistant is reached through the operations of the domain' },
  { within: 'software/saras/shared', mayNotImport: ['software/saras/src', 'software/saras/web', 'software/saras/test'], why: 'shared/ depends on nothing but itself' },
];

const found = [
  ...files('*.md').flatMap((file) => brokenLinks(file, read(file), exists)),
  ...files('software/*.ts').flatMap((file) => crossings(file, read(file), BOUNDARIES)),
];

for (const finding of found) console.error(finding);
if (found.length > 0) process.exit(1);
console.log('harness: every link leads somewhere, and no import crosses a boundary');
