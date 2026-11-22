// The way-of-working step of getting started: choosing how the tool works for the team, then
// on to a first email sorted and prepared that way.

import { fetchMailbox, readMailboxes } from '../../api/mailboxes.ts';
import { chooseWayOfWorking } from '../../api/settings.ts';
import { sortAgainUnsorted } from '../../api/sorting.ts';
import { t } from '../../i18n.ts';
import { ActionButton, guard } from '../actions.ts';
import { leaveStep, PathSteps } from './path.ts';
import { shell } from '../shell.ts';
import { me, refreshMe } from '../../session.ts';
import { Text } from '../../ui/atoms/text.ts';
import { Card } from '../../ui/molecules/card.ts';
import { Choices } from '../../ui/molecules/choices.ts';
import type { ChoicesHandle } from '../../ui/molecules/choices.ts';
import { Actions } from '../../ui/molecules/form.ts';
import { PageHeader } from '../../ui/molecules/page-header.ts';
import { Page } from '../../ui/organisms/page.ts';

/** The four ways. Without a key the AI can do nothing: only the first can be chosen, and the others say why. */
function waysChoice(): ChoicesHandle {
  const hasKey = me().hasKey;
  const withAi = (hint: string) => ({ hint: hasKey ? hint : t('welcome.needsKey'), disabled: !hasKey });
  return Choices({ legend: t('welcome.workLegend'), name: 'way', value: hasKey ? me().organization.way : 'manual', options: [
    { value: 'manual', title: t('welcome.manual'), hint: t('welcome.manualHint') },
    { value: 'sort', title: t('welcome.sort'), ...withAi(t('welcome.sortHint')) },
    { value: 'draft', title: t('welcome.draft'), ...withAi(t('welcome.draftHint')) },
    { value: 'mailbox', title: t('welcome.mailbox'), ...withAi(t('welcome.mailboxHint')) },
  ] });
}

/** ChooseWayOfWorking, then SortAgainUnsorted and a fetch: what the first fetch let through is sorted again the chosen way, and prepared if asked. */
async function applyWay(way: string): Promise<void> {
  await chooseWayOfWorking(way);
  await sortAgainUnsorted();
  await refreshMe();
  for (const account of await readMailboxes()) if (account.folder) await fetchMailbox(account.id);
  leaveStep('work');
}

/** Choosing how the tool works for the team, then on to a first email sorted and prepared that way. */
export const wayOfWorkingPage = guard(async () => {
  const ways = waysChoice();
  const finish = ActionButton(t('welcome.finish'), t('mailbox.refreshing'), () => applyWay(ways.value()), { variant: 'primary' });
  shell(Page(
    PathSteps('work'),
    PageHeader({ title: t('welcome.workTitle'), intro: t('welcome.workIntro') }),
    Card({}, ways.element, Text({ muted: true, small: true }, t('welcome.workLater'))),
    Actions(finish),
  ));
});
