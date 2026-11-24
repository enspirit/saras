import { Icon } from '../atoms/icon.ts';
import type { IconName } from '../atoms/icon.ts';
import { h } from '../dom.ts';

export interface NavEntry {
  href: string;
  label: string;
  icon?: IconName;
  /** Shown at the end of the entry when not zero. */
  count?: number;
  current?: boolean;
}

/** An entry of the menu, on one line: a name too long for it is cut, and read in full on hover. */
export function NavItem({ href, label, icon, count, current }: NavEntry): HTMLAnchorElement {
  return h('a', { class: 'nav-item', href, 'aria-current': current ? 'page' : null }, icon && Icon(icon), h('span', { class: 'nav-item__label', title: label }, label), count ? h('span', { class: 'nav-item__count' }, count) : null);
}
