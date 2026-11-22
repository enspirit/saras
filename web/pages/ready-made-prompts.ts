// Ready-made prompts: the ones the organisation does not have yet, to add as they are.

import { addReadyMadePrompt } from '../api/prompts.ts';
import type { PromptTemplate } from '../api/prompts.ts';
import { t } from '../i18n.ts';
import { ActionButton } from './actions.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Strong, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Table } from '../ui/molecules/table.ts';

/** Ready-made prompts not yet added, each with its button. `onAdded` is called after one was. */
export function ReadyMadePrompts(templates: PromptTemplate[], onAdded?: () => void): Child {
  return Table({ columns: [t('prompts.templates')], actions: t('common.actions') }, templates.map((template) => {
    const add: HTMLButtonElement = ActionButton(t('prompts.addTemplate'), '…', async () => {
      await addReadyMadePrompt(template);
      if (onAdded) return onAdded();
      add.replaceWith(Badge(t('prompts.added'), 'ok'));
    }, { size: 'small', icon: 'plus' });
    return [[Strong(template.name), Text({ muted: true, small: true }, template.description)], add];
  }));
}
