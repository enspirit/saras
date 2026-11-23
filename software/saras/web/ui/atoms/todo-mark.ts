import { Icon } from './icon.ts';
import { h } from '../dom.ts';

/** A passage the AI left open, to complete before sending. */
export const TodoMark = (label: string): HTMLElement => h('mark', { class: 'todo-mark' }, Icon('triangle-alert', { size: 'small' }), label);
