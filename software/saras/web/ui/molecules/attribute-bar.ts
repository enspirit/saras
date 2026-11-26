import { Icon } from '../atoms/icon.ts';
import { toneClass } from '../atoms/value-chip.ts';
import type { Tone } from '../atoms/value-chip.ts';
import type { IconName } from '../atoms/icon.ts';
import { cx, h } from '../dom.ts';
import type { Child } from '../dom.ts';
import { popover } from '../popover.ts';

export interface AttributeChoice {
  key: string;
  label: Child;
  chosen: boolean;
  /** The colour of the value: the row of the one it has is tinted with it. */
  tone?: Tone;
}

/** One attribute of what is being read: the value it has, why, and the values to choose from. */
export interface AttributeEntry {
  name: string;
  /** The value it has, as it is shown; nothing when it has none. */
  value: Child | null;
  /** Who decided the value, and why: the tooltip. */
  why: string;
  /** What the cross that clears the value says, to a screen reader and as a tooltip. */
  clearLabel: string;
  choices: AttributeChoice[];
  /** A value's key, or '' to clear it. */
  onPick: (key: string) => void;
  /** Clears the value: the menu stays open, to choose another. */
  onClear: () => void;
  /** Its menu is open as soon as the bar is shown: the bar was drawn again after a value was cleared. */
  open?: boolean;
  /** A value typed at the end of the menu, when one may be added. */
  onAdd?: (label: string) => void;
  /** The placeholder of that field. */
  addLabel: string;
}

/** The cross that clears a value. */
const ClearButton = (label: string, clear: () => void): HTMLButtonElement =>
  h('button', { class: 'clear-value', type: 'button', 'aria-label': label, title: label, onclick: clear }, Icon('x', { size: 'small' }));

/** One value to choose; the row of the one it has is tinted with its colour, and ends with a cross that clears it. */
const ChoiceRow = (choice: AttributeChoice, { clearLabel, onPick, onClear }: AttributeEntry, close: () => void): HTMLDivElement =>
  h('div', { class: cx('value-menu__row', choice.chosen && 'value-menu__row--chosen', choice.chosen && toneClass(choice.tone)) },
    h('button', { class: 'value-menu__choice', type: 'button', 'aria-pressed': String(choice.chosen), onclick: () => (close(), onPick(choice.key)) }, choice.label),
    choice.chosen && ClearButton(clearLabel, onClear));

/** The last row of the menu: a value typed, added on Enter. */
function AddRow(label: string, add: (label: string) => void, close: () => void): HTMLFormElement {
  const input = h('input', { class: 'value-menu__input', type: 'text', placeholder: label, 'aria-label': label, maxlength: '60' });
  const submit = (event: Event): void => {
    event.preventDefault();
    const typed = input.value.trim();
    if (typed) (close(), add(typed));
  };
  return h('form', { class: 'value-menu__add', onsubmit: submit }, Icon('plus', { size: 'small' }), input);
}

/** The values to choose from, and a field to add one when it may be. */
const ValueMenu = (entry: AttributeEntry, close: () => void): HTMLDivElement =>
  h('div', { class: 'value-menu', role: 'dialog', 'aria-label': entry.name },
    h('div', { class: 'value-menu__choices' }, entry.choices.map((choice) => ChoiceRow(choice, entry, close))),
    entry.onAdd && AddRow(entry.addLabel, entry.onAdd, close));

/** One attribute as a button: its name and its value, who decided it as a tooltip. */
function AttributeProp(entry: AttributeEntry): HTMLSpanElement {
  const { name, value, why } = entry;
  const button = h('button', { class: cx('attribute-prop__button', !value && 'attribute-prop__button--unset'), type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: why || undefined },
    !value && Icon('plus', { size: 'small' }), h('span', { class: 'attribute-prop__name' }, name), value);
  const wrap = h('span', { class: 'attribute-prop' }, button);
  button.addEventListener('click', popover(wrap, button, (close) => ValueMenu(entry, close)));
  if (entry.open) requestAnimationFrame(() => button.click());
  return wrap;
}

/** The attributes of what is being read, as a tool bar under its header. Who decided a value is said by its tooltip. */
export const AttributeBar = (entries: AttributeEntry[], label: string): HTMLDivElement =>
  h('div', { class: 'attribute-bar', role: 'toolbar', 'aria-label': label }, entries.map(AttributeProp));

/** Who decides, in a line of a table: the signs, then the words. */
export const DecidedBy = (icons: IconName[], label: string): HTMLSpanElement =>
  h('span', { class: 'decided-by' }, icons.map((icon) => Icon(icon, { size: 'small' })), label);

/** A few values side by side. */
export const ValueList = (...values: Child[]): HTMLSpanElement => h('span', { class: 'value-list' }, values);
