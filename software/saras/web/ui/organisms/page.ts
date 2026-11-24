import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** A scrolling column, from the left edge every page starts at. */
export const Page = (...children: Child[]): HTMLDivElement => h('div', { class: 'page' }, h('div', { class: 'page__inner' }, children));

/** What one works on, and beside it, in a narrow column, what informs the work. */
export const Columns = (main: Child, aside: Child): HTMLDivElement => h('div', { class: 'columns' }, h('div', {}, main), h('aside', {}, aside));
