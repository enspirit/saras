import { Icon } from '../atoms/icon.ts';
import { cx, h } from '../dom.ts';

/** A short path and where one is on it; `current` is the index of the step in progress. */
export const Steps = (labels: string[], current: number): HTMLOListElement =>
  h('ol', { class: 'steps' }, labels.map((label, i) =>
    h('li', { class: cx('steps__step', i < current && 'steps__step--done'), 'aria-current': i === current ? 'step' : null },
      h('span', { class: 'steps__mark' }, i < current ? Icon('check', { size: 'small' }) : i + 1), label)));
