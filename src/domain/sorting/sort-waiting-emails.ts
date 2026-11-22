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
import type { EmailRow } from '../model/email.ts';
import type { AccountRow } from '../model/mailbox.ts';
import { rowToEmail, toTriageMail } from '../computations/emails.ts';
import { emailsWaiting, keepVerdict } from '../state/emails.ts';
import { memberById, organizationById } from '../state/members.ts';
import { promptsToSuggest } from '../state/prompts.ts';
import { runGate } from './gate.ts';
import type { Triage } from './strategies.ts';

export interface SortingResult {
  /** Emails the gate decided about. */
  triaged: number;
  error: Problem | null;
}

type Sorting = { db: Db; triage: Triage };

/** Asks the organisation's gate, as the mailbox's owner, about the emails that wait; records what it decided. */
async function decideAbout({ db, triage }: Sorting, account: AccountRow, waiting: EmailRow[]): Promise<number> {
  const organization = await organizationById(db, account.org_id);
  const gate = triage.gateFor(account, organization, await memberById(db, account.user_id));
  const decisions = await runGate(gate, await promptsToSuggest(db, organization.id), waiting.map((row) => toTriageMail(rowToEmail(row))));
  await db.transaction(async (tx) => {
    for (const decision of decisions) await keepVerdict(tx, gate.name, decision);
  });
  return decisions.length;
}

export async function sortWaitingEmails(sorting: Sorting, account: AccountRow): Promise<SortingResult> {
  const waiting = await emailsWaiting(sorting.db, account.id);
  if (!waiting.length) return { triaged: 0, error: null };
  try {
    return { triaged: await decideAbout(sorting, account, waiting), error: null };
  } catch (e) {
    return { triaged: 0, error: e instanceof LlmError ? e.problem : problem('sync.triageFailed', { detail: errorMessage(e) }) };
  }
}
