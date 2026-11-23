import { Icon } from '../atoms/icon.ts';
import type { IconName } from '../atoms/icon.ts';
import { cx, h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** Who decided a value: its sign, and the same in words. */
export interface Sign {
  icon: IconName;
  label: string;
}

export interface AttributeChoice {
  key: string;
  label: Child;
  chosen: boolean;
}

/** One attribute of what is being read: the value it has, who decided it, and the values to choose from. */
export interface AttributeEntry {
  name: string;
  /** The value it has, as it is shown; nothing when it has none. */
  value: Child | null;
  decider?: Sign;
  choices: AttributeChoice[];
  /** Under the choices: who decided, and why. */
  note: Child[];
  onPick: (key: string) => void;
}

/** The values to choose from, and under them what is known of the one it has. */
const ValueMenu = ({ name, choices, note, onPick }: AttributeEntry, close: () => void): HTMLDivElement =>
  h('div', { class: 'value-menu', role: 'dialog', 'aria-label': name },
    h('div', { class: 'value-menu__choices' }, choices.map((choice) =>
      h('button', { class: 'value-menu__choice', type: 'button', 'aria-pressed': String(choice.chosen), onclick: () => (close(), onPick(choice.key)) }, choice.label, choice.chosen && Icon('check', { size: 'small' })))),
    note.length > 0 && h('div', { class: 'value-menu__note' }, note.map((line) => h('p', {}, line))),
  );

/** Opens the menu under its button, and closes it on a choice, a click elsewhere or Escape. */
function opening(wrap: HTMLElement, button: HTMLButtonElement, entry: AttributeEntry): () => void {
  let menu: HTMLElement | null = null;
  const outside = (event: Event): void => void (!wrap.contains(event.target as Node) && close());
  const escape = (event: KeyboardEvent): void => void (event.key === 'Escape' && (close(), button.focus()));
  function close(): void {
    menu?.remove();
    menu = null;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside);
    document.removeEventListener('keydown', escape);
  }
  return () => {
    if (menu) return close();
    menu = wrap.appendChild(ValueMenu(entry, close));
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
  };
}

/** One attribute as a button: its name, its value, and the sign of who decided it. */
function AttributeProp(entry: AttributeEntry): HTMLSpanElement {
  const { name, value, decider } = entry;
  const button = h('button', { class: cx('attribute-prop__button', !value && 'attribute-prop__button--unset'), type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: decider?.label },
    !value && Icon('plus', { size: 'small' }), h('span', { class: 'attribute-prop__name' }, name), value, decider && Icon(decider.icon, { size: 'small' }));
  const wrap = h('span', { class: 'attribute-prop' }, button);
  button.addEventListener('click', opening(wrap, button, entry));
  return wrap;
}

/** The attributes of what is being read, on one line; `legend` says what each sign of who decided means. */
export const AttributeBar = (entries: AttributeEntry[], { label, legend }: { label: string; legend: Sign[] }): HTMLDivElement =>
  h('div', { class: 'attribute-bar', role: 'group', 'aria-label': label },
    entries.map(AttributeProp),
    h('span', { class: 'attribute-bar__legend' }, legend.map(({ icon, label: meaning }) => h('span', { class: 'attribute-bar__sign' }, Icon(icon, { size: 'small' }), meaning))),
  );

/** Who decides, in a line of a table: the signs, then the words. */
export const DecidedBy = (icons: IconName[], label: string): HTMLSpanElement =>
  h('span', { class: 'decided-by' }, icons.map((icon) => Icon(icon, { size: 'small' })), label);

/** A few values side by side. */
export const ValueList = (...values: Child[]): HTMLSpanElement => h('span', { class: 'value-list' }, values);
