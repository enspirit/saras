import { Button } from '../atoms/button.ts';
import { Icon } from '../atoms/icon.ts';
import { toneClass } from '../atoms/value-chip.ts';
import type { Tone } from '../atoms/value-chip.ts';
import { cx, h } from '../dom.ts';
import type { Child } from '../dom.ts';

/** One part of a whole: how many, shown as what, in which colour (none for what has no value). */
export interface Part {
  label: Child;
  count: number;
  color?: Tone;
}

/** How a whole divides: a bar, each part as wide as its share, and under it each part in words. */
export const Proportion = (parts: Part[], label: string): HTMLDivElement =>
  h('div', { class: 'proportion' },
    h('div', { class: 'proportion__bar', role: 'img', 'aria-label': label }, parts.filter((part) => part.count > 0).map((part) => {
      const piece = h('span', { class: cx('proportion__part', part.color ? toneClass(part.color) : 'proportion__part--none') });
      piece.style.flexGrow = String(part.count);
      return piece;
    })),
    h('div', { class: 'proportion__legend' }, parts.map((part) => h('span', { class: 'proportion__item' }, part.label, part.count))),
  );

/** Something wrong in what is being written: where, what, and the correction when one is known. */
export interface Mistake {
  where: string;
  message: string;
  fix?: { before: string; label: string; apply: () => void };
}

/** What is wrong, said at once and next to what it is about. */
export const Problems = (problems: Mistake[]): HTMLDivElement =>
  h('div', { class: 'problems', role: 'alert' }, problems.map(({ where, message, fix }) =>
    h('p', { class: 'problems__one' }, Icon('triangle-alert', { size: 'small' }), h('span', {}, h('strong', {}, where), ' ', message,
      fix && [' ', fix.before, ' ', h('button', { class: 'problems__fix', type: 'button', onclick: fix.apply }, fix.label)]))));

/** One thing there is to read, with its type and what it is. */
export interface FieldEntry {
  path: string;
  type: string;
  what: string;
}

/** What there is to read, field by field. With `onPick`, each is a button that hands its path over. */
export const FieldList = (fields: FieldEntry[], onPick?: (path: string) => void): HTMLDivElement =>
  h('div', { class: 'field-list' }, fields.map(({ path, type, what }) => {
    const text = [h('span', { class: 'field-list__text' }, h('code', { class: 'field-list__path' }, path), h('span', { class: 'field-list__what' }, what)), h('span', { class: 'field-list__type' }, type)];
    return onPick ? h('button', { class: 'field-list__field', type: 'button', onclick: () => onPick(path) }, text) : h('div', { class: 'field-list__field' }, text);
  }));

/** A line of code and what it means. */
export const Snippet = (code: string, what: string): HTMLDivElement => h('div', { class: 'snippet' }, h('code', { class: 'snippet__code' }, code), h('span', { class: 'snippet__what' }, what));

/** A piece of code to start from, with what it does and a way to copy it. */
export function CodeCard({ title, what, code, copyLabel, onCopied }: { title: string; what: string; code: string; copyLabel: string; onCopied?: () => void }): HTMLElement {
  const copy = Button(copyLabel, { variant: 'ghost', size: 'small', icon: 'copy', iconOnly: true, onClick: () => void navigator.clipboard.writeText(code).then(onCopied) });
  return h('section', { class: 'code-card' },
    h('div', { class: 'code-card__head' }, h('div', { class: 'code-card__text' }, h('strong', {}, title), h('span', { class: 'code-card__what' }, what)), copy),
    h('pre', { class: 'code-card__code' }, code));
}

/** Several pieces of code, side by side. */
export const CodeCards = (...cards: Child[]): HTMLDivElement => h('div', { class: 'code-cards' }, cards);
