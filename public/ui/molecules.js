/**
 * MOLECULES — styled by design/molecules.css. A few atoms assembled for one job.
 */
import { Checkbox, Heading } from './atoms.js';
import { cx, h } from './dom.js';

/**
 * A labelled control with an optional hint.
 * @param size 'fill' (default) | 'narrow' (ports, short selects) | 'fit' (a button in a form row)
 */
export function Field(label, control, { hint, size = 'fill' } = {}) {
  return h('div', { class: cx('field', size !== 'fill' && `field--${size}`) },
    label ? h('label', { class: 'field__label' }, label, control) : control,
    hint && h('p', { class: 'field__hint' }, hint),
  );
}

/** A checkbox with its label on the same line. Returns the field; pass your own Checkbox to keep a handle on it. */
export function CheckField(label, checkbox = Checkbox(), { size = 'fill' } = {}) {
  return h('div', { class: cx('field', 'field--check', size !== 'fill' && `field--${size}`) }, h('label', { class: 'field__label' }, checkbox, label));
}

/** Gives any node (a notice, a paragraph) the vertical rhythm of a field. */
export const Block = (node) => {
  node.classList.add('block');
  return node;
};

/** A form; the caller wires its submit event. */
export const Form = (...children) => h('form', {}, children);

export const FormRow = (...fields) => h('div', { class: 'form-row' }, fields);
export const Actions = (...children) => h('div', { class: 'actions' }, children);

/**
 * @param title heading of the card (optional)
 * @param badges nodes shown next to the title
 */
export function Card({ title, badges = [], tag = 'div', ...attrs } = {}, ...children) {
  return h(tag, { ...attrs, class: 'card' }, title && h('div', { class: 'card__head' }, Heading(2, title), badges), children);
}

/** A titled sub-part inside a card. */
export const CardSection = (title, ...children) => h('div', { class: 'card__section' }, Heading(3, title), children);

export const PageHeader = (title, ...actions) => h('div', { class: 'page-head' }, Heading(1, title), actions);
export const EmptyState = (text) => h('div', { class: 'empty' }, text);

export function NavItem({ href, label, count, current }) {
  return h('a', { class: 'nav-item', href, 'aria-current': current ? 'page' : null }, h('span', {}, label), count ? h('span', { class: 'nav-item__count' }, count) : null);
}

/** A standing guarantee, e.g. the data-retention policy. */
export const Assurance = (text, title) => h('div', { class: 'assurance', title }, text);

export function EmailListItem({ from, date, subject, snippet, badges = [], current, onClick }) {
  return h('button', { class: 'email-item', type: 'button', 'aria-current': current ? 'true' : null, onclick: onClick },
    h('div', { class: 'email-item__top' }, h('span', { class: 'email-item__from' }, from), h('span', { class: 'email-item__date' }, date)),
    h('div', { class: 'email-item__subject' }, subject),
    h('div', { class: 'email-item__snippet' }, snippet),
    h('div', { class: 'email-item__badges' }, badges),
  );
}

/** The body of an email, scrollable when long. */
export const Message = (prose) => h('div', { class: 'message' }, prose);

/** One colour token, shown in the style guide. */
export function Swatch(token) {
  const chip = h('span', { class: 'swatch__chip' });
  chip.style.background = `var(${token})`;
  return h('div', { class: 'swatch' }, chip, h('span', { class: 'swatch__name' }, token));
}

/** Drives the single toast element of the page. */
export function createToast(el) {
  let timer;
  el.classList.add('toast');
  return (message, isError = false) => {
    el.textContent = message;
    el.classList.toggle('toast--error', isError);
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => (el.hidden = true), isError ? 8000 : 3500);
  };
}
