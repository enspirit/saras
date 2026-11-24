// What a list of emails has around its emails: the fetch button, the search field, what it says
// when empty, and the way from a box searched to every box.

import type { View } from '../../shared/email.ts';
import type { Mailbox } from '../../shared/mailbox.ts';
import { problemText } from '../api.ts';
import { fetchMailbox } from '../api/mailboxes.ts';
import { t } from '../i18n.ts';
import { showPage } from '../navigation.ts';
import { ActionButton, toast } from './actions.ts';
import { sayFetched } from './what-was-fetched.ts';
import { ButtonLink } from '../ui/atoms/button.ts';
import type { IconName } from '../ui/atoms/icon.ts';
import type { Child } from '../ui/dom.ts';
import { EmptyState } from '../ui/molecules/empty-state.ts';
import { SearchField, SearchScope } from '../ui/molecules/search-field.ts';

/** FetchMailbox, for every mailbox in turn: says what came in, or what went wrong where. */
async function fetchMailboxes(mailboxes: Mailbox[]): Promise<void> {
  if (!mailboxes.length) return void (location.hash = '#/mailboxes');
  const all = { fetched: 0, toCome: 0 };
  const errors: string[] = [];
  for (const a of mailboxes) {
    const r = await fetchMailbox(a.id);
    all.fetched += r.fetched;
    all.toCome += r.toCome;
    if (r.error) errors.push(t('mailbox.accountError', { account: a.email, error: problemText(r.error) }));
  }
  if (errors.length) toast(errors.join(' — '), true);
  else sayFetched(all);
  showPage();
}

export const fetchButton = (mailboxes: Mailbox[]): HTMLButtonElement =>
  ActionButton(t('mailbox.refresh'), t('mailbox.refreshing'), () => fetchMailboxes(mailboxes), { variant: 'ghost', icon: 'refresh-cw', iconOnly: true, title: t('mailbox.refreshTitle') });

/** When mail was last fetched, whichever mailbox it was. */
export const lastFetchOf = (mailboxes: Mailbox[]): string | undefined => mailboxes.map((a) => a.lastSyncAt ?? '').filter(Boolean).sort().pop();

/** What the list shows when it is empty: that nothing matches what is searched; or, with no mailbox connected yet, where one is connected. */
export function emptyList({ emptyText, icon, view }: { emptyText: string; icon: IconName; view: View }, mailboxes: Mailbox[]): HTMLDivElement {
  if (view.search) return EmptyState(t('mailbox.noneFound', { search: view.search }), { icon: 'search' });
  return EmptyState(emptyText, { icon, action: !mailboxes.length && ButtonLink(t('nav.mailboxes'), { href: '#/mailboxes', variant: 'primary' }) });
}

/** Under the field, while a list is searched: where, and from a box, the way to the same search among every box. */
export function searchScope({ view, title }: { view: View; title: string }): Child {
  if (!view.search) return null;
  const everywhere = view.box && view.box !== 'all' && ButtonLink(t('mailbox.searchEverywhere'), { href: `#/search?search=${encodeURIComponent(view.search)}`, variant: 'link' });
  return SearchScope(t('mailbox.searchedIn', { list: title }), everywhere);
}

/** The search field of the list on screen, which "/" reaches from anywhere but a field. */
let current: HTMLInputElement | null = null;
document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  if (event.key !== '/' || !current?.isConnected || target.closest('input, textarea, select, [contenteditable]')) return;
  event.preventDefault();
  current.focus();
});

export function searchField(value: string, onSearch: (text: string) => void): HTMLDivElement {
  const field = SearchField({ label: t('mailbox.searchLabel'), clearLabel: t('mailbox.searchClear'), value, onSearch });
  current = field.querySelector('input');
  return field;
}
