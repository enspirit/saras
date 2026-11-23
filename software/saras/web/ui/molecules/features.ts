import { Icon } from '../atoms/icon.ts';
import type { IconName } from '../atoms/icon.ts';
import { Heading } from '../atoms/text.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** A few points of equal weight, each with its sign. */
export const Features = (items: { icon: IconName; title: string; text: Child }[]): HTMLDivElement =>
  h('div', { class: 'features' }, items.map((item) => h('section', { class: 'feature' }, h('span', { class: 'feature__icon' }, Icon(item.icon, { size: 'large' })), Heading(3, item.title), h('p', { class: 'feature__text' }, item.text))));
