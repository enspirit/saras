// On the prompts page: when the AI writes a proposal, and which prompt it writes with.

import type { Organization } from '../../shared/organization.ts';
import { WRITING } from '../../shared/organization.ts';
import { changeOrganizationSettings } from '../api/settings.ts';
import { t, tRich } from '../i18n.ts';
import { showPage } from '../navigation.ts';
import { SubmitForm, toast } from './actions.ts';
import { Button } from '../ui/atoms/button.ts';
import { Select } from '../ui/atoms/input.ts';
import { Link, List, Strong, Text } from '../ui/atoms/text.ts';
import { Card, CardSection } from '../ui/molecules/card.ts';
import { Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';

/** Writing is named as in getting started. */
const WRITING_LABEL = { none: 'welcome.writingNone', draft: 'welcome.writingDraft', mailbox: 'welcome.writingMailbox' };

/** ChooseWriting. */
function writingForm(org: Organization): HTMLFormElement {
  const writing = Select(WRITING.map((value) => ({ value, label: t(WRITING_LABEL[value]), selected: org.writing === value })));
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    await changeOrganizationSettings({ writing: writing.value });
    toast(t('settings.saved'));
    showPage();
  }, Field(t('organization.writing'), writing, { hint: t('organization.writingHint') }), Actions(save));
}

/** Which prompt a proposal is written with: who chooses it, and when. What applies now is said first. */
const whichPrompt = (org: Organization): HTMLDivElement =>
  CardSection(t('prompts.whichTitle'),
    Text({}, Strong(t(org.sorting === 'ai' ? 'prompts.whichNowAi' : 'prompts.whichNowNone'))),
    List([
      tRich('prompts.whichSuggested', {}, { link: (label) => Link(label, '#/attributes/edit/status') }),
      t('prompts.whichMember'),
      t('prompts.whichAtFetch'),
    ]));

/** When the AI writes, and with which prompt. */
export const promptUseCard = (org: Organization): HTMLDivElement => Card({ title: t('prompts.useTitle'), form: true }, writingForm(org), whichPrompt(org));
