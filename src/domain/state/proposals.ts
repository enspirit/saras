// State: the proposals the AI wrote, and the replies handed to mailboxes.
import type { Db } from '../../db.ts';
import type { AssistAction, DraftRow, ReplyMode } from '../../types.ts';

/** The proposal with this number, when it is one of this email's. */
export const proposalOf = (db: Db, emailId: number, id: number): Promise<DraftRow | undefined> =>
  db.one<DraftRow>('SELECT * FROM drafts WHERE id = $1 AND email_id = $2', [id, emailId]);

/** Keeps a proposal; returns its number. */
export async function keepProposal(db: Db, proposal: { emailId: number; action: AssistAction; promptId: number | null; model: string; html: string }): Promise<number> {
  const created = await db.one<{ id: number }>('INSERT INTO drafts (email_id, action, prompt_id, model, ai_text) VALUES ($1, $2, $3, $4, $5) RETURNING id', [
    proposal.emailId,
    proposal.action,
    proposal.promptId,
    proposal.model,
    proposal.html,
  ]);
  return created!.id;
}

/** What was handed to the mailbox for an email, and what became of the proposal on the way. */
export interface ReplyRecord {
  emailId: number;
  memberId: number;
  promptId: number | null;
  /** The proposal as text, when there was one. */
  proposedText: string | null;
  text: string;
  html: string;
  edited: boolean;
  reason: string;
  mode: ReplyMode;
  to: string[];
  cc: string[];
}

/** Records the reply and marks the email as replied, together. `onlyFrom` restricts it to an email still in that status. */
export async function recordReply(db: Db, r: ReplyRecord, onlyFrom?: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO replies (email_id, user_id, prompt_id, ai_text, final_text, was_edited, change_reason, mode, to_json, cc_json, final_html)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [r.emailId, r.memberId, r.promptId, r.proposedText, r.text, r.edited, r.reason, r.mode, JSON.stringify(r.to), JSON.stringify(r.cc), r.html],
    );
    if (onlyFrom) await tx.run(`UPDATE emails SET status = 'sent' WHERE id = $1 AND status = $2`, [r.emailId, onlyFrom]);
    else await tx.run(`UPDATE emails SET status = 'sent' WHERE id = $1`, [r.emailId]);
  });
}
