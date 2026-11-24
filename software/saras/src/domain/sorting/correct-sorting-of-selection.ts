// CorrectSortingOfSelection — a member says where several emails stand, at once: no reply
// needed, ignored, or to handle again.
//
//   DomPre   emails the member may see: those ticked, or all of a box or a board, as searched
//   DomPost  each of them not replied stands where the member says, as the member's verdict
//   ReqPre   the status is one of the three corrections; at most TICKED_MAX emails ticked
//   ReqPost  one statement for all of them, whatever their number; a replied email is left as it is
//            (as MarkNoReplyNeeded, IgnoreEmail and MoveBackToHandle refuse it one by one)
import type { SelectionDone } from '../../../shared/email.ts';
import { selectionGiven } from '../computations/selection.ts';
import { Refusal, accepted } from '../refusal.ts';
import { idsMeeting, selectionConditions } from '../state/views.ts';
import type { Actor, World } from '../world.ts';

const CORRECTIONS = ['needs_reply', 'no_reply', 'ignored'];

export async function correctSortingOfSelection({ db }: World, actor: Actor, given: unknown, status: unknown): Promise<SelectionDone> {
  if (!CORRECTIONS.includes(String(status))) throw new Refusal('invalid', 'emails.invalidStatus');
  const conditions = await selectionConditions(db, actor, accepted(selectionGiven(given)));
  const done = await db.one<SelectionDone>(
    `WITH changed AS (UPDATE emails SET status = $${3 + conditions.params.length}, triage_source = 'user'
                      WHERE status <> 'sent' AND id IN (${idsMeeting(conditions)}) RETURNING 1)
     SELECT count(*)::int AS changed FROM changed`,
    [actor.organization.id, actor.member.id, ...conditions.params, String(status)],
  );
  return { changed: done?.changed ?? 0 };
}
