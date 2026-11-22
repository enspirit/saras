import { Icon } from '../atoms/icon.ts';
import { Checkbox } from '../atoms/input.ts';
import { cx, h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** 'fill' (default) | 'narrow' (ports, short selects) | 'fit' (a button in a form row) */
export type FieldSize = 'fill' | 'narrow' | 'fit';

/**
 * A labelled control with an optional hint. Without a label, the control alone keeps the field's
 * rhythm. An `error` takes the place of the hint, next to the control it is about.
 */
export function Field(label: string | null, control: Child, { hint, error, size = 'fill' }: { hint?: Child; error?: string; size?: FieldSize } = {}): HTMLDivElement {
  if (error && control instanceof Element) control.setAttribute('aria-invalid', 'true');
  return h('div', { class: cx('field', size !== 'fill' && `field--${size}`) },
    label ? h('label', { class: 'field__label' }, label, control) : control,
    error ? h('p', { class: 'field__error', role: 'alert' }, Icon('circle-alert', { size: 'small' }), error) : hint && h('p', { class: 'field__hint' }, hint),
  );
}

/** A checkbox with its label on the same line. Pass your own Checkbox to keep a handle on it. */
export function CheckField(label: string, checkbox: HTMLInputElement = Checkbox(), { size = 'fill' }: { size?: FieldSize } = {}): HTMLDivElement {
  return h('div', { class: cx('field', 'field--check', size !== 'fill' && `field--${size}`) }, h('label', { class: 'field__label' }, checkbox, label));
}

/** Gives any node (a notice, a paragraph) the vertical rhythm of a field. */
export const Block = <T extends Element>(node: T): T => {
  node.classList.add('block');
  return node;
};
