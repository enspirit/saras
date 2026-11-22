import { Icon } from '../atoms/icon.ts';
import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** Says that the text below was written by the AI and with what; `action` usually undoes it. */
export const AiNote = (text: Child, action?: Child): HTMLDivElement => h('div', { class: 'ai-note' }, Icon('file-text'), h('span', { class: 'ai-note__text' }, text), action);
