import { h } from '../dom.ts';

/** In a row, pushes what follows to the far end. */
export const Spacer = (): HTMLSpanElement => h('span', { class: 'spacer' });
