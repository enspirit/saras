import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** A scrolling column, centred. */
export const Page = (...children: Child[]): HTMLDivElement => h('div', { class: 'page' }, h('div', { class: 'page__inner' }, children));

/** What one works on, and beside it what informs the work. */
export const Columns = (main: Child, aside: Child): HTMLDivElement => h('div', { class: 'columns' }, h('div', {}, main), h('aside', {}, aside));
