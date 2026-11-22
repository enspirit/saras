// Signing in, or creating the organisation: the first screen a visitor meets.

import { createOrganization, readPublicInfo, signIn } from '../api/access.ts';
import type { PublicInfo } from '../api/access.ts';
import { language, t } from '../i18n.ts';
import { start } from '../navigation.ts';
import { SubmitForm } from './actions.ts';
import { LanguagePicker } from './language.ts';
import { showScreen } from './screen.ts';
import { session } from '../session.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import type { Child } from '../ui/dom.ts';
import { Field } from '../ui/molecules/field.ts';
import { AuthPanel } from '../ui/organisms/auth-panel.ts';

/** What the installation guarantees, said where a visitor first meets it. */
export const guarantees = (info: PublicInfo) => [
  session.brand.euHosting && { icon: 'shield-check' as const, title: t('auth.pointEuTitle'), text: t('auth.pointEu') },
  { icon: 'lock' as const, text: t('auth.pointZdr') },
  { icon: 'eye-off' as const, text: t('auth.pointMinimal') },
  info.retentionDays ? { icon: 'timer' as const, text: t('settings.privacyRetention', { days: info.retentionDays }) } : null,
  { icon: 'check' as const, text: t('settings.privacyValidation') },
].filter((point) => point !== null && point !== false);

/** What the installation says of itself; when it cannot be asked, sign-up is taken as closed. */
export const publicInfo = (): Promise<PublicInfo> => readPublicInfo().catch((): PublicInfo => ({ allowSignup: false }));

interface SignInFields {
  email: HTMLInputElement;
  password: HTMLInputElement;
  organization: HTMLInputElement;
  name: HTMLInputElement;
}

const signInFields = (signup: boolean, typedEmail: string): SignInFields => ({
  email: Input({ type: 'email', required: true, autocomplete: 'username', value: typedEmail }),
  password: Input({ type: 'password', required: true, minLength: signup ? 10 : 1, autocomplete: signup ? 'new-password' : 'current-password' }),
  organization: Input({ required: true, autocomplete: 'organization' }),
  name: Input({ autocomplete: 'name' }),
});

/** The form: signing in, or with `signup` creating the organisation and its first account. */
function signInForm(signup: boolean, { email, password, organization, name }: SignInFields): HTMLFormElement {
  const submit = Button(signup ? t('auth.createAccount') : t('auth.signIn'), { variant: 'primary', size: 'large', type: 'submit', block: true });
  return SubmitForm(submit, '…', async () => {
    const details = { email: email.value, password: password.value, organization: organization.value, name: name.value, language: language() };
    await (signup ? createOrganization(details) : signIn(details));
    if (signup) location.hash = '#/accounts';
    await start();
  },
    signup && Field(t('auth.organization'), organization, { hint: t('auth.organizationHint') }),
    signup && Field(t('auth.name'), name, { hint: t('auth.nameHint') }),
    Field(t('auth.email'), email),
    Field(t('auth.password'), password, { hint: signup && t('auth.passwordHint') }),
    submit,
  );
}

/** Under the form: the way to the other form, or how to get in when sign-up is closed. */
const otherWay = (info: PublicInfo, signup: boolean, email: HTMLInputElement): Child => (info.allowSignup
  ? [signup ? t('auth.haveAccount') : t('auth.noAccountYet'), ' ', Button(signup ? t('auth.signIn') : t('auth.signUp'), { variant: 'link', onClick: () => signingInPage(signup ? 'login' : 'signup', email.value) })]
  : t('auth.askInvitation'));

export async function signingInPage(mode: 'login' | 'signup' = 'login', typedEmail = ''): Promise<void> {
  const info = await publicInfo();
  const signup = mode === 'signup' && info.allowSignup;
  const fields = signInFields(signup, typedEmail);
  const { brand } = session;
  showScreen(
    AuthPanel({ brand, tagline: brand.tagline, points: guarantees(info), title: signup ? t('auth.signUp') : t('auth.signIn'), intro: info.firstAccount && t('auth.firstAccount'), tools: LanguagePicker(), foot: otherWay(info, signup, fields.email) }, signInForm(signup, fields)),
  );
  (signup ? fields.organization : fields.email).focus();
}
