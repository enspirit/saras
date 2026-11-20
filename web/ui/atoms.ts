/**
 * ATOMS — styled by design/atoms.css. Each returns a DOM node and takes its content last.
 * Pages never write a class name: they call these.
 */
import { cx, h } from './dom.ts';
import type { Attrs, Child } from './dom.ts';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'link';
export type BadgeTone = 'accent' | 'ok' | 'warn' | 'danger' | 'neutral';
export type NoticeTone = 'info' | 'ok' | 'warn' | 'danger';

/** Name, logo and tagline of the installation, as loaded by brand.ts. */
export interface Brand {
  name: string;
  tagline: string;
  /** URL of the logo, when the brand has one. */
  logo: string | null;
  /** URL of the variant used in dark mode. */
  logoDark: string | null;
}

export interface ButtonOptions {
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
  /** Takes the full width of its container. */
  block?: boolean;
  title?: string;
  onClick?: (event: MouseEvent) => void;
}

export function Button(label: string, { variant = 'default', type = 'button', block = false, title, onClick }: ButtonOptions = {}): HTMLButtonElement {
  return h('button', { class: cx('btn', variant !== 'default' && `btn--${variant}`, block && 'btn--block'), type, title, onclick: onClick }, label);
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

export function Badge(label: string, tone: BadgeTone = 'accent'): HTMLSpanElement {
  return h('span', { class: cx('badge', tone !== 'accent' && `badge--${tone}`) }, label);
}

/** Any native input attribute is accepted: type, value, placeholder, required, autocomplete… */
export function Input(attrs: Attrs = {}): HTMLInputElement {
  return h('input', { type: 'text', ...attrs, class: 'input' });
}

export interface SelectOption {
  value: string | number;
  label: string;
  selected?: boolean;
}

export function Select(options: SelectOption[], attrs: Attrs = {}): HTMLSelectElement {
  return h('select', { ...attrs, class: 'input' }, options.map((o) => h('option', { value: o.value, selected: o.selected }, o.label)));
}

/** @param tall a writing surface rather than a short note */
export function Textarea({ value = '', tall = false, ...attrs }: Attrs & { value?: string; tall?: boolean } = {}): HTMLTextAreaElement {
  const el = h('textarea', { ...attrs, class: cx('input', tall && 'input--tall') });
  el.value = value;
  return el;
}

export function Checkbox(attrs: Attrs = {}): HTMLInputElement {
  return h('input', { ...attrs, type: 'checkbox', class: 'checkbox' });
}

export function Notice(tone: NoticeTone, ...children: Child[]): HTMLParagraphElement {
  return h('p', { class: cx('notice', tone !== 'info' && `notice--${tone}`) }, children);
}

/** A paragraph. */
export function Text({ muted = false, small = false }: { muted?: boolean; small?: boolean } = {}, ...children: Child[]): HTMLParagraphElement {
  return h('p', { class: cx(muted && 'text--muted', small && 'text--small') || null }, children);
}

/** An inline run of muted text. */
export const Muted = (...children: Child[]): HTMLSpanElement => h('span', { class: 'text--muted' }, children);
export const Small = (...children: Child[]): HTMLSpanElement => h('span', { class: 'text--small' }, children);
export const Strong = (...children: Child[]): HTMLElement => h('strong', {}, children);
export const Code = (text: string): HTMLElement => h('code', {}, text);
export const Link = (label: string, href: string): HTMLAnchorElement => h('a', { href }, label);
export const Heading = (level: 1 | 2 | 3, ...children: Child[]): HTMLHeadingElement => h(`h${level}`, {}, children);
export const List = (items: Child[]): HTMLUListElement => h('ul', {}, items.map((item) => h('li', {}, item)));

/** Preformatted plain text that wraps: mail bodies, drafts. */
export const Prose = (text: string): HTMLPreElement => h('pre', { class: 'prose' }, text);

/** In a row, pushes what follows to the far end. */
export const Spacer = (): HTMLSpanElement => h('span', { class: 'spacer' });

/** The product's name, or the brand's logo when it has one (with an optional variant for dark mode). */
export function BrandMark({ name, logo, logoDark }: Brand, { large = false }: { large?: boolean } = {}): HTMLDivElement {
  const image = logo && h('picture', {},
    logoDark && h('source', { srcset: logoDark, media: '(prefers-color-scheme: dark)' }),
    h('img', { class: 'brandmark__logo', src: logo, alt: name }),
  );
  return h('div', { class: cx('brandmark', large && 'brandmark--large') }, image || name);
}
