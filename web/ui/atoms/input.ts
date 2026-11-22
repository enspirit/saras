import { cx, h } from '../dom.ts';
import type { Attrs } from '../dom.ts';

/** Any native input attribute is accepted: type, value, placeholder, required, autocomplete… */
export function Input(attrs: Attrs = {}): HTMLInputElement {
  return h('input', { type: 'text', ...attrs, class: 'input' });
}

export interface SelectOption {
  value: string | number;
  label: string;
  selected?: boolean;
}

export function Select(options: SelectOption[], attrs: Attrs = {}): HTMLSelectElement {
  return h('select', { ...attrs, class: 'input' }, options.map((o) => h('option', { value: o.value, selected: o.selected }, o.label)));
}

/** @param tall a writing surface rather than a short note */
export function Textarea({ value = '', tall = false, ...attrs }: Attrs & { value?: string; tall?: boolean } = {}): HTMLTextAreaElement {
  const el = h('textarea', { ...attrs, class: cx('input', tall && 'input--tall') });
  el.value = value;
  return el;
}

export function Checkbox(attrs: Attrs = {}): HTMLInputElement {
  return h('input', { ...attrs, type: 'checkbox', class: 'checkbox' });
}
