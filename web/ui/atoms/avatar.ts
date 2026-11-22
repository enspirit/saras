import { Icon } from './icon.ts';
import type { IconName } from './icon.ts';
import { cx, h } from '../dom.ts';

/** A person, as the initials of their name (or of the start of their address). */
export function Avatar(name: string, { size = 'medium', icon }: { size?: 'small' | 'medium'; icon?: IconName } = {}): HTMLSpanElement {
  const words = name.split('@')[0]?.split(/[\s._-]+/).filter(Boolean) ?? [];
  const initials = words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  // With an icon it stands for something other than one person, e.g. a mailbox shared by a team.
  return h('span', { class: cx('avatar', size === 'small' && 'avatar--small', icon && 'avatar--neutral'), 'aria-hidden': 'true' }, icon ? Icon(icon) : initials);
}
