import { Heading, SrOnly } from '../atoms/text.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/**
 * The same facts about several things. Each row is its cells in the order of `columns`; with
 * `actions` (the accessible name of that column), one more cell holds the row's controls.
 */
export function Table({ columns, actions, title }: { columns: string[]; actions?: string; title?: string }, rows: Child[][]): HTMLDivElement {
  return h('div', { class: 'table-wrap' },
    title && h('div', { class: 'table-wrap__title' }, Heading(3, title)),
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, columns.map((c) => h('th', { scope: 'col' }, c)), actions && h('th', { scope: 'col' }, SrOnly(actions)))),
      h('tbody', {}, rows.map((cells) => h('tr', {}, cells.map((cell, i) => h('td', {}, actions && i === columns.length ? h('div', { class: 'table__actions' }, cell) : cell))))),
    ),
  );
}
