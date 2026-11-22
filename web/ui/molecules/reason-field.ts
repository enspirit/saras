import { h } from '../dom.ts';

/** Asked where a proposal was edited: why, with a hint on what the answer is for and who reads it. */
export const ReasonField = (label: string, input: HTMLInputElement, hint: string): HTMLDivElement =>
  h('div', { class: 'reason' }, h('label', { class: 'reason__row' }, label, input), h('span', { class: 'reason__hint' }, hint));
