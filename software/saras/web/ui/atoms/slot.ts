import { append, h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** A place in a component whose content is replaced without remaking what surrounds it. It is no box of its own: what it holds is laid out as its parent's. */
export interface SlotHandle {
  element: HTMLElement;
  show(...content: Child[]): void;
}

export function Slot(...initial: Child[]): SlotHandle {
  const element = h('div', { class: 'slot' }, initial);
  return { element, show: (...content) => void append((element.replaceChildren(), element), content) };
}
