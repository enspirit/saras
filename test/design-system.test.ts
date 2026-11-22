// Guard rails of the design system: they keep the tiers honest as the interface grows.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string): string => readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8');
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const COMPONENT_SHEETS = ['base.css', 'atoms.css', 'molecules.css', 'organisms.css'];
/** Browser sources live in web/ and are compiled to public/js/. */
const readWeb = (path: string): string => readFileSync(new URL(`../web/${path}`, import.meta.url), 'utf8');
const PAGES = ['app.ts', 'styleguide.ts'];

test('colours and fonts are written only in tokens.css', () => {
  for (const sheet of COMPONENT_SHEETS) {
    const css = stripComments(read(`design/${sheet}`));
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, `${sheet}: hex colour`);
    assert.doesNotMatch(css, /\b(rgb|hsl|oklch|oklab|lab|lch)a?\(/i, `${sheet}: colour function`);
    for (const [, value] of css.matchAll(/font-family\s*:\s*([^;]+);/g)) {
      assert.match(value, /^(var\(--font-[\w-]+\)|inherit)$/, `${sheet}: font-family "${value}"`);
    }
  }
});

test('components use semantic tokens, never brand inputs', () => {
  for (const sheet of COMPONENT_SHEETS) assert.doesNotMatch(stripComments(read(`design/${sheet}`)), /--brand-/, sheet);
});

test('every token a component uses is declared', () => {
  const declared = new Set([...read('design/tokens.css').matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  for (const sheet of COMPONENT_SHEETS) {
    const css = stripComments(read(`design/${sheet}`));
    const local = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    for (const [, name] of css.matchAll(/var\((--[\w-]+)/g)) {
      assert.ok(declared.has(name) || local.has(name), `${sheet}: ${name} is not declared`);
    }
  }
});

test('the brand theme only sets tokens that exist', () => {
  const declared = new Set([...read('design/tokens.css').matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const themes = [read('brand/theme.css'), ...['example', 'klaro'].map((brand) => readFileSync(new URL(`../brands/${brand}/theme.css`, import.meta.url), 'utf8'))];
  for (const theme of themes) {
    const set = [...stripComments(theme).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
    assert.ok(set.length > 0);
    for (const name of set) assert.ok(declared.has(name), `${name} is not a token`);
  }
});

test('pages are made of components: no class name, no element created directly', () => {
  for (const page of PAGES) {
    const js = readWeb(page);
    assert.doesNotMatch(js, /\bclass(Name|List)?\b\s*[:=.]/, `${page}: class name`);
    assert.doesNotMatch(js, /createElement|innerHTML|\bh\(/, `${page}: raw DOM`);
  }
});

test('dependencies point downwards: atoms < molecules < organisms < pages', () => {
  const imports = (file: string): string[] => [...new Set([...readWeb(`ui/${file}`).matchAll(/from '\.\/([\w-]+)\.ts'/g)].map((m) => m[1] ?? ''))];
  assert.deepEqual(imports('dom.ts'), []);
  // sanitize.ts is base-level, beside dom.ts: it turns foreign HTML into safe nodes.
  assert.deepEqual(imports('sanitize.ts'), []);
  assert.deepEqual(imports('atoms.ts').sort(), ['dom', 'sanitize']);
  assert.deepEqual(imports('molecules.ts').sort(), ['atoms', 'dom', 'sanitize']);
  assert.deepEqual(imports('organisms.ts').sort(), ['atoms', 'dom', 'molecules']);
});

test('each tier styles only its own components (no dead or misplaced styles)', () => {
  for (const tier of ['atoms', 'molecules', 'organisms']) {
    const js = readWeb(`ui/${tier}.ts`);
    const blocks = new Set([...stripComments(read(`design/${tier}.css`)).matchAll(/\.([a-z][a-z-]*?)(?=__|--|[^\w-])/g)].map((m) => m[1]));
    for (const block of blocks) {
      // .nav-item inside organisms.css is a contextual tweak of a molecule: allowed when prefixed by the organism.
      if (tier === 'organisms' && !js.includes(`'${block}`)) continue;
      assert.match(js, new RegExp(`['\`\\s]${block}['\`\\s_-]`), `${tier}.css styles .${block}, which ${tier}.ts never builds`);
    }
  }
});

test('the default brand folder is complete', () => {
  const files = readdirSync(new URL('../public/brand', import.meta.url));
  for (const file of ['theme.css', 'brand.json', 'favicon.svg']) assert.ok(files.includes(file), file);
  const brand = JSON.parse(read('brand/brand.json'));
  assert.equal(typeof brand.name, 'string');
});
