import type { Brand } from '../brand.ts';
import { cx, h } from '../dom.ts';

/** The product's name, or the brand's logo when it has one (with an optional variant for dark mode). */
export function BrandMark({ name, logo, logoDark }: Pick<Brand, 'name' | 'logo' | 'logoDark'>, { large = false, onDark = false }: { large?: boolean; onDark?: boolean } = {}): HTMLDivElement {
  // On a ground that is dark in both schemes, the dark variant is the one to show.
  const image = logo && (onDark
    ? h('img', { class: 'brandmark__logo', src: logoDark ?? logo, alt: name })
    : h('picture', {},
      logoDark && h('source', { srcset: logoDark, media: '(prefers-color-scheme: dark)' }),
      h('img', { class: 'brandmark__logo', src: logo, alt: name }),
    ));
  return h('div', { class: cx('brandmark', large && 'brandmark--large') }, image || name);
}
