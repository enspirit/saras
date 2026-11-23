import { Avatar } from '../atoms/avatar.ts';
import type { IconName } from '../atoms/icon.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** Who (or which mailbox), and one fact about them. */
export function Person({ name, detail, tags = [], icon }: { name: string; detail?: Child; tags?: Child[]; icon?: IconName }): HTMLDivElement {
  return h('div', { class: 'person' }, Avatar(name, { icon }), h('div', { class: 'person__text' }, h('span', { class: 'person__name' }, name, tags), detail && h('span', { class: 'person__detail' }, detail)));
}
