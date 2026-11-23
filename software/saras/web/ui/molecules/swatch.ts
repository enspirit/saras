import { h } from '../dom.ts';

/** One colour token, shown in the style guide. */
export function Swatch(token: string): HTMLDivElement {
  const chip = h('span', { class: 'swatch__chip' });
  chip.style.background = `var(${token})`;
  return h('div', { class: 'swatch' }, chip, h('span', { class: 'swatch__name' }, token));
}
