// Builds what the browser loads into public/js/: the interface and its style sheets, bundled
// and minified, and the translations, one file per language. `--watch` rebuilds on change.
import { context } from 'esbuild';
import type { BuildOptions } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

/** The two pages and the design system. What the pages share is put in chunks of its own. */
const interfaceBundle: BuildOptions = {
  absWorkingDir: fileURLToPath(root),
  entryPoints: [
    { in: 'web/app.ts', out: 'app' },
    { in: 'web/styleguide.ts', out: 'styleguide' },
    { in: 'public/design/index.css', out: 'design' },
  ],
  outdir: 'public/js',
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  // The licences of the libraries bundled stay with their code.
  legalComments: 'eof',
  loader: { '.woff2': 'file' },
  logLevel: 'info',
};

interface Catalogue {
  languages: { tag: string }[];
  sections: string[];
}

/** One file per language, made of its sections: the interface asks for a single one. */
function bundleTranslations(): void {
  const { languages, sections } = read('public/i18n/index.json') as Catalogue;
  mkdirSync(new URL('public/js/i18n/', root), { recursive: true });
  for (const { tag } of languages) {
    const messages = Object.fromEntries(sections.map((section) => [section, read(`public/i18n/${tag}/${section}.json`)]));
    writeFileSync(new URL(`public/js/i18n/${tag}.json`, root), JSON.stringify(messages));
  }
}

const building = await context(interfaceBundle);
bundleTranslations();
if (process.argv.includes('--watch')) {
  await building.watch();
} else {
  await building.rebuild();
  await building.dispose();
}
