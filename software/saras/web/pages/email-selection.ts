// Several emails of a list at once: which are ticked, the bar that says so above the list, and
// what can be done to them all. "All" is said by the view the list is of, never email by email.

import { STATUS } from '../../shared/attribute.ts';
import type { EmailStatus, Selection, SelectionDone, View } from '../../shared/email.ts';
import { correctSelection, setOnSelection } from '../api/emails.ts';
import { t } from '../i18n.ts';
import { showPage } from '../navigation.ts';
import { session } from '../session.ts';
import { ActionButton, toast } from './actions.ts';
import { attributeName } from './attribute-names.ts';
import { chipOf, noValueChip } from './attribute-values.ts';
import { Button } from '../ui/atoms/button.ts';
import type { Child } from '../ui/dom.ts';
import { GroupedMenu, SelectionBar } from '../ui/molecules/selection-bar.ts';
import type { Ticked } from '../ui/molecules/selection-bar.ts';

/** What is ticked in the list on screen; `all`: every email of its view, however many, rather than those ticked. */
interface Ticks { key: string; ids: Set<number>; all: boolean; last: number | null }
let ticks: Ticks = { key: '', ids: new Set(), all: false, last: null };

/** The ticks of a list, by its view: kept while an email of it is opened, forgotten for another list or another search. */
export function ticksOf(view: View): Ticks {
  const key = JSON.stringify(view);
  if (ticks.key !== key) ticks = { key, ids: new Set(), all: false, last: null };
  return ticks;
}

export const anyTicked = (view: View): boolean => ticksOf(view).all || ticksOf(view).ids.size > 0;

/** A list as the selection sees it: its view, the ids it shows, how many its view holds (unknown when searched beyond what is shown), and how to show it again. */
export interface Listed {
  view: View;
  ids: number[];
  total: number | null;
  redraw: () => void;
}

/** Ticks or unticks one email; with `range`, every email from the last one ticked to it takes the same state. */
export function toggle(listed: Listed, index: number, range: boolean): void {
  const own = ticksOf(listed.view);
  if (own.all) own.ids = new Set(listed.ids);
  own.all = false;
  const on = !own.ids.has(listed.ids[index] ?? 0);
  const from = range && own.last !== null ? Math.min(own.last, index) : index;
  const to = range && own.last !== null ? Math.max(own.last, index) : index;
  for (const id of listed.ids.slice(from, to + 1)) on ? own.ids.add(id) : own.ids.delete(id);
  own.last = index;
  listed.redraw();
}

const tickedOf = (listed: Listed): Ticked => {
  const own = ticksOf(listed.view);
  if (own.all || (listed.ids.length > 0 && listed.ids.every((id) => own.ids.has(id)))) return 'all';
  return own.ids.size ? 'some' : 'none';
};

/** The selection as the server takes it: the ids ticked, or the view itself. */
const selectionOf = (listed: Listed): Selection => (ticksOf(listed.view).all ? { all: listed.view } : { ids: [...ticksOf(listed.view).ids] });

/** Whether there are more emails to select than those shown: then "all" is offered, as the view. */
const moreThanShown = ({ ids, total }: Listed): boolean => (total === null ? ids.length >= 200 : total > ids.length);

function clear(listed: Listed): void {
  Object.assign(ticksOf(listed.view), { ids: new Set(), all: false, last: null });
  listed.redraw();
}

/** Does it to the selection, says how many changed, and shows the list again, nothing ticked. */
async function apply(listed: Listed, run: (selection: Selection) => Promise<SelectionDone>): Promise<void> {
  const { changed } = await run(selectionOf(listed));
  clear(listed);
  toast(t('mailbox.selection.done', { count: changed }));
  showPage();
}

/** Where the emails may be moved, from the box they are in: anywhere but there, and never to "Replied". */
const MOVES: { status: EmailStatus; label: string; from: View['box'][] }[] = [
  { status: 'no_reply', label: 'composer.noReplyNeeded', from: ['todo', 'ignored', 'all'] },
  { status: 'ignored', label: 'composer.ignore', from: ['todo', 'none', 'all'] },
  { status: 'needs_reply', label: 'composer.restore', from: ['none', 'ignored', 'all'] },
];

/** The values of every attribute but where an email stands, each to set on all, or to take away. */
const setMenu = (listed: Listed): HTMLElement =>
  GroupedMenu(t('mailbox.selection.set'), session.attributes.filter((a) => a.key !== STATUS).map((attribute) => ({
    title: attributeName(attribute),
    choices: [
      ...attribute.values.map((value) => ({ label: chipOf(attribute, value, true), onPick: () => void apply(listed, (s) => setOnSelection(s, attribute.key, value.key)) })),
      { label: noValueChip(true), onPick: () => void apply(listed, (s) => setOnSelection(s, attribute.key, null)) },
    ],
  })));

/** What can be done to the emails ticked. On a board, whatever box they are in. */
export const selectionActions = (listed: Listed): Child[] => [
  ...MOVES.filter((move) => listed.view.board || move.from.includes(listed.view.box)).map((move) =>
    ActionButton(t(move.label), '…', () => apply(listed, (s) => correctSelection(s, move.status)), { size: 'small' })),
  setMenu(listed),
];

/** How many are selected, in words. */
export function selectedLabel(listed: Listed): string {
  const own = ticksOf(listed.view);
  if (!own.all) return t('mailbox.selection.count', { count: own.ids.size });
  return listed.total === null || listed.view.search ? t('mailbox.selection.allMatching') : t('mailbox.selection.all', { count: listed.total });
}

/** The way to select every email of the view, once all those shown are ticked and there are more. */
export function selectAllOffer(listed: Listed): Child {
  if (ticksOf(listed.view).all || tickedOf(listed) !== 'all' || !moreThanShown(listed)) return null;
  const label = listed.total === null || listed.view.search ? t('mailbox.selection.selectAllMatching') : t('mailbox.selection.selectAll', { count: listed.total });
  return Button(label, { variant: 'link', size: 'small', onClick: () => ((ticksOf(listed.view).all = true), listed.redraw()) });
}

/** Above the list, while any email is ticked. */
export function selectionBar(listed: Listed): Child {
  if (!anyTicked(listed.view)) return null;
  return SelectionBar({
    ticked: tickedOf(listed),
    toggleLabel: t('mailbox.selection.tickAll'),
    onToggle: () => (tickedOf(listed) === 'all' ? clear(listed) : (Object.assign(ticksOf(listed.view), { ids: new Set(listed.ids), all: false }), listed.redraw())),
    label: [selectedLabel(listed), ' ', selectAllOffer(listed)],
    actions: selectionActions(listed),
    clearLabel: t('mailbox.selection.clear'),
    onClear: () => clear(listed),
  });
}
