// Pure: which emails an action on several is for. Ticked ones are named, at most a few hundred;
// "all" is named by the view it is of, whatever the number of its emails.
import { BOXES } from '../../../shared/email.ts';
import type { Box, Selection, View } from '../../../shared/email.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import { searchGiven } from './search.ts';

/** More ticked emails than a list shows are not ticked by hand: "all" is for them. */
export const TICKED_MAX = 500;

const isBox = (box: unknown): box is Box | 'all' => box === 'all' || Object.hasOwn(BOXES, String(box));

/** A view as asked: a board by its number, or else a box (the emails to handle when none is said), and what is searched in it. */
export function viewGiven(value: unknown): View {
  const given = (value ?? {}) as Record<string, unknown>;
  const search = searchGiven(given.search);
  const board = Number(given.board);
  if (Number.isInteger(board) && board > 0) return { board, search };
  return { box: isBox(given.box) ? given.box : 'todo', search };
}

const invalid = (): Verdict<never> => refuse('invalid', 'emails.selectionInvalid', { max: TICKED_MAX });

/** The emails ticked, each a positive whole number, once. */
function ticked(ids: unknown): Verdict<Selection> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > TICKED_MAX) return invalid();
  const numbers = ids.map(Number);
  return numbers.every((id) => Number.isInteger(id) && id > 0) ? accept({ ids: [...new Set(numbers)] }) : invalid();
}

/** The selection asked for: emails ticked, or all of a view. */
export function selectionGiven(value: unknown): Verdict<Selection> {
  const given = (value ?? {}) as Record<string, unknown>;
  if ('ids' in given) return ticked(given.ids);
  if (given.all && typeof given.all === 'object') return accept({ all: viewGiven(given.all) });
  return invalid();
}
