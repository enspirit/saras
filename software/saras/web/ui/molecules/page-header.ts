import { Icon } from '../atoms/icon.ts';
import { Heading } from '../atoms/text.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

export interface PageHeaderOptions {
  title: string;
  /** What the page is for, in a sentence or two. */
  intro?: Child;
  /** The way back: the pages above this one, as label and address. */
  crumbs?: { label: string; href: string }[];
}

/** Top of a page: where one is, what it is for, and what can be done there. */
export function PageHeader(head: string | PageHeaderOptions, ...actions: Child[]): HTMLDivElement {
  const { title, intro, crumbs = [] } = typeof head === 'string' ? { title: head } : head;
  return h('div', { class: 'page-head' },
    h('div', { class: 'page-head__text' },
      crumbs.length > 0 && h('nav', { class: 'crumbs' }, crumbs.map((c) => [h('a', { href: c.href }, c.label), Icon('chevron-right', { size: 'small' })]), h('span', {}, title)),
      Heading(1, title),
      intro && h('p', { class: 'page-head__intro' }, intro),
    ),
    h('div', { class: 'page-head__actions' }, actions),
  );
}
