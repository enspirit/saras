import { Icon } from './icon.ts';
import type { IconName } from './icon.ts';
import { cx, h } from '../dom.ts';

export interface ChipOptions {
  /** Called when its remove button is pressed; without it the chip cannot be removed. */
  onRemove?: () => void;
  /** Accessible name of the remove button. */
  removeLabel?: string;
  invalid?: boolean;
  /** Shown before the label, e.g. a paperclip for a file. */
  icon?: IconName;
  title?: string;
}

/** One value among several, e.g. a recipient. */
export function Chip(label: string, { onRemove, removeLabel, invalid = false, icon, title }: ChipOptions = {}): HTMLSpanElement {
  return h('span', { class: cx('chip', !onRemove && 'chip--fixed', invalid && 'chip--invalid'), title }, icon && Icon(icon, { size: 'small' }), label,
    onRemove && h('button', { class: 'chip__remove', type: 'button', 'aria-label': removeLabel, title: removeLabel, onclick: onRemove }, Icon('x', { size: 'small' })),
  );
}
