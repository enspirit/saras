import { Button } from '../atoms/button.ts';
import { Icon } from '../atoms/icon.ts';
import { ValueChip } from '../atoms/value-chip.ts';
import type { Tone } from '../atoms/value-chip.ts';
import { h } from '../dom.ts';
import { popover } from '../popover.ts';

/** One value that can be picked: what it is called, and its colour when it has one. */
export interface PickOption {
  key: string;
  label: string;
  color?: Tone;
}

export interface ValuePickerHandle {
  element: HTMLSpanElement;
  /** The keys picked, in the order of the options. */
  values(): string[];
}

export interface ValuePickerOptions {
  options: PickOption[];
  picked: string[];
  /** The button that offers one more value, and the accessible name of the one that takes a value away. */
  addLabel: string;
  removeLabel: (label: string) => string;
  onChange?: () => void;
}

/** The values not picked yet, to pick one more from. */
const PickMenu = (left: PickOption[], pick: (key: string) => void): HTMLDivElement =>
  h('div', { class: 'pick-menu', role: 'menu' }, left.map((option) =>
    h('button', { class: 'pick-menu__item', type: 'button', role: 'menuitem', onclick: () => pick(option.key) }, ValueChip(option.label, { color: option.color, plain: !option.color }))));

/** A few values picked among those there are: each a chip that can be taken away, and a way to add one more. */
export function ValuePicker({ options, picked, addLabel, removeLabel, onChange }: ValuePickerOptions): ValuePickerHandle {
  const chosen = new Set(picked.filter((key) => options.some((o) => o.key === key)));
  const element = h('span', { class: 'value-picker' });
  const change = (make: () => void) => (): void => (make(), render(), onChange?.());
  const chip = (o: PickOption): HTMLSpanElement => ValueChip([o.label,
    h('button', { class: 'value-picker__remove', type: 'button', 'aria-label': removeLabel(o.label), title: removeLabel(o.label), onclick: change(() => chosen.delete(o.key)) }, Icon('x', { size: 'small' })),
  ], { color: o.color, plain: !o.color });
  function render(): void {
    const left = options.filter((o) => !chosen.has(o.key));
    const add = h('button', { class: 'value-picker__add', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, addLabel);
    const anchor = h('span', { class: 'value-picker__anchor' }, add);
    add.addEventListener('click', popover(anchor, add, () => PickMenu(left, (key) => change(() => chosen.add(key))())));
    element.replaceChildren(...options.filter((o) => chosen.has(o.key)).map(chip), ...(left.length ? [anchor] : []));
  }
  render();
  return { element, values: () => options.filter((o) => chosen.has(o.key)).map((o) => o.key) };
}

/** Something a condition can be put on: its name, the word that links it to its value, and the control that holds the value. */
export interface Condition {
  key: string;
  name: string;
  /** The linking word, or the control that chooses it when the condition can be said both ways: "is", "is not". */
  verb: string | HTMLElement;
  control: HTMLElement;
  /** The group it is offered under, when one adds a condition. */
  group: string;
}

export interface ConditionListHandle {
  element: HTMLDivElement;
  /** The keys of the conditions that are there. */
  present(): string[];
}

export interface ConditionListOptions {
  conditions: Condition[];
  present: string[];
  /** Between two conditions, the button that adds one, the name of the one that removes one, and what is said when there is none. */
  and: string;
  addLabel: string;
  removeLabel: (name: string) => string;
  emptyText: string;
  onChange?: () => void;
}

/** One condition: what it is on, the linking word, its value, and the way to remove it. */
const Row = ({ name, verb, control }: Condition, removeLabel: string, remove: () => void): HTMLDivElement =>
  h('div', { class: 'condition', role: 'group', 'aria-label': name },
    h('span', { class: 'condition__name' }, name), h('span', { class: 'condition__verb' }, verb), h('span', { class: 'condition__value' }, control),
    Button(removeLabel, { variant: 'ghost', size: 'small', icon: 'trash', iconOnly: true, onClick: remove }));

/** What a condition can still be put on, under the group of each. */
function AddMenu(absent: Condition[], add: (key: string) => void): HTMLDivElement {
  const groups = [...new Set(absent.map((c) => c.group))];
  return h('div', { class: 'pick-menu', role: 'menu' }, groups.map((group) => [
    h('span', { class: 'pick-menu__group' }, group),
    absent.filter((c) => c.group === group).map((c) => h('button', { class: 'pick-menu__item', type: 'button', role: 'menuitem', onclick: () => add(c.key) }, c.name)),
  ]));
}

/** Conditions that must all hold, as a list one adds to: only those given are there, the others are offered. */
export function ConditionList({ conditions, present, and, addLabel, removeLabel, emptyText, onChange }: ConditionListOptions): ConditionListHandle {
  const there = new Set(present);
  const element = h('div', { class: 'condition-list' });
  const change = (make: () => void): void => (make(), render(), onChange?.());
  function render(): void {
    const rows = conditions.filter((c) => there.has(c.key)).map((c) => Row(c, removeLabel(c.name), () => change(() => there.delete(c.key))));
    const absent = conditions.filter((c) => !there.has(c.key));
    const add = Button(addLabel, { size: 'small', icon: 'plus' });
    const anchor = h('span', { class: 'condition-list__add' }, add);
    add.setAttribute('aria-haspopup', 'menu');
    add.addEventListener('click', popover(anchor, add, () => AddMenu(absent, (key) => change(() => there.add(key)))));
    const joined = rows.flatMap((row, i) => (i ? [h('span', { class: 'condition-list__and', 'aria-hidden': 'true' }, and), row] : [row]));
    element.replaceChildren(...(rows.length ? joined : [h('p', { class: 'condition-list__empty' }, emptyText)]), ...(absent.length ? [anchor] : []));
  }
  render();
  return { element, present: () => conditions.filter((c) => there.has(c.key)).map((c) => c.key) };
}
