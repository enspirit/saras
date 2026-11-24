import { Button } from '../atoms/button.ts';
import { Icon } from '../atoms/icon.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';
import { popover } from '../popover.ts';

/** How much of a list is ticked: every email shown, some of them, or none. */
export type Ticked = 'all' | 'some' | 'none';

export interface SelectionBarOptions {
  ticked: Ticked;
  /** What the box at its start does, said to who cannot see it. */
  toggleLabel: string;
  onToggle: () => void;
  /** How many are selected, in words. */
  label: Child;
  actions: Child;
  clearLabel: string;
  onClear: () => void;
}

/** Above a list some of whose items are ticked: a box that ticks them all or none, how many are, what can be done to them, and the way out. */
export function SelectionBar({ ticked, toggleLabel, onToggle, label, actions, clearLabel, onClear }: SelectionBarOptions): HTMLDivElement {
  const box = h('input', { class: 'checkbox', type: 'checkbox', checked: ticked === 'all', 'aria-label': toggleLabel, onchange: onToggle });
  box.indeterminate = ticked === 'some';
  return h('div', { class: 'selection-bar', role: 'toolbar', 'aria-label': toggleLabel },
    box,
    h('span', { class: 'selection-bar__label' }, label),
    h('button', { class: 'selection-bar__clear', type: 'button', title: clearLabel, 'aria-label': clearLabel, onclick: onClear }, Icon('x', { size: 'small' })),
    h('span', { class: 'selection-bar__actions' }, actions),
  );
}

/** One of the choices of a menu, under its group. */
export interface MenuChoice {
  label: Child;
  onPick: () => void;
}

/** A button that opens a menu of choices in groups, e.g. the values of each attribute. */
export function GroupedMenu(label: string, groups: { title: string; choices: MenuChoice[] }[]): HTMLSpanElement {
  const button = Button(label, { size: 'small' });
  button.append(Icon('chevron-down', { size: 'small' }));
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  const anchor = h('span', { class: 'grouped-menu' }, button);
  button.addEventListener('click', popover(anchor, button, (close) =>
    h('div', { class: 'grouped-menu__list', role: 'menu' }, groups.map((group) => [
      h('span', { class: 'grouped-menu__group' }, group.title),
      group.choices.map((choice) => h('button', { class: 'grouped-menu__item', type: 'button', role: 'menuitem', onclick: () => (close(), choice.onPick()) }, choice.label)),
    ]))));
  return anchor;
}
