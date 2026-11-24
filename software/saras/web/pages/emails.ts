// The emails of a box, as a list searched as one types, some of them ticked to act on them at
// once, with the one being read beside it. A board shows its own the same way.

import type { EmailSummary, View } from '../../shared/email.ts';
import type { Mailbox } from '../../shared/mailbox.ts';
import type { Prompt } from '../../shared/prompt.ts';
import { readBox, readEmail } from '../api/emails.ts';
import { readMailboxes } from '../api/mailboxes.ts';
import { readPrompts } from '../api/prompts.ts';
import { t } from '../i18n.ts';
import { fmtDate, fmtWhen } from '../i18n/dates.ts';
import { guard } from './actions.ts';
import type { ListOnScreen } from './boxes.ts';
import { chipFor } from './attribute-values.ts';
import { anyTicked, selectionActions, selectedLabel, selectionBar, selectAllOffer, ticksOf, toggle } from './email-selection.ts';
import type { Listed } from './email-selection.ts';
import { emptyList, fetchButton, lastFetchOf, searchField, searchScope } from './email-list-parts.ts';
import { emailDetail } from './reading.ts';
import { shell } from './shell.ts';
import { session } from '../session.ts';
import { Badge } from '../ui/atoms/badge.ts';
import type { IconName } from '../ui/atoms/icon.ts';
import { Slot } from '../ui/atoms/slot.ts';
import type { Child } from '../ui/dom.ts';
import { TickableEmailListItem } from '../ui/molecules/email-list-item.ts';
import type { EmailListEntry } from '../ui/molecules/email-list-item.ts';
import { EmptyState } from '../ui/molecules/empty-state.ts';
import { Actions } from '../ui/molecules/form.ts';
import { MailboxView } from '../ui/organisms/mailbox.ts';

/** A list of emails on screen: a box, or a board, as searched. */
export interface EmailsShown {
  title: string;
  icon: IconName;
  view: View;
  emails: EmailSummary[];
  /** How many emails the view holds, unsearched: those of the box, or of the board. */
  total: number;
  /** The address of the list, as searched, and of one of its emails open beside it. */
  listHref(search: string): string;
  hrefOf(emailId: number, search: string): string;
  /** The emails of the view, as searched. */
  load(search: string): Promise<EmailSummary[]>;
  /** What the list says when it is empty. */
  emptyText: string;
  /** Controls of this list, before the fetch button. */
  actions?: Child;
  selectedId: number | null;
}

/** The values an email has for the organisation's own attributes, each as a small chip. */
const valuesOf = (e: EmailSummary): Child => session.attributes.filter((a) => !a.system).map((a) => chipFor(a, e.attributes[a.key]?.value, true));

/** One email of the list: who and when, what about, and what to know first; the words searched marked. */
const entryOf = (e: EmailSummary, shown: EmailsShown): EmailListEntry => ({
    from: e.fromName || e.fromAddr,
    date: fmtDate(e.date),
    subject: e.subject || t('mailbox.noSubject'),
    snippet: e.snippet,
    current: e.id === shown.selectedId,
    onClick: () => (location.hash = shown.hrefOf(e.id, shown.view.search ?? '')),
    marks: (shown.view.search ?? '').split(/\s+/).filter(Boolean),
    tags: [
      e.replyMode === 'draft' && Badge(t('mailbox.draft'), 'neutral'),
      valuesOf(e),
    ],
    // In a shared mailbox, say which: several may be shown together.
    shared: e.shared ? { label: e.mailbox.split('@')[0] ?? e.mailbox, title: e.mailbox } : undefined,
});

/** The list's places that change without the rest: the count, what is ticked, the emails, and the reading pane while none is open. */
const slots = () => ({ count: Slot(), scope: Slot(), bar: Slot(), items: Slot(), idle: Slot() });

/** The count beside the title: of the view, or of what is found in it. */
const countOf = (shown: EmailsShown): Child => (shown.view.search ? t('mailbox.found', { count: shown.emails.length, total: shown.total }) : shown.total || null);

