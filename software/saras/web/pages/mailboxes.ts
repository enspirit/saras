// The mailboxes one may use: which folder each watches, when it was last fetched, and what
// can be done about it. With no mailbox yet, or one without a folder, the page is a step of
// getting started.

import type { Mailbox } from '../../shared/mailbox.ts';
import { problemText } from '../api.ts';
import { disconnectMailbox, fetchMailbox, readMailboxes } from '../api/mailboxes.ts';
import { t } from '../i18n.ts';
import { fmtWhen } from '../i18n/dates.ts';
import { ActionButton, confirmAction, guard, toast } from './actions.ts';
import { connectMailboxPage } from './connect-mailbox.ts';
import { editMailboxPage } from './edit-mailbox.ts';
import { shell } from './shell.ts';
import { watchedFolderPage } from './watched-folder.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import { Muted } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Callout } from '../ui/molecules/callout.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Person } from '../ui/molecules/person.ts';
import { Table } from '../ui/molecules/table.ts';
import { Page } from '../ui/organisms/page.ts';

/** Kinds of mailbox are product names: the same in every language. */
const KIND: Record<Mailbox['kind'], string> = { imap: 'IMAP / SMTP', google: 'Google', microsoft: 'Microsoft' };

/** FetchMailbox, now: says what came in or what went wrong. */
const fetchButton = (a: Mailbox): HTMLButtonElement => ActionButton(t('mailboxes.syncNow'), t('mailbox.refreshing'), async () => {
  const r = await fetchMailbox(a.id);
  if (r.error) toast(problemText(r.error), true);
  else toast(t('mailbox.fetched', { count: r.fetched }));
  void mailboxesPage();
}, { size: 'small', icon: 'refresh-cw' });

/** DisconnectMailbox, once confirmed. */
const disconnectButton = (a: Mailbox): HTMLButtonElement => ActionButton(t('mailboxes.disconnect'), '…', async () => {
  if (!(await confirmAction(t('mailboxes.confirmDisconnect', { email: a.email }), t('mailboxes.disconnect')))) return;
  await disconnectMailbox(a.id);
  void mailboxesPage();
}, { variant: 'danger', size: 'small', icon: 'trash', iconOnly: true });

/** What can be done about a mailbox: fetch it, and for who manages it, change it (its name, what is fetched, its access) or disconnect it. */
const mailboxActions = (a: Mailbox): Child[] => [
  a.folder && fetchButton(a),
  a.canManage && Button(t('mailboxes.edit'), { size: 'small', icon: 'pencil', onClick: () => (location.hash = `#/mailboxes/edit/${a.id}`) }),
  a.canManage && disconnectButton(a),
];

const mailboxesTable = (mailboxes: Mailbox[]): HTMLDivElement =>
  Table({ columns: [t('mailboxes.mailbox'), t('mailboxes.folderColumn'), t('mailboxes.lastSyncColumn'), t('box.todo.label')], actions: t('common.actions') }, mailboxes.map((a) => [
    Person({ name: a.email, detail: KIND[a.kind], tags: [a.shared && Badge(t('mailboxes.shared'))], icon: a.shared ? 'users' : 'mail' }),
    a.folder ? [a.folderName, ' ', Muted(t(a.unreadOnly ? 'mailboxes.fetchedUnread' : 'mailboxes.fetchedAll', { days: a.fetchDays }))] : Muted(t('mailboxes.folderPending')),
    a.lastSyncAt ? fmtWhen(a.lastSyncAt) : Muted(t('mailboxes.neverSynced')),
    a.todo,
    mailboxActions(a),
  ]));

/** What went wrong at the last fetch of each mailbox that watches a folder. */
const fetchFailures = (mailboxes: Mailbox[]): HTMLDivElement[] =>
  mailboxes.filter((a) => a.lastError && a.folder).map((a) => Callout('warn', `${a.email}: ${problemText(a.lastError as NonNullable<Mailbox['lastError']>)}`));

/** The list of mailboxes, or the page of the `part` asked for: connect, edit/<id>, folder/<id>. */
export const mailboxesPage = guard(async (part = '', id: number | null = null, oauthError?: string | null, oauthDetail?: string) => {
  const mailboxes = await readMailboxes();
  const failure = oauthError && Callout('warn', problemText({ code: oauthError, params: { detail: oauthDetail ?? '' }, message: oauthDetail || oauthError }));

  // With no mailbox yet, the page is the first step of the path.
  if (part === 'connect' || mailboxes.length === 0) return connectMailboxPage(mailboxes.length === 0, failure);
  // A mailbox just connected has no folder yet: the page is the second step.
  const pending = mailboxes.find((a) => a.canManage && (a.folder === null || (part === 'folder' && a.id === id)));
  if (pending) return watchedFolderPage(pending);

  const editing = part === 'edit' && mailboxes.find((a) => a.canManage && a.id === id);
  if (editing) return editMailboxPage(editing);

  shell(Page(
    PageHeader({ title: t('mailboxes.title'), intro: t('mailboxes.intro') }, ButtonLink(t('mailboxes.connectTitle'), { href: '#/mailboxes/connect', variant: 'primary' })),
    failure,
    fetchFailures(mailboxes),
    mailboxesTable(mailboxes),
  ));
});
