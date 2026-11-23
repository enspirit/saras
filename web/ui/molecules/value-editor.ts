import { Icon } from '../atoms/icon.ts';
import { ValueChip } from '../atoms/value-chip.ts';
import type { Tone } from '../atoms/value-chip.ts';
import { h } from '../dom.ts';

export interface EditedValue {
  label: string;
  color: Tone;
}

export interface ValueEditorHandle {
  element: HTMLDivElement;
  /** The values as they stand, what is being typed included. */
  values(): EditedValue[];
}

export interface ValueEditorOptions {
  values: EditedValue[];
  /** The colours a value can take, in the order a click goes through them. */
  colors: readonly Tone[];
  /** Shown as they are, with nothing to change. */
  fixed?: boolean;
  placeholder: string;
  /** The accessible names of the two buttons of a value. */
  colorLabel: (label: string) => string;
  removeLabel: (label: string) => string;
}

type Change = () => void;

/** One value: its dot, which changes its colour, its label, and the way to remove it. */
function EditedChip(value: EditedValue, { colors, colorLabel, removeLabel }: ValueEditorOptions, values: EditedValue[], changed: Change): HTMLSpanElement {
  const recolour = (): void => {
    value.color = colors[(colors.indexOf(value.color) + 1) % colors.length] ?? value.color;
    changed();
  };
  const remove = (): void => void (values.splice(values.indexOf(value), 1), changed());
  return ValueChip([
    h('button', { class: 'value-editor__dot', type: 'button', 'aria-label': colorLabel(value.label), title: colorLabel(value.label), onclick: recolour }),
    value.label,
    h('button', { class: 'value-editor__remove', type: 'button', 'aria-label': removeLabel(value.label), title: removeLabel(value.label), onclick: remove }, Icon('x', { size: 'small' })),
  ], { color: value.color, plain: true });
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
  const input = h('input', { class: 'value-editor__input', type: 'text', maxLength: 60, placeholder, 'aria-label': placeholder });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') (event.preventDefault(), add(input, values, changed), input.focus());
    else if (event.key === 'Backspace' && !input.value && values.pop()) changed();
  });
  input.addEventListener('blur', () => add(input, values, changed));
  return input;
}

/** The values of a choice: typed one by one, each with a colour, in the order they are given. */
export function ValueEditor(options: ValueEditorOptions): ValueEditorHandle {
  const values = options.values.map((value) => ({ ...value }));
  const element = h('div', { class: 'value-editor' });
  const input = AddInput(options.placeholder, values, () => render(true));
  function render(refocus = false): void {
    const chips = options.fixed ? values.map((value) => ValueChip(value.label, { color: value.color })) : values.map((value) => EditedChip(value, options, values, () => render()));
    element.replaceChildren(...chips, ...(options.fixed ? [] : [input]));
    if (refocus) input.focus();
  }
  render();
  return { element, values: () => [...values, ...(input.value.trim() ? [{ label: input.value.trim(), color: 'grey' as Tone }] : [])] };
}
