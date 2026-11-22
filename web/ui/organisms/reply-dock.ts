import { Icon } from '../atoms/icon.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

export interface ReplyDockOptions {
  /** Accessible name of the region. */
  label: string;
  /** A notice above everything, e.g. a missing key. */
  notice?: Child;
  /** RecipientField elements and the reply-to-all control. */
  recipients: Child;
  /** The editor, and what follows it when the proposal was edited. */
  write: Child;
  /** The AI help. */
  help: Child;
  /** Send, save, and what must be settled first. */
  actions: Child;
}

/** The reply area, docked under the email. */
export function ReplyDock({ label, notice, recipients, write, help, actions }: ReplyDockOptions): HTMLElement {
  return h('section', { class: 'dock', 'aria-label': label },
    notice && h('div', { class: 'dock__notice' }, notice),
    h('div', { class: 'dock__recipients' }, recipients),
    h('div', { class: 'dock__write' }, write),
    h('div', { class: 'dock__help' }, help),
    h('div', { class: 'dock__actions' }, actions),
  );
}

/** In place of the reply area when no reply is expected: says so, and offers to open it. */
export const ClosedDock = (text: Child, action: Child): HTMLDivElement =>
  h('div', { class: 'dock dock--closed' }, Icon('mail-check', { size: 'large' }), h('span', { class: 'dock__text' }, text), action);
