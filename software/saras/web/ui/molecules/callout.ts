import { Icon } from '../atoms/icon.ts';
import type { IconName } from '../atoms/icon.ts';
import { cx, h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** Something that just happened or must be known, with room for a control under it. */
export function Callout(tone: 'info' | 'ok' | 'warn', lead: Child, ...children: Child[]): HTMLDivElement {
  const icon: IconName = tone === 'ok' ? 'check' : tone === 'warn' ? 'triangle-alert' : 'info';
  return h('div', { class: cx('callout', tone !== 'info' && `callout--${tone}`), role: 'status' }, h('div', { class: 'callout__lead' }, Icon(icon), h('span', {}, lead)), children);
}
