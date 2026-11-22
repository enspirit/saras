// Getting started is a path. Everyone connects a mailbox and chooses its folder; whoever
// administers the organisation is then shown what a newcomer would not find alone: the AI's
// key when there is none, the prompt, and how the tool works for the team. It ends on a first email.

import { readBox } from '../../api/emails.ts';
import { t } from '../../i18n.ts';
import { guard } from '../actions.ts';
import { isAdmin, needsKey } from '../../session.ts';
import { Steps } from '../../ui/molecules/steps.ts';

export type PathStep = 'connect' | 'folder' | 'key' | 'prompt' | 'work' | 'read';

const STEP_LABEL: Record<PathStep, string> = { connect: 'accounts.step1', folder: 'accounts.step2', key: 'accounts.stepKey', prompt: 'welcome.stepPrompt', work: 'welcome.stepWork', read: 'accounts.step3' };
const pathOf = (withKey: boolean): PathStep[] => ['connect', 'folder', ...(withKey ? (['key'] as const) : []), ...(isAdmin() ? (['prompt', 'work'] as const) : []), 'read'];

/** The path as shown at the top of each of its pages. */
export function PathSteps(at: PathStep): HTMLOListElement {
  const steps = pathOf(needsKey() || at === 'key');
  return Steps(steps.map((step) => t(STEP_LABEL[step])), steps.indexOf(at));
}

/** Where the path goes after `at`. */
export function leaveStep(at: PathStep): void {
  const steps = pathOf(needsKey());
  const next = steps[steps.indexOf(at) + 1] ?? 'read';
  if (next === 'read') void openFirstEmail();
  else location.hash = `#/welcome/${next}`;
}

/** The end of the path: the first email to handle, open, or the box that has something to show. */
export const openFirstEmail = guard(async () => {
  const { emails } = await readBox('todo');
  if (emails[0]) return void (location.hash = `#/inbox/${emails[0].id}?welcome`);
  const { emails: prepared } = await readBox('sent');
  location.hash = prepared.length ? '#/replied' : '#/inbox';
});
