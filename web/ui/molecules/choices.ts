import { cx, h } from '../dom.ts';

export interface ChoiceOption {
  value: string;
  title: string;
  hint?: string;
  /** Cannot be chosen; the hint should say why. */
  disabled?: boolean;
}

export interface ChoicesHandle {
  element: HTMLFieldSetElement;
  value(): string;
  /** Replaces the options, e.g. once they are known. */
  setOptions(options: ChoiceOption[], value?: string): void;
  /** Chooses an option, when it exists and can be chosen. Returns whether it did. */
  select(value: string): boolean;
}

/** One option: its radio, its title, and what choosing it means. */
const Choice = (o: ChoiceOption, name: string, chosen?: string, onChange?: (value: string) => void): HTMLLabelElement =>
  h('label', { class: cx('choice', o.disabled && 'choice--disabled') },
    h('input', { class: 'choice__radio', type: 'radio', name, value: o.value, checked: o.value === chosen, disabled: o.disabled, onchange: () => onChange?.(o.value) }),
    h('span', { class: 'choice__text' }, h('span', { class: 'choice__title' }, o.title), o.hint && h('span', { class: 'choice__hint' }, o.hint)),
  );

/** One among a few, each explained. `rows` lays them out as a list, for names without explanation. */
export function Choices({ legend, name, options, value, rows = false, onChange }: { legend: string; name: string; options: ChoiceOption[]; value?: string; rows?: boolean; onChange?: (value: string) => void }): ChoicesHandle {
  const list = h('div', { class: 'choices__list' });
  const element = h('fieldset', { class: cx('choices', rows && 'choices--rows') }, h('legend', { class: 'choices__legend' }, legend), list);
  const fill = (items: ChoiceOption[], chosen?: string): void => list.replaceChildren(...items.map((o) => Choice(o, name, chosen, onChange)));
  fill(options, value);
  return {
    element,
    value: () => element.querySelector<HTMLInputElement>('input:checked')?.value ?? '',
    setOptions: fill,
    select(wanted) {
      const radio = [...element.querySelectorAll<HTMLInputElement>('input')].find((input) => input.value === wanted && !input.disabled);
      if (radio) radio.checked = true;
      return Boolean(radio);
    },
  };
}
