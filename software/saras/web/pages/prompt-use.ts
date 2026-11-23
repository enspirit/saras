// On the page of the prompts: when the AI writes a proposal.

import type { Organization } from '../../shared/organization.ts';
import { WRITING } from '../../shared/organization.ts';
import { changeOrganizationSettings } from '../api/settings.ts';
import { t } from '../i18n.ts';
import { showPage } from '../navigation.ts';
import { SubmitForm, toast } from './actions.ts';
import { Button } from '../ui/atoms/button.ts';
import { Card } from '../ui/molecules/card.ts';
import { Choices } from '../ui/molecules/choices.ts';
import { Actions } from '../ui/molecules/form.ts';

/** Each way of writing, and what it means for what the AI is sent: `title` and `hint` are translation keys. */
const WAYS = {
  none: { title: 'welcome.writingNone', hint: 'prompts.writingNoneHint' },
  draft: { title: 'welcome.writingDraft', hint: 'prompts.writingDraftHint' },
  mailbox: { title: 'welcome.writingMailbox', hint: 'prompts.writingMailboxHint' },
};

/** ChooseWriting. */
function writingForm(org: Organization): HTMLFormElement {
  const writing = Choices({ legend: t('prompts.writingLegend'), name: 'writing', value: org.writing, options: WRITING.map((value) => ({ value, title: t(WAYS[value].title), hint: t(WAYS[value].hint) })) });
  const save = Button(t('common.save'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    await changeOrganizationSettings({ writing: writing.value() });
    toast(t('settings.saved'));
    showPage();
  }, writing.element, Actions(save));
}

/** When the AI writes. */
export const promptUse = (org: Organization): HTMLElement => Card({}, writingForm(org));
