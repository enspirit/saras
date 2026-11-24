import { h } from '../dom.ts';
import { Prose } from '../atoms/text.ts';
import { partsOfText } from '../text-parts.ts';
import type { TextPart } from '../text-parts.ts';

/** Whether a quoted part is the history at the end, which nothing said follows. */
const isHistory = (parts: TextPart[], index: number): boolean => parts.slice(index + 1).every((part) => part.kind !== 'said');

/** One part, as it reads: the history folded under `earlier`, a quote set back, a signature stepping back. */
function shownPart(part: TextPart, index: number, parts: TextPart[], earlier: string): HTMLElement {
  if (part.kind === 'said') return Prose(part.text);
  if (part.kind === 'signed') return h('div', { class: 'message-text__signature' }, Prose(part.text));
  const quote = h('blockquote', { class: 'message-text__quote' }, Prose(part.text));
  return isHistory(parts, index) ? h('details', { class: 'message-text__earlier' }, h('summary', {}, earlier), quote) : quote;
}

/** An email's text, to be read: `earlier` names the earlier emails it carries, folded. */
export function MessageText(text: string, earlier: string): HTMLDivElement {
  const parts = partsOfText(text);
  return h('div', { class: 'message-text' }, parts.map((part, index) => shownPart(part, index, parts, earlier)));
}
