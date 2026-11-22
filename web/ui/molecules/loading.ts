import { Spinner } from '../atoms/spinner.ts';
import { SrOnly } from '../atoms/text.ts';
import { h } from '../dom.ts';

/** A whole screen is on its way; `label` says so to screen readers. */
export const Loading = (label: string): HTMLDivElement => h('div', { class: 'loading', role: 'status' }, Spinner(), SrOnly(label));
