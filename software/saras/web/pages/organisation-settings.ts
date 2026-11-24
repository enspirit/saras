// Settings → Organisation (administrators): its name, and deleting it. Its AI is
// in the tab beside; how emails are sorted is decided on the attribute "Stands in".

import type { Profile } from '../../shared/member.ts';
import type { Organization } from '../../shared/organization.ts';
import { deleteOrganization } from '../api/access.ts';
import { changeOrganizationSettings } from '../api/settings.ts';
import { t } from '../i18n.ts';
import { showPage } from '../navigation.ts';
import { SubmitForm, toast } from './actions.ts';
import { LeavingForm } from './leaving.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import type { Child } from '../ui/dom.ts';
import { Card } from '../ui/molecules/card.ts';
import { Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';

/** RenameOrganization. */
function organisationForm(org: Organization): HTMLFormElement {
  const name = Input({ required: true, value: org.name });
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    await changeOrganizationSettings({ name: name.value });
    toast(t('settings.saved'));
    showPage();
  }, Field(t('organization.name'), name), Actions(save));
}

/** DeleteOrganization, behind its name typed as it is, the password and a confirmation. */
const deleteOrganisationForm = (org: Organization): Child => LeavingForm({
  text: t('organization.deleteText'),
  label: t('organization.delete'),
  confirm: t('organization.confirmDelete', { organization: org.name }),
  done: t('organization.deleted'),
  leave: deleteOrganization,
  nameLabel: t('organization.deleteName'),
});

/** The organisation's own settings, for its administrators. */
export const organisationSettings = (who: Profile): Child => [
  Card({ title: t('organization.generalTitle'), form: true }, organisationForm(who.organization)),
  Card({ title: t('organization.deleteTitle'), form: true, danger: true }, deleteOrganisationForm(who.organization)),
];
