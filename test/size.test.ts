// The size harness: no source file has more than 200 lines, no function more than 20.
// Small files are named after one thing; small functions say one thing. Run alone with
//   node --test test/size.test.ts
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { functionsOf, lineCount } from './support/size.ts';

const MAX_FILE_LINES = 200;
const MAX_FUNCTION_LINES = 20;

/** Every source file of the repository, tracked or about to be: TypeScript and CSS, ours only. */
const sources = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.ts', '*.css'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  // A file deleted but not yet committed is still listed: it is no longer a source.
  .filter((path) => existsSync(path) && !path.includes('/vendor/'));

test(`no source file has more than ${MAX_FILE_LINES} lines`, () => {
  const tooLong = sources.map((path) => ({ path, lines: lineCount(path) })).filter((file) => file.lines > MAX_FILE_LINES);
  assert.deepEqual(tooLong.map((file) => `${file.path}: ${file.lines} lines`), []);
});

test(`no function has more than ${MAX_FUNCTION_LINES} lines`, () => {
  const tooLong = sources
    .filter((path) => path.endsWith('.ts'))
    .flatMap((path) => functionsOf(path).filter((fn) => fn.lines > MAX_FUNCTION_LINES).map((fn) => `${path}:${fn.line} ${fn.name}: ${fn.lines} lines`));
  assert.deepEqual(tooLong, []);
});
