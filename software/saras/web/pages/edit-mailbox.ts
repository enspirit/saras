// A connected mailbox, to look at and change: the name its replies show, what is fetched from it,
// and how saras reaches it — its servers and password, or a new sign-in at its host.

import type { Mailbox, MailboxServers } from '../../shared/mailbox.ts';
import { changeMailboxServers, hostSignInAddress, nameMailbox, readMailboxServers, shareMailbox } from '../api/mailboxes.ts';
import { t } from '../i18n.ts';
import { goTo } from '../navigation.ts';
import { ActionButton, SubmitForm, confirmAction, toast } from './actions.ts';
import { isAdmin, me } from '../session.ts';
import { shell } from './shell.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import { Checkbox, Input } from '../ui/atoms/input.ts';
import { Text } from '../ui/atoms/text.ts';
import { Card } from '../ui/molecules/card.ts';
import { Facts } from '../ui/molecules/facts.ts';
import { Block, CheckField, Field } from '../ui/molecules/field.ts';
import { Actions, FormRow } from '../ui/molecules/form.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Page } from '../ui/organisms/page.ts';

/** NameMailbox: the name replies show to recipients. */
function nameCard(mailbox: Mailbox): HTMLDivElement {
  const name = Input({ value: mailbox.displayName, maxLength: 200, placeholder: mailbox.email });
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  return Card({ title: t('mailboxes.nameTitle'), form: true }, SubmitForm(save, '…', async () => {
    await nameMailbox(mailbox.id, name.value);
    toast(t('mailboxes.nameSaved'));
  }, Field(t('mailboxes.name'), name, { hint: t('mailboxes.nameHint') }), Actions(save)));
}

/** What is fetched: the folder, how far back, unread only or not; changed on the page that chooses them. */
const fetchedCard = (mailbox: Mailbox): HTMLDivElement =>
  Card({ title: t('mailboxes.fetchedTitle'), form: true },
    Facts([
      [t('mailboxes.folderColumn'), mailbox.folderName],
      [t('mailboxes.fetchBack'), t('mailboxes.fetchDays', { days: mailbox.fetchDays })],
      [t('mailboxes.whichEmails'), t(mailbox.unreadOnly ? 'mailboxes.unreadOnlyShort' : 'mailboxes.readOrNot')],
    ]),
    Actions(ButtonLink(t('mailboxes.changeFetched'), { href: `#/mailboxes/folder/${mailbox.id}` })));

interface ServerFields {
  imapHost: HTMLInputElement;
  imapPort: HTMLInputElement;
  imapSecure: HTMLInputElement;
  smtpHost: HTMLInputElement;
  smtpPort: HTMLInputElement;
  smtpSecure: HTMLInputElement;
  username: HTMLInputElement;
  password: HTMLInputElement;
}

const serverFields = (s: MailboxServers): ServerFields => ({
  imapHost: Input({ required: true, value: s.imapHost }),
  imapPort: Input({ type: 'number', required: true, value: s.imapPort, min: 1, max: 65535 }),
  imapSecure: Checkbox({ checked: s.imapSecure }),
  smtpHost: Input({ required: true, value: s.smtpHost }),
  smtpPort: Input({ type: 'number', required: true, value: s.smtpPort, min: 1, max: 65535 }),
  smtpSecure: Checkbox({ checked: s.smtpSecure }),
  username: Input({ value: s.username, autocomplete: 'off' }),
  password: Input({ type: 'password', autocomplete: 'new-password', placeholder: t('mailboxes.passwordKept') }),
});

const written = (f: ServerFields) => ({
  imapHost: f.imapHost.value, imapPort: Number(f.imapPort.value), imapSecure: f.imapSecure.checked,
  smtpHost: f.smtpHost.value, smtpPort: Number(f.smtpPort.value), smtpSecure: f.smtpSecure.checked,
  username: f.username.value, password: f.password.value,
});

/** ChangeMailboxServers: tested before anything is kept. */
function serversCard(mailbox: Mailbox, servers: MailboxServers): HTMLDivElement {
  const f = serverFields(servers);
  const save = Button(t('mailboxes.testAndSave'), { variant: 'primary', type: 'submit' });
  return Card({ title: t('mailboxes.accessTitle'), form: true }, SubmitForm(save, t('mailboxes.connecting'), async () => {
    await changeMailboxServers(mailbox.id, written(f));
    toast(t('mailboxes.serversSaved'));
    goTo('#/mailboxes');
  },
    FormRow(Field(t('mailboxes.imapServer'), f.imapHost), Field(t('mailboxes.port'), f.imapPort, { size: 'narrow' }), CheckField(t('mailboxes.directTls'), f.imapSecure, { size: 'narrow' })),
    FormRow(Field(t('mailboxes.smtpServer'), f.smtpHost), Field(t('mailboxes.port'), f.smtpPort, { size: 'narrow' }), CheckField(t('mailboxes.directTls'), f.smtpSecure, { size: 'narrow' })),
    Block(Text({ muted: true, small: true }, t('mailboxes.tlsHint'))),
    Field(t('mailboxes.username'), f.username),
    Field(t('mailboxes.password'), f.password, { hint: t('mailboxes.passwordKeptHint') }),
    Actions(save),
  ));
}

/** RenewMailboxCredentials for a mailbox reached by signing in at its host: the way there. */
function signInCard(mailbox: Mailbox): HTMLDivElement {
  const provider = mailbox.kind === 'google' ? t('mailboxes.connectGoogle') : t('mailboxes.connectMicrosoft');
  return Card({ title: t('mailboxes.accessTitle'), form: true },
    Block(Text({ muted: true }, t('mailboxes.oauthIntro'))),
    Actions(ButtonLink(t('mailboxes.continueAt', { provider }), { href: hostSignInAddress(mailbox.kind, `?renew=${mailbox.id}`) })));
}

/** ShareMailbox, once confirmed: an administrator hands a mailbox of their own to the whole organisation. */
const sharingCard = (mailbox: Mailbox): HTMLDivElement =>
  Card({ title: t('mailboxes.shareTitle'), form: true },
    Block(Text({ muted: true }, t('mailboxes.shareIntro', { organization: me().organization.name }))),
    Actions(ActionButton(t('mailboxes.share'), '…', async () => {
      if (!(await confirmAction(t('mailboxes.confirmShare', { email: mailbox.email }), t('mailboxes.share'), false))) return;
      await shareMailbox(mailbox.id);
      toast(t('mailboxes.sharedNow'));
      goTo('#/mailboxes');
    }, { icon: 'users' })));

/** Everything that can be changed of a connected mailbox, for who manages it. */
export async function editMailboxPage(mailbox: Mailbox): Promise<void> {
  const servers = mailbox.kind === 'imap' ? await readMailboxServers(mailbox.id) : null;
  shell(Page(
    PageHeader({ title: mailbox.email, crumbs: [{ label: t('mailboxes.title'), href: '#/mailboxes' }] }),
    nameCard(mailbox),
    mailbox.folder && fetchedCard(mailbox),
    servers ? serversCard(mailbox, servers) : signInCard(mailbox),
    isAdmin() && !mailbox.shared && sharingCard(mailbox),
  ));
}
