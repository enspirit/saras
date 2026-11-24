// The way-of-working step of getting started: the administrator chooses when the AI writes a
// proposal of reply, then goes on to a first email prepared that way.

import { fetchMailbox, readMailboxes } from '../../api/mailboxes.ts';
import { changeOrganizationSettings } from '../../api/settings.ts';
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

/** When a proposal is written for an email to handle. */
const writingChoice = (): ChoicesHandle =>
  Choices({ legend: t('welcome.writingLegend'), name: 'writing', value: me().hasKey ? me().organization.writing : 'none', options: [
    { value: 'none', title: t('welcome.writingNone'), hint: t('welcome.writingNoneHint') },
    { value: 'draft', title: t('welcome.writingDraft'), ...withAi(t('welcome.writingDraftHint')) },
    { value: 'mailbox', title: t('welcome.writingMailbox'), ...withAi(t('welcome.writingMailboxHint')) },
  ] });

/** ChooseWriting, then a fetch: what the first fetch brought in is prepared if asked. */
async function apply(writing: string): Promise<void> {
  await changeOrganizationSettings({ writing });
  await refreshMe();
  for (const mailbox of await readMailboxes()) if (mailbox.folder) await fetchMailbox(mailbox.id);
  leaveStep('work');
}

/** Choosing when the AI writes, then on to a first email prepared that way. */
export const wayOfWorkingPage = guard(async () => {
  const writing = writingChoice();
  const finish = ActionButton(t('welcome.finish'), t('mailbox.refreshing'), () => apply(writing.value()), { variant: 'primary' });
  shell(Page(
    PathSteps('work'),
    PageHeader({ title: t('welcome.workTitle'), intro: t('welcome.workIntro') }),
    Card({}, Block(Text({ muted: true }, t('welcome.writingIntro'))), writing.element),
    Callout('info', t('welcome.workLater')),
    Actions(finish),
  ));
});
