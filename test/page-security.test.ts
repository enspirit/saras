// The pages of the interface: what the browser is told it may run and style.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';

let stack: Stack;
before(async () => (stack = await startStack()));
after(() => stack.stop());

const nonceIn = (policy: string): string => policy.match(/style-src 'self' 'nonce-([^']+)'/)?.[1] ?? '';

test('a page allows only its own files, and one style sheet written with the nonce it was given', async () => {
  for (const path of ['/', '/index.html', '/styleguide.html']) {
    const page = await fetch(stack.url + path);
    const policy = page.headers.get('content-security-policy') ?? '';
    const html = await page.text();
    assert.match(policy, /^default-src 'self'; style-src 'self' 'nonce-[^']+'; frame-ancestors 'none'/, path);
    assert.ok(!policy.includes('unsafe-inline'), 'nothing inline is allowed');
    assert.ok(html.includes(`<meta name="csp-nonce" content="${nonceIn(policy)}" />`), `${path} carries the nonce of its own answer`);
    assert.ok(!html.includes('__CSP_NONCE__'));
    assert.equal(page.headers.get('cache-control'), 'no-store', 'a nonce is good once');
  }
});

test('each answer has a nonce of its own', async () => {
  const first = nonceIn((await fetch(stack.url + '/')).headers.get('content-security-policy') ?? '');
  const second = nonceIn((await fetch(stack.url + '/')).headers.get('content-security-policy') ?? '');
  assert.ok(first.length >= 20 && second.length >= 20);
  assert.notEqual(first, second);
});
