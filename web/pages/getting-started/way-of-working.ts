// The way-of-working step of getting started. An email goes through two steps before a member
// replies, sorting then writing: the administrator chooses what the AI does at each, then goes
// on to a first email sorted and prepared that way.

import { fetchMailbox, readMailboxes } from '../../api/mailboxes.ts';
import { chooseSortingAndWriting } from '../../api/settings.ts';
import { sortAgainUnsorted } from '../../api/sorting.ts';
import { t } from '../../i18n.ts';
import { ActionButton, guard } from '../actions.ts';
import { leaveStep, PathSteps } from './path.ts';
import { shell } from '../shell.ts';
import { me, refreshMe } from '../../session.ts';
import { Callout } from '../../ui/molecules/callout.ts';
import { Card } from '../../ui/molecules/card.ts';
import { Choices } from '../../ui/molecules/choices.ts';
import type { ChoicesHandle } from '../../ui/molecules/choices.ts';
import { Block } from '../../ui/molecules/field.ts';
import { Text } from '../../ui/atoms/text.ts';
import { Actions } from '../../ui/molecules/form.ts';
import { PageHeader } from '../../ui/molecules/page-header.ts';
import { Page } from '../../ui/organisms/page.ts';

/** Without a key the AI can do nothing: only what needs none can be chosen, and the rest says why. */
const withAi = (hint: string) => (me().hasKey ? { hint } : { hint: t('welcome.needsKey'), disabled: true });

/** Step 1: who says whether an email needs a reply. */
const sortingChoice = (): ChoicesHandle =>
  Choices({ legend: t('welcome.sortingLegend'), name: 'sorting', value: me().hasKey ? me().organization.sorting : 'none', options: [
    { value: 'none', title: t('welcome.sortingNone'), hint: t('welcome.sortingNoneHint') },
    { value: 'ai', title: t('welcome.sortingAi'), ...withAi(t('welcome.sortingAiHint')) },
  ] });

/** Step 2: when a proposal is written for an email to handle. */
const writingChoice = (): ChoicesHandle =>
  Choices({ legend: t('welcome.writingLegend'), name: 'writing', value: me().hasKey ? me().organization.writing : 'none', options: [
    { value: 'none', title: t('welcome.writingNone'), hint: t('welcome.writingNoneHint') },
    { value: 'draft', title: t('welcome.writingDraft'), ...withAi(t('welcome.writingDraftHint')) },
    { value: 'mailbox', title: t('welcome.writingMailbox'), ...withAi(t('welcome.writingMailboxHint')) },
  ] });

/** ChooseSorting and ChooseWriting, then SortAgainUnsorted and a fetch: what the first fetch let through is sorted again as chosen, and prepared if asked. */
async function apply(sorting: string, writing: string): Promise<void> {
  await chooseSortingAndWriting(sorting, writing);
  await sortAgainUnsorted();
  await refreshMe();
  for (const mailbox of await readMailboxes()) if (mailbox.folder) await fetchMailbox(mailbox.id);
  leaveStep('work');
}

/** One of the two steps: its number and name, what happens at it, and the choice. */
const stepCard = (title: string, intro: string, choice: ChoicesHandle): HTMLDivElement => Card({ title }, Block(Text({ muted: true }, intro)), choice.element);

/** Choosing what the AI does at each step, then on to a first email sorted and prepared that way. */
export const wayOfWorkingPage = guard(async () => {
  const sorting = sortingChoice();
  const writing = writingChoice();
  const finish = ActionButton(t('welcome.finish'), t('mailbox.refreshing'), () => apply(sorting.value(), writing.value()), { variant: 'primary' });
  shell(Page(
    PathSteps('work'),
    PageHeader({ title: t('welcome.workTitle'), intro: t('welcome.workIntro') }),
    stepCard(t('welcome.sortingTitle'), t('welcome.sortingIntro'), sorting),
    stepCard(t('welcome.writingTitle'), t('welcome.writingIntro'), writing),
    Callout('info', t('welcome.workLater')),
    Actions(finish),
  ));
});
