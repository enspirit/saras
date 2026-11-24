import { cx, h } from '../dom.ts';
import type { Attrs } from '../dom.ts';

/** What a field is filled with when it signs someone in: a password manager may offer it. */
const CREDENTIALS = new Set(['username', 'current-password', 'new-password', 'one-time-code']);

/** What tells password managers (1Password, LastPass, Bitwarden, Dashlane) and the browser to leave a field alone. */
export const NOT_A_CREDENTIAL: Attrs = { autocomplete: 'off', 'data-1p-ignore': true, 'data-lpignore': 'true', 'data-bwignore': true, 'data-form-type': 'other' };

/** A field a password manager may fill: a password, or what signs in beside it. */
const isCredential = (attrs: Attrs): boolean => attrs.type === 'password' || CREDENTIALS.has(String(attrs.autocomplete ?? ''));

/** Any native input attribute is accepted: type, value, placeholder, required, autocomplete… A field that is no credential is left alone by password managers. */
export function Input(attrs: Attrs = {}): HTMLInputElement {
  return h('input', { type: 'text', ...(isCredential(attrs) ? {} : NOT_A_CREDENTIAL), ...attrs, class: 'input' });
}

export interface SelectOption {
  value: string | number;
  label: string;
  selected?: boolean;
}

export function Select(options: SelectOption[], attrs: Attrs = {}): HTMLSelectElement {
  return h('select', { ...NOT_A_CREDENTIAL, ...attrs, class: 'input' }, options.map((o) => h('option', { value: o.value, selected: o.selected }, o.label)));
}

/** @param tall a writing surface rather than a short note */
export function Textarea({ value = '', tall = false, ...attrs }: Attrs & { value?: string; tall?: boolean } = {}): HTMLTextAreaElement {
  const el = h('textarea', { ...NOT_A_CREDENTIAL, ...attrs, class: cx('input', tall && 'input--tall') });
  el.value = value;
  return el;
}

export function Checkbox(attrs: Attrs = {}): HTMLInputElement {
  return h('input', { ...attrs, type: 'checkbox', class: 'checkbox' });
}
