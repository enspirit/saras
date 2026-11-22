// SortWaitingEmails — the backend has the emails of a mailbox that wait to be sorted looked
// at by the organisation's way of sorting: nobody, or the AI.
//
//   DomPre   emails of the mailbox waiting to be sorted
//   DomPost  each one the gate decided about is to handle or needs no reply, with the reason,
//            the priority and, when to handle, the prompt that suits it
//   ReqPost  an email the gate says nothing about stays waiting
//            if the gate fails, so do all those it had not decided yet, and why is reported
//            the AI is asked as the mailbox's owner: with the key and the model in force for them
//   ReqTrig  after every fetch of the mailbox that did not fail
import type { Db } from '../../tooling/db.ts';
import { errorMessage } from '../../tooling/errors.ts';
import { LlmError } from '../../tooling/llm/openrouter.ts';
import { problem } from '../../tooling/messages.ts';
import type { Problem } from '../../tooling/messages.ts';
import type { AccountRow, EmailRow, UserRow } from '../../types.ts';
import { rowToEmail, toTriageMail } from '../computations/emails.ts';
import { organizationById } from '../state/members.ts';
import { runGate } from './gate.ts';
import type { TriagePrompt } from './gate.ts';
import type { Triage } from './index.ts';

export interface SortingResult {
  /** Emails the gate decided about. */
  triaged: number;
  error: Problem | null;
}

export async function sortWaitingEmails({ db, triage }: { db: Db; triage: Triage }, account: AccountRow): Promise<SortingResult> {
  const org = (await organizationById(db, account.org_id))!;
  const owner = (await db.one<UserRow>('SELECT * FROM users WHERE id = $1', [account.user_id]))!;
  const pending = await db.query<EmailRow>(`SELECT * FROM emails WHERE account_id = $1 AND status = 'pending' ORDER BY date DESC`, [account.id]);
  if (!pending.length) return { triaged: 0, error: null };
  const prompts = await db.query<TriagePrompt>('SELECT id, name, description FROM prompts WHERE org_id = $1 ORDER BY id', [org.id]);
  const gate = triage.gateFor(account, org, owner);
  try {
    const decisions = await runGate(gate, prompts, pending.map((row) => toTriageMail(rowToEmail(row))));
    await db.transaction(async (tx) => {
      for (const decision of decisions) {
        await tx.run(`UPDATE emails SET status = $1, triage_source = $2, triage_reason = $3, priority = $4, suggested_prompt_id = $5 WHERE id = $6 AND status = 'pending'`, [
          decision.replyNeeded ? 'needs_reply' : 'no_reply',
          gate.name,
          decision.reason ?? '',
          decision.priority ?? 'normal',
          decision.replyNeeded ? decision.promptId : null,
          decision.mailId,
        ]);
      }
    });
    return { triaged: decisions.length, error: null };
  } catch (e) {
    return { triaged: 0, error: e instanceof LlmError ? e.problem : problem('sync.triageFailed', { detail: errorMessage(e) }) };
  }
}
