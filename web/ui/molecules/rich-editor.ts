import Squire from 'squire-rte';
import { h } from '../dom.ts';
import { EditorToolbar } from './rich-editor-toolbar.ts';
import type { EditorLabels, EditorToolbarHandle } from './rich-editor-toolbar.ts';
import { sanitizeToFragment } from '../sanitize.ts';

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
  /** Shows the content under `note` (an AiNote), tinted as a proposal of the AI unless `tinted` is false; null takes it away. */
  setProposal(note: Element | null, tinted?: boolean): void;
  /** How many passages match `highlight` at the moment. */
  countHighlights(): number;
}

/** What an editor is made of, for the functions below. */
interface EditorParts {
  element: HTMLDivElement;
  surface: HTMLDivElement;
  toolbar: EditorToolbarHandle;
  squire: Squire;
  highlight?: RegExp;
  listeners: (() => void)[];
}

/** Ranges of the passages matching `highlight`, found in the text as it stands. */
function passages(surface: HTMLElement, highlight?: RegExp): Range[] {
  if (!highlight) return [];
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const match of (node.textContent ?? '').matchAll(new RegExp(highlight.source, 'g'))) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      ranges.push(range);
    }
  }
  return ranges;
}

/** Marks them through the browser's highlight registry, so the text itself is never changed. */
function mark(surface: HTMLElement, highlight?: RegExp): void {
  if (!highlight || !('highlights' in CSS)) return;
  CSS.highlights.set('todo-mark', new Highlight(...passages(surface, highlight)));
}

const textOf = (surface: HTMLElement): string => (surface.textContent ?? '').replace(/\u200b/g, '');
const isEmpty = (surface: HTMLElement): boolean => !textOf(surface).trim();

/** Brings the frame in line with the content: passages marked, placeholder, formats in use. */
function refresh({ element, surface, toolbar, highlight }: EditorParts): void {
  mark(surface, highlight);
  element.classList.toggle('editor--empty', isEmpty(surface));
  toolbar.refresh();
}

/** Shows the AI's note under the toolbar or takes it away, and tints the editor with it. */
function proposalSlot(element: HTMLElement, toolbar: HTMLElement): RichEditorHandle['setProposal'] {
  let note: Element | null = null;
  return (next, tinted = true) => {
    if (note !== next) note?.remove();
    note = next;
    if (note && !note.isConnected) toolbar.after(note);
    element.classList.toggle('editor--proposed', Boolean(note) && tinted);
  };
}

/** What a page may do with the editor. */
function handleOf(parts: EditorParts): RichEditorHandle {
  const { element, surface, toolbar, squire, highlight, listeners } = parts;
  return {
    element,
    getHtml: () => (isEmpty(surface) ? '' : squire.getHTML()),
    setHtml(html) {
      squire.setHTML(html);
      refresh(parts);
    },
    getText: () => textOf(surface),
    isEmpty: () => isEmpty(surface),
    onChange: (listener) => void listeners.push(listener),
    focus: () => void squire.focus(),
    setProposal: proposalSlot(element, toolbar.element),
    countHighlights: () => passages(surface, highlight).length,
  };
}

/**
 * A rich-text editor for composing a reply: paragraphs, emphasis, lists and links, with a
 * toolbar. Built on Squire, an editor made for email; whatever is pasted or set goes through
 * the sanitiser first.
 */
export function RichEditor({ labels, placeholder = '', highlight }: { labels: EditorLabels; placeholder?: string; highlight?: RegExp }): RichEditorHandle {
  const surface = h('div', { class: 'editor__surface rich', 'data-placeholder': placeholder });
  const squire = new Squire(surface, { blockTag: 'P', sanitizeToDOMFragment: (html: string) => sanitizeToFragment(html) });
  const toolbar = EditorToolbar(squire, labels);
  const parts: EditorParts = { element: h('div', { class: 'editor' }, toolbar.element, surface), surface, toolbar, squire, highlight, listeners: [] };
  squire.addEventListener('input', () => {
    refresh(parts);
    for (const listener of parts.listeners) listener();
  });
  squire.addEventListener('pathChange', () => refresh(parts));
  refresh(parts);
  return handleOf(parts);
}
