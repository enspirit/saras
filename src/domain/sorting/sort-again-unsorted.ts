// SortAgainUnsorted — an administrator has the emails that nobody sorted looked at again,
// after choosing a way of sorting: the next fetch then sorts them that way.
//
//   DomPre   emails to handle that no strategy sorted, and that have no proposal
//   DomPost  they are waiting to be sorted
//   ReqPre   the member is an administrator
import { isAdministrator } from '../computations/access.ts';
import { accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

export async function sortAgainUnsorted({ db }: World, actor: Actor): Promise<void> {
  accepted(isAdministrator(actor));
  await db.run(
    `UPDATE emails e SET status = 'pending', triage_source = NULL, triage_reason = ''
     FROM accounts a
     WHERE a.id = e.account_id AND a.org_id = $1 AND e.status = 'needs_reply' AND e.triage_source = 'none'
       AND NOT EXISTS (SELECT 1 FROM drafts d WHERE d.email_id = e.id)`,
    [actor.organization.id],
  );
}
