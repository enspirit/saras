import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { errorMessage } from './errors.ts';
import { LlmError } from './llm/openrouter.ts';
import type { MailService } from './mail/index.ts';
import { encodeProblem, problem } from './messages.ts';
import type { Problem } from './messages.ts';
import { runGate } from './triage/gate.ts';
import type { TriageMail, TriagePrompt } from './triage/gate.ts';
import type { Triage } from './triage/index.ts';
import { heuristicTriage } from './triage/rules.ts';
import type { AccountRow, Email, EmailRow, IncomingEmail, OrganizationRow, UserRow } from './types.ts';

const MAX_STORED_BODY = 100_000;

export function rowToEmail(row: EmailRow): Email {
  return {
    id: row.id,
    accountId: row.account_id,
    folder: row.folder,
    providerId: row.provider_id,
    messageId: row.message_id,
    threadId: row.thread_id,
    refs: row.refs,
    fromName: row.from_name,
    fromAddr: row.from_addr,
    replyTo: row.reply_to,
    to: JSON.parse(row.to_json),
    cc: JSON.parse(row.cc_json),
    subject: row.subject,
    date: row.date.toISOString(),
    bodyText: row.body_text,
    attachments: JSON.parse(row.attachments_json),
    status: row.status,
    triageSource: row.triage_source,
    triageReason: row.triage_reason,
    priority: row.priority,
    suggestedPromptId: row.suggested_prompt_id,
  };
}

/** Pure: a stored email, as the triage gate is given it. */
export function toTriageMail(email: Email): TriageMail {
  return {
    id: email.id,
    from: { name: email.fromName, address: email.fromAddr },
    to: email.to,
    cc: email.cc,
    subject: email.subject,
    body: email.bodyText,
    attachments: email.attachments,
  };
}

export interface TriageResult {
  /** Emails the gate decided about. */
  triaged: number;
  error: Problem | null;
}

export interface SyncResult extends TriageResult {
  /** New emails fetched from the mailbox. */
  fetched: number;
}

export interface Sync {
  syncAccount(account: AccountRow): Promise<SyncResult>;
  syncAll(): Promise<void>;
  triagePending(account: AccountRow): Promise<TriageResult>;
}

interface Dependencies {
  db: Db;
  mail: MailService;
  triage: Triage;
  config: Config;
}

/**
 * Fetches the new emails of a mailbox's watched folder, then passes them through the triage
 * gate, which sorts them into "a reply is needed" or not.
 */
export function createSync({ db, mail, triage, config }: Dependencies): Sync {
  /** account id -> sync in flight; concurrent callers share it instead of fetching twice. */
  const running = new Map<number, Promise<SyncResult>>();

  const organizationOf = async (account: AccountRow): Promise<OrganizationRow> =>
    (await db.one<OrganizationRow>('SELECT * FROM organizations WHERE id = $1', [account.org_id]))!;

  /** Stores what was fetched. A message already known (same account, folder and provider id) is left as it is. */
  async function store(account: AccountRow, org: OrganizationRow, folder: string, emails: IncomingEmail[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const email of emails) {
        // Plainly automated mail is set aside here, before any gate is asked about it.
        const verdict = org.skip_automated ? heuristicTriage(email, account.email) : null;
        await tx.run(
          `INSERT INTO emails
             (account_id, folder, provider_id, message_id, thread_id, refs, from_name, from_addr, reply_to, to_json, cc_json,
              subject, date, body_text, attachments_json, status, triage_source, triage_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           ON CONFLICT (account_id, folder, provider_id) DO NOTHING`,
          [
            account.id,
            folder,
            email.providerId,
            email.messageId,
            email.threadId,
            email.refs || '',
            email.fromName,
            email.fromAddr,
            email.replyTo || '',
            JSON.stringify(email.to),
            JSON.stringify(email.cc),
            email.subject,
            email.date,
            // PostgreSQL text cannot hold a NUL character, which a malformed mail may contain.
            email.bodyText.replaceAll('\u0000', '').slice(0, MAX_STORED_BODY),
            JSON.stringify(email.attachments),
            verdict ? verdict.status : 'pending',
            verdict ? 'rule' : null,
            verdict ? verdict.reason : '',
          ],
        );
      }
    });
  }

  /**
   * Passes every email still waiting through the gate. An email the gate says nothing about
   * stays waiting; if the gate fails, so do all those it had not decided yet.
   */
  async function triagePending(account: AccountRow): Promise<TriageResult> {
    const org = await organizationOf(account);
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

  function syncAccount(account: AccountRow): Promise<SyncResult> {
    let inFlight = running.get(account.id);
    if (!inFlight) {
      inFlight = runSync(account).finally(() => running.delete(account.id));
      running.set(account.id, inFlight);
    }
    return inFlight;
  }

  async function runSync(account: AccountRow): Promise<SyncResult> {
    const { folder } = account;
    // Nothing is fetched until the user has said which folder to watch.
    if (!folder) return { fetched: 0, triaged: 0, error: problem('accounts.folderRequired') };
    const stored = await db.query<Pick<EmailRow, 'provider_id'>>('SELECT provider_id FROM emails WHERE account_id = $1 AND folder = $2', [account.id, folder]);
    const known = new Set(stored.map((r) => r.provider_id));
    const since = new Date(Date.now() - config.syncDays * 86_400_000);
    let fetched = 0;
    let error: Problem | null = null;
    try {
      const emails = await mail.providerFor(account).listNew({ folder, since, limit: config.syncMaxEmails, known });
      await store(account, await organizationOf(account), folder, emails);
      fetched = emails.length;
    } catch (e) {
      error = problem('sync.fetchFailed', { detail: errorMessage(e) });
    }
    const outcome: TriageResult = error ? { triaged: 0, error: null } : await triagePending(account);
    error = error || outcome.error;
    await db.run(`UPDATE accounts SET last_sync_at = now(), last_error = $1 WHERE id = $2`, [encodeProblem(error), account.id]);
    return { fetched, triaged: outcome.triaged, error };
  }

  async function syncAll(): Promise<void> {
    for (const account of await db.query<AccountRow>('SELECT * FROM accounts WHERE folder IS NOT NULL')) {
      await syncAccount(account).catch((e) => console.error(`sync of account ${account.id} failed: ${errorMessage(e)}`));
    }
  }

  return { syncAccount, syncAll, triagePending };
}
