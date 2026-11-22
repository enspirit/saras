import { Icon } from './icon.ts';
import type { IconName, Size } from './icon.ts';
import { Spinner } from './spinner.ts';
import { cx, h } from '../dom.ts';

/**
 * 'danger' marks a destructive action among others; 'destructive' is the same action about to
 * happen, in a confirmation. 'ghost' has no frame. 'tool' is a compact button of a toolbar.
 */
export type ButtonVariant = 'default' | 'primary' | 'danger' | 'destructive' | 'ghost' | 'link' | 'tool';

export interface ButtonOptions {
  variant?: ButtonVariant;
  size?: Size;
  /** Shown before the label. */
  icon?: IconName;
  /** Shows the icon alone; the label becomes the accessible name and the tooltip. */
  iconOnly?: boolean;
  type?: 'button' | 'submit';
  /** Takes the full width of its container. */
  block?: boolean;
  /** Without frame nor rounding: for a button that is one part of a joined control. */
  flush?: boolean;
  title?: string;
  onClick?: (event: MouseEvent) => void;
}

export function Button(label: string, { variant = 'default', size = 'medium', icon, iconOnly = false, type = 'button', block = false, flush = false, title, onClick }: ButtonOptions = {}): HTMLButtonElement {
  const className = cx('btn', variant !== 'default' && `btn--${variant}`, size !== 'medium' && `btn--${size}`, iconOnly && 'btn--icon-only', block && 'btn--block', flush && 'btn--flush');
  return h('button', { class: className, type, title: title ?? (iconOnly ? label : undefined), 'aria-label': iconOnly ? label : null, onclick: onClick }, icon && Icon(icon), !iconOnly && label);
}

/** Puts a button in its busy state (a spinner in place of its icon, no click) or takes it out of it. */
export function setBusy(button: HTMLButtonElement, busy: boolean): void {
  button.querySelector(':scope > .spinner')?.remove();
  if (busy) button.prepend(Spinner());
  button.disabled = busy;
  if (busy) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
}

export interface ButtonLinkOptions {
  href?: string;
  variant?: ButtonVariant;
  /** Keeps it visible but inert; `title` should say why. */
  disabled?: boolean;
  title?: string;
}

/** A link that looks like a button. */
export function ButtonLink(label: string, { href, variant = 'default', disabled = false, title }: ButtonLinkOptions = {}): HTMLElement {
  const className = cx('btn', variant !== 'default' && `btn--${variant}`);
  return disabled ? h('span', { class: className, 'aria-disabled': 'true', title }, label) : h('a', { class: className, href, title }, label);
}
