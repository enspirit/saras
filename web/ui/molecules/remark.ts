import { Avatar } from '../atoms/avatar.ts';
import { h } from '../dom.ts';

/** What someone said, who and when. */
export const Remark = ({ text, by, meta }: { text: string; by: string; meta: string }): HTMLDivElement =>
  h('div', { class: 'remark' }, Avatar(by, { size: 'small' }), h('div', { class: 'remark__text' }, h('span', {}, text), h('span', { class: 'remark__meta' }, meta)));
