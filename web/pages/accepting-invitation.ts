// Accepting an invitation: the page an invitation link opens.

import type { WhatVisitorsAreTold } from '../../shared/member.ts';
import { acceptInvitation, checkInvitation } from '../api/access.ts';
import { language, t } from '../i18n.ts';
import { start } from '../navigation.ts';
import { messageOf, SubmitForm } from './actions.ts';
import { LanguagePicker } from './language.ts';
import { showScreen } from './screen.ts';
import { guarantees, publicInfo } from './signing-in.ts';
import { session } from '../session.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import { Notice } from '../ui/atoms/notice.ts';
import { Field } from '../ui/molecules/field.ts';
import { AuthPanel } from '../ui/organisms/auth-panel.ts';

/** Leaves the invitation: drops the token from the address bar and the history, and starts over. */
const leaveInvitation = (): Promise<void> => {
  history.replaceState(null, '', '/');
  return start();
};

/** Shown when the link opens nothing: why, and the way to the sign-in page. */
const refusedInvitation = (info: WhatVisitorsAreTold, problem: unknown): HTMLDivElement => {
  const { brand } = session;
  return AuthPanel({ brand, tagline: brand.tagline, points: guarantees(info), title: t('invitation.title') }, Notice('danger', messageOf(problem)), Button(t('invitation.goToSignIn'), { onClick: leaveInvitation }));
};

/** The form of the invited person: their name, and the password they choose. */
function acceptForm(token: string, address: string, name: HTMLInputElement, password: HTMLInputElement): HTMLFormElement {
  const submit = Button(t('auth.createAccount'), { variant: 'primary', size: 'large', type: 'submit', block: true });
  return SubmitForm(submit, '…', async () => {
    await acceptInvitation({ token, password: password.value, name: name.value, language: language() });
    history.replaceState(null, '', '/#/accounts');
    await start();
  },
    Field(t('auth.email'), Input({ type: 'email', value: address, disabled: true, autocomplete: 'username' })),
    Field(t('auth.name'), name, { hint: t('auth.nameHint') }),
    Field(t('invitation.choosePassword'), password, { hint: t('auth.passwordHint') }),
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
    return showScreen(refusedInvitation(info, e));
  }
  const name = Input({ autocomplete: 'name' });
  const password = Input({ type: 'password', required: true, minLength: 10, autocomplete: 'new-password' });
  const { brand } = session;
  const intro = t('invitation.invited', { organization: invitation.organization, product: brand.name });
  showScreen(AuthPanel({ brand, tagline: brand.tagline, points: guarantees(info), title: t('invitation.title'), intro, tools: LanguagePicker() }, acceptForm(token, invitation.email, name, password)));
  name.focus();
}
