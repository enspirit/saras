// DeleteBoard — the one who manages a board deletes it.
//
//   DomPre   a board the member sees
//   DomPost  the board is gone
//   ReqPre   the member manages it: its owner; for a shared one, an administrator
//   ReqPost  the emails it showed are untouched: a board is only a view
import { mayManageBoard } from '../computations/boards.ts';
import { accepted } from '../refusal.ts';
import { boardFor, forgetBoard } from '../state/boards.ts';
import type { Actor, World } from '../world.ts';

export async function deleteBoard({ db }: World, actor: Actor, boardId: unknown): Promise<void> {
  const board = await boardFor(db, actor, boardId);
  accepted(mayManageBoard(actor, board));
  await forgetBoard(db, board.id);
}
