import { Icon } from '../atoms/icon.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

export interface EmailListEntry {
  from: string;
  date: string;
  subject: string;
  snippet: string;
  /** Badges shown next to the sender: what to do first. */
  tags?: Child[];
  /** Short name of the shared mailbox it arrived in, with its full address as a tooltip. */
  shared?: { label: string; title: string };
  current?: boolean;
  onClick?: () => void;
}

export function EmailListItem({ from, date, subject, snippet, tags = [], shared, current, onClick }: EmailListEntry): HTMLButtonElement {
  return h('button', { class: 'email-item', type: 'button', 'aria-current': current ? 'true' : null, onclick: onClick },
    h('span', { class: 'email-item__top' }, h('span', { class: 'email-item__from' }, from), h('span', { class: 'email-item__tags' }, tags), h('span', { class: 'email-item__date' }, date)),
    h('span', { class: 'email-item__line' },
      h('span', { class: 'email-item__subject' }, subject),
      shared && h('span', { class: 'email-item__shared', title: shared.title }, Icon('users', { size: 'small' }), shared.label),
    ),
    h('span', { class: 'email-item__snippet' }, snippet),
  );
}
