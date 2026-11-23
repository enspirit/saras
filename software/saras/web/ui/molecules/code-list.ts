import { h } from '../dom.ts';

/** A few codes to copy down, one per line, in the type of code. */
export const CodeList = (codes: string[]): HTMLUListElement => h('ul', { class: 'code-list' }, codes.map((code) => h('li', { class: 'code-list__code' }, code)));
