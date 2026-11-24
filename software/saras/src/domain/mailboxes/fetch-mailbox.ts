// FetchMailbox — the backend brings in what arrived in a mailbox's watched folder, sorted by
// the organisation's rules, then has proposals prepared where the organisation wants them.
//
//   DomPre   a mailbox that watches a folder
//   DomPost  the emails that arrived in that folder since the last fetch are kept, each where
//            the rules put it: to handle, unless one sets it aside (SortByRules)
//   ReqPre   (none: a mailbox that watches no folder is not fetched, and says so as its last error)
//   ReqPost  an email already kept is left as it is
//            no further back than the days chosen for the mailbox (those the server is set up for, when none were),
//            only what is unread when the mailbox says so, and no more at a time than the number the server is set up for,
//            the most recent first: how many that leaves for later fetches is told
//            what went wrong, fetching or preparing, is kept as the mailbox's last error
//            one fetch at a time per mailbox: whoever asks meanwhile shares the one under way,
//            or waits for its turn when it is under way on another server
//   ReqTrig  on the server's clock, for every mailbox that watches a folder
//            when a member asks, when a folder is chosen, when a mailbox is reconnected
//   Then     PrepareProposals, unless fetching failed
import type { FetchResult } from '../../../shared/mailbox.ts';
import type { Config } from '../../tooling/config.ts';
import type { Vault } from '../../tooling/crypto.ts';
import type { Db } from '../../tooling/db.ts';
import { errorKind, errorMessage } from '../../tooling/errors.ts';
import { about, log } from '../../tooling/log.ts';
import type { MailService } from '../../tooling/mail/mail-service.ts';
import { problem } from '../../tooling/messages.ts';
import type { ServerProblem } from '../../tooling/messages.ts';
import { daysFetched } from '../computations/mailboxes.ts';
import type { Llm } from '../model/llm.ts';
import type { AccountRow } from '../model/mailbox.ts';
import { prepareProposals } from '../replying/prepare-proposals.ts';
import { ruled, sortByRules } from '../sorting/sort-by-rules.ts';
import { attributesOf } from '../state/attributes.ts';
import { keepFetched, knownIn } from '../state/emails.ts';
import { recordFetch, watchedMailboxes } from '../state/mailboxes.ts';
import { memberById, organizationById } from '../state/members.ts';

/** What a fetch brought in, and what went wrong if anything did. */
export type SyncResult = FetchResult;

export interface Sync {
  syncAccount(account: AccountRow): Promise<SyncResult>;
  /** The same, without waiting for it: what goes wrong is kept with the mailbox, and logged. */
  inBackground(account: AccountRow): void;
  syncAll(): Promise<void>;
}

interface Dependencies {
  db: Db;
  mail: MailService;
  config: Config;
  llm: Llm;
  vault: Vault;
}

/** What a fetch brought in, and how many more emails it left in the folder for later ones. */
type Brought = Pick<FetchResult, 'fetched' | 'toCome'>;

/** Brings in what arrived in the folder and keeps it, sorted at once by the rules of the organisation's attributes (SortByRules). */
async function bringIn({ db, mail, config }: Dependencies, account: AccountRow, folder: string): Promise<Brought> {
  const known = await knownIn(db, account.id, folder);
  const since = new Date(Date.now() - daysFetched(account.fetch_days, config) * 86_400_000);
  const { emails, toCome } = await mail.providerFor(account).listNew({ folder, since, unreadOnly: account.unread_only, limit: config.syncMaxEmails, known });
  const rules = ruled(await attributesOf(db, await organizationById(db, account.org_id)));
  await db.transaction(async (tx) => {
    for (const email of emails) await keepFetched(tx, account.id, folder, email, sortByRules(rules, email, account.email));
  });
  return { fetched: emails.length, toCome };
}

/** The same, a failure being told and not thrown. */
async function broughtIn(deps: Dependencies, account: AccountRow, folder: string): Promise<Brought & { error: ServerProblem | null }> {
  try {
    return { ...(await bringIn(deps, account, folder)), error: null };
  } catch (e) {
    // By its kind only: the words of a mail host may name a folder. They are kept with the mailbox, for its members.
    log.warn('mailbox not fetched', { kind: account.kind, ...errorKind(e) });
    return { fetched: 0, toCome: 0, error: problem('sync.fetchFailed', { detail: errorMessage(e) }) };
  }
}

/** Proposals are prepared last, as the mailbox's owner. */
const prepared = async (deps: Dependencies, account: AccountRow): Promise<ServerProblem | null> =>
  prepareProposals(deps, account, await organizationById(deps.db, account.org_id), await memberById(deps.db, account.user_id));

async function fetchMailbox(deps: Dependencies, account: AccountRow): Promise<SyncResult> {
  const { folder } = account;
  // Nothing is fetched until the user has said which folder to watch.
  if (!folder) return { fetched: 0, toCome: 0, error: problem('mailboxes.folderRequired') };
  const started = Date.now();
  const brought = await broughtIn(deps, account, folder);
  const error = brought.error ?? (await prepared(deps, account));
  await recordFetch(deps.db, account.id, error);
  log.info('mailbox fetched', { kind: account.kind, fetched: brought.fetched, toCome: brought.toCome, problem: error?.code, ms: Date.now() - started });
  return { fetched: brought.fetched, toCome: brought.toCome, error };
}

/** The same, once no other server is fetching this mailbox: what that one brought in is then known, sorted and prepared, and is not again. */
async function inTurn(deps: Dependencies, account: AccountRow): Promise<SyncResult> {
  const release = await deps.db.hold(`fetch-mailbox:${account.id}`);
  try {
    return await fetchMailbox(deps, account);
  } finally {
    await release();
  }
}

/** Every line logged while a mailbox is fetched says which, by its number: a mailbox is never named in a log. */
const fetchInTurn = (deps: Dependencies, account: AccountRow): Promise<SyncResult> => about({ mailbox: account.id }, () => inTurn(deps, account));

const logged = (account: AccountRow) => (e: unknown) => log.error('fetch of a mailbox failed', { mailbox: account.id, error: errorMessage(e) });

export function createSync(deps: Dependencies): Sync {
  /** Mailbox -> fetch in flight on this server; whoever asks it meanwhile shares it instead of fetching twice. */
  const running = new Map<number, Promise<SyncResult>>();
  const syncAccount = (account: AccountRow): Promise<SyncResult> => {
    const inFlight = running.get(account.id) ?? fetchInTurn(deps, account).finally(() => running.delete(account.id));
    running.set(account.id, inFlight);
    return inFlight;
  };
  const syncAll = async (): Promise<void> => {
    for (const account of await watchedMailboxes(deps.db)) await syncAccount(account).catch(logged(account));
  };
  return { syncAccount, syncAll, inBackground: (account) => void syncAccount(account).catch(logged(account)) };
}
