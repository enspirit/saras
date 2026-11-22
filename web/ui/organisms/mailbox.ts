import { ButtonLink } from '../atoms/button.ts';
import { Heading } from '../atoms/text.ts';
import { cx, h } from '../dom.ts';
import type { Child } from '../dom.ts';

export interface MailboxOptions {
  title: string;
  /** How many emails the box holds. */
  count?: number;
  /** A short fact about the list, e.g. when mail was last fetched. */
  meta?: string;
  /** A control at the end of the head, e.g. a refresh button. */
  action?: Child;
  /** EmailListItem nodes. */
  items: Node[];
  /** Shown in the list when it has no item (an EmptyState). */
  empty: Child;
  backHref: string;
  /** Label of the link back to the list, on small screens. */
  backLabel: string;
  /** Shown in the reading pane while no email is open (an EmptyState). */
  idle: Child;
  /** Content of the reading pane (a Reading), or null when no email is open. */
  detail: Child;
}

/** List of emails on one side, reading pane on the other. */
export function Mailbox({ title, count, meta, action, items, empty, backHref, backLabel, idle, detail }: MailboxOptions): HTMLDivElement {
  return h('div', { class: cx('mailbox', Boolean(detail) && 'mailbox--reading') },
    h('section', { class: 'mailbox__list' },
      h('div', { class: 'mailbox__list-head' }, Heading(2, title), count ? h('span', { class: 'mailbox__count' }, count) : null, meta && h('span', { class: 'mailbox__meta' }, meta), action),
      items.length ? items : empty,
    ),
    h('section', { class: 'mailbox__detail' },
      detail ? [h('div', { class: 'mailbox__back' }, ButtonLink(backLabel, { href: backHref, variant: 'link' })), detail] : idle,
    ),
  );
}
