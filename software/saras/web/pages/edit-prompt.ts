// Writing a prompt, new or existing: its name, when to use it, its instructions, the emails it
// suits; and beside the instructions, what members changed in the proposals it wrote.

import type { Attribute } from '../../shared/attribute.ts';
import type { Correction, Prompt } from '../../shared/prompt.ts';
import { readAttributes } from '../api/attributes.ts';
import { createPrompt, editPrompt, readCorrections } from '../api/prompts.ts';
import type { PromptContent } from '../api/prompts.ts';
import { t } from '../i18n.ts';
import { fmtWhen } from '../i18n/dates.ts';
import { showPage } from '../navigation.ts';
import { SubmitForm, toast } from './actions.ts';
import { attributeConditions } from './attribute-conditions.ts';
import { called } from './people.ts';
import { shell } from './shell.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Button } from '../ui/atoms/button.ts';
import { Input, Textarea } from '../ui/atoms/input.ts';
import { Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Card, CardSection } from '../ui/molecules/card.ts';
import { Block, Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Remark } from '../ui/molecules/remark.ts';
import { Columns, Page } from '../ui/organisms/page.ts';

export interface PromptFields {
  name: HTMLInputElement;
  /** The three fields under their labels, in the order of the form. */
  fields: Child[];
  /** What was written, as the server expects it. */
  content(): PromptContent;
}

/**
 * The fields of a prompt, filled with `prompt` when there is one. `rows` is the height of the
 * instructions. With the organisation's `attributes`, the emails the prompt suits can be said;
 * without, what it had is kept.
 */
export function promptFields(prompt: Prompt | null | undefined, rows: number, attributes?: Attribute[]): PromptFields {
  const suits = attributes && attributeConditions(prompt?.affinity ?? {}, attributes, t('prompts.suitsAny'));
  const name = Input({ required: true, value: prompt?.name || '' });
  const description = Input({ value: prompt?.description || '' });
  const system = Textarea({ required: true, rows, value: prompt?.systemPrompt || '' });
  return {
    name,
    fields: [
      Field(t('prompts.name'), name),
      Field(t('prompts.when'), description, { hint: t('prompts.whenHint') }),
      Field(t('prompts.instructions'), system, { hint: t('prompts.instructionsHint') }),
      suits && CardSection(t('prompts.suits'), Block(Text({ muted: true, small: true }, t('prompts.suitsHint'))), suits.element),
    ],
    content: () => ({ name: name.value, description: description.value, systemPrompt: system.value, affinity: suits ? suits.values() : (prompt?.affinity ?? {}) }),
  };
}

/** Back to the list of prompts. */
const backToPrompts = (): void => void (location.hash === '#/prompts' ? showPage() : (location.hash = '#/prompts'));

/** CreatePrompt or EditPrompt, then back to the list. */
function promptForm(prompt: Prompt | null, { fields, content }: PromptFields): HTMLFormElement {
  const save = Button(prompt ? t('common.save') : t('prompts.create'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    await (prompt ? editPrompt(prompt.id, content()) : createPrompt(content()));
    toast(t('prompts.saved'));
    backToPrompts();
  },
    fields,
    Actions(save, Button(t('common.cancel'), { onClick: backToPrompts })),
  );
}

/** What members changed in this prompt's proposals: it sits beside the instructions it should feed. */
const correctionsCard = (items: Correction[]): HTMLDivElement =>
  Card({ title: t('prompts.corrections'), badges: [items.length > 0 && Badge(String(items.length))] },
    Block(Text({ muted: true, small: true }, t('prompts.correctionsHint'))),
    items.length ? items.map((c) => Remark({ text: c.reason, by: called(c.userName, c.user), meta: `${called(c.userName, c.user)} · ${fmtWhen(c.at)}` })) : Text({ muted: true, small: true }, t('prompts.noCorrections')),
  );

/** The page of one prompt being written: `prompt` is the existing one, or null for a new one. */
export async function editPromptPage(prompt: Prompt | null): Promise<void> {
  const [items, attributes] = await Promise.all([prompt ? readCorrections(prompt.id).catch((): Correction[] => []) : [], readAttributes()]);
  const written = promptFields(prompt, 9, attributes);
  const form = promptForm(prompt, written);
  shell(Page(
    PageHeader({ title: prompt ? t('prompts.edit') : t('prompts.new'), crumbs: [{ label: t('prompts.title'), href: '#/prompts' }] }),
    prompt ? Columns(Card({}, form), correctionsCard(items)) : Card({ form: true }, form),
  ));
  written.name.focus();
}
