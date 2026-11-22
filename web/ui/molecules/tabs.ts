import { h } from '../dom.ts';

/** The parts of one page, each with its own address. */
export const Tabs = (items: { label: string; href: string; current?: boolean }[]): HTMLElement =>
  h('nav', { class: 'tabs' }, items.map((item) => h('a', { class: 'tabs__tab', href: item.href, 'aria-current': item.current ? 'page' : null }, item.label)));
