import { NOT_A_CREDENTIAL } from '../atoms/input.ts';
import { Chip } from '../atoms/chip.ts';
import { h } from '../dom.ts';

export interface RecipientFieldOptions {
  /** 'To', 'Cc'. */
  label: string;
  values?: string[];
  /** Accessible name of the button that removes an address. */
  removeLabel: (address: string) => string;
}

export interface RecipientFieldHandle {
  element: HTMLDivElement;
  getValues(): string[];
  setValues(values: string[]): void;
  onChange(listener: () => void): void;
}

const isAddress = (text: string): boolean => /^[^@\s]+@[^@\s]+$/.test(text);
const typedIn = (input: HTMLInputElement): string[] => input.value.split(/[,;\s]+/).map((a) => a.trim()).filter(Boolean);

/** Wires the place to type: Enter, a comma or leaving it adds what was typed; Backspace when it is empty removes the last address. */
function wireTyping(input: HTMLInputElement, current: () => string[], change: (next: string[]) => void): void {
  const commit = (): void => {
    const typed = typedIn(input);
    if (!typed.length) return;
    input.value = '';
    change([...current(), ...typed]);
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
      input.focus();
    } else if (event.key === 'Backspace' && !input.value && current().length) {
      change(current().slice(0, -1));
      input.focus();
    }
  });
  input.addEventListener('blur', commit);
}

/**
 * Addresses shown one by one, each removable, with a place to type another: Enter, a comma
 * or leaving the field adds it; Backspace in the empty field removes the last one.
 */
export function RecipientField({ label, values = [], removeLabel }: RecipientFieldOptions): RecipientFieldHandle {
  let addresses: string[] = [];
  const listeners: (() => void)[] = [];
  const input = h('input', { ...NOT_A_CREDENTIAL, class: 'recipients__input', type: 'email', 'aria-label': label });
  const element = h('div', { class: 'recipients' });
  const chip = (address: string): HTMLSpanElement =>
    Chip(address, { invalid: !isAddress(address), removeLabel: removeLabel(address), onRemove: () => change(addresses.filter((a) => a !== address)) });
  const show = (next: string[]): void => {
    addresses = [...new Set(next)];
    element.replaceChildren(h('span', { class: 'recipients__label' }, label), ...addresses.map(chip), input);
  };
  const change = (next: string[]): void => {
    show(next);
    for (const listener of listeners) listener();
  };
  wireTyping(input, () => addresses, change);
  show(values);
  return { element, getValues: () => [...addresses], setValues: show, onChange: (listener) => void listeners.push(listener) };
}
