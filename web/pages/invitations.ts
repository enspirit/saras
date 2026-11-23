// Invitations (administrators): inviting someone, the link to hand them, and the invitations
// that still wait for an answer.

import type { Invitation, NewInvitation } from '../../shared/member.ts';
import { inviteMember, revokeInvitation } from '../api/access.ts';
import { t, tRich } from '../i18n.ts';
import { fmtDay } from '../i18n/dates.ts';
import { ActionButton, SubmitForm, toast } from './actions.ts';
import { roleLabel } from './people.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input, Select } from '../ui/atoms/input.ts';
import { Strong } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Callout } from '../ui/molecules/callout.ts';
import { Card } from '../ui/molecules/card.ts';
import { Field } from '../ui/molecules/field.ts';
import { Actions, FormRow } from '../ui/molecules/form.ts';
import { Table } from '../ui/molecules/table.ts';

/** Copies a link that is shown once. */
const copyButton = (address: string, link: HTMLInputElement): HTMLButtonElement =>
  Button(t('common.copy'), {
    icon: 'copy',
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(address);
        toast(t('members.linkCopied'));
      } catch {
        link.focus();
        toast(t('members.copyFailed'), true);
      }
    },
  });

/** Says that a link is ready to hand to someone, and shows it to copy: it cannot be shown again. */
export function LinkToHandOver(address: string, ready: Child): HTMLDivElement {
  const link = Input({ readOnly: true, value: address, onfocus: () => link.select() });
  return Callout('ok', ready, FormRow(Field(null, link), Field(null, copyButton(address, link), { size: 'fit' })));
}

/** The link of an invitation just created, and for how long it holds. */
export const InvitationLink = (invitation: NewInvitation): HTMLDivElement =>
  LinkToHandOver(invitation.link, tRich('members.linkReady', { email: invitation.email, days: invitation.validDays }, { strong: Strong }));

export interface InviteCardHandle {
  element: HTMLDivElement;
  /** Shows the card, ready to be typed in. */
  open(): void;
}

/** InviteMember: a step opened on demand, rather than a form that stays on the page. `onInvited` gets the invitation and its link. */
export function InviteCard(onInvited: (invitation: NewInvitation) => unknown): InviteCardHandle {
  const email = Input({ type: 'email', required: true, placeholder: t('members.emailPlaceholder') });
  const role = Select([{ value: 'user', label: t('role.user') }, { value: 'admin', label: t('role.admin') }]);
  const invite = Button(t('members.createLink'), { variant: 'primary', type: 'submit' });
  const element = Card({ title: t('members.invite'), form: true },
    SubmitForm(invite, '…', async () => onInvited(await inviteMember(email.value, role.value)),
      FormRow(Field(t('members.email'), email), Field(t('members.role'), role, { size: 'narrow' })),
      Actions(invite, Button(t('common.cancel'), { onClick: () => (element.hidden = true) })),
    ),
  );
  element.hidden = true;
  const open = (): void => {
    element.hidden = false;
    email.focus();
  };
  return { element, open };
}

/** The invitations not yet accepted, each with RevokeInvitation. `onRevoked` is called after one was. */
export const PendingInvitations = (invitations: Invitation[], onRevoked: () => unknown): HTMLDivElement =>
  Table({ title: t('members.pending'), columns: [t('members.email'), t('members.role'), t('members.expiry')], actions: t('common.actions') }, invitations.map((i) => [
    i.email,
    Badge(roleLabel(i.role), i.role === 'admin' ? 'accent' : 'neutral'),
    i.expired ? Badge(t('members.expired'), 'warn') : fmtDay(i.expiresAt),
    ActionButton(t('members.revoke'), '…', async () => {
      await revokeInvitation(i.id);
      onRevoked();
    }, { variant: 'ghost', size: 'small' }),
  ]));
