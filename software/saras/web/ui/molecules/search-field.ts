import { Icon } from '../atoms/icon.ts';
import { NOT_A_CREDENTIAL } from '../atoms/input.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

export interface SearchFieldOptions {
  /** What is searched, said to who cannot see the field, and shown in it while it is empty. */
  label: string;
  clearLabel: string;
  value?: string;
  /** Called once typing pauses, and at once when the field is cleared. */
  onSearch: (text: string) => void;
}

/** How long typing pauses before what is typed is searched. */
const PAUSE_MS = 250;

/** A field to search a list with, as one types; Escape or its cross clears it. */
export function SearchField({ label, clearLabel, value = '', onSearch }: SearchFieldOptions): HTMLDivElement {
  let waiting: ReturnType<typeof setTimeout> | undefined;
  const input = h('input', { ...NOT_A_CREDENTIAL, class: 'search-field__input', type: 'search', value, placeholder: label, 'aria-label': label });
  const clear = h('button', { class: 'search-field__clear', type: 'button', title: clearLabel, 'aria-label': clearLabel, hidden: !value }, Icon('x', { size: 'small' }));
  const search = (text: string, now = false): void => {
    clearTimeout(waiting);
    clear.hidden = !text;
    waiting = setTimeout(() => onSearch(text.trim()), now ? 0 : PAUSE_MS);
  };
  input.addEventListener('input', () => search(input.value));
  input.addEventListener('keydown', (event) => event.key === 'Escape' && input.value && (event.preventDefault(), (input.value = ''), search('', true)));
  clear.addEventListener('click', () => ((input.value = ''), search('', true), input.focus()));
  return h('div', { class: 'search-field', role: 'search' }, Icon('search', { size: 'small' }), input, clear);
}

/** Under a search field, while something is searched: where it was searched, and a way to search further. */
export const SearchScope = (text: Child, further?: Child): HTMLParagraphElement => h('p', { class: 'search-scope' }, text, further && [' ', further]);
