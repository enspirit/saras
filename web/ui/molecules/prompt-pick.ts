import { Badge } from '../atoms/badge.ts';
import { Button } from '../atoms/button.ts';
import type { SelectOption } from '../atoms/input.ts';
import { h } from '../dom.ts';

export interface PromptPickOptions {
  /** 'Write with'. */
  label: string;
  /** Accessible name of the list of prompts. */
  selectLabel: string;
  options: SelectOption[];
  /** The prompt the AI suggested for this email, and the word saying so. */
  suggested?: { value: string | number; label: string };
  title?: string;
}

/** Write with a prompt: the action and the choice of the prompt, as one control. */
export function PromptPick({ label, selectLabel, options, suggested, title }: PromptPickOptions): { element: HTMLSpanElement; button: HTMLButtonElement; select: HTMLSelectElement } {
  const button = Button(label, { variant: 'ghost', size: 'small', icon: 'file-text', flush: true, title });
  const select = h('select', { class: 'prompt-pick__select', 'aria-label': selectLabel }, options.map((o) => h('option', { value: o.value, selected: o.selected }, o.label)));
  const badge = h('span', { class: 'prompt-pick__badge' }, suggested && Badge(suggested.label));
  const sync = (): void => void (badge.hidden = !suggested || select.value !== String(suggested.value));
  select.addEventListener('change', sync);
  sync();
  return { element: h('span', { class: 'prompt-pick' }, button, select, badge), button, select };
}
