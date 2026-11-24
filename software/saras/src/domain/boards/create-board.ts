// CreateBoard — a member makes a board: a named view of emails, defined by a filter on their
// attributes and on the facts of an email (mailbox, how recent, sender, keywords, attachments).
//
//   DomPre   (none)
//   DomPost  the member has one more board, with this name and this filter
//   ReqPre   it has a name
//            only an administrator makes it shared
//   ReqPost  the filter is kept reduced to the attributes we know
//            a board shows each member only the emails of mailboxes they may use
import type { Board } from '../../../shared/board.ts';
import { boardGiven, mayShare } from '../computations/boards.ts';
import { boardSeenBy } from '../observations/boards.ts';
import { accepted } from '../refusal.ts';
import { addBoard } from '../state/boards.ts';
import type { Actor, World } from '../world.ts';

export async function createBoard({ db }: World, actor: Actor, given: { name?: unknown; shared?: unknown; filter?: unknown }): Promise<Board> {
  const board = accepted(boardGiven(given));
  accepted(mayShare(actor, board.shared));
  return boardSeenBy(db, actor, await addBoard(db, actor, board));
}
