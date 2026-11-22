// The prompts of the organisation (administrators): the list, how much each is used, and the
// ready-made ones still to add.

import type { Prompt } from '../../shared/prompt.ts';
import { deletePrompt, readPrompts, readPromptTemplates } from '../api/prompts.ts';
import { t } from '../i18n.ts';
import { ActionButton, confirmAction, guard } from './actions.ts';
import { editPromptPage } from './edit-prompt.ts';
import { ReadyMadePrompts } from './ready-made-prompts.ts';
import { shell } from './shell.ts';
import { ButtonLink } from '../ui/atoms/button.ts';
import { Muted, Strong, Text } from '../ui/atoms/text.ts';
import { Block } from '../ui/molecules/field.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Table } from '../ui/molecules/table.ts';
import { Page } from '../ui/organisms/page.ts';

/** DeletePrompt, once confirmed. */
const deleteButton = (p: Prompt): HTMLButtonElement => ActionButton(t('common.delete'), '…', async () => {
  if (!(await confirmAction(t('prompts.confirmDelete', { name: p.name }), t('common.delete')))) return;
  await deletePrompt(p.id);
  void promptsPage();
}, { variant: 'danger', size: 'small', icon: 'trash', iconOnly: true });

/** Each prompt, how often it was used and how often its proposals were changed. */
const promptsTable = (prompts: Prompt[]): HTMLDivElement =>
  Table({ columns: [t('prompts.column'), t('prompts.usageColumn')], actions: t('common.actions') }, prompts.map((p) => [
    [Strong(p.name), p.description && Text({ muted: true, small: true }, p.description)],
    (p.used ?? 0) > 0 ? t('prompts.usage', { used: p.used ?? 0, edited: p.edited ?? 0 }) : Muted(t('prompts.unused')),
    [ButtonLink(t('common.edit'), { href: `#/prompts/${p.id}` }), deleteButton(p)],
  ]));

/** The list of prompts, or with `open` one of them (or a new one) being edited. */
export const promptsPage = guard(async (open: number | 'new' | null = null) => {
  const [prompts, templates] = await Promise.all([readPrompts(), readPromptTemplates()]);
  const prompt = typeof open === 'number' ? prompts.find((p) => p.id === open) ?? null : null;
  if (open !== null && (open === 'new' || prompt)) return editPromptPage(prompt);

  shell(
    Page(
      PageHeader({ title: t('prompts.title'), intro: t('prompts.intro') }, ButtonLink(t('prompts.new'), { href: '#/prompts/new', variant: 'primary' })),
      promptsTable(prompts),
      templates.length > 0 && [Block(Text({ muted: true }, t('prompts.templatesHint'))), ReadyMadePrompts(templates, () => void promptsPage())],
    ),
  );
});
