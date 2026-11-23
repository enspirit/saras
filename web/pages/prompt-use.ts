// On the page of the prompts: when the AI writes a proposal, and beside it which prompt it writes with.

import type { Organization } from '../../shared/organization.ts';
import { WRITING } from '../../shared/organization.ts';
import { changeOrganizationSettings } from '../api/settings.ts';
import { t } from '../i18n.ts';
import { showPage } from '../navigation.ts';
import { SubmitForm, toast } from './actions.ts';
import { Button } from '../ui/atoms/button.ts';
import { Link, Muted, Small, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Callout } from '../ui/molecules/callout.ts';
import { Choices } from '../ui/molecules/choices.ts';
import { Actions } from '../ui/molecules/form.ts';
import { PartTitle, Points, SplitPanel } from '../ui/molecules/split-panel.ts';

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
  }, writing.element, Actions(save, Muted(Small(t('prompts.writingNothingSent')))));
}

/** Which prompt a proposal is written with: what applies now, then who chooses it, and when. */
const whichPrompt = (org: Organization): Child => [
  PartTitle(t('prompts.whichTitle')),
  Callout('info', t(org.sorting === 'ai' ? 'prompts.whichNowAi' : 'prompts.whichNowNone')),
  Points([
    { title: t('prompts.whichSuggested'), text: t('prompts.whichSuggestedText') },
    { title: t('prompts.whichMember'), text: t('prompts.whichMemberText') },
    { title: t('prompts.whichAtFetch'), text: t('prompts.whichAtFetchText') },
  ]),
  org.sorting !== 'ai' && Text({ small: true }, Link(t('prompts.whichSort'), '#/attributes/edit/status')),
];

/** When the AI writes, and beside it with which prompt. */
export const promptUse = (org: Organization): HTMLElement => SplitPanel(writingForm(org), whichPrompt(org));
