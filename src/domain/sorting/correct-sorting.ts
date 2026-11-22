// What MarkNoReplyNeeded, IgnoreEmail and MoveBackToHandle have in common: a member has the
// last word on where an email stands.
//
//   fetch    the email
//   decide   may it still be sorted                (pure: mayBeSortedAgain)
//   execute  it stands where the member says, and the verdict is theirs
import type { EmailStatus } from '../../types.ts';
import { mayBeSortedAgain } from '../computations/sorting.ts';
import { accepted } from '../refusal.ts';
import { emailFor } from '../state/emails.ts';
import type { Actor, World } from '../world.ts';

export async function correctSorting({ db }: World, actor: Actor, emailId: unknown, status: Extract<EmailStatus, 'needs_reply' | 'no_reply' | 'ignored'>): Promise<void> {
  const email = await emailFor(db, actor, emailId);
  accepted(mayBeSortedAgain(email.status));
  await db.run(`UPDATE emails SET status = $1, triage_source = 'user' WHERE id = $2`, [status, email.id]);
}
