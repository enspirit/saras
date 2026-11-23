import { Heading } from '../atoms/text.ts';
import { append, h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** A panel as wide as its page, in two parts: what is chosen, and beside it, set back, what the choice governs. */
export const SplitPanel = (main: Child, aside: Child): HTMLElement =>
  h('section', { class: 'split-panel' }, h('div', { class: 'split-panel__main' }, main), h('div', { class: 'split-panel__aside' }, aside));

/** A part whose content follows what is being done beside it: what it shows is replaced, and said to who cannot see it. */
export function Live(...initial: Child[]): { element: HTMLDivElement; show(...content: Child[]): void } {
  const element = h('div', { class: 'live', 'aria-live': 'polite' }, initial);
  return { element, show: (...content) => void append((element.replaceChildren(), element), content) };
}

/** The heading of one part of a split panel. */
export const PartTitle = (title: string): HTMLHeadingElement => Heading(2, title);

/** One thing that is so, and where it is chosen. */
export interface Standing {
  /** What it is about, in a word. */
  label: string;
  /** How it stands now. */
  now: string;
  detail?: Child;
  /** Where it is changed, for who can. */
  link?: { label: string; href: string };
}

/** How a few things stand, line by line, each leading to where it is chosen. */
export const Standings = (rows: Standing[]): HTMLDivElement =>
  h('div', { class: 'standings' }, rows.map(({ label, now, detail, link }) =>
    h('div', { class: 'standings__row' },
      h('div', { class: 'standings__text' }, h('span', { class: 'standings__label' }, label), h('strong', {}, now), detail && h('span', { class: 'standings__detail' }, detail)),
      link && h('a', { class: 'standings__link', href: link.href }, link.label))));
