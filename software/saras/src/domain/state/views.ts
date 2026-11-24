// State: the emails of a view (a box, every box or a board, as searched) and of a selection, as
// conditions on the emails a member may see. Parameters $1 and $2 are the organisation and the
// member (SEEN_BY_MEMBER); a view's own are numbered from $3.
import { BOXES } from '../../../shared/email.ts';
import type { EmailStatus, Selection, View } from '../../../shared/email.ts';
import type { Db } from '../../tooling/db.ts';
import type { BoardFilter } from '../../../shared/board.ts';
import { conditionsOf } from '../computations/boards.ts';
import type { Conditions } from '../computations/boards.ts';
import { statusesOf } from '../computations/boxes.ts';
import { both, searchConditions } from '../computations/search.ts';
import type { Actor } from '../world.ts';
import { boardFor } from './boards.ts';
import { mayUse } from './mailboxes.ts';

/** Every status an email may have: what "every box" holds. */
const EVERY_STATUS = Object.values(BOXES).flat() as EmailStatus[];

/** The conditions of a box, or of every box, before any search. */
const ofBox = (box: View['box']): Conditions => ({ sql: ['e.status = ANY($3)'], params: [box === 'all' ? EVERY_STATUS : statusesOf(box)] });

/** The conditions of a view: of its board, which must be one the member sees, or of its box; then of what is searched. */
export async function viewConditions(db: Db, actor: Actor, view: View): Promise<Conditions> {
  const own = view.board ? conditionsOf(JSON.parse((await boardFor(db, actor, view.board)).filter_json) as BoardFilter, 3) : ofBox(view.box);
  return both(own, searchConditions(view.search ?? '', 3 + own.params.length));
}

/** The conditions of a selection: the emails ticked, or all of a view. */
export const selectionConditions = async (db: Db, actor: Actor, selection: Selection): Promise<Conditions> =>
  'ids' in selection ? { sql: ['e.id = ANY($3)'], params: [selection.ids] } : viewConditions(db, actor, selection.all);

/** A query naming the emails that meet these conditions among those the member may see: its $1 and $2 are the organisation and the member. */
export const idsMeeting = ({ sql }: Conditions): string =>
  `SELECT e.id FROM emails e JOIN accounts a ON a.id = e.account_id WHERE ${[mayUse('$1', '$2'), ...sql].join(' AND ')}`;
