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
import type { Vault } from '../../tooling/crypto.ts';
import type { Db } from '../../tooling/db.ts';
import { errorMessage } from '../../tooling/errors.ts';
import type { MailService } from '../../tooling/mail/mail-service.ts';
import { problem } from '../../tooling/messages.ts';
import type { Problem } from '../../tooling/messages.ts';
import { firstStanding } from '../computations/emails.ts';
import type { Llm } from '../model/llm.ts';
import type { AccountRow } from '../model/mailbox.ts';
import { prepareProposals } from '../replying/prepare-proposals.ts';
import type { Triage } from '../sorting/strategies.ts';
import { sortWaitingEmails } from '../sorting/sort-waiting-emails.ts';
import type { SortingResult } from '../sorting/sort-waiting-emails.ts';
import { keepFetched, knownIn } from '../state/emails.ts';
import { recordFetch, watchedMailboxes } from '../state/mailboxes.ts';
import { memberById, organizationById } from '../state/members.ts';

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

/** Brings in what arrived in the folder and keeps it. Plainly automated mail is set aside at once, when the organisation wants that. */
async function bringIn({ db, mail, config }: Dependencies, account: AccountRow, folder: string): Promise<number> {
  const known = await knownIn(db, account.id, folder);
  const since = new Date(Date.now() - config.syncDays * 86_400_000);
  const emails = await mail.providerFor(account).listNew({ folder, since, limit: config.syncMaxEmails, known });
  const organization = await organizationById(db, account.org_id);
  await db.transaction(async (tx) => {
    for (const email of emails) await keepFetched(tx, account.id, folder, email, firstStanding(organization, email, account.email));
  });
  return emails.length;
}

/** The same, a failure being told and not thrown. */
async function broughtIn(deps: Dependencies, account: AccountRow, folder: string): Promise<{ fetched: number; error: Problem | null }> {
  try {
    return { fetched: await bringIn(deps, account, folder), error: null };
  } catch (e) {
    return { fetched: 0, error: problem('sync.fetchFailed', { detail: errorMessage(e) }) };
  }
}

/** Proposals are prepared last, as the mailbox's owner. */
const prepared = async (deps: Dependencies, account: AccountRow): Promise<Problem | null> =>
  prepareProposals(deps, account, await organizationById(deps.db, account.org_id), await memberById(deps.db, account.user_id));

/** Sorting, then preparing: each only when what came before went well. */
async function sortedAndPrepared(deps: Dependencies, account: AccountRow): Promise<SortingResult> {
  const sorted = await sortWaitingEmails(deps, account);
  return { triaged: sorted.triaged, error: sorted.error || (await prepared(deps, account)) };
}

async function fetchMailbox(deps: Dependencies, account: AccountRow): Promise<SyncResult> {
  const { folder } = account;
  // Nothing is fetched until the user has said which folder to watch.
  if (!folder) return { fetched: 0, triaged: 0, error: problem('accounts.folderRequired') };
  const { fetched, error } = await broughtIn(deps, account, folder);
  const after: SortingResult = error ? { triaged: 0, error } : await sortedAndPrepared(deps, account);
  await recordFetch(deps.db, account.id, after.error);
  return { fetched, ...after };
}

const logged = (account: AccountRow) => (e: unknown) => console.error(`sync of account ${account.id} failed: ${errorMessage(e)}`);

export function createSync(deps: Dependencies): Sync {
  /** Mailbox -> fetch in flight; whoever asks meanwhile shares it instead of fetching twice. */
  const running = new Map<number, Promise<SyncResult>>();
  const syncAccount = (account: AccountRow): Promise<SyncResult> => {
    const inFlight = running.get(account.id) ?? fetchMailbox(deps, account).finally(() => running.delete(account.id));
    running.set(account.id, inFlight);
    return inFlight;
  };
  const syncAll = async (): Promise<void> => {
    for (const account of await watchedMailboxes(deps.db)) await syncAccount(account).catch(logged(account));
  };
  return { syncAccount, syncAll, inBackground: (account) => void syncAccount(account).catch(logged(account)) };
}
