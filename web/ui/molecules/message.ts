import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** The body of an email, scrollable when long. */
export const Message = (prose: Child): HTMLDivElement => h('div', { class: 'message' }, prose);
