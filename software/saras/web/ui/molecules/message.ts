import { append, h } from '../dom.ts';
import type { Child } from '../dom.ts';

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

/** One email seen several ways, one at a time, the first to begin with; `note` says something of them all. */
export function MessageViews(views: MessageView[], note?: Child): HTMLDivElement {
  const shown = h('div', { class: 'message-views__shown' });
  const buttons = views.map((view, index) => h('button', { class: 'message-views__view', type: 'button', onclick: () => choose(index) }, view.label));
  const choose = (chosen: number): void => {
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === chosen)));
    shown.replaceChildren();
    append(shown, views[chosen]?.show());
  };
  choose(0);
  return h('div', { class: 'message-views' }, h('div', { class: 'message-views__bar' }, buttons), shown, note && h('p', { class: 'message-views__note' }, note));
}
