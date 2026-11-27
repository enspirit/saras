// The boxes an email stands in: to handle, no reply needed, replied, ignored.

import type { Box } from '../../shared/email.ts';
import type { IconName } from '../ui/atoms/icon.ts';

/** A box of the mailbox: its API id, its URL path and its wording. */
export interface BoxOnScreen {
  id: Box;
  path: string;
  /** Translation keys of its name and of the text shown when it is empty. */
  label: string;
  empty: string;
  /** Translation key of what the box is for, said while no email of it is open. */
  about?: string;
  icon: IconName;
}

/** A box, or every box at once. */
export type ListOnScreen = Omit<BoxOnScreen, 'id'> & { id: Box | 'all' };

export const BOXES_ON_SCREEN: BoxOnScreen[] = [
  { id: 'todo', path: 'inbox', label: 'box.todo.label', empty: 'box.todo.empty', about: 'box.todo.about', icon: 'mail' },
  { id: 'none', path: 'no-reply', label: 'box.none.label', empty: 'box.none.empty', about: 'box.none.about', icon: 'mail-check' },
  { id: 'sent', path: 'replied', label: 'box.sent.label', empty: 'box.sent.empty', about: 'box.sent.about', icon: 'reply' },
  { id: 'ignored', path: 'ignored', label: 'box.ignored.label', empty: 'box.ignored.empty', about: 'box.ignored.about', icon: 'archive' },
];

/** Every box at once: where a search goes beyond the box it was made in. In no menu. */
export const EVERY_BOX: ListOnScreen = { id: 'all', path: 'search', label: 'box.all.label', empty: 'box.all.empty', icon: 'search' };
