// Signing in, or creating the organisation: the first screen a visitor meets.

import type { WhatVisitorsAreTold } from '../../shared/member.ts';
import { createOrganization, signIn } from '../api/access.ts';
import { language, t } from '../i18n.ts';
import { start } from '../navigation.ts';
import { SubmitForm } from './actions.ts';
import { lostPasswordPage } from './lost-password.ts';
import { continueSigningIn } from './second-factor.ts';
import { passwordField, publicInfo, showVisitorScreen } from './visitor-screen.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import type { Child } from '../ui/dom.ts';
import { Field } from '../ui/molecules/field.ts';

interface SignInFields {
  email: HTMLInputElement;
  password: ReturnType<typeof passwordField>;
  organization: HTMLInputElement;
  name: HTMLInputElement;
}

const signInFields = (signup: boolean, typedEmail: string): SignInFields => ({
  email: Input({ type: 'email', required: true, autocomplete: 'username', value: typedEmail }),
  password: passwordField({ minLength: signup ? 10 : 1, autocomplete: signup ? 'new-password' : 'current-password' }),
  organization: Input({ required: true, autocomplete: 'organization' }),
  name: Input({ autocomplete: 'name' }),
});

/** The form: signing in, or with `signup` creating the organisation and its first account. */
function signInForm(signup: boolean, { email, password, organization, name }: SignInFields): HTMLFormElement {
  const submit = Button(signup ? t('auth.createAccount') : t('auth.signIn'), { variant: 'primary', size: 'large', type: 'submit', block: true });
  return SubmitForm(submit, '…', async () => {
    const details = { email: email.value, password: password.input.value, organization: organization.value, name: name.value, language: language() };
    const admitted = await (signup ? createOrganization(details) : signIn(details));
    if (signup) location.hash = '#/mailboxes';
    await continueSigningIn(admitted, { next: start, again: () => void signingInPage('login', email.value) });
  },
    signup && Field(t('auth.organization'), organization, { hint: t('auth.organizationHint') }),
    signup && Field(t('auth.name'), name, { hint: t('auth.nameHint') }),
    Field(t('auth.email'), email),
    Field(t('auth.password'), password.field, { hint: signup ? t('auth.passwordHint') : lostPasswordLink(email) }),
    submit,
  );
}

/** Under the password of someone signing in: the way out for one who lost it. */
const lostPasswordLink = (email: HTMLInputElement): HTMLButtonElement => Button(t('lostPassword.link'), { variant: 'link', onClick: () => void lostPasswordPage(email.value) });

/** Under the form: the way to the other form, or how to get in when sign-up is closed. */
const otherWay = (info: WhatVisitorsAreTold, signup: boolean, email: HTMLInputElement): Child => (info.allowSignup
  ? [signup ? t('auth.haveAccount') : t('auth.noAccountYet'), ' ', Button(signup ? t('auth.signIn') : t('auth.signUp'), { variant: 'link', onClick: () => signingInPage(signup ? 'login' : 'signup', email.value) })]
  : t('auth.askInvitation'));

export async function signingInPage(mode: 'login' | 'signup' = 'login', typedEmail = ''): Promise<void> {
  const info = await publicInfo();
  const signup = mode === 'signup' && info.allowSignup;
  const fields = signInFields(signup, typedEmail);
  showVisitorScreen(info, { title: signup ? t('auth.signUp') : t('auth.signIn'), intro: info.firstAccount && t('auth.firstAccount'), foot: otherWay(info, signup, fields.email) }, signInForm(signup, fields));
  (signup ? fields.organization : fields.email).focus();
}
