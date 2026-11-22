// FetchMailbox — the backend brings in what arrived in a mailbox's watched folder, then has
// it sorted, then has proposals prepared where the organisation wants them.
//
//   DomPre   a mailbox that watches a folder
//   DomPost  the emails that arrived in that folder since the last fetch are kept, waiting to
//            be sorted — or already set aside, for plainly automated mail, when the organisation
//            wants that done first
//   ReqPre   (none: a mailbox that watches no folder is not fetched, and says so as its last error)
//   ReqPost  an email already kept is left as it is
//            no further back than the days, and no more than the number, this server is set up for
//            what went wrong, fetching, sorting or preparing, is kept as the mailbox's last error
//            one fetch at a time per mailbox: whoever asks meanwhile shares the one under way
//   ReqTrig  on the server's clock, for every mailbox that watches a folder
//            when a member asks, when a folder is chosen, when a mailbox is reconnected
//   Then     SortWaitingEmails, and PrepareProposals, unless fetching failed
import type { Config } from '../../tooling/config.ts';
import { prepareProposals } from '../replying/prepare-proposals.ts';
import type { Vault } from '../../tooling/crypto.ts';
import type { Db } from '../../tooling/db.ts';
import { errorMessage } from '../../tooling/errors.ts';
import type { MailService } from '../../tooling/mail/index.ts';
import { encodeProblem, problem } from '../../tooling/messages.ts';
import type { Problem } from '../../tooling/messages.ts';
import { watchedMailboxes } from '../state/mailboxes.ts';
import { sortWaitingEmails } from '../sorting/sort-waiting-emails.ts';
import type { SortingResult } from '../sorting/sort-waiting-emails.ts';
import { organizationById } from '../state/members.ts';
import type { Triage } from '../sorting/index.ts';
import { heuristicTriage } from '../sorting/rules.ts';
import type { AccountRow, EmailRow, IncomingEmail, Llm, OrganizationRow, UserRow } from '../../types.ts';

const MAX_STORED_BODY = 100_000;

export interface SyncResult extends SortingResult {
  /** New emails fetched from the mailbox. */
  fetched: number;
}

export interface Sync {
  syncAccount(account: AccountRow): Promise<SyncResult>;
  /** The same, without waiting for it: what goes wrong is kept with the mailbox, and logged. */
  inBackground(account: AccountRow): void;
  syncAll(): Promise<void>;
}

interface Dependencies {
  db: Db;
  mail: MailService;
  triage: Triage;
  config: Config;
  llm: Llm;
  vault: Vault;
}


/**
 * Fetches the new emails of a mailbox's watched folder, then passes them through the triage
 * gate, which sorts them into "a reply is needed" or not.
 */
export function createSync({ db, mail, triage, config, llm, vault }: Dependencies): Sync {
  /** account id -> sync in flight; concurrent callers share it instead of fetching twice. */
  const running = new Map<number, Promise<SyncResult>>();

  const organizationOf = async (account: AccountRow): Promise<OrganizationRow> =>
    (await organizationById(db, account.org_id))!;

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
    const outcome: SortingResult = error ? { triaged: 0, error: null } : await sortWaitingEmails({ db, triage }, account);
    error = error || outcome.error;
    // Proposals are prepared last, and only once fetching and sorting went well.
    error = error || (await prepareProposals({ db, mail, llm, vault, config }, account, await organizationOf(account), (await db.one<UserRow>('SELECT * FROM users WHERE id = $1', [account.user_id]))!));
    await db.run(`UPDATE accounts SET last_sync_at = now(), last_error = $1 WHERE id = $2`, [encodeProblem(error), account.id]);
    return { fetched, triaged: outcome.triaged, error };
  }

  const logged = (account: AccountRow) => (e: unknown) => console.error(`sync of account ${account.id} failed: ${errorMessage(e)}`);
  const inBackground = (account: AccountRow): void => void syncAccount(account).catch(logged(account));

  async function syncAll(): Promise<void> {
    for (const account of await watchedMailboxes(db)) {
      await syncAccount(account).catch(logged(account));
    }
  }

  return { syncAccount, inBackground, syncAll };
}
