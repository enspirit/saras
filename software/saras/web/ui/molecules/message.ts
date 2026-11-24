import { append, h } from '../dom.ts';
import type { Child } from '../dom.ts';
import { Icon } from '../atoms/icon.ts';

/** The body of an email, scrollable when long. */
export const Message = (prose: Child): HTMLDivElement => h('div', { class: 'message' }, prose);

/**
 * An email as it was written, in a frame of its own: a document the server rebuilt, which
 * runs nothing and asks nothing of any host. Its links open in a tab of their own.
 */
export const MessageAsWritten = (src: string, title: string): HTMLIFrameElement =>
  h('iframe', { class: 'message-frame', src, title, sandbox: 'allow-popups allow-popups-to-escape-sandbox', referrerpolicy: 'no-referrer' });

export interface MessageView {
  label: string;
  /** Made when the view is first chosen. */
  show: () => Child;
}

/** Something said of every view, in a few words; `explanation` says why, to whoever asks. */
export interface MessageNote { label: string; explanation: string; }

const Note = (note: MessageNote): HTMLElement =>
  h('span', { class: 'message-views__note', title: note.explanation }, Icon('eye-off', { size: 'small' }), note.label, h('span', { class: 'sr-only' }, `: ${note.explanation}`));

/**
 * One email on one sheet, seen one way at a time, the first to begin with: which way is chosen
 * in the sheet's bar, beside `note`. With a single view and nothing to note, the sheet has no bar.
 */
export function MessageViews(views: MessageView[], note?: MessageNote): HTMLDivElement {
  const shown = h('div', { class: 'message-views__shown' });
  const buttons = views.map((view, index) => h('button', { class: 'message-views__view', type: 'button', onclick: () => choose(index) }, view.label));
  const choose = (chosen: number): void => {
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === chosen)));
    shown.replaceChildren();
    append(shown, views[chosen]?.show());
  };
  choose(0);
  const choice = views.length > 1 && h('div', { class: 'message-views__choice' }, buttons);
  const bar = (choice || note) && h('div', { class: 'message-views__bar' }, choice, note && Note(note));
  return h('div', { class: 'message-views' }, bar, shown);
}
