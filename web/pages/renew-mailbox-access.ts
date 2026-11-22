// Giving saras access to a mailbox again: a new password, or a new trip to its host.

import type { Mailbox } from '../../shared/mailbox.ts';
import { hostSignInAddress, renewMailboxCredentials } from '../api/mailboxes.ts';
import { t } from '../i18n.ts';
import { goTo } from '../navigation.ts';
import { SubmitForm, toast } from './actions.ts';
import { shell } from './shell.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import { Text } from '../ui/atoms/text.ts';
import { Card } from '../ui/molecules/card.ts';
import { Block, Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Page } from '../ui/organisms/page.ts';

const cancel = (): HTMLElement => ButtonLink(t('common.cancel'), { href: '#/mailboxes' });

/** RenewMailboxCredentials for a mailbox reached by signing in at its host: the way there. */
function renewByHostSignIn(account: Mailbox): HTMLDivElement {
  const provider = account.kind === 'google' ? t('mailboxes.connectGoogle') : t('mailboxes.connectMicrosoft');
  return Card({},
    Block(Text({ muted: true }, t('mailboxes.oauthIntro'))),
    Actions(ButtonLink(t('mailboxes.continueAt', { provider }), { href: hostSignInAddress(account.kind, `?renew=${account.id}`), variant: 'primary' }), cancel()),
  );
}

/** RenewMailboxCredentials for a mailbox reached by its servers: its new password. */
function renewByPassword(account: Mailbox): HTMLDivElement {
  const password = Input({ type: 'password', required: true, autocomplete: 'off' });
  const renew = Button(t('mailboxes.renew'), { variant: 'primary', type: 'submit' });
  return Card({}, SubmitForm(renew, t('mailboxes.connecting'), async () => {
    await renewMailboxCredentials(account.id, password.value);
    toast(t('mailboxes.renewed'));
    goTo('#/mailboxes');
  },
    Field(t('mailboxes.newPassword'), password, { hint: t('mailboxes.passwordHint') }),
    Actions(renew, cancel()),
  ));
}

/** Giving saras access to a mailbox again: a new password, or a new trip to its host. */
export function renewMailboxAccessPage(account: Mailbox): void {
  const crumbs = [{ label: t('mailboxes.title'), href: '#/mailboxes' }];
  const header = PageHeader({ title: t('mailboxes.renewTitle', { email: account.email }), intro: t('mailboxes.renewIntro'), crumbs });
  shell(Page(header, account.kind === 'imap' ? renewByPassword(account) : renewByHostSignIn(account)));
}
