// Choosing the one folder of a mailbox to watch, and what is fetched from it (how far back, unread only
// or not): the second step of getting started, and later a change made from the list of mailboxes.

import { FETCH_DAYS } from '../../shared/mailbox.ts';
import type { Mailbox, WhatIsFetched } from '../../shared/mailbox.ts';
import { problemText } from '../api.ts';
import { chooseWatchedFolder, fetchMailbox, readFolders } from '../api/mailboxes.ts';
import { t } from '../i18n.ts';
import { goTo } from '../navigation.ts';
import { ActionButton, messageOf, toast } from './actions.ts';
import { leaveStep, PathSteps } from './getting-started/path.ts';
import { shell } from './shell.ts';
import { ButtonLink } from '../ui/atoms/button.ts';
import { Checkbox, Select } from '../ui/atoms/input.ts';
import { Callout } from '../ui/molecules/callout.ts';
import { Card } from '../ui/molecules/card.ts';
import { Choices } from '../ui/molecules/choices.ts';
import type { ChoicesHandle } from '../ui/molecules/choices.ts';
import { CheckField, Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Page } from '../ui/organisms/page.ts';

/** ChooseWatchedFolder. A change goes back to the mailboxes; the first choice goes on with the path. */
async function watchFolder(account: Mailbox, folder: string, what: WhatIsFetched): Promise<void> {
  await chooseWatchedFolder(account.id, folder, what);
  if (account.folder !== null) {
    toast(t('mailboxes.folderChosen'));
    return goTo(`#/mailboxes/edit/${account.id}`);
  }
  // The first choice goes on with the path. The button waits for the first fetch, so that
  // the newcomer arrives on their emails and not on an empty box.
  const fetched = await fetchMailbox(account.id);
  if (fetched.error) toast(problemText(fetched.error), true);
  else toast(t('mailbox.fetched', { count: fetched.fetched }));
  leaveStep('folder');
}

/** Asks the mailbox for its folders, and offers them with the watched one (or the first, the inbox) chosen. */
function offerFolders(account: Mailbox, folders: ChoicesHandle, confirm: HTMLButtonElement): void {
  readFolders(account.id)
    .then((list) => {
      folders.setOptions(list.map((f) => ({ value: f.id, title: f.name })), account.folder ?? list[0]?.id);
      confirm.disabled = false;
    })
    .catch((e) => toast(messageOf(e), true));
}

/** How far back: the spans offered, with the one the mailbox has (the server's, until one is chosen) even when it is not among them. */
const daysField = (account: Mailbox): HTMLSelectElement =>
  Select([...new Set([...FETCH_DAYS, account.fetchDays])].sort((a, b) => a - b).map((days) => ({ value: String(days), label: t('mailboxes.fetchDays', { days }), selected: days === account.fetchDays })));

/**
 * Choosing the one folder of a mailbox to watch, and what is fetched from it. The folders are
 * asked of the mailbox when the page appears, with the inbox first and preselected.
 */
export function watchedFolderPage(account: Mailbox): void {
  const fresh = account.folder === null;
  const folders = Choices({ legend: t('mailboxes.folders'), name: 'folder', rows: true, options: [{ value: '', title: t('mailboxes.loadingFolders'), disabled: true }] });
  const days = daysField(account);
  const unreadOnly = Checkbox({ checked: account.unreadOnly });
  const confirm = ActionButton(t('mailboxes.useFolder'), t('mailbox.refreshing'), () => watchFolder(account, folders.value(), { days: Number(days.value), unreadOnly: unreadOnly.checked }), { variant: 'primary' });
  confirm.disabled = true;
  offerFolders(account, folders, confirm);
  shell(Page(
    fresh && PathSteps('folder'),
    PageHeader({ title: t('mailboxes.chooseFolderTitle'), intro: t('mailboxes.chooseFolder'), crumbs: fresh ? [] : [{ label: t('mailboxes.title'), href: '#/mailboxes' }, { label: account.email, href: `#/mailboxes/edit/${account.id}` }] }),
    fresh && Callout('ok', t('mailboxes.connectedShort', { email: account.email })),
    Card({ form: true }, folders.element,
      Field(t('mailboxes.fetchBack'), days, { hint: t('mailboxes.fetchBackHint'), size: 'narrow' }),
      CheckField(t('mailboxes.unreadOnly'), unreadOnly),
      Actions(confirm, !fresh && ButtonLink(t('common.cancel'), { href: `#/mailboxes/edit/${account.id}` }))),
  ));
}
