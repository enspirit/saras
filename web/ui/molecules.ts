/**
 * MOLECULES — styled by design/molecules.css. A few atoms assembled for one job.
 */
import Squire from '../vendor/squire.mjs';
import { Button, Checkbox, Chip, Heading, Icon, Input } from './atoms.ts';
import type { IconName } from './atoms.ts';
import { cx, h } from './dom.ts';
import type { Attrs, Child } from './dom.ts';
import { sanitizeToFragment } from './sanitize.ts';

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

export interface EmptyStateOptions {
  icon?: IconName;
  /** What the situation is, in a few words; the text then says what to do about it. */
  title?: string;
  /** A button or a link that leads out of the empty state. */
  action?: Child;
}

/** What a region shows when it has nothing to show: where one is, and what to do next. */
export function EmptyState(text: string, { icon, title, action }: EmptyStateOptions = {}): HTMLDivElement {
  return h('div', { class: 'empty' },
    icon && h('div', { class: 'empty__icon' }, Icon(icon, { size: 'large' })),
    title && h('div', { class: 'empty__title' }, title),
    h('div', { class: 'empty__text' }, text),
    action && h('div', { class: 'empty__action' }, action),
  );
}

export interface NavEntry {
  href: string;
  label: string;
  icon?: IconName;
  /** Shown at the end of the entry when not zero. */
  count?: number;
  current?: boolean;
}

export function NavItem({ href, label, icon, count, current }: NavEntry): HTMLAnchorElement {
  return h('a', { class: 'nav-item', href, 'aria-current': current ? 'page' : null }, icon && Icon(icon), h('span', { class: 'nav-item__label' }, label), count ? h('span', { class: 'nav-item__count' }, count) : null);
}

/** A standing guarantee, e.g. the data-retention policy. */
export const Assurance = (text: string, title?: string): HTMLDivElement => h('div', { class: 'assurance', title }, Icon('lock'), h('span', {}, text));

export interface DialogOptions {
  /** The question, in a few words. */
  title?: string;
  /** What will happen, in a sentence. */
  text?: Child;
  confirmLabel: string;
  cancelLabel: string;
  /** The action destroys something: its button says so, and Cancel is the default. */
  danger?: boolean;
}

/** Opens a modal dialog and resolves with what was typed in `field` (or '' without one), or null when dismissed. */
function openDialog({ title, text, confirmLabel, cancelLabel, danger = false }: DialogOptions, field?: { label: string; input: HTMLInputElement }): Promise<string | null> {
  return new Promise((resolve) => {
    const confirm = Button(confirmLabel, { variant: danger ? 'destructive' : 'primary', type: 'submit' });
    confirm.value = 'confirm';
    const cancel = Button(cancelLabel, { onClick: () => dialog.close() });
    const heading = title ? Heading(2, title) : null;
    const dialog = h('dialog', { class: 'dialog' },
      h('form', { method: 'dialog' },
        h('div', { class: 'dialog__body' },
          heading,
          text && h('div', { class: 'dialog__text' }, text),
          field && h('label', { class: 'dialog__field field__label' }, field.label, field.input),
        ),
        h('div', { class: 'dialog__actions' }, cancel, confirm),
      ),
    );
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'confirm' ? (field?.input.value ?? '') : null);
    });
    document.body.append(dialog);
    dialog.showModal();
    (field?.input ?? (danger ? cancel : confirm)).focus();
  });
}

/** Asks for a confirmation before an action. Resolves to true when confirmed; Escape cancels. */
export const confirmDialog = async (options: DialogOptions): Promise<boolean> => (await openDialog(options)) !== null;

/** Asks for one value. Resolves to it, or to null when dismissed. */
export function promptDialog({ label, value = '', ...options }: DialogOptions & { label: string; value?: string }): Promise<string | null> {
  return openDialog(options, { label, input: Input({ value, required: true }) });
}

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

/**
 * Addresses shown one by one, each removable, with a place to type another: Enter, a comma
 * or leaving the field adds it; Backspace in the empty field removes the last one.
 */
