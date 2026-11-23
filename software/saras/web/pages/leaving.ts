// Leaving: deleting one's own account, or the whole organisation. Either ends the session.

import { t } from '../i18n.ts';
import { start } from '../navigation.ts';
import { confirmAction, SubmitForm, toast } from './actions.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import { Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Block, Field } from '../ui/molecules/field.ts';
import { Actions, FormRow } from '../ui/molecules/form.ts';

interface Leaving {
  /** What will be lost. */
  text: string;
  /** Label of the button, and of the confirmation. */
  label: string;
  /** The question asked before it happens. */
  confirm: string;
  /** Said once it is done. */
  done: string;
  /** DeleteOwnAccount or DeleteOrganization: the password is given, and the name typed when one is asked. */
  leave(password: string, name: string): Promise<unknown>;
  /** Label of the field where a name must be typed, when the deletion asks for one. */
  nameLabel?: string;
}

/** A deletion that ends the session: the password is asked, then a confirmation, then back to the sign-in page. */
export function LeavingForm({ text, label, confirm, done, leave, nameLabel }: Leaving): Child {
  const name = Input({ required: true, autocomplete: 'off' });
  const password = Input({ type: 'password', required: true, autocomplete: 'current-password' });
  const submit = Button(label, { variant: 'danger', type: 'submit' });
  const passwordField = Field(t('organization.deletePassword'), password);
  return SubmitForm(submit, '…', async () => {
    if (!(await confirmAction(confirm, label))) return;
    await leave(password.value, name.value);
    toast(done);
    location.hash = '';
    await start();
  },
    Block(Text({ muted: true }, text)),
    nameLabel ? FormRow(Field(nameLabel, name), passwordField) : passwordField,
    Actions(submit),
  );
}
