// A lost password: asking for a link to choose a new one, and choosing it.

import { checkPasswordReset, requestPasswordReset, resetPassword } from '../api/access.ts';
import { t } from '../i18n.ts';
import { start } from '../navigation.ts';
import { messageOf, SubmitForm, toast } from './actions.ts';
import { passwordField, publicInfo, showVisitorScreen } from './visitor-screen.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import { Notice } from '../ui/atoms/notice.ts';
import { Field } from '../ui/molecules/field.ts';

/** Leaves for the sign-in page, dropping any link from the address bar and the history. */
const toSignIn = (): Promise<void> => {
  history.replaceState(null, '', '/');
  return start();
};
const backToSignIn = (): HTMLButtonElement => Button(t('invitation.goToSignIn'), { variant: 'link', onClick: toSignIn });

/** RequestPasswordReset: the answer is the same whether the address has an account or not. */
function requestForm(typedEmail: string): HTMLFormElement {
  const email = Input({ type: 'email', required: true, autocomplete: 'username', value: typedEmail });
  const submit = Button(t('lostPassword.send'), { variant: 'primary', size: 'large', type: 'submit', block: true });
  const form = SubmitForm(submit, '…', async () => {
    await requestPasswordReset(email.value);
    form.replaceWith(Notice('ok', t('lostPassword.sent', { email: email.value })));
  }, Field(t('auth.email'), email), submit);
  return form;
}

/** Where a visitor who lost their password is told how to get a new one: by email when this server sends some, from an administrator otherwise. */
export async function lostPasswordPage(typedEmail = ''): Promise<void> {
  const info = await publicInfo();
  showVisitorScreen(info, { title: t('lostPassword.title'), intro: info.passwordResetByEmail ? t('lostPassword.intro') : undefined, foot: backToSignIn() },
    info.passwordResetByEmail ? requestForm(typedEmail) : Notice('info', t('lostPassword.askAdministrator')));
}

/** ResetPassword: the new password, then the sign-in page, where it is used. */
function newPasswordForm(token: string, address: string): HTMLFormElement {
  const password = passwordField({ minLength: 10, autocomplete: 'new-password' });
  const submit = Button(t('lostPassword.choose'), { variant: 'primary', size: 'large', type: 'submit', block: true });
  return SubmitForm(submit, '…', async () => {
    await resetPassword(token, password.input.value);
    toast(t('lostPassword.chosen'));
    await toSignIn();
  },
    Field(t('auth.email'), Input({ type: 'email', value: address, disabled: true, autocomplete: 'username' })),
    Field(t('lostPassword.newPassword'), password.field, { hint: t('auth.passwordHint') }),
    submit,
  );
}

/** Landing page of a link to a new password. A link that opens nothing says so, with the way back. */
export async function newPasswordPage(token: string): Promise<void> {
  const info = await publicInfo();
  try {
    const { email } = await checkPasswordReset(token);
    showVisitorScreen(info, { title: t('lostPassword.chooseTitle'), foot: backToSignIn() }, newPasswordForm(token, email));
  } catch (e) {
    showVisitorScreen(info, { title: t('lostPassword.chooseTitle'), foot: backToSignIn() }, Notice('danger', messageOf(e)));
  }
}
