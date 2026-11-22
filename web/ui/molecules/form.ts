import { h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** A form; the caller wires its submit event. */
export const Form = (...children: Child[]): HTMLFormElement => h('form', {}, children);

export const FormRow = (...fields: Child[]): HTMLDivElement => h('div', { class: 'form-row' }, fields);

export const Actions = (...children: Child[]): HTMLDivElement => h('div', { class: 'actions' }, children);
