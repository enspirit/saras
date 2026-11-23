import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** Label and value, line by line. */
export const Facts = (rows: [string, Child][]): HTMLElement => h('dl', { class: 'facts' }, rows.map(([label, value]) => [h('dt', {}, label), h('dd', {}, value)]));
