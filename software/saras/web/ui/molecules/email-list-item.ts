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
  /** Words searched: marked where the sender, the subject and the snippet hold them. */
  marks?: string[];
}

/** A box before an email, to act on several at once. `shown`: always, rather than when hovered (once any is ticked). */
export interface EmailTick {
  checked: boolean;
  label: string;
  shown: boolean;
  /** `range`: the shift key was held, to tick every email since the last one ticked. */
  onToggle: (range: boolean) => void;
}

const escaped = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A text with the words searched marked in it, whatever their case. */
function marked(text: string, words: string[] = []): Child {
  if (!words.length) return text;
  const pattern = new RegExp(`(${words.map(escaped).join('|')})`, 'gi');
  return text.split(pattern).map((part, index) => (index % 2 ? h('mark', { class: 'email-item__mark' }, part) : part));
}

export function EmailListItem({ from, date, subject, snippet, tags = [], shared, current, onClick, marks }: EmailListEntry): HTMLButtonElement {
  return h('button', { class: 'email-item', type: 'button', 'aria-current': current ? 'true' : null, onclick: onClick },
    h('span', { class: 'email-item__top' }, h('span', { class: 'email-item__from' }, marked(from, marks)), h('span', { class: 'email-item__tags' }, tags), h('span', { class: 'email-item__date' }, date)),
    h('span', { class: 'email-item__line' },
      h('span', { class: 'email-item__subject' }, marked(subject, marks)),
      shared && h('span', { class: 'email-item__shared', title: shared.title }, Icon('users', { size: 'small' }), shared.label),
    ),
    h('span', { class: 'email-item__snippet' }, marked(snippet, marks)),
  );
}

/** An email of a list that can be ticked: its box, then the email itself. */
export function TickableEmailListItem(entry: EmailListEntry, tick: EmailTick): HTMLDivElement {
  const box = h('input', { class: 'checkbox email-item__tick', type: 'checkbox', checked: tick.checked, 'aria-label': tick.label });
  box.addEventListener('click', (event) => tick.onToggle(event.shiftKey));
  const state = tick.checked ? 'email-item-row email-item-row--ticked' : tick.shown ? 'email-item-row email-item-row--ticking' : 'email-item-row';
  return h('div', { class: state }, box, EmailListItem(entry));
}
