// Settings → You: one's name, signature, model and key, one's password, the language, and
// deleting one's own account.

import { changePassword, deleteOwnAccount } from '../api/access.ts';
import { changeOwnSettings, removeOwnKey } from '../api/settings.ts';
import type { Me } from '../api/settings.ts';
import { languages, t } from '../i18n.ts';
import { showPage } from '../navigation.ts';
import { ActionButton, SubmitForm, toast } from './actions.ts';
import { LanguagePicker } from './language.ts';
import { LeavingForm } from './leaving.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input, Textarea } from '../ui/atoms/input.ts';
import type { Child } from '../ui/dom.ts';
import { Callout } from '../ui/molecules/callout.ts';
import { Card, CardSection } from '../ui/molecules/card.ts';
import { Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';

/** SetOwnName, SetSignature, ChooseOwnModel and SetOwnKey, in one form; RemoveOwnKey beside it. */
function ownSettingsForm(who: Me): HTMLFormElement {
  const name = Input({ value: who.name, autocomplete: 'name' });
  const model = Input({ value: who.model, placeholder: who.defaultModel });
  const signature = Textarea({ rows: 3, placeholder: t('settings.signaturePlaceholder'), value: who.signature });
  const key = Input({ type: 'password', autocomplete: 'off', placeholder: who.hasOwnKey ? t('settings.keySaved') : who.hasKey ? t('settings.keyServer') : 'sk-or-…' });
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    const body: { name: string; model: string; signature: string; openrouterKey?: string } = { name: name.value, model: model.value === who.defaultModel ? '' : model.value, signature: signature.value };
    if (key.value) body.openrouterKey = key.value;
    await changeOwnSettings(body);
    toast(t('settings.saved'));
    showPage();
  },
    Field(t('settings.name'), name, { hint: t('settings.nameHint', { organization: who.organization.name }) }),
    Field(t('settings.signature'), signature, { hint: t('settings.signatureHint') }),
    ownAiSection(who, model, key),
    Actions(save, who.hasOwnKey && removeOwnKeyButton()),
  );
}

const ownAiSection = (who: Me, model: HTMLInputElement, key: HTMLInputElement): HTMLDivElement =>
  CardSection(t('settings.aiTitle'),
    Field(t('settings.model'), model, { hint: t('settings.modelHint', { model: who.defaultModel }) }),
    Field(t('settings.key'), key, { hint: who.hasOwnKey ? t('settings.keyHintOwn') : t('settings.keyHint') }),
  );

const removeOwnKeyButton = (): HTMLButtonElement => ActionButton(t('settings.deleteKey'), '…', async () => {
  await removeOwnKey();
  toast(t('settings.keyDeleted'));
  showPage();
}, { variant: 'danger' });

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
const deleteAccountForm = (who: Me): Child => LeavingForm({
  text: t('settings.deleteAccountText'),
  label: t('settings.deleteAccount'),
  confirm: t('settings.confirmDeleteAccount', { email: who.email }),
  done: t('settings.accountDeleted'),
  leave: (password) => deleteOwnAccount(password),
});

/** One's own settings. */
export const yourSettings = (who: Me): Child => [
  !who.hasKey && Callout('warn', t('settings.noKey')),
  Card({ form: true }, ownSettingsForm(who)),
  Card({ title: t('settings.passwordTitle'), form: true }, passwordForm()),
  languages().length > 1 && Card({ title: t('settings.display'), form: true }, LanguagePicker()),
  Card({ title: t('settings.deleteAccountTitle'), form: true }, deleteAccountForm(who)),
];
