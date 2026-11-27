// EditBoard — the one who manages a board changes its name, its filter, or whether it is shared.
//
//   DomPre   a board the member sees
//   DomPost  the board has this name, this filter, and is shared or not
//   ReqPre   the member manages it: its owner; for a shared one, an administrator
//            it has a name (the type of its input says so)
//            only an administrator makes it shared
//   ReqPost  a shared board made personal again stays with who made it
import type { Board, BoardGiven } from '../../../shared/board.ts';
import { boardKept, mayManageBoard, mayShare } from '../computations/boards.ts';
import { boardSeenBy } from '../observations/boards.ts';
import { accepted } from '../refusal.ts';
import { boardFor, changeBoard } from '../state/boards.ts';
import type { Actor, World } from '../world.ts';

export async function editBoard({ db }: World, actor: Actor, boardId: number, given: BoardGiven): Promise<Board> {
  const kept = await boardFor(db, actor, boardId);
  accepted(mayManageBoard(actor, kept));
  accepted(mayShare(actor, given.shared));
  return boardSeenBy(db, actor, await changeBoard(db, kept.id, boardKept(given)));
}
