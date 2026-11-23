// Accepting an invitation: the page an invitation link opens.

import type { WhatVisitorsAreTold } from '../../shared/member.ts';
import { acceptInvitation, checkInvitation } from '../api/access.ts';
import { language, t } from '../i18n.ts';
import { start } from '../navigation.ts';
import { messageOf, SubmitForm } from './actions.ts';
import { session } from '../session.ts';
import { continueSigningIn } from './second-factor.ts';
import { passwordField, publicInfo, showVisitorScreen } from './visitor-screen.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import { Notice } from '../ui/atoms/notice.ts';
import { Field } from '../ui/molecules/field.ts';

/** Leaves the invitation: drops the token from the address bar and the history, and starts over. */
const leaveInvitation = (): Promise<void> => {
  history.replaceState(null, '', '/');
  return start();
};

/** Shown when the link opens nothing: why, and the way to the sign-in page. */
const refusedInvitation = (info: WhatVisitorsAreTold, problem: unknown): void =>
  showVisitorScreen(info, { title: t('invitation.title') }, Notice('danger', messageOf(problem)), Button(t('invitation.goToSignIn'), { onClick: leaveInvitation }));

/** The form of the invited person: their name, and the password they choose. */
function acceptForm(token: string, address: string, name: HTMLInputElement): HTMLFormElement {
  const password = passwordField({ minLength: 10, autocomplete: 'new-password' });
  const submit = Button(t('auth.createAccount'), { variant: 'primary', size: 'large', type: 'submit', block: true });
  return SubmitForm(submit, '…', async () => {
    const admitted = await acceptInvitation({ token, password: password.input.value, name: name.value, language: language() });
    history.replaceState(null, '', '/#/mailboxes');
    await continueSigningIn(admitted, { next: start, again: () => void start() });
  },
    Field(t('auth.email'), Input({ type: 'email', value: address, disabled: true, autocomplete: 'username' })),
    Field(t('auth.name'), name, { hint: t('auth.nameHint') }),
    Field(t('invitation.choosePassword'), password.field, { hint: t('auth.passwordHint') }),
    submit,
  );
}

/** Landing page of an invitation link: the invited person gives their name and chooses a password. */
export async function invitationPage(token: string): Promise<void> {
  const info = await publicInfo();
  let invitation: { email: string; organization: string };
  try {
    invitation = await checkInvitation(token);
  } catch (e) {
    return refusedInvitation(info, e);
  }
  const name = Input({ autocomplete: 'name' });
  const intro = t('invitation.invited', { organization: invitation.organization, product: session.brand.name });
  showVisitorScreen(info, { title: t('invitation.title'), intro }, acceptForm(token, invitation.email, name));
  name.focus();
}
