// Guard rails of the design system: they keep the tiers honest as the interface grows.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string): string => readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8');
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
/** The files of a folder and of its sub-folders with this extension, as paths relative to it. */
const filesOf = (folder: string, extension: string): string[] =>
  (readdirSync(new URL(`../../${folder}`, import.meta.url), { recursive: true }) as string[]).filter((file) => file.endsWith(extension)).map((file) => file.replaceAll('\\', '/')).sort();

/** The tiers of components, lowest first. Each has a folder of sheets in public/design/ and a folder of modules in web/ui/. */
const TIERS = ['atoms', 'molecules', 'organisms'];
const sheetsOf = (tier: string): string[] => filesOf(`public/design/${tier}`, '.css').map((file) => `${tier}/${file}`);
const COMPONENT_SHEETS = ['base.css', ...TIERS.flatMap(sheetsOf)];
/** Browser sources live in web/ and are compiled to public/js/. */
const readWeb = (path: string): string => readFileSync(new URL(`../../web/${path}`, import.meta.url), 'utf8');
const WEB = filesOf('web', '.ts');
/** The components: everything under web/ui/. */
const UI = WEB.filter((file) => file.startsWith('ui/'));
/** Everything else composes components: the pages, what they share, the entry files and the style guide. */
const PAGES = WEB.filter((file) => !file.startsWith('ui/') && !file.startsWith('vendor/'));
/** All the modules of a tier, read as one text. */
const modulesOf = (tier: string): string => UI.filter((file) => file.startsWith(`${tier}/`, 'ui/'.length)).map(readWeb).join('\n');

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
  const themes = [read('brand/theme.css'), ...['example', 'klaro'].map((brand) => readFileSync(new URL(`../../brands/${brand}/theme.css`, import.meta.url), 'utf8'))];
  for (const theme of themes) {
    const set = [...stripComments(theme).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
    assert.ok(set.length > 0);
    for (const name of set) assert.ok(declared.has(name), `${name} is not a token`);
  }
});

test('every sheet is loaded by index.css, in the layer of its tier and in the order of the tiers', () => {
  const imports = [...stripComments(read('design/index.css')).matchAll(/@import url\("([^"]+)"\) layer\((\w+)\);/g)].map((m) => ({ sheet: m[1] ?? '', layer: m[2] ?? '' }));
  assert.deepEqual(imports.map((i) => i.sheet).sort(), ['tokens.css', ...COMPONENT_SHEETS].sort());
  const order = ['tokens', 'base', ...TIERS];
  for (const { sheet, layer } of imports) assert.equal(layer, sheet.includes('/') ? sheet.split('/')[0] : sheet.replace('.css', ''), `${sheet} is in layer ${layer}`);
  assert.deepEqual(imports.map((i) => order.indexOf(i.layer)), imports.map((i) => order.indexOf(i.layer)).sort((x, y) => x - y), 'the tiers are loaded lowest first');
});

test('pages are made of components: no class name, no element created directly', () => {
  for (const page of PAGES) {
    const js = readWeb(page);
    assert.doesNotMatch(js, /\bclass(Name|List)?\b\s*[:=.]/, `${page}: class name`);
    assert.doesNotMatch(js, /createElement|innerHTML|\bh\(/, `${page}: raw DOM`);
  }
});

/** How high a module of web/ui/ stands: 0 for the base beside the tiers (dom, sanitize, brand), then the rank of its tier. */
const rankOf = (file: string): number => TIERS.indexOf(file.split('/')[1] ?? '') + 1;
/** The modules a file of web/ imports, as paths relative to web/. */
const importsOf = (file: string): string[] =>
  [...readWeb(file).matchAll(/from '(\.[^']+)'/g)].map((m) => new URL(m[1] ?? '', `file:///${file}`).pathname.slice(1));

test('dependencies point downwards: atoms < molecules < organisms < pages', () => {
  assert.ok(PAGES.length > 0 && TIERS.every((tier) => UI.some((file) => file.startsWith(`ui/${tier}/`))));
  for (const file of UI) {
    for (const imported of importsOf(file)) {
      // A component is made of components of its own tier or of lower ones, and of nothing else of the application.
      assert.ok(imported.startsWith('ui/') || imported.startsWith('vendor/'), `${file} imports ${imported}, which is not a component`);
      if (imported.startsWith('ui/')) assert.ok(rankOf(imported) <= rankOf(file), `${file} imports ${imported}, which stands higher`);
    }
  }
  // dom.ts is the one DOM helper; sanitize.ts, beside it, turns foreign HTML into safe nodes. Neither needs a component.
  for (const base of ['ui/dom.ts', 'ui/sanitize.ts']) assert.deepEqual(importsOf(base).filter((imported) => imported.startsWith('ui/')), []);
});

test('each tier styles only its own components (no dead or misplaced styles)', () => {
  for (const tier of TIERS) {
    const js = modulesOf(tier);
    const css = sheetsOf(tier).map((sheet) => stripComments(read(`design/${sheet}`))).join('\n');
    const blocks = new Set([...css.matchAll(/\.([a-z][a-z-]*?)(?=__|--|[^\w-])/g)].map((m) => m[1]));
    for (const block of blocks) {
      // .nav-item inside an organism's sheet is a contextual tweak of a molecule: allowed when prefixed by the organism.
      if (tier === 'organisms' && !js.includes(`'${block}`)) continue;
      assert.match(js, new RegExp(`['\`\\s]${block}['\`\\s_-]`), `the sheets of ${tier} style .${block}, which no module of ${tier} builds`);
    }
  }
});

test('the default brand folder is complete', () => {
  const files = readdirSync(new URL('../../public/brand', import.meta.url));
  for (const file of ['theme.css', 'brand.json', 'favicon.svg']) assert.ok(files.includes(file), file);
  const brand = JSON.parse(read('brand/brand.json'));
  assert.equal(typeof brand.name, 'string');
});
