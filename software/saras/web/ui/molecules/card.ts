import { Heading } from '../atoms/text.ts';
import { cx, h } from '../dom.ts';
import type { Attrs, Child } from '../dom.ts';

export interface CardOptions extends Attrs {
  /** Heading of the card. */
  title?: string;
  /** Nodes shown next to the title. */
  badges?: Child[];
}

export function Card({ title, badges = [], form = false, ...attrs }: CardOptions & { form?: boolean } = {}, ...children: Child[]): HTMLDivElement {
  // A card that holds one form keeps to a readable width.
  return h('div', { ...attrs, class: cx('card', form && 'card--form') }, title && h('div', { class: 'card__head' }, Heading(2, title), badges), children);
}

/** A titled sub-part inside a card. */
export const CardSection = (title: string, ...children: Child[]): HTMLDivElement => h('div', { class: 'card__section' }, Heading(3, title), children);
