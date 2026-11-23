// Settings → Organisation (administrators): its name, when the AI writes, its AI, the appearance, and
// deleting it. How emails are sorted is decided on the attribute "Stands in".

import type { Profile } from '../../shared/member.ts';
import type { Organization } from '../../shared/organization.ts';
import { WRITING } from '../../shared/organization.ts';
import { deleteOrganization } from '../api/access.ts';
import { changeOrganizationSettings, removeOrganizationKey } from '../api/settings.ts';
import { t, tRich } from '../i18n.ts';
import { showPage } from '../navigation.ts';
import { ActionButton, SubmitForm, toast } from './actions.ts';
import { LeavingForm } from './leaving.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input, Select } from '../ui/atoms/input.ts';
import { Link, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Card, CardSection } from '../ui/molecules/card.ts';
import { Block, Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';

interface OrganisationFields {
  name: HTMLInputElement;
  writing: HTMLSelectElement;
  model: HTMLInputElement;
  key: HTMLInputElement;
}

/** Writing is named as in getting started. */
const WRITING_LABEL = { none: 'welcome.writingNone', draft: 'welcome.writingDraft', mailbox: 'welcome.writingMailbox' };

const organisationFields = (org: Organization): OrganisationFields => ({
  name: Input({ required: true, value: org.name }),
  writing: Select(WRITING.map((value) => ({ value, label: t(WRITING_LABEL[value]), selected: org.writing === value }))),
  model: Input({ value: org.model ?? '', placeholder: t('organization.modelPlaceholder') }),
  key: Input({ type: 'password', autocomplete: 'off', placeholder: org.hasKey ? t('settings.keySaved') : 'sk-or-…' }),
});

/** What the form sends: the key only when one was typed. */
function written({ name, writing, model, key }: OrganisationFields): Record<string, unknown> {
  const body: Record<string, unknown> = { name: name.value, writing: writing.value, model: model.value };
  if (key.value) body.openrouterKey = key.value;
  return body;
}

/** RenameOrganization, ChooseWriting, SetOrganizationModel and SetOrganizationKey, in one form; RemoveOrganizationKey beside it. */
function organisationForm(org: Organization): HTMLFormElement {
  const fields = organisationFields(org);
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    await changeOrganizationSettings(written(fields));
    toast(t('settings.saved'));
    showPage();
  },
    Field(t('organization.name'), fields.name),
    Block(Text({ muted: true, small: true }, tRich('organization.sortingMoved', {}, { link: (label) => Link(label, '#/attributes/edit/status') }))),
    Field(t('organization.writing'), fields.writing, { hint: t('organization.writingHint') }),
    organisationAiSection(org, fields.model, fields.key),
    Actions(save, org.hasKey && removeKeyButton()),
  );
}

const organisationAiSection = (org: Organization, model: HTMLInputElement, key: HTMLInputElement): HTMLDivElement =>
  CardSection(t('settings.aiTitle'),
    Field(t('organization.model'), model, { hint: t('organization.modelHint') }),
    Field(t('organization.key'), key, { hint: org.hasKey ? t('settings.keyHintOwn') : t('organization.keyHint') }),
  );

const removeKeyButton = (): HTMLButtonElement => ActionButton(t('organization.deleteKey'), '…', async () => {
  await removeOrganizationKey();
  toast(t('settings.keyDeleted'));
  showPage();
}, { variant: 'danger' });

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
  Card({ form: true }, Block(Text({ muted: true }, t('organization.intro'))), organisationForm(who.organization)),
  Card({ title: t('settings.appearance'), form: true }, Text({}, tRich('settings.appearanceText', {}, { link: (label) => Link(label, '/styleguide.html') }))),
  Card({ title: t('organization.deleteTitle'), form: true }, deleteOrganisationForm(who.organization)),
];
