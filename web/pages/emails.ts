// The emails of a box, as a list, with the one being read beside it.

import type { EmailSummary } from '../../shared/email.ts';
import type { Mailbox } from '../../shared/mailbox.ts';
import { problemText } from '../api.ts';
import { readBox, readEmail } from '../api/emails.ts';
import { fetchMailbox, readMailboxes } from '../api/mailboxes.ts';
import { readPrompts } from '../api/prompts.ts';
import { t } from '../i18n.ts';
import { fmtDate, fmtWhen } from '../i18n/dates.ts';
import { showPage } from '../navigation.ts';
import { ActionButton, guard, toast } from './actions.ts';
import type { BoxOnScreen } from './boxes.ts';
import { emailDetail } from './reading.ts';
import { shell } from './shell.ts';
import { session } from '../session.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { ButtonLink } from '../ui/atoms/button.ts';
import { EmailListItem } from '../ui/molecules/email-list-item.ts';
import { EmptyState } from '../ui/molecules/empty-state.ts';
import { MailboxView } from '../ui/organisms/mailbox.ts';

/** FetchMailbox, for every mailbox in turn: says what came in, or what went wrong where. */
async function fetchMailboxes(mailboxes: Mailbox[]): Promise<void> {
  if (!mailboxes.length) return void (location.hash = '#/mailboxes');
  let fetched = 0;
  const errors: string[] = [];
  for (const a of mailboxes) {
    const r = await fetchMailbox(a.id);
    fetched += r.fetched;
    if (r.error) errors.push(t('mailbox.accountError', { account: a.email, error: problemText(r.error) }));
  }
  if (errors.length) toast(errors.join(' — '), true);
  else toast(t('mailbox.fetched', { count: fetched }));
  showPage();
}

const fetchButton = (mailboxes: Mailbox[]): HTMLButtonElement =>
  ActionButton(t('mailbox.refresh'), t('mailbox.refreshing'), () => fetchMailboxes(mailboxes), { variant: 'ghost', icon: 'refresh-cw', iconOnly: true, title: t('mailbox.refreshTitle') });

/** One email of the list: who and when, what about, and what to know first. */
const emailItem = (e: EmailSummary, box: BoxOnScreen, selectedId: number | null): HTMLButtonElement =>
  EmailListItem({
    from: e.fromName || e.fromAddr,
    date: fmtDate(e.date),
    subject: e.subject || t('mailbox.noSubject'),
    snippet: e.snippet,
    current: e.id === selectedId,
    onClick: () => (location.hash = `#/${box.path}/${e.id}`),
    tags: [
      e.priority === 'high' && e.status !== 'sent' && Badge(t('mailbox.priority'), 'warn'),
      e.status === 'pending' && Badge(t('mailbox.untriaged'), 'neutral'),
      e.replyMode === 'draft' && Badge(t('mailbox.draft'), 'neutral'),
    ],
    // In a shared mailbox, say which: several may be shown together.
    shared: e.shared ? { label: e.mailbox.split('@')[0] ?? e.mailbox, title: e.mailbox } : undefined,
  });

/** What the list shows when the box is empty. With no mailbox connected yet, it leads to where one is connected. */
const emptyBox = (box: BoxOnScreen, mailboxes: Mailbox[]): HTMLDivElement =>
  EmptyState(t(box.empty), { icon: box.icon, action: !mailboxes.length && ButtonLink(t('nav.mailboxes'), { href: '#/mailboxes', variant: 'primary' }) });

/** When mail was last fetched, whichever mailbox it was. */
const lastFetchOf = (mailboxes: Mailbox[]): string | undefined => mailboxes.map((a) => a.lastSyncAt ?? '').filter(Boolean).sort().pop();

export const emailsPage = guard(async (box: BoxOnScreen, selectedId: number | null) => {
  const [{ emails, counts }, prompts, mailboxes] = await Promise.all([readBox(box.id), readPrompts(), readMailboxes()]);
  session.counts = counts;
  const lastFetch = lastFetchOf(mailboxes);
  const detail = selectedId ? emailDetail(await readEmail(selectedId), prompts, box) : null;
  shell(MailboxView({
    title: t(box.label),
    count: emails.length,
    meta: lastFetch ? t('mailbox.fetchedAt', { time: fmtWhen(lastFetch) }) : undefined,
    action: fetchButton(mailboxes),
    empty: emptyBox(box, mailboxes),
    backHref: `#/${box.path}`,
    backLabel: t('mailbox.back'),
    idle: emails.length > 0 && EmptyState(t('mailbox.select'), { icon: box.icon, title: t('mailbox.count', { count: emails.length }) }),
    detail,
    items: emails.map((e) => emailItem(e, box, selectedId)),
  }));
});
