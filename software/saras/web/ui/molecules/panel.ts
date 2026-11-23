import { Icon } from '../atoms/icon.ts';
import type { IconName } from '../atoms/icon.ts';
import { Heading } from '../atoms/text.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';
import { Facts } from './facts.ts';

export interface PanelOptions {
  icon?: IconName;
  title: string;
  /** Who and when, next to the title. */
  meta?: Child;
  badges?: Child[];
  /** Label and value pairs shown under the head. */
  facts?: [string, Child][];
}

/** A record with its facts, e.g. a reply that was sent. */
export function Panel({ icon, title, meta, badges = [], facts }: PanelOptions, ...children: Child[]): HTMLElement {
  return h('section', { class: 'panel' },
    h('div', { class: 'panel__head' }, icon && Icon(icon, { size: 'large' }), Heading(3, title), meta && h('span', { class: 'panel__meta' }, meta), h('span', { class: 'panel__badges' }, badges)),
    facts && facts.length > 0 && Facts(facts),
    h('div', { class: 'panel__body' }, children),
  );
}
