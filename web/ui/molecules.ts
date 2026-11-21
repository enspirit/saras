/**
 * MOLECULES — styled by design/molecules.css. A few atoms assembled for one job.
 */
import Squire from '../vendor/squire.mjs';
import { Button, Checkbox, Heading } from './atoms.ts';
import { cx, h } from './dom.ts';
import type { Attrs, Child } from './dom.ts';
import { sanitizeToFragment } from './sanitize.ts';

/** 'fill' (default) | 'narrow' (ports, short selects) | 'fit' (a button in a form row) */
export type FieldSize = 'fill' | 'narrow' | 'fit';

/** A labelled control with an optional hint. Without a label, the control alone keeps the field's rhythm. */
export function Field(label: string | null, control: Child, { hint, size = 'fill' }: { hint?: Child; size?: FieldSize } = {}): HTMLDivElement {
  return h('div', { class: cx('field', size !== 'fill' && `field--${size}`) },
    label ? h('label', { class: 'field__label' }, label, control) : control,
    hint && h('p', { class: 'field__hint' }, hint),
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

/** A form; the caller wires its submit event. */
export const Form = (...children: Child[]): HTMLFormElement => h('form', {}, children);

export const FormRow = (...fields: Child[]): HTMLDivElement => h('div', { class: 'form-row' }, fields);
export const Actions = (...children: Child[]): HTMLDivElement => h('div', { class: 'actions' }, children);

export interface CardOptions extends Attrs {
  /** Heading of the card. */
  title?: string;
  /** Nodes shown next to the title. */
  badges?: Child[];
}

export function Card({ title, badges = [], ...attrs }: CardOptions = {}, ...children: Child[]): HTMLDivElement {
  return h('div', { ...attrs, class: 'card' }, title && h('div', { class: 'card__head' }, Heading(2, title), badges), children);
}

/** A titled sub-part inside a card. */
export const CardSection = (title: string, ...children: Child[]): HTMLDivElement => h('div', { class: 'card__section' }, Heading(3, title), children);

export const PageHeader = (title: string, ...actions: Child[]): HTMLDivElement => h('div', { class: 'page-head' }, Heading(1, title), actions);
export const EmptyState = (text: string): HTMLDivElement => h('div', { class: 'empty' }, text);

export interface NavEntry {
  href: string;
  label: string;
  /** Shown at the end of the entry when not zero. */
  count?: number;
  current?: boolean;
}

export function NavItem({ href, label, count, current }: NavEntry): HTMLAnchorElement {
  return h('a', { class: 'nav-item', href, 'aria-current': current ? 'page' : null }, h('span', {}, label), count ? h('span', { class: 'nav-item__count' }, count) : null);
}

/** A standing guarantee, e.g. the data-retention policy. */
export const Assurance = (text: string, title?: string): HTMLDivElement => h('div', { class: 'assurance', title }, text);

export interface EmailListEntry {
  from: string;
  date: string;
  subject: string;
  snippet: string;
  badges?: Child[];
  current?: boolean;
  onClick?: () => void;
}

export function EmailListItem({ from, date, subject, snippet, badges = [], current, onClick }: EmailListEntry): HTMLButtonElement {
  return h('button', { class: 'email-item', type: 'button', 'aria-current': current ? 'true' : null, onclick: onClick },
    h('div', { class: 'email-item__top' }, h('span', { class: 'email-item__from' }, from), h('span', { class: 'email-item__date' }, date)),
    h('div', { class: 'email-item__subject' }, subject),
    h('div', { class: 'email-item__snippet' }, snippet),
    h('div', { class: 'email-item__badges' }, badges),
  );
}

/** The body of an email, scrollable when long. */
export const Message = (prose: Child): HTMLDivElement => h('div', { class: 'message' }, prose);

/** Wording of the editor's toolbar, given by the page. */
export interface EditorLabels {
  bold: string;
  italic: string;
  underline: string;
  bullets: string;
  numbers: string;
  link: string;
  /** Question asked for the address of a link. */
  linkPrompt: string;
  clear: string;
}

export interface RichEditorHandle {
  element: HTMLDivElement;
  /** The content as HTML, empty when nothing was written. */
  getHtml(): string;
  setHtml(html: string): void;
  /** The content as text, to compare two versions without their markup. */
  getText(): string;
  isEmpty(): boolean;
  onChange(listener: () => void): void;
  focus(): void;
}

/**
 * A rich-text editor for composing a reply: paragraphs, emphasis, lists and links, with a
 * toolbar. Built on Squire, an editor made for email; whatever is pasted or set goes through
 * the sanitiser first.
 */
export function RichEditor({ labels, placeholder = '' }: { labels: EditorLabels; placeholder?: string }): RichEditorHandle {
  const surface = h('div', { class: 'editor__surface rich', 'data-placeholder': placeholder });
  const squire = new Squire(surface, { blockTag: 'P', sanitizeToDOMFragment: (html: string) => sanitizeToFragment(html) });
  const listeners: (() => void)[] = [];

  const text = (): string => (surface.textContent ?? '').replace(/\u200b/g, '');
  const isEmpty = (): boolean => !text().trim();

  /** A toolbar button that turns a format on, or off when the selection already has it. */
  const tool = (label: string, title: string, tag: string, on: () => unknown, off: () => unknown): HTMLButtonElement => {
    const button = Button(label, { variant: 'tool', title, onClick: () => {
      (squire.hasFormat(tag) ? off : on)();
      squire.focus();
    } });
    button.dataset.format = tag;
    return button;
  };
  const tools = [
    tool('B', labels.bold, 'B', () => squire.bold(), () => squire.removeBold()),
    tool('I', labels.italic, 'I', () => squire.italic(), () => squire.removeItalic()),
    tool('U', labels.underline, 'U', () => squire.underline(), () => squire.removeUnderline()),
    tool('•', labels.bullets, 'UL', () => squire.makeUnorderedList(), () => squire.removeList()),
    tool('1.', labels.numbers, 'OL', () => squire.makeOrderedList(), () => squire.removeList()),
    tool(labels.link, labels.link, 'A', () => {
      const url = window.prompt(labels.linkPrompt, 'https://');
      if (url && /^(https?:|mailto:)/i.test(url.trim())) squire.makeLink(url.trim());
    }, () => squire.removeLink()),
  ];
  const clear = Button(labels.clear, { variant: 'tool', title: labels.clear, onClick: () => {
    squire.removeAllFormatting();
    squire.focus();
  } });

  const element = h('div', { class: 'editor' }, h('div', { class: 'editor__toolbar', role: 'toolbar' }, tools, clear), surface);
  const refresh = (): void => {
    element.classList.toggle('editor--empty', isEmpty());
    for (const button of tools) button.setAttribute('aria-pressed', String(squire.hasFormat(button.dataset.format ?? '')));
  };
  squire.addEventListener('input', () => {
    refresh();
    for (const listener of listeners) listener();
  });
  squire.addEventListener('pathChange', refresh);
  refresh();

  return {
    element,
    getHtml: () => (isEmpty() ? '' : squire.getHTML()),
    setHtml(html) {
      squire.setHTML(html);
      refresh();
    },
    getText: text,
    isEmpty,
    onChange: (listener) => void listeners.push(listener),
    focus: () => void squire.focus(),
  };
}

/** One colour token, shown in the style guide. */
export function Swatch(token: string): HTMLDivElement {
  const chip = h('span', { class: 'swatch__chip' });
  chip.style.background = `var(${token})`;
  return h('div', { class: 'swatch' }, chip, h('span', { class: 'swatch__name' }, token));
}

export type Toast = (message: string, isError?: boolean) => void;

/** Drives the single toast element of the page. */
export function createToast(el: HTMLElement): Toast {
  let timer: ReturnType<typeof setTimeout> | undefined;
  el.classList.add('toast');
  return (message, isError = false) => {
    el.textContent = message;
    el.classList.toggle('toast--error', isError);
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => (el.hidden = true), isError ? 8000 : 3500);
  };
}
