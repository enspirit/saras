/**
 * ATOMS — styled by design/atoms.css. Each returns a DOM node and takes its content last.
 * Pages never write a class name: they call these.
 */
import { cx, h } from './dom.ts';
import type { Attrs, Child } from './dom.ts';
import { sanitizeToFragment } from './sanitize.ts';

/**
 * 'danger' marks a destructive action among others; 'destructive' is the same action about to
 * happen, in a confirmation. 'ghost' has no frame. 'tool' is a compact button of a toolbar.
 */
export type ButtonVariant = 'default' | 'primary' | 'danger' | 'destructive' | 'ghost' | 'link' | 'tool';
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
  /** Who offers this installation, shown next to the name on the sign-in screen ("by …"). */
  byline: string;
  /** Small print under the sign-in form ("Engineered by …"). */
  credit: string;
  /** The installation and the AI it calls are hosted in Europe: the sign-in screen may say so. */
  euHosting: boolean;
}

/** The glyphs of the icon font that the interface uses (see .icon in design/atoms.css). */
export type IconName =
  | 'archive' | 'bold' | 'check' | 'chevron-down' | 'chevron-right' | 'copy' | 'folder' | 'key' | 'shield-check' | 'user-plus' | 'circle-alert' | 'eye-off' | 'file-text' | 'globe' | 'inbox' | 'info' | 'italic'
  | 'link' | 'list' | 'list-ordered' | 'lock' | 'log-out' | 'mail' | 'mail-check' | 'paperclip' | 'pen-line' | 'pencil' | 'plug' | 'plus'
  | 'refresh-cw' | 'remove-formatting' | 'reply' | 'search' | 'send' | 'settings' | 'spell-check' | 'timer' | 'trash' | 'triangle-alert'
  | 'underline' | 'undo' | 'users' | 'x';
export type Size = 'small' | 'medium' | 'large';

/** A decorative glyph: what it means is always said in words next to it, or by its button's label. */
export function Icon(name: IconName, { size = 'medium' }: { size?: Size } = {}): HTMLElement {
  return h('i', { class: cx('icon', `icon--${name}`, size !== 'medium' && `icon--${size}`), 'aria-hidden': 'true' });
}

/** Something is in progress. */
export const Spinner = (): HTMLSpanElement => h('span', { class: 'spinner', 'aria-hidden': 'true' });

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

/** Rich text from elsewhere (a reply, a proposal), sanitised before it is shown. */
export function RichText(html: string): HTMLDivElement {
  const el = h('div', { class: 'rich' });
  el.append(sanitizeToFragment(html));
  return el;
}

/** A person, as the initials of their name (or of the start of their address). */
export function Avatar(name: string, { size = 'medium', icon }: { size?: 'small' | 'medium'; icon?: IconName } = {}): HTMLSpanElement {
  const words = name.split('@')[0]?.split(/[\s._-]+/).filter(Boolean) ?? [];
  const initials = words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  // With an icon it stands for something other than one person, e.g. a mailbox shared by a team.
  return h('span', { class: cx('avatar', size === 'small' && 'avatar--small', icon && 'avatar--neutral'), 'aria-hidden': 'true' }, icon ? Icon(icon) : initials);
}

/** Text for screen readers only. */
export const SrOnly = (text: string): HTMLSpanElement => h('span', { class: 'sr-only' }, text);

export interface ChipOptions {
  /** Called when its remove button is pressed; without it the chip cannot be removed. */
  onRemove?: () => void;
  /** Accessible name of the remove button. */
  removeLabel?: string;
  invalid?: boolean;
  /** Shown before the label, e.g. a paperclip for a file. */
  icon?: IconName;
  title?: string;
}

/** One value among several, e.g. a recipient. */
export function Chip(label: string, { onRemove, removeLabel, invalid = false, icon, title }: ChipOptions = {}): HTMLSpanElement {
  return h('span', { class: cx('chip', !onRemove && 'chip--fixed', invalid && 'chip--invalid'), title }, icon && Icon(icon, { size: 'small' }), label,
    onRemove && h('button', { class: 'chip__remove', type: 'button', 'aria-label': removeLabel, title: removeLabel, onclick: onRemove }, Icon('x', { size: 'small' })),
  );
}

/** A passage the AI left open, to complete before sending. */
export const TodoMark = (label: string): HTMLElement => h('mark', { class: 'todo-mark' }, Icon('triangle-alert', { size: 'small' }), label);

/** In a row, pushes what follows to the far end. */
export const Spacer = (): HTMLSpanElement => h('span', { class: 'spacer' });

/** The product's name, or the brand's logo when it has one (with an optional variant for dark mode). */
export function BrandMark({ name, logo, logoDark }: Pick<Brand, 'name' | 'logo' | 'logoDark'>, { large = false, onDark = false }: { large?: boolean; onDark?: boolean } = {}): HTMLDivElement {
  // On a ground that is dark in both schemes, the dark variant is the one to show.
  const image = logo && (onDark
    ? h('img', { class: 'brandmark__logo', src: logoDark ?? logo, alt: name })
    : h('picture', {},
      logoDark && h('source', { srcset: logoDark, media: '(prefers-color-scheme: dark)' }),
      h('img', { class: 'brandmark__logo', src: logo, alt: name }),
    ));
  return h('div', { class: cx('brandmark', large && 'brandmark--large') }, image || name);
}
