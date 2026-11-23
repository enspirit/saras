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
  icon: IconName;
}

export const BOXES_ON_SCREEN: BoxOnScreen[] = [
  { id: 'todo', path: 'inbox', label: 'box.todo.label', empty: 'box.todo.empty', icon: 'mail' },
  { id: 'none', path: 'no-reply', label: 'box.none.label', empty: 'box.none.empty', icon: 'mail-check' },
  { id: 'sent', path: 'replied', label: 'box.sent.label', empty: 'box.sent.empty', icon: 'reply' },
  { id: 'ignored', path: 'ignored', label: 'box.ignored.label', empty: 'box.ignored.empty', icon: 'archive' },
];
