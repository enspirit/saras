import { h } from '../dom.ts';

export interface CheckOption {
  value: string;
  label: string;
  checked?: boolean;
}

export interface CheckGroupHandle {
  element: HTMLFieldSetElement;
  /** The values ticked, in the order of the options. */
  values(): string[];
}

/** Several among a few: none ticked means "any". */
export function CheckGroup({ legend, name, options, hint }: { legend: string; name: string; options: CheckOption[]; hint?: string }): CheckGroupHandle {
  const boxes = options.map((o) => h('input', { class: 'checkbox', type: 'checkbox', name, value: o.value, checked: o.checked }));
  const element = h('fieldset', { class: 'check-group' },
    h('legend', { class: 'check-group__legend' }, legend),
    h('div', { class: 'check-group__list' }, options.map((o, i) => h('label', { class: 'check-group__option' }, boxes[i], o.label))),
    hint && h('p', { class: 'check-group__hint' }, hint),
  );
  return { element, values: () => boxes.filter((box) => box.checked).map((box) => box.value) };
}
