// EditBoard — the one who manages a board changes its name, its filter, or whether it is shared.
//
//   DomPre   a board the member sees
//   DomPost  the board has this name, this filter, and is shared or not
//   ReqPre   the member manages it: its owner; for a shared one, an administrator
//            it has a name
//            only an administrator makes it shared
//   ReqPost  a shared board made personal again stays with who made it
import type { Board } from '../../../shared/board.ts';
import { boardGiven, mayManageBoard, mayShare } from '../computations/boards.ts';
import { boardSeenBy } from '../observations/boards.ts';
import { accepted } from '../refusal.ts';
import { boardFor, changeBoard } from '../state/boards.ts';
import type { Actor, World } from '../world.ts';

export async function editBoard({ db }: World, actor: Actor, boardId: unknown, given: { name?: unknown; shared?: unknown; filter?: unknown }): Promise<Board> {
  const kept = await boardFor(db, actor, boardId);
  accepted(mayManageBoard(actor, kept));
  const board = accepted(boardGiven(given));
  accepted(mayShare(actor, board.shared));
  return boardSeenBy(db, actor, await changeBoard(db, kept.id, board));
}
