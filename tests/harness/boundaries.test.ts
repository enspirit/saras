import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crossings, importsOf } from './boundaries.ts';
import type { Boundary } from './boundaries.ts';

test('what a file imports: values, types, re-exports, side effects and imports on demand', () => {
  const source = [
    "import express from 'express';",
    "import type { Db } from '../../tooling/db.ts';",
    "import {\n  a,\n  b,\n} from './several-lines.ts';",
    "export { c } from './re-exported.ts';",
    "import './side-effect.ts';",
    "const later = await import('./on-demand.ts');",
    "const text = 'not an import from nowhere';",
  ].join('\n');
  assert.deepEqual(importsOf(source), ['express', '../../tooling/db.ts', './several-lines.ts', './re-exported.ts', './side-effect.ts', './on-demand.ts']);
});

const RULES: Boundary[] = [
  { within: 'app/src/domain', mayNotImport: ['express', 'app/src/tooling/http'], why: 'the domain knows nothing of HTTP' },
  { within: 'app/web', mayNotImport: ['app/src'], why: 'the browser is a client of the API' },
];

const CASES: [string, string, string, string[]][] = [
  ['the domain may use the database', 'app/src/domain/access/sign-in.ts', "import type { Db } from '../../tooling/db.ts';", []],
  ['the domain may not use a route', 'app/src/domain/access/sign-in.ts', "import { done } from '../../tooling/http/route.ts';", ['app/src/domain/access/sign-in.ts imports app/src/tooling/http/route.ts: the domain knows nothing of HTTP']],
  ['the domain may not use express', 'app/src/domain/world.ts', "import type { Request } from 'express';", ['app/src/domain/world.ts imports express: the domain knows nothing of HTTP']],
  ['a package whose name only starts the same is another package', 'app/src/domain/world.ts', "import x from 'express-session';", []],
  ['the tooling is not held to the rule of the domain', 'app/src/tooling/http/server.ts', "import express from 'express';", []],
  ['the browser may use what is shared', 'app/web/api.ts', "import type { Mailbox } from '../shared/mailbox.ts';", []],
  ['the browser may not use the server', 'app/web/pages/x.ts', "import { MESSAGES } from '../../src/tooling/messages.ts';", ['app/web/pages/x.ts imports app/src/tooling/messages.ts: the browser is a client of the API']],
];

for (const [name, file, source, expected] of CASES) {
  test(`boundaries: ${name}`, () => assert.deepEqual(crossings(file, source, RULES), expected));
}
