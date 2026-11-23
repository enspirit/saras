import { cx, h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** The colours a value can be shown in. */
export type Tone = 'grey' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

const TONES: Record<Tone, string> = { grey: 'tone--grey', red: 'tone--red', orange: 'tone--orange', yellow: 'tone--yellow', green: 'tone--green', blue: 'tone--blue', purple: 'tone--purple' };

/** The class that gives an element, and what it holds, the colour of a value. */
export const toneClass = (tone: Tone = 'grey'): string => TONES[tone];

export interface ValueChipOptions {
  color?: Tone;
  small?: boolean;
  /** Stands for no value: outlined, without colour. */
  empty?: boolean;
  /** Without the dot before the label: for a chip that brings its own sign. */
  plain?: boolean;
  title?: string;
}

/** One value of an attribute, in its colour: said in words, the colour only helps find it. */
export function ValueChip(label: Child, { color = 'grey', small = false, empty = false, plain = false, title }: ValueChipOptions = {}): HTMLSpanElement {
  return h('span', { class: cx('value-chip', toneClass(color), small && 'value-chip--small', empty && 'value-chip--empty', (plain || empty) && 'value-chip--plain'), title }, label);
}
