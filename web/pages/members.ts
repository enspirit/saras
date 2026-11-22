// The members of the organisation (administrators): who they are, their role, and removing one.

import { appointAdministrator, deleteMember, readInvitations, readMembers, removeAdministratorRole } from '../api/access.ts';
import type { NewInvitation, User } from '../api/access.ts';
import { t } from '../i18n.ts';
import { fmtDay } from '../i18n/dates.ts';
import { start } from '../navigation.ts';
import { ActionButton, confirmAction, guard } from './actions.ts';
import { InvitationLink, InviteCard, PendingInvitations } from './invitations.ts';
import { called, roleLabel } from './people.ts';
import { shell } from './shell.ts';
import { me } from '../session.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Button } from '../ui/atoms/button.ts';
import { Muted } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Person } from '../ui/molecules/person.ts';
import { Table } from '../ui/molecules/table.ts';
import { Page } from '../ui/organisms/page.ts';

/** AppointAdministrator or RemoveAdministratorRole, whichever applies to this member. */
const roleButton = (u: User, self: boolean): HTMLButtonElement => {
  const admin = u.role === 'admin';
  return ActionButton(admin ? t('users.demote') : t('users.promote'), '…', async () => {
    await (admin ? removeAdministratorRole(u.id) : appointAdministrator(u.id));
    // One's own role decides what the application shows: start over.
    if (self) return start();
    void membersPage();
  }, { variant: 'ghost', size: 'small' });
};

/** DeleteMember, once confirmed. */
const deleteButton = (u: User): HTMLButtonElement => ActionButton(t('users.delete'), '…', async () => {
  if (!(await confirmAction(t('users.confirmDelete', { email: u.email }), t('users.delete')))) return;
  await deleteMember(u.id);
  void membersPage();
}, { variant: 'danger', size: 'small', icon: 'trash', iconOnly: true });

/** One member: who, their role, since when, how many mailboxes, and what can be done about them. */
function memberRow(u: User): Child[] {
  const self = u.email === me().email;
  return [
    Person({ name: called(u.name, u.email), detail: u.name ? u.email : undefined, tags: [self && Badge(t('users.you'), 'neutral')] }),
    Badge(roleLabel(u.role), u.role === 'admin' ? 'accent' : 'neutral'),
    fmtDay(u.createdAt),
    u.accounts || Muted(t('users.noMailbox')),
    [roleButton(u, self), !self && deleteButton(u)],
  ];
}

const membersTable = (users: User[]): HTMLDivElement =>
  Table({ columns: [t('users.member'), t('users.role'), t('users.joined'), t('users.mailboxes')], actions: t('common.actions') }, users.map(memberRow));

/** The members and the pending invitations. `freshInvitation` is one just created, whose link is shown once. */
export const membersPage = guard(async (freshInvitation?: NewInvitation) => {
  const [users, invitations] = await Promise.all([readMembers(), readInvitations()]);
  const invite = InviteCard((invitation) => membersPage(invitation));
  shell(
    Page(
      PageHeader({ title: t('users.title'), intro: t('users.intro', { organization: me().organization.name }) },
        Button(t('users.invite'), { variant: 'primary', icon: 'user-plus', onClick: invite.open })),
      freshInvitation?.link ? InvitationLink(freshInvitation) : null,
      invite.element,
      membersTable(users),
      invitations.length > 0 && PendingInvitations(invitations, () => membersPage()),
    ),
  );
});
