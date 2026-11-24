import { Heading } from '../atoms/text.ts';
import { cx, h } from '../dom.ts';
import type { Attrs, Child } from '../dom.ts';

export interface CardOptions extends Attrs {
  /** Heading of the card. */
  title?: string;
  /** Nodes shown next to the title. */
  badges?: Child[];
}

/** `form`: it holds a form, or one part of a page of forms, and keeps to a readable width. `danger`: what it does cannot be undone. */
export function Card({ title, badges = [], form = false, danger = false, ...attrs }: CardOptions & { form?: boolean; danger?: boolean } = {}, ...children: Child[]): HTMLDivElement {
  return h('div', { ...attrs, class: cx('card', form && 'card--form', danger && 'card--danger') }, title && h('div', { class: 'card__head' }, Heading(2, title), badges), children);
}

/** A titled sub-part inside a card. */
export const CardSection = (title: string, ...children: Child[]): HTMLDivElement => h('div', { class: 'card__section' }, Heading(3, title), children);
