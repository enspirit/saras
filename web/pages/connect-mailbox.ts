// Connecting a mailbox: whose it is, where it is hosted, then what that host asks for. With
// no mailbox yet, it is the first step of getting started.

import type { Profile } from '../../shared/member.ts';
import { hostSignInAddress } from '../api/mailboxes.ts';
import { t } from '../i18n.ts';
import { PathSteps } from './getting-started/path.ts';
import { MailHostAdvice } from './mail-host-advice.ts';
import { MailboxByServersForm } from './mailbox-by-servers.ts';
import { shell } from './shell.ts';
import { isAdmin, me } from '../session.ts';
import { ButtonLink } from '../ui/atoms/button.ts';
import { Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Card } from '../ui/molecules/card.ts';
import { Choices } from '../ui/molecules/choices.ts';
import type { ChoicesHandle } from '../ui/molecules/choices.ts';
import { Block } from '../ui/molecules/field.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Page } from '../ui/organisms/page.ts';

/** Whose the mailbox will be: an administrator may connect one for the whole organisation. */
const whoseChoice = (onChange: () => void): ChoicesHandle =>
  Choices({ legend: t('mailboxes.whose'), name: 'whose', value: 'mine', options: [
    { value: 'mine', title: t('mailboxes.mine'), hint: t('mailboxes.mineHint') },
    { value: 'shared', title: t('mailboxes.sharedChoice'), hint: t('mailboxes.sharedHint', { organization: me().organization.name }) },
  ], onChange });

/** Where the mailbox is hosted. A host the server is not set up for cannot be chosen, and says why. */
function hostChoice(oauth: Profile['oauth'], onChange: () => void): ChoicesHandle {
  const unavailable = (kind: 'google' | 'microsoft'): string | undefined => (oauth[kind] ? undefined : t('mailboxes.oauthUnavailable', { prefix: kind.toUpperCase() }));
  return Choices({ legend: t('mailboxes.where'), name: 'host', value: oauth.google ? 'google' : oauth.microsoft ? 'microsoft' : 'imap', options: [
    { value: 'google', title: t('mailboxes.connectGoogle'), hint: unavailable('google'), disabled: !oauth.google },
    { value: 'microsoft', title: t('mailboxes.connectMicrosoft'), hint: unavailable('microsoft'), disabled: !oauth.microsoft },
    { value: 'imap', title: t('mailboxes.imapTitle'), hint: t('mailboxes.imapHint') },
  ], onChange });
}

/** ConnectMailbox by signing in at its host: the way there. */
function hostSignIn(kind: string, shared: boolean): HTMLElement[] {
  const provider = kind === 'google' ? t('mailboxes.connectGoogle') : t('mailboxes.connectMicrosoft');
  return [
    Block(Text({ muted: true }, t('mailboxes.oauthIntro'))),
    ButtonLink(t('mailboxes.continueAt', { provider }), { href: hostSignInAddress(kind, shared ? '?shared=1' : ''), variant: 'primary' }),
  ];
}

/** The form for a mailbox reached by its servers, with the advice about who really hosts its address. */
function serversFormWithAdvice(first: boolean, shared: () => boolean, host: ChoicesHandle, onHostChosen: () => void) {
  const byServers = MailboxByServersForm(first, shared);
  const advice = MailHostAdvice({ oauth: me().oauth, host, propose: byServers.propose, onHostChosen });
  byServers.email.addEventListener('change', () => void advice.find(byServers.email.value));
  return { form: byServers.form, advice };
}

/** Connecting a mailbox: whose it is, where it is hosted, then what that host asks for. */
export function connectMailboxPage(first: boolean, oauthError: Child): void {
  // What the chosen host asks for: a form for IMAP, a trip to the provider for the others.
  const detail = Card({});
  const showDetail = (): void => detail.replaceChildren(...(host.value() === 'imap' ? [byServers.form] : hostSignIn(host.value(), shared())));
  const whose = isAdmin() ? whoseChoice(showDetail) : null;
  const shared = (): boolean => whose?.value() === 'shared';
  const host = hostChoice(me().oauth, showDetail);
  const byServers = serversFormWithAdvice(first, shared, host, showDetail);
  showDetail();
  shell(Page(
    first && PathSteps('connect'),
    PageHeader({ title: t('mailboxes.connectTitle'), intro: t('mailboxes.connectIntro'), crumbs: first ? [] : [{ label: t('mailboxes.title'), href: '#/mailboxes' }] }),
    oauthError,
    byServers.advice.element,
    whose && Card({}, whose.element),
    Card({}, host.element),
    detail,
  ));
  if (first) void byServers.advice.find(me().email);
}
