import { Heading } from '../atoms/text.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** A panel as wide as its page, in two parts: what is chosen, and beside it, set back, what the choice governs. */
export const SplitPanel = (main: Child, aside: Child): HTMLElement =>
  h('section', { class: 'split-panel' }, h('div', { class: 'split-panel__main' }, main), h('div', { class: 'split-panel__aside' }, aside));

/** The heading of one part of a split panel. */
export const PartTitle = (title: string): HTMLHeadingElement => Heading(2, title);

/** A few things that follow one another, numbered: each said in a few words, then explained. */
export const Points = (points: { title: string; text: Child }[]): HTMLOListElement =>
  h('ol', { class: 'points' }, points.map(({ title, text }, i) =>
    h('li', { class: 'points__point' }, h('span', { class: 'points__mark', 'aria-hidden': 'true' }, i + 1), h('span', { class: 'points__text' }, h('strong', {}, title), h('span', { class: 'points__detail' }, text)))));

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