/** Shows the emails, what is ticked, and the reading pane while none is open, as they now are. */
function redraw(shown: EmailsShown, places: ReturnType<typeof slots>, mailboxes: Mailbox[]): void {
  const listed: Listed = { view: shown.view, ids: shown.emails.map((e) => e.id), total: shown.view.search ? null : shown.total, redraw: () => redraw(shown, places, mailboxes) };
  const own = ticksOf(shown.view);
  const tick = (e: EmailSummary, index: number) => ({ checked: own.all || own.ids.has(e.id), label: t('mailbox.selection.tick'), shown: anyTicked(shown.view), onToggle: (range: boolean) => toggle(listed, index, range) });
  places.count.show(countOf(shown));
  places.scope.show(searchScope(shown));
  places.bar.show(selectionBar(listed));
  places.items.show(shown.emails.length ? shown.emails.map((e, index) => TickableEmailListItem(entryOf(e, shown), tick(e, index))) : emptyList(shown, mailboxes));
  places.idle.show(anyTicked(shown.view)
    ? EmptyState(t('mailbox.selection.pane'), { icon: 'check', title: selectedLabel(listed), action: [Actions(selectionActions(listed)), selectAllOffer(listed)] })
    : shown.emails.length > 0 && EmptyState(t('mailbox.select'), { icon: shown.icon, title: t('mailbox.count', { count: shown.emails.length }) }));
}

/** The last search asked: an answer to an earlier one, come late, is dropped. */
let asked = 0;

/** The list as searched now: its address changes without the page being shown again, and its emails are read again. */
async function searched(shown: EmailsShown, text: string, redrawn: () => void): Promise<void> {
  const mine = (asked += 1);
  history.replaceState(null, '', shown.listHref(text));
  const emails = await shown.load(text);
  if (mine !== asked) return;
  Object.assign(shown, { view: { ...shown.view, search: text }, emails });
  redrawn();
}

/** Shows a list of emails, with the one selected open beside it. Searching and ticking change the list only: an email open, a reply being written, stay as they are. */
export async function showEmails(shown: EmailsShown, prompts: Prompt[], mailboxes: Mailbox[]): Promise<void> {
  const lastFetch = lastFetchOf(mailboxes);
  const detail = shown.selectedId ? emailDetail(await readEmail(shown.selectedId), prompts, shown.listHref(shown.view.search ?? '')) : null;
  const places = slots();
  const search = searchField(shown.view.search ?? '', (text) => void searched(shown, text, () => redraw(shown, places, mailboxes)));
  shell(MailboxView({
    title: shown.title,
    count: places.count.element,
    meta: lastFetch ? t('mailbox.fetchedAt', { time: fmtWhen(lastFetch) }) : undefined,
    action: [shown.actions, fetchButton(mailboxes)],
    tools: [search, places.scope.element, places.bar.element],
    empty: null,
    backHref: shown.listHref(shown.view.search ?? ''),
    backLabel: t('mailbox.back'),
    idle: places.idle.element,
    detail,
    items: [places.items.element],
  }));
  redraw(shown, places, mailboxes);
}

/** The address of a box, as searched, and of one of its emails. */
const boxHref = (box: ListOnScreen, search: string, emailId?: number): string => `#/${box.path}${emailId ? `/${emailId}` : ''}${search ? `?search=${encodeURIComponent(search)}` : ''}`;

export const emailsPage = guard(async (box: ListOnScreen, selectedId: number | null, search: string) => {
  const [{ emails, counts }, prompts, mailboxes] = await Promise.all([readBox(box.id, search), readPrompts(), readMailboxes()]);
  session.counts = counts;
  const total = box.id === 'all' ? Object.values(counts).reduce((sum, n) => sum + n, 0) : counts[box.id];
  await showEmails({
    title: t(box.label), icon: box.icon, view: { box: box.id, search }, emails, total,
    listHref: (text) => boxHref(box, text), hrefOf: (id, text) => boxHref(box, text, id),
    load: async (text) => (await readBox(box.id, text)).emails,
    emptyText: t(box.empty), selectedId,
  }, prompts, mailboxes);
});