export function RecipientField({ label, values = [], removeLabel }: RecipientFieldOptions): RecipientFieldHandle {
  let addresses: string[] = [];
  const listeners: (() => void)[] = [];
  const input = h('input', { class: 'recipients__input', type: 'email', 'aria-label': label, autocomplete: 'off' });
  const element = h('div', { class: 'recipients' });
  const render = (): void => {
    element.replaceChildren(
      h('span', { class: 'recipients__label' }, label),
      ...addresses.map((address) => Chip(address, { invalid: !/^[^@\s]+@[^@\s]+$/.test(address), removeLabel: removeLabel(address), onRemove: () => change(addresses.filter((a) => a !== address)) })),
      input,
    );
  };
  const change = (next: string[]): void => {
    addresses = [...new Set(next)];
    render();
    for (const listener of listeners) listener();
  };
  const commit = (): void => {
    const typed = input.value.split(/[,;\s]+/).map((a) => a.trim()).filter(Boolean);
    if (!typed.length) return;
    input.value = '';
    change([...addresses, ...typed]);
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
      input.focus();
    } else if (event.key === 'Backspace' && !input.value && addresses.length) {
      change(addresses.slice(0, -1));
      input.focus();
    }
  });
  input.addEventListener('blur', commit);
  addresses = [...new Set(values)];
  render();
  return {
    element,
    getValues: () => [...addresses],
    setValues(next) {
      addresses = [...new Set(next)];
      render();
    },
    onChange: (listener) => void listeners.push(listener),
  };
}

/** Says that the text below was written by the AI and with what; `action` usually undoes it. */
export const AiNote = (text: Child, action?: Child): HTMLDivElement => h('div', { class: 'ai-note' }, Icon('file-text'), h('span', { class: 'ai-note__text' }, text), action);

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
  /** Question asked for the address of a link, and the two answers. */
  linkPrompt: string;
  linkInsert: string;
  cancel: string;
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
  /** Shows the content as a proposal of the AI, under `note` (an AiNote); null takes that away. */
  setProposal(note: Element | null): void;
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
  const tool = (icon: IconName, title: string, tag: string, on: () => unknown, off: () => unknown): HTMLButtonElement => {
    const button = Button(title, { variant: 'tool', icon, iconOnly: true, onClick: () => {
      (squire.hasFormat(tag) ? off : on)();
      squire.focus();
    } });
    button.dataset.format = tag;
    return button;
  };
  const askLink = async (): Promise<void> => {
    const url = (await promptDialog({ title: labels.link, label: labels.linkPrompt, value: 'https://', confirmLabel: labels.linkInsert, cancelLabel: labels.cancel }))?.trim();
    if (url && /^(https?:|mailto:)/i.test(url)) squire.makeLink(url);
    squire.focus();
  };
  const tools = [
    tool('bold', labels.bold, 'B', () => squire.bold(), () => squire.removeBold()),
    tool('italic', labels.italic, 'I', () => squire.italic(), () => squire.removeItalic()),
    tool('underline', labels.underline, 'U', () => squire.underline(), () => squire.removeUnderline()),
    tool('list', labels.bullets, 'UL', () => squire.makeUnorderedList(), () => squire.removeList()),
    tool('list-ordered', labels.numbers, 'OL', () => squire.makeOrderedList(), () => squire.removeList()),
    tool('link', labels.link, 'A', () => void askLink(), () => squire.removeLink()),
  ];
  const clear = Button(labels.clear, { variant: 'tool', icon: 'remove-formatting', iconOnly: true, onClick: () => {
    squire.removeAllFormatting();
    squire.focus();
  } });
  const sep = (): HTMLSpanElement => h('span', { class: 'editor__sep', 'aria-hidden': 'true' });

  const toolbar = h('div', { class: 'editor__toolbar', role: 'toolbar' }, tools.slice(0, 3), sep(), tools.slice(3), sep(), clear);
  const element = h('div', { class: 'editor' }, toolbar, surface);
  let note: Element | null = null;
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
    setProposal(next) {
      note?.remove();
      note = next;
      if (note) toolbar.after(note);
      element.classList.toggle('editor--proposed', Boolean(note));
    },
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
