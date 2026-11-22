import { h } from '../dom.ts';

/** Something is in progress. */
export const Spinner = (): HTMLSpanElement => h('span', { class: 'spinner', 'aria-hidden': 'true' });
