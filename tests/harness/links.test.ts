import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brokenLinks, relativeLinks, resolve } from './links.ts';

const CASES: [string, string, string[]][] = [
  ['a relative link', 'See [the design](doc/4-design.md).', ['doc/4-design.md']],
  ['a link with a fragment leads to its file', '[deviations](doc/2-deviations.md#deviations)', ['doc/2-deviations.md']],
  ['a link whose text is code', '[`software/saras/`](software/saras/)', ['software/saras/']],
  ['two links on a line', '[a](x.md) and [b](y/z.md)', ['x.md', 'y/z.md']],
  ['an image', '![badge](img/badge.svg)', ['img/badge.svg']],
  ['a link with a title', '[a](x.md "the title")', ['x.md']],
  ['a link elsewhere is not ours to check', '[site](https://elo-lang.org), [mail](mailto:a@b.c), [here](#status)', []],
  ['inline code is not a link', 'write `[text](target.md)` to link', []],
  ['a fenced block is not prose', '```md\n[a](nowhere.md)\n```\n[b](there.md)', ['there.md']],
];

for (const [name, markdown, expected] of CASES) {
  test(`links: ${name}`, () => assert.deepEqual(relativeLinks(markdown), expected));
}

test('a link is resolved from the file it is in', () => {
  assert.equal(resolve('README.md', 'doc/4-design.md'), 'doc/4-design.md');
  assert.equal(resolve('software/saras/README.md', '../../doc/2-deviations.md'), 'doc/2-deviations.md');
  assert.equal(resolve('doc/1-user-stories.md', './4-design.md'), 'doc/4-design.md');
  assert.equal(resolve('software/saras/README.md', 'brands/example/'), 'software/saras/brands/example');
  assert.equal(resolve('doc/a.md', '/LICENSE'), 'LICENSE');
});

test('a link that leads nowhere is reported with its file, and one that leads somewhere is not', () => {
  const exists = (path: string): boolean => path === 'doc/4-design.md';
  assert.deepEqual(brokenLinks('README.md', '[a](doc/4-design.md) [b](doc/gone.md)', exists), ['README.md: (doc/gone.md) leads nowhere']);
});
