import { Avatar } from '../atoms/avatar.ts';
import { Chip } from '../atoms/chip.ts';
import { Heading } from '../atoms/text.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** An open email: its header, the tool bar that goes with it, its content (which scrolls), and what is docked under it. */
export const Reading = ({ header, toolbar, dock }: { header: Child; toolbar?: Child; dock?: Child }, ...content: Child[]): HTMLDivElement =>
  h('div', { class: 'reading' }, header, toolbar, h('div', { class: 'reading__body' }, content), dock);

export interface ReadingHeaderOptions {
  subject: string;
  /** Decisions about the email itself, at the end of the subject line. */
  actions?: Child;
  sender: { name: string; address?: string };
  /** 'To you · Cc Paul Novak'. */
  to?: string;
  /** Names of the attached files. */
  attachments?: string[];
  date: string;
  /** The complete date, as a tooltip. */
  dateTitle?: string;
  /** Verdict line: badge and reason. */
  triage?: Child;
}

/** Top of the reading pane. */
export function ReadingHeader({ subject, actions, sender, to, attachments = [], date, dateTitle, triage }: ReadingHeaderOptions): HTMLElement {
  return h('header', { class: 'reading-head' },
    h('div', { class: 'reading-head__top' }, Heading(1, subject), actions),
    h('div', { class: 'reading-head__sender' },
      Avatar(sender.name),
      h('div', { class: 'reading-head__who' },
        h('span', {}, h('span', { class: 'reading-head__name' }, sender.name), sender.address && [' ', h('span', { class: 'reading-head__address' }, sender.address)]),
        to && h('span', { class: 'reading-head__to' }, to),
      ),
      attachments.length > 0 && h('div', { class: 'reading-head__files' }, attachments.map((name) => Chip(name, { icon: 'paperclip' }))),
      h('span', { class: 'reading-head__date', title: dateTitle }, date),
    ),
    triage && h('div', { class: 'reading-head__triage' }, triage),
  );
}
