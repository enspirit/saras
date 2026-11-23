// Settings → AI & privacy: which AI works for the organisation, when it writes, and what the
// product guarantees about the emails it is sent. Administrators choose; members read.

import type { Profile } from '../../shared/member.ts';
import type { Organization } from '../../shared/organization.ts';
import { WRITING } from '../../shared/organization.ts';
import { changeOrganizationSettings, removeOrganizationKey } from '../api/settings.ts';
import { t, tRich } from '../i18n.ts';
import { showPage } from '../navigation.ts';
import { ActionButton, SubmitForm, toast } from './actions.ts';
import { privacy } from './privacy.ts';
import { isAdmin } from '../session.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input, Select } from '../ui/atoms/input.ts';
import { Link, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Callout } from '../ui/molecules/callout.ts';
import { Card } from '../ui/molecules/card.ts';
import { Facts } from '../ui/molecules/facts.ts';
import { Block, Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';

/** The two steps an email goes through are named as in getting started. */
const SORTING_LABEL = { none: 'welcome.sortingNone', ai: 'welcome.sortingAi' };
const WRITING_LABEL = { none: 'welcome.writingNone', draft: 'welcome.writingDraft', mailbox: 'welcome.writingMailbox' };

/** Where sorting is decided: on the attribute that says where an email stands. */
const sortingMoved = (): HTMLElement => Block(Text({ muted: true, small: true }, tRich('organization.sortingMoved', {}, { link: (label) => Link(label, '#/attributes/edit/status') })));

const removeKeyButton = (): HTMLButtonElement => ActionButton(t('organization.deleteKey'), '…', async () => {
  await removeOrganizationKey();
  toast(t('settings.keyDeleted'));
  showPage();
}, { variant: 'danger' });

/** SetOrganizationModel, SetOrganizationKey and ChooseWriting, in one form; RemoveOrganizationKey beside it. */
function aiForm(org: Organization, inForce: string): HTMLFormElement {
  const model = Input({ value: org.model ?? '', placeholder: inForce });
  const key = Input({ type: 'password', autocomplete: 'off', placeholder: org.hasKey ? t('settings.keySaved') : 'sk-or-…' });
  const writing = Select(WRITING.map((value) => ({ value, label: t(WRITING_LABEL[value]), selected: org.writing === value })));
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    await changeOrganizationSettings({ model: model.value, writing: writing.value, ...(key.value ? { openrouterKey: key.value } : {}) });
    toast(t('settings.saved'));
    showPage();
  },
    Field(t('organization.model'), model, { hint: t('organization.modelHint') }),
    Field(t('organization.key'), key, { hint: org.hasKey ? t('settings.keyHintOwn') : t('organization.keyHint') }),
    Field(t('organization.writing'), writing, { hint: t('organization.writingHint') }),
    sortingMoved(),
    Actions(save, org.hasKey && removeKeyButton()),
  );
}

/** The same, for a member to read: what the administrators chose. */
const aiFacts = (who: Profile): Child => [
  Facts([
    [t('organization.model'), who.model],
    [t('settings.factSorting'), t(SORTING_LABEL[who.organization.sorting])],
    [t('settings.factWriting'), t(WRITING_LABEL[who.organization.writing])],
  ]),
  Text({ muted: true, small: true }, t('settings.aiSetBy', { organization: who.organization.name })),
];

/** Which AI works for the organisation and when, then what is guaranteed about what it is sent. */
export const aiAndPrivacy = (who: Profile): Child => [
  !who.hasKey && Callout('warn', t('settings.noKey')),
  Card({ title: t('settings.aiTitle'), form: true }, isAdmin() ? aiForm(who.organization, who.model) : aiFacts(who)),
  privacy(who),
];
