// Copies the browser libraries we depend on next to the compiled interface, so that the
// browser loads them as plain ES modules: there is no bundler. Run by `npm run build`.
import { copyFileSync, mkdirSync } from 'node:fs';

/** package file -> name under public/js/vendor/ (see the matching type files in web/vendor/). */
const LIBRARIES: Record<string, string> = {
  // Rich-text editor made for composing email. MIT.
  'squire-rte/dist/squire.mjs': 'squire.mjs',
  // HTML sanitiser. MPL-2.0 OR Apache-2.0.
  'dompurify/dist/purify.es.mjs': 'purify.mjs',
};

const target = new URL('../public/js/vendor/', import.meta.url);
mkdirSync(target, { recursive: true });
for (const [source, name] of Object.entries(LIBRARIES)) {
  copyFileSync(new URL(`../node_modules/${source}`, import.meta.url), new URL(name, target));
}
