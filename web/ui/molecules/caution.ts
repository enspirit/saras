import { Icon } from '../atoms/icon.ts';
import { h } from '../dom.ts';

/** Something to settle before going on, shown next to the action it concerns. */
export const Caution = (text: string): HTMLSpanElement => h('span', { class: 'caution', role: 'status' }, Icon('triangle-alert'), text);
