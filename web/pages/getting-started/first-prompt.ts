// The prompt step of getting started: the prompt an organisation starts with, to read and
// adjust, and the other ready-made ones beside it.

import type { Prompt } from '../../../shared/prompt.ts';
import { createPrompt, editPrompt, readPrompts, readPromptTemplates } from '../../api/prompts.ts';
import { t } from '../../i18n.ts';
import { guard, SubmitForm } from '../actions.ts';
import { promptFields } from '../edit-prompt.ts';
import type { PromptFields } from '../edit-prompt.ts';
import { leaveStep, PathSteps } from './path.ts';
import { ReadyMadePrompts } from '../ready-made-prompts.ts';
import { shell } from '../shell.ts';
import { Button } from '../../ui/atoms/button.ts';
import { Text } from '../../ui/atoms/text.ts';
import { Card } from '../../ui/molecules/card.ts';
import { Block } from '../../ui/molecules/field.ts';
import { Actions } from '../../ui/molecules/form.ts';
import { PageHeader } from '../../ui/molecules/page-header.ts';
import { Columns, Page } from '../../ui/organisms/page.ts';

/** EditPrompt on the organisation's first prompt (CreatePrompt when it has none), then on with the path. */
function firstPromptForm(first: Prompt | undefined, { fields, content }: PromptFields): HTMLFormElement {
  const next = Button(t('welcome.continue'), { variant: 'primary', type: 'submit' });
  return SubmitForm(next, '…', async () => {
    await (first ? editPrompt(first.id, content()) : createPrompt(content()));
    leaveStep('prompt');
  },
    fields,
    Actions(next),
  );
}

/** The prompt an organisation starts with, to read and adjust, and the other ready-made ones beside it. */
export const firstPromptPage = guard(async () => {
  const [prompts, templates] = await Promise.all([readPrompts(), readPromptTemplates()]);
  const form = firstPromptForm(prompts[0], promptFields(prompts[0], 7));
  shell(Page(
    PathSteps('prompt'),
    PageHeader({ title: t('welcome.promptTitle'), intro: t('welcome.promptIntro') }),
    templates.length ? Columns(Card({}, form), [Block(Text({ muted: true, small: true }, t('prompts.templatesHint'))), ReadyMadePrompts(templates)]) : Card({ form: true }, form),
  ));
});
