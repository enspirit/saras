// Settings → You: one's name and signature, one's password, the language, and deleting one's
// own account.

import type { Profile } from '../../shared/member.ts';
import { changePassword, deleteOwnAccount } from '../api/access.ts';
import { changeOwnSettings } from '../api/settings.ts';
import { languages, t } from '../i18n.ts';
import { showPage } from '../navigation.ts';
import { SubmitForm, toast } from './actions.ts';
import { LanguagePicker } from './language.ts';
import { LeavingForm } from './leaving.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input, Textarea } from '../ui/atoms/input.ts';
import type { Child } from '../ui/dom.ts';
import { Card } from '../ui/molecules/card.ts';
import { Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';

/** SetOwnName and SetSignature, in one form. */
function ownSettingsForm(who: Profile): HTMLFormElement {
  const name = Input({ value: who.name, autocomplete: 'name' });
  const signature = Textarea({ rows: 3, placeholder: t('settings.signaturePlaceholder'), value: who.signature });
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    await changeOwnSettings({ name: name.value, signature: signature.value });
    toast(t('settings.saved'));
    showPage();
  },
    Field(t('settings.name'), name, { hint: t('settings.nameHint', { organization: who.organization.name }) }),
    Field(t('settings.signature'), signature, { hint: t('settings.signatureHint') }),
    Actions(save),
  );
}

/** ChangePassword: the current one is asked for. */
function passwordForm(): HTMLFormElement {
  const current = Input({ type: 'password', required: true, autocomplete: 'current-password' });
  const next = Input({ type: 'password', required: true, minLength: 10, autocomplete: 'new-password' });
  const change = Button(t('settings.changePassword'), { type: 'submit' });
  return SubmitForm(change, '…', async () => {
    await changePassword(current.value, next.value);
    toast(t('settings.passwordChanged'));
    showPage();
  },
    Field(t('settings.currentPassword'), current),
    Field(t('settings.newPassword'), next, { hint: t('auth.passwordHint') }),
    Actions(change),
  );
}

/** DeleteOwnAccount, behind the password and a confirmation. */
const deleteAccountForm = (who: Profile): Child => LeavingForm({
  text: t('settings.deleteAccountText'),
  label: t('settings.deleteAccount'),
  confirm: t('settings.confirmDeleteAccount', { email: who.email }),
  done: t('settings.accountDeleted'),
  leave: (password) => deleteOwnAccount(password),
});

/** One's own settings. */
export const yourSettings = (who: Profile): Child => [
  Card({ title: t('settings.profileTitle'), form: true }, ownSettingsForm(who)),
  Card({ title: t('settings.passwordTitle'), form: true }, passwordForm()),
  languages().length > 1 && Card({ title: t('settings.display'), form: true }, LanguagePicker()),
  Card({ title: t('settings.deleteAccountTitle'), form: true, danger: true }, deleteAccountForm(who)),
];
