import { Icon } from '../atoms/icon.ts';
import { h } from '../dom.ts';

/** A standing guarantee, e.g. the data-retention policy. */
export const Assurance = (text: string, title?: string): HTMLDivElement => h('div', { class: 'assurance', title }, Icon('lock'), h('span', {}, text));
