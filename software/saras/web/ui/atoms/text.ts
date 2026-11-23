import { cx, h } from '../dom.ts';
import type { Child } from '../dom.ts';
import { sanitizeToFragment } from '../sanitize.ts';

/** A paragraph. */
export function Text({ muted = false, small = false }: { muted?: boolean; small?: boolean } = {}, ...children: Child[]): HTMLParagraphElement {
  return h('p', { class: cx(muted && 'text--muted', small && 'text--small') || null }, children);
}

/** An inline run of muted text. */
export const Muted = (...children: Child[]): HTMLSpanElement => h('span', { class: 'text--muted' }, children);

export const Small = (...children: Child[]): HTMLSpanElement => h('span', { class: 'text--small' }, children);

export const Strong = (...children: Child[]): HTMLElement => h('strong', {}, children);

export const Code = (text: string): HTMLElement => h('code', {}, text);

/** A link; one to another site opens beside the application, so that what is in progress here is not lost. */
export const Link = (label: string, href: string): HTMLAnchorElement => (/^https?:/.test(href) ? h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label) : h('a', { href }, label));

export const Heading = (level: 1 | 2 | 3, ...children: Child[]): HTMLHeadingElement => h(`h${level}`, {}, children);

export const List = (items: Child[]): HTMLUListElement => h('ul', {}, items.map((item) => h('li', {}, item)));

/** Preformatted plain text that wraps: mail bodies, drafts. */
export const Prose = (text: string): HTMLPreElement => h('pre', { class: 'prose' }, text);

/** Rich text from elsewhere (a reply, a proposal), sanitised before it is shown. */
export function RichText(html: string): HTMLDivElement {
  const el = h('div', { class: 'rich' });
  el.append(sanitizeToFragment(html));
  return el;
}

/** Text for screen readers only. */
export const SrOnly = (text: string): HTMLSpanElement => h('span', { class: 'sr-only' }, text);
