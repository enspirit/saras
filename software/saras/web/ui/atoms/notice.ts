import { cx, h } from '../dom.ts';
import type { Child } from '../dom.ts';

export type NoticeTone = 'info' | 'ok' | 'warn' | 'danger';

export function Notice(tone: NoticeTone, ...children: Child[]): HTMLParagraphElement {
  return h('p', { class: cx('notice', tone !== 'info' && `notice--${tone}`) }, children);
}
