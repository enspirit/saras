import { Icon } from '../atoms/icon.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** The optional kinds of AI help, as equals, with a note on what they send. */
export function AiHelp({ label, note }: { label: string; note?: Child }, ...actions: Child[]): HTMLDivElement {
  return h('div', { class: 'ai-help' },
    h('div', { class: 'ai-help__row' }, h('span', { class: 'ai-help__label' }, label), actions),
    note && h('div', { class: 'ai-help__note' }, Icon('lock', { size: 'small' }), h('span', {}, note)),
  );
}
