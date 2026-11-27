// ArrangeBoards — a member puts the boards of their menu in the order they want.
//
//   DomPre   —
//   DomPost  the boards the member sees come in the order given; those not named come after,
//            in the order they had
//   ReqPre   —
//   ReqPost  the order is the member's alone: nobody else's menu changes, not even for a
//            shared board; a board the member does not see is left out, as if it was not named
import { boardsArranged } from '../computations/boards.ts';
import { boardsSeenBy, keepBoardOrder } from '../state/boards.ts';
import type { Actor, World } from '../world.ts';

export async function arrangeBoards({ db }: World, actor: Actor, boardIds: number[]): Promise<void> {
  const seen = await boardsSeenBy(db, actor);
  await keepBoardOrder(db, actor.member.id, boardsArranged(seen.map((board) => board.id), boardIds));
}
