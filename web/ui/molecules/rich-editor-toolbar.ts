import Squire from '../../vendor/squire.mjs';
import { Button } from '../atoms/button.ts';
import type { IconName } from '../atoms/icon.ts';
import { h } from '../dom.ts';
import { promptDialog } from './dialog.ts';

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

/** A toolbar button that turns a format on, or off when the selection already has it. */
function tool(squire: Squire, icon: IconName, title: string, tag: string, on: () => unknown, off: () => unknown): HTMLButtonElement {
  const button = Button(title, { variant: 'tool', icon, iconOnly: true, onClick: () => {
    (squire.hasFormat(tag) ? off : on)();
    squire.focus();
  } });
  button.dataset.format = tag;
  return button;
}

/** Asks for the address of a link, and makes one of the selection. */
async function askLink(squire: Squire, labels: EditorLabels): Promise<void> {
  const url = (await promptDialog({ title: labels.link, label: labels.linkPrompt, value: 'https://', confirmLabel: labels.linkInsert, cancelLabel: labels.cancel }))?.trim();
  if (url && /^(https?:|mailto:)/i.test(url)) squire.makeLink(url);
  squire.focus();
}

/** The format buttons, in the order of the toolbar. */
const formatTools = (squire: Squire, labels: EditorLabels): HTMLButtonElement[] => [
  tool(squire, 'bold', labels.bold, 'B', () => squire.bold(), () => squire.removeBold()),
  tool(squire, 'italic', labels.italic, 'I', () => squire.italic(), () => squire.removeItalic()),
  tool(squire, 'underline', labels.underline, 'U', () => squire.underline(), () => squire.removeUnderline()),
  tool(squire, 'list', labels.bullets, 'UL', () => squire.makeUnorderedList(), () => squire.removeList()),
  tool(squire, 'list-ordered', labels.numbers, 'OL', () => squire.makeOrderedList(), () => squire.removeList()),
  tool(squire, 'link', labels.link, 'A', () => void askLink(squire, labels), () => squire.removeLink()),
];

const sep = (): HTMLSpanElement => h('span', { class: 'editor__sep', 'aria-hidden': 'true' });

export interface EditorToolbarHandle {
  element: HTMLDivElement;
  /** Shows as pressed the formats that the selection has. */
  refresh(): void;
}

/** The toolbar of the editor: emphasis, lists and links, and a way to take all of it away. */
export function EditorToolbar(squire: Squire, labels: EditorLabels): EditorToolbarHandle {
  const tools = formatTools(squire, labels);
  const clear = Button(labels.clear, { variant: 'tool', icon: 'remove-formatting', iconOnly: true, onClick: () => {
    squire.removeAllFormatting();
    squire.focus();
  } });
  return {
    element: h('div', { class: 'editor__toolbar', role: 'toolbar' }, tools.slice(0, 3), sep(), tools.slice(3), sep(), clear),
    refresh() {
      for (const button of tools) button.setAttribute('aria-pressed', String(squire.hasFormat(button.dataset.format ?? '')));
    },
  };
}
