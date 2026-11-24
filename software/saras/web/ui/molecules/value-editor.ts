import { NOT_A_CREDENTIAL } from '../atoms/input.ts';
import { Icon } from '../atoms/icon.ts';
import { ValueChip, toneClass } from '../atoms/value-chip.ts';
import type { Tone } from '../atoms/value-chip.ts';
import { cx, h } from '../dom.ts';
import { popover } from '../popover.ts';

export interface EditedValue {
  label: string;
  color: Tone;
}

export interface ValueEditorHandle {
  /** It says `change` each time a value is added, removed or given another colour. */
  element: HTMLDivElement;
  /** The values as they stand, what is being typed included. */
  values(): EditedValue[];
}

export interface ValueEditorOptions {
  values: EditedValue[];
  /** The colours a value can take, in the order they are offered. */
  colors: readonly Tone[];
  /** None is added, removed or renamed: only the colour of each can be changed. */
  fixed?: boolean;
  placeholder: string;
  /** The accessible names: of the button that opens the colours of a value, of each colour, of the button that removes a value. */
  colorLabel: (label: string) => string;
  colorName: (color: Tone) => string;
  removeLabel: (label: string) => string;
}

type Change = () => void;

/** The colours to choose from, the one the value has marked. */
const Palette = (value: EditedValue, { colors, colorLabel, colorName }: ValueEditorOptions, pick: (color: Tone) => void): HTMLDivElement =>
  h('div', { class: 'value-editor__palette', role: 'dialog', 'aria-label': colorLabel(value.label) }, colors.map((color) =>
    h('button', { class: cx('value-editor__swatch', toneClass(color)), type: 'button', 'aria-label': colorName(color), title: colorName(color), 'aria-pressed': String(color === value.color), onclick: () => pick(color) },
      color === value.color && Icon('check', { size: 'small' }))));

/** One value: its dot, which opens its colours, its label, and the way to remove it unless the values are fixed. */
function EditedChip(value: EditedValue, options: ValueEditorOptions, values: EditedValue[], changed: Change): HTMLSpanElement {
  const { colorLabel, removeLabel, fixed } = options;
  const dot = h('button', { class: 'value-editor__dot', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-label': colorLabel(value.label), title: colorLabel(value.label) });
  const remove = (): void => void (values.splice(values.indexOf(value), 1), changed());
  const removal = !fixed && h('button', { class: 'value-editor__remove', type: 'button', 'aria-label': removeLabel(value.label), title: removeLabel(value.label), onclick: remove }, Icon('x', { size: 'small' }));
  const chip = ValueChip([dot, value.label, removal], { color: value.color, plain: true });
  const item = h('span', { class: 'value-editor__item' }, chip);
  dot.addEventListener('click', popover(item, dot, (close) => Palette(value, options, (color) => (close(), (value.color = color), changed()))));
  return item;
}

/** Takes what is typed as one more value, unless it is empty or already there. */
function add(input: HTMLInputElement, values: EditedValue[], changed: Change): void {
  const label = input.value.trim();
  input.value = '';
  if (!label || values.some((value) => value.label === label)) return;
  values.push({ label, color: 'grey' });
  changed();
}

/** Where a value is typed: Enter or a comma adds it, Backspace on nothing removes the last. */
function AddInput(placeholder: string, values: EditedValue[], changed: Change): HTMLInputElement {
  const input = h('input', { ...NOT_A_CREDENTIAL, class: 'value-editor__input', type: 'text', maxLength: 60, placeholder, 'aria-label': placeholder });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') (event.preventDefault(), add(input, values, changed), input.focus());
    else if (event.key === 'Backspace' && !input.value && values.pop()) changed();
  });
  input.addEventListener('blur', () => add(input, values, changed));
  return input;
}

/** The values of a choice: typed one by one, each with a colour chosen among a few, in the order they are given. Fixed, they only change colour. */
export function ValueEditor(options: ValueEditorOptions): ValueEditorHandle {
  const values = options.values.map((value) => ({ ...value }));
  const element = h('div', { class: 'value-editor' });
  const changed = (refocus = false): void => (render(refocus), void element.dispatchEvent(new Event('change')));
  const input = AddInput(options.placeholder, values, () => changed(true));
  function render(refocus = false): void {
    const chips = values.map((value) => EditedChip(value, options, values, () => changed()));
    element.replaceChildren(...chips, ...(options.fixed ? [] : [input]));
    if (refocus) input.focus();
  }
  render();
  return { element, values: () => [...values, ...(!options.fixed && input.value.trim() ? [{ label: input.value.trim(), color: 'grey' as Tone }] : [])] };
}
