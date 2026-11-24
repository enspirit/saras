import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** A scrolling column, centred. */
export const Page = (...children: Child[]): HTMLDivElement => h('div', { class: 'page' }, h('div', { class: 'page__inner' }, children));

/**
 * What one works on, and beside it what informs the work. `wide`: the work needs room (a rule
 * being written), so the page takes what the screen has and what informs it is a narrow column.
 */
export const Columns = (main: Child, aside: Child, { wide = false }: { wide?: boolean } = {}): HTMLDivElement =>
  h('div', { class: wide ? 'columns columns--wide' : 'columns' }, h('div', {}, main), h('aside', {}, aside));
