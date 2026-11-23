import { BrandMark } from '../atoms/brand-mark.ts';
import { Icon } from '../atoms/icon.ts';
import type { IconName } from '../atoms/icon.ts';
import { Heading } from '../atoms/text.ts';
import type { Brand } from '../brand.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

export interface AuthPanelOptions {
  brand: Brand;
  /** What the product is, in one sentence: the headline of the brand's side. */
  tagline: string;
  /** What the installation guarantees, shown under the tagline. */
  points?: { icon: IconName; title?: string; text: string }[];
  /** Title of the form: what the visitor is about to do. */
  title: string;
  intro?: Child;
  /** A control above the form, e.g. the language. */
  tools?: Child;
  /** Under the form: the way to the other form. */
  foot?: Child;
}

/** Signing in, signing up, accepting an invitation: the brand on one side, the form on the other. */
export function AuthPanel({ brand, tagline, points = [], title, intro, tools, foot }: AuthPanelOptions, ...children: Child[]): HTMLDivElement {
  return h('div', { class: 'auth' },
    h('aside', { class: 'auth__brand' },
      h('div', { class: 'auth__mark' }, BrandMark(brand, { onDark: true }), brand.byline && h('span', { class: 'auth__byline' }, brand.byline)),
      h('div', { class: 'auth__pitch' },
        h('p', { class: 'auth__tagline' }, tagline),
        points.length > 0 && h('ul', { class: 'auth__points' }, points.map((p) => h('li', { class: 'auth__point' }, Icon(p.icon, { size: 'large' }), h('span', {}, p.title && h('span', { class: 'auth__point-title' }, p.title), p.text)))),
      ),
    ),
    h('main', { class: 'auth__main' },
      h('div', { class: 'auth__tools' }, tools),
      h('div', { class: 'auth__panel' }, Heading(1, title), intro && h('p', { class: 'auth__intro' }, intro), children, foot && h('p', { class: 'auth__foot' }, foot)),
      brand.credit && h('p', { class: 'auth__credit' }, brand.credit),
    ),
  );
}
