/**
 * ATOMS — styled by design/atoms.css. Each returns a DOM node and takes its content last.
 * Pages never write a class name: they call these.
 */
import { cx, h } from './dom.js';

/** @param variant 'default' | 'primary' | 'danger' | 'link' */
export function Button(label, { variant = 'default', type = 'button', block = false, title, onClick } = {}) {
  return h('button', { class: cx('btn', variant !== 'default' && `btn--${variant}`, block && 'btn--block'), type, title, onclick: onClick }, label);
}

/** A link that looks like a button. `disabled` keeps it visible but inert (with `title` saying why). */
export function ButtonLink(label, { href, variant = 'default', disabled = false, title } = {}) {
  const className = cx('btn', variant !== 'default' && `btn--${variant}`);
  return disabled ? h('span', { class: className, 'aria-disabled': 'true', title }, label) : h('a', { class: className, href, title }, label);
}

/** @param tone 'accent' | 'ok' | 'warn' | 'danger' | 'neutral' */
export function Badge(label, tone = 'accent') {
  return h('span', { class: cx('badge', tone !== 'accent' && `badge--${tone}`) }, label);
}

/** Any native input attribute is accepted: type, value, placeholder, required, autocomplete… */
export function Input(attrs = {}) {
  return h('input', { type: 'text', ...attrs, class: 'input' });
}

/** @param options [{ value, label, selected }] */
export function Select(options, attrs = {}) {
  return h('select', { ...attrs, class: 'input' }, options.map((o) => h('option', { value: o.value, selected: o.selected }, o.label)));
}

/** @param tall a writing surface rather than a short note */
export function Textarea({ value = '', tall = false, ...attrs } = {}) {
  const el = h('textarea', { ...attrs, class: cx('input', tall && 'input--tall') });
  el.value = value;
  return el;
}

export function Checkbox(attrs = {}) {
  return h('input', { ...attrs, type: 'checkbox', class: 'checkbox' });
}

/** @param tone 'info' | 'ok' | 'warn' | 'danger' */
export function Notice(tone, ...children) {
  return h('p', { class: cx('notice', tone !== 'info' && `notice--${tone}`) }, children);
}

/** A paragraph. @param style { muted, small } */
export function Text({ muted = false, small = false } = {}, ...children) {
  return h('p', { class: cx(muted && 'text--muted', small && 'text--small') || null }, children);
}

/** An inline run of muted text. */
export const Muted = (...children) => h('span', { class: 'text--muted' }, children);
export const Small = (...children) => h('span', { class: 'text--small' }, children);
export const Strong = (...children) => h('strong', {}, children);
export const Code = (text) => h('code', {}, text);
export const Link = (label, href) => h('a', { href }, label);
export const Heading = (level, ...children) => h(`h${level}`, {}, children);
export const List = (items) => h('ul', {}, items.map((item) => h('li', {}, item)));

/** Preformatted plain text that wraps: mail bodies, drafts. */
export const Prose = (text) => h('pre', { class: 'prose' }, text);

/** In a row, pushes what follows to the far end. */
export const Spacer = () => h('span', { class: 'spacer' });

/** The product's name, or the brand's logo when it has one (with an optional variant for dark mode). */
export function BrandMark({ name, logo, logoDark }, { large = false } = {}) {
  const image = logo && h('picture', {},
    logoDark && h('source', { srcset: logoDark, media: '(prefers-color-scheme: dark)' }),
    h('img', { class: 'brandmark__logo', src: logo, alt: name }),
  );
  return h('div', { class: cx('brandmark', large && 'brandmark--large') }, image || name);
}
