import { Icon } from '../atoms/icon.ts';
import type { IconName } from '../atoms/icon.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

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
