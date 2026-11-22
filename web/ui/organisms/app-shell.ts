import { Avatar } from '../atoms/avatar.ts';
import { BrandMark } from '../atoms/brand-mark.ts';
import type { Brand } from '../brand.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';
import { Assurance } from '../molecules/assurance.ts';
import { NavItem } from '../molecules/nav-item.ts';
import type { NavEntry } from '../molecules/nav-item.ts';

export interface AppShellOptions {
  brand: Brand;
  /** The boxes of the mailbox: the main entries. */
  boxes: NavEntry[];
  /** Configuration pages: quieter entries, under their title. */
  pages: { title: string; items: NavEntry[] };
  /** On a small screen, the entry that leads to everything that is not a box. */
  more: NavEntry;
  assurance?: { text: string; title?: string };
  /** Who is signed in, and in which organisation. */
  user: { name: string; organization: string };
  /** The sign-out button. */
  logout: Child;
}

/** The frame of every signed-in screen. */
export function AppShell({ brand, boxes, pages, more, assurance, user, logout }: AppShellOptions, content: Child): HTMLDivElement {
  return h('div', { class: 'shell' },
    h('nav', { class: 'shell__nav' },
      h('div', { class: 'shell__brand' }, BrandMark(brand)),
      h('div', { class: 'shell__group' }, boxes.map(NavItem), h('div', { class: 'shell__more' }, NavItem(more))),
      h('div', { class: 'shell__group shell__group--minor' }, h('div', { class: 'shell__section' }, pages.title), pages.items.map(NavItem)),
      h('div', { class: 'shell__foot' },
        assurance && Assurance(assurance.text, assurance.title),
        h('div', { class: 'shell__user' }, Avatar(user.name, { size: 'small' }), h('div', { class: 'shell__who' }, h('span', { class: 'shell__name' }, user.name), h('span', { class: 'shell__org' }, user.organization)), logout),
      ),
    ),
    h('main', { class: 'shell__main' }, content),
  );
}
