import { cx, h } from '../dom.ts';

export type BadgeTone = 'accent' | 'ok' | 'warn' | 'danger' | 'neutral';

export function Badge(label: string, tone: BadgeTone = 'accent'): HTMLSpanElement {
  return h('span', { class: cx('badge', tone !== 'accent' && `badge--${tone}`) }, label);
}
