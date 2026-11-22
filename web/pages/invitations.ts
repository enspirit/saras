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
import { Callout } from '../ui/molecules/callout.ts';
import { Card } from '../ui/molecules/card.ts';
import { Field } from '../ui/molecules/field.ts';
import { Actions, FormRow } from '../ui/molecules/form.ts';
import { Table } from '../ui/molecules/table.ts';

/** The link of an invitation just created, to copy: it cannot be shown again. */
function copyButton(invitation: NewInvitation, link: HTMLInputElement): HTMLButtonElement {
  return Button(t('common.copy'), {
    icon: 'copy',
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(invitation.link);
        toast(t('users.linkCopied'));
      } catch {
        link.focus();
        toast(t('users.copyFailed'), true);
      }
    },
  });
}

/** Says that the invitation is ready, with its link and for how long it holds. */
export function InvitationLink(invitation: NewInvitation): HTMLDivElement {
  const link = Input({ readOnly: true, value: invitation.link, onfocus: () => link.select() });
  const ready = tRich('users.linkReady', { email: invitation.email, days: invitation.validDays }, { strong: Strong });
  return Callout('ok', ready, FormRow(Field(null, link), Field(null, copyButton(invitation, link), { size: 'fit' })));
}

export interface InviteCardHandle {
  element: HTMLDivElement;
  /** Shows the card, ready to be typed in. */
  open(): void;
}

/** InviteMember: a step opened on demand, rather than a form that stays on the page. `onInvited` gets the invitation and its link. */
export function InviteCard(onInvited: (invitation: NewInvitation) => unknown): InviteCardHandle {
  const email = Input({ type: 'email', required: true, placeholder: t('users.emailPlaceholder') });
  const role = Select([{ value: 'user', label: t('role.user') }, { value: 'admin', label: t('role.admin') }]);
  const invite = Button(t('users.createLink'), { variant: 'primary', type: 'submit' });
  const element = Card({ title: t('users.invite'), form: true },
    SubmitForm(invite, '…', async () => onInvited(await inviteMember(email.value, role.value)),
      FormRow(Field(t('users.email'), email), Field(t('users.role'), role, { size: 'narrow' })),
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
  Table({ title: t('users.pending'), columns: [t('users.email'), t('users.role'), t('users.expiry')], actions: t('common.actions') }, invitations.map((i) => [
    i.email,
    Badge(roleLabel(i.role), i.role === 'admin' ? 'accent' : 'neutral'),
    i.expired ? Badge(t('users.expired'), 'warn') : fmtDay(i.expiresAt),
    ActionButton(t('users.revoke'), '…', async () => {
      await revokeInvitation(i.id);
      onRevoked();
    }, { variant: 'ghost', size: 'small' }),
  ]));
