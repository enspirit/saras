// Settings → AI & privacy: which AI works for the organisation, and what the product guarantees
// about the emails it is sent. Administrators choose; members read. When the AI writes is chosen
// where it applies: with the prompts.

import type { Profile } from '../../shared/member.ts';
import type { Organization } from '../../shared/organization.ts';
import { changeOrganizationSettings, removeOrganizationKey } from '../api/settings.ts';
import { t } from '../i18n.ts';
import { showPage } from '../navigation.ts';
import { ActionButton, SubmitForm, toast } from './actions.ts';
import { privacy } from './privacy.ts';
import { isAdmin } from '../session.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input } from '../ui/atoms/input.ts';
import { Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Callout } from '../ui/molecules/callout.ts';
import { Facts } from '../ui/molecules/facts.ts';
import { Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';
import { PartTitle, SplitPanel, Standings } from '../ui/molecules/split-panel.ts';

/** When the AI writes is named as in getting started. */
const WRITING_LABEL = { none: 'welcome.writingNone', draft: 'welcome.writingDraft', mailbox: 'welcome.writingMailbox' };

/** What the AI is sent then, as things stand: translation keys. */
const SENT_WRITING = { none: 'settings.sentWritingAsked', draft: 'settings.sentWritingFetch', mailbox: 'settings.sentWritingFetch' };

/** When the AI writes, what it is sent then, and for administrators where that is chosen. */
const whatItDoes = ({ writing }: Organization): Child => [
  PartTitle(t('settings.aiDoesTitle')),
  Standings([
    { label: t('settings.factWriting'), now: t(WRITING_LABEL[writing]), detail: t(SENT_WRITING[writing]), link: isAdmin() ? { label: t('settings.chosenIn', { page: t('nav.prompts') }), href: '#/prompts' } : undefined },
  ]),
];

const removeKeyButton = (): HTMLButtonElement => ActionButton(t('organization.deleteKey'), '…', async () => {
  await removeOrganizationKey();
  toast(t('settings.keyDeleted'));
  showPage();
}, { variant: 'danger' });

/** SetOrganizationModel and SetOrganizationKey, in one form; RemoveOrganizationKey beside it. */
function aiForm(org: Organization, inForce: string): HTMLFormElement {
  const model = Input({ value: org.model ?? '', placeholder: inForce });
  const key = Input({ type: 'password', autocomplete: 'off', placeholder: org.hasKey ? t('settings.keySaved') : 'sk-or-…' });
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    await changeOrganizationSettings({ model: model.value, ...(key.value ? { openrouterKey: key.value } : {}) });
    toast(t('settings.saved'));
    showPage();
  },
    Field(t('organization.model'), model, { hint: t('organization.modelHint') }),
    Field(t('organization.key'), key, { hint: org.hasKey ? t('settings.keyHintOwn') : t('organization.keyHint') }),
    Actions(save, org.hasKey && removeKeyButton()),
  );
}

/** The same, for a member to read: what the administrators chose. */
const aiFacts = (who: Profile): Child => [
  Facts([[t('organization.model'), who.model]]),
  Text({ muted: true, small: true }, t('settings.aiSetBy', { organization: who.organization.name })),
];

/** Which AI works for the organisation and when, then what is guaranteed about what it is sent. */
export const aiAndPrivacy = (who: Profile): Child => [
  !who.hasKey && Callout('warn', t('settings.noKey')),
  SplitPanel([PartTitle(t('settings.aiOf', { organization: who.organization.name })), isAdmin() ? aiForm(who.organization, who.model) : aiFacts(who)], whatItDoes(who.organization)),
  privacy(who),
];
