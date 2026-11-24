// Connecting a mailbox by its servers (IMAP and SMTP): the form, and the servers proposed
// when we are sure of them, until the user writes their own. Nothing is guessed.

import { connectMailboxByServers } from '../api/mailboxes.ts';
import type { MailboxByServers } from '../api/mailboxes.ts';
import { t } from '../i18n.ts';
import type { MailServers } from '../../shared/mailbox.ts';
import { domainOf, serversFor } from '../mail-presets.ts';
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
    displayName: Input({ placeholder: t('mailboxes.namePlaceholder'), value: first ? me().name : '' }),
    username: Input({ placeholder: t('mailboxes.usernamePlaceholder'), autocomplete: 'off' }),
    password: Input({ type: 'password', required: true, autocomplete: 'new-password' }),
    imapHost: Input({ required: true, placeholder: t('mailboxes.imapPlaceholder') }),
    imapPort: Input({ type: 'number', required: true, value: 993, min: 1, max: 65535 }),
    imapSecure: Checkbox({ checked: true }),
    smtpHost: Input({ required: true, placeholder: t('mailboxes.smtpPlaceholder') }),
    smtpPort: Input({ type: 'number', required: true, value: 465, min: 1, max: 65535 }),
    smtpSecure: Checkbox({ checked: true }),
  };
  fields.imapPort.addEventListener('input', () => (fields.imapSecure.checked = fields.imapPort.value === '993'));
  fields.smtpPort.addEventListener('input', () => (fields.smtpSecure.checked = fields.smtpPort.value === '465'));
  return fields;
}

/** Writes servers in the fields; with none, empties them and puts the usual ports back. */
function fill({ imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure }: ServerFields, servers: MailServers | null): void {
  imapHost.value = servers?.imapHost ?? '';
  smtpHost.value = servers?.smtpHost ?? '';
  imapPort.value = String(servers?.imapPort ?? 993);
  smtpPort.value = String(servers?.smtpPort ?? 465);
  imapSecure.checked = imapPort.value === '993';
  smtpSecure.checked = smtpPort.value === '465';
}

/** What is said above the servers: where they come from, or that they are the user's to give. */
const SAID = { unknown: 'mailboxes.servers.unknown', searching: 'mailboxes.servers.searching', found: 'mailboxes.servers.found', notFound: 'mailboxes.servers.notFound' };
type Found = keyof typeof SAID;
const said = (found: Found, address: string): HTMLElement => Block(Text({ muted: true, small: true }, t(SAID[found], { domain: domainOf(address) ?? '' })));

/**
 * Fills in the servers we are sure of for the address, and says where things stand. What was
 * proposed follows the address; what the user wrote themselves is never touched.
 */
function proposer(fields: ServerFields, status: { element: HTMLElement }) {
  let proposed = '';
  const say = (found: Found): void => {
    const next = said(found, fields.email.value);
    status.element.replaceWith(next);
    status.element = next;
  };
  const untouched = (): boolean => fields.imapHost.value === proposed;
  const propose = (servers: MailServers | null): void => {
    if (!untouched()) return;
    fill(fields, servers);
    proposed = fields.imapHost.value;
    say(servers ? 'found' : domainOf(fields.email.value) ? 'notFound' : 'unknown');
  };
  const searching = (on: boolean): void => void (on && untouched() && !proposed && say('searching'));
  return { propose, searching };
}

/** What "Test and connect" sends. */
const written = (f: ServerFields, shared: boolean): MailboxByServers => ({
  email: f.email.value, displayName: f.displayName.value, username: f.username.value, password: f.password.value,
  imapHost: f.imapHost.value, imapPort: Number(f.imapPort.value), imapSecure: f.imapSecure.checked,
  smtpHost: f.smtpHost.value, smtpPort: Number(f.smtpPort.value), smtpSecure: f.smtpSecure.checked,
  shared,
});

/** The servers, proposed and open to correction. */
const serverSettings = (f: ServerFields, status: HTMLElement): HTMLDivElement =>
  CardSection(t('mailboxes.serverSettings'),
    status,
    FormRow(Field(t('mailboxes.imapServer'), f.imapHost), Field(t('mailboxes.port'), f.imapPort, { size: 'narrow' }), CheckField(t('mailboxes.directTls'), f.imapSecure, { size: 'narrow' })),
    FormRow(Field(t('mailboxes.smtpServer'), f.smtpHost), Field(t('mailboxes.port'), f.smtpPort, { size: 'narrow' }), CheckField(t('mailboxes.directTls'), f.smtpSecure, { size: 'narrow' })),
    Block(Text({ muted: true, small: true }, t('mailboxes.tlsHint'))),
    Field(t('mailboxes.username'), f.username),
  );

/** ConnectMailbox by its servers: tested, then connected, then on to its folder. */
function serversForm(f: ServerFields, status: HTMLElement, shared: () => boolean): HTMLFormElement {
  const connect = Button(t('mailboxes.connect'), { variant: 'primary', type: 'submit' });
  return SubmitForm(connect, t('mailboxes.connecting'), async () => {
    await connectMailboxByServers(written(f, shared()));
    toast(t('mailboxes.connected'));
    goTo('#/mailboxes');
  },
    FormRow(Field(t('mailboxes.email'), f.email), Field(t('mailboxes.password'), f.password)),
    Field(t('mailboxes.name'), f.displayName),
    serverSettings(f, status),
    Actions(connect, Muted(Small(t('mailboxes.connectHint')))),
  );
}

export interface MailboxByServersHandle {
  form: HTMLFormElement;
  /** The address of the mailbox, as it is being typed. */
  email: HTMLInputElement;
  /** Fills in the servers the server is sure of, or says that none were found, unless the user wrote their own. */
  propose(servers: MailServers | null): void;
  /** Says that the servers are being looked for. */
  searching(on: boolean): void;
}

/** The form for a mailbox reached by its servers. `shared` tells whose it will be when it is sent. */
export function MailboxByServersForm(first: boolean, shared: () => boolean): MailboxByServersHandle {
  const fields = serverFields(first);
  const status = { element: said('unknown', '') };
  const { propose, searching } = proposer(fields, status);
  // While the address is typed, only a domain we know by heart is proposed; the server is asked once it is written.
  const known = (): void => void (serversFor(fields.email.value) && propose(serversFor(fields.email.value)));
  fields.email.addEventListener('input', known);
  known();
  return { form: serversForm(fields, status.element, shared), email: fields.email, propose, searching };
}
