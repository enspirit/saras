// Connecting a mailbox by its servers (IMAP and SMTP): the form, and the servers proposed
// from the address until the user writes their own.

import { connectMailboxByServers } from '../api/mailboxes.ts';
import type { MailboxByServers } from '../api/mailboxes.ts';
import { t } from '../i18n.ts';
import { serversFor } from '../mail-presets.ts';
import type { MailServers } from '../mail-presets.ts';
import { goTo } from '../navigation.ts';
import { SubmitForm, toast } from './actions.ts';
import { me } from '../session.ts';
import { Button } from '../ui/atoms/button.ts';
import { Checkbox, Input } from '../ui/atoms/input.ts';
import { Muted, Small, Text } from '../ui/atoms/text.ts';
import { CardSection } from '../ui/molecules/card.ts';
import { Block, CheckField, Field } from '../ui/molecules/field.ts';
import { Actions, FormRow } from '../ui/molecules/form.ts';

interface ServerFields {
  email: HTMLInputElement;
  displayName: HTMLInputElement;
  username: HTMLInputElement;
  password: HTMLInputElement;
  imapHost: HTMLInputElement;
  imapPort: HTMLInputElement;
  imapSecure: HTMLInputElement;
  smtpHost: HTMLInputElement;
  smtpPort: HTMLInputElement;
  smtpSecure: HTMLInputElement;
}

/** The fields of the form. A first mailbox is most often one's own: it starts from what sign-up already knows. */
function serverFields(first: boolean): ServerFields {
  const fields: ServerFields = {
    email: Input({ type: 'email', required: true, value: first ? me().email : '' }),
    displayName: Input({ placeholder: t('accounts.namePlaceholder'), value: first ? me().name : '' }),
    username: Input({ placeholder: t('accounts.usernamePlaceholder'), autocomplete: 'off' }),
    password: Input({ type: 'password', required: true, autocomplete: 'new-password' }),
    imapHost: Input({ required: true, placeholder: t('accounts.imapPlaceholder') }),
    imapPort: Input({ type: 'number', required: true, value: 993, min: 1, max: 65535 }),
    imapSecure: Checkbox({ checked: true }),
    smtpHost: Input({ required: true, placeholder: t('accounts.smtpPlaceholder') }),
    smtpPort: Input({ type: 'number', required: true, value: 465, min: 1, max: 65535 }),
    smtpSecure: Checkbox({ checked: true }),
  };
  fields.imapPort.addEventListener('input', () => (fields.imapSecure.checked = fields.imapPort.value === '993'));
  fields.smtpPort.addEventListener('input', () => (fields.smtpSecure.checked = fields.smtpPort.value === '465'));
  return fields;
}

/** Fills in the servers of an address. They follow the address until the user writes their own. */
function proposer({ imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure }: ServerFields): (servers: MailServers | null) => void {
  let proposed = '';
  return (servers) => {
    if (!servers || (imapHost.value && imapHost.value !== proposed)) return;
    proposed = imapHost.value = servers.imapHost;
    smtpHost.value = servers.smtpHost;
    imapPort.value = String(servers.imapPort);
    smtpPort.value = String(servers.smtpPort);
    imapSecure.checked = servers.imapPort === 993;
    smtpSecure.checked = servers.smtpPort === 465;
  };
}

/** What "Test and connect" sends. */
const written = (f: ServerFields, shared: boolean): MailboxByServers => ({
  email: f.email.value, displayName: f.displayName.value, username: f.username.value, password: f.password.value,
  imapHost: f.imapHost.value, imapPort: Number(f.imapPort.value), imapSecure: f.imapSecure.checked,
  smtpHost: f.smtpHost.value, smtpPort: Number(f.smtpPort.value), smtpSecure: f.smtpSecure.checked,
  shared,
});

/** The servers, proposed and open to correction. */
const serverSettings = (f: ServerFields): HTMLDivElement =>
  CardSection(t('accounts.serverSettings'),
    Block(Text({ muted: true, small: true }, t('accounts.serversProposed'))),
    FormRow(Field(t('accounts.imapServer'), f.imapHost), Field(t('accounts.port'), f.imapPort, { size: 'narrow' }), CheckField(t('accounts.directTls'), f.imapSecure, { size: 'narrow' })),
    FormRow(Field(t('accounts.smtpServer'), f.smtpHost), Field(t('accounts.port'), f.smtpPort, { size: 'narrow' }), CheckField(t('accounts.directTls'), f.smtpSecure, { size: 'narrow' })),
    Field(t('accounts.username'), f.username, { hint: t('accounts.tlsHint') }),
  );

/** ConnectMailbox by its servers: tested, then connected, then on to its folder. */
function serversForm(f: ServerFields, shared: () => boolean): HTMLFormElement {
  const connect = Button(t('accounts.connect'), { variant: 'primary', type: 'submit' });
  return SubmitForm(connect, t('accounts.connecting'), async () => {
    await connectMailboxByServers(written(f, shared()));
    toast(t('accounts.connected'));
    goTo('#/accounts');
  },
    FormRow(Field(t('accounts.email'), f.email), Field(t('accounts.password'), f.password)),
    Field(t('accounts.name'), f.displayName, { hint: t('accounts.passwordHint') }),
    serverSettings(f),
    Actions(connect, Muted(Small(t('accounts.connectHint')))),
  );
}

export interface MailboxByServersHandle {
  form: HTMLFormElement;
  /** The address of the mailbox, as it is being typed. */
  email: HTMLInputElement;
  /** Fills in servers found elsewhere, unless the user wrote their own. */
  propose(servers: MailServers | null): void;
}

/** The form for a mailbox reached by its servers. `shared` tells whose it will be when it is sent. */
export function MailboxByServersForm(first: boolean, shared: () => boolean): MailboxByServersHandle {
  const fields = serverFields(first);
  const propose = proposer(fields);
  fields.email.addEventListener('input', () => propose(serversFor(fields.email.value)));
  propose(serversFor(fields.email.value));
  return { form: serversForm(fields, shared), email: fields.email, propose };
}
