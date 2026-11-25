// Having the assistant propose a configuration (administrators): say what the organisation
// does, answer what it asks, read what it proposes, and apply what one keeps of it.

import type { ConfigurationProposed, ConfigurationWanted, Question } from '../../shared/advice.ts';
import { attributeConfiguredAs, sameName } from '../../shared/configuration.ts';
import type { Configuration } from '../../shared/configuration.ts';
import { sortAgainByRule } from '../api/attributes.ts';
import { applyConfiguration, proposeConfiguration } from '../api/configuration.ts';
import { t } from '../i18n.ts';
import { refreshAttributes, refreshBoards } from '../session.ts';
import { ActionButton, guard, SubmitForm, toast } from './actions.ts';
import { proposedConfiguration } from './proposed-configuration.ts';
import { shell } from './shell.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import { Checkbox, Input, Textarea } from '../ui/atoms/input.ts';
import { Slot } from '../ui/atoms/slot.ts';
import type { SlotHandle } from '../ui/atoms/slot.ts';
import { Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Callout } from '../ui/molecules/callout.ts';
import { Card } from '../ui/molecules/card.ts';
import { Block, CheckField, Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Page } from '../ui/organisms/page.ts';

/** ProposeConfiguration, then what it answered: its questions, or what it proposes. */
async function ask(stage: SlotHandle, wanted: ConfigurationWanted): Promise<void> {
  const advice = await proposeConfiguration(wanted);
  if (advice.kind === 'questions') asking(stage, wanted, advice.questions);
  else proposing(stage, wanted, advice);
}

/** The first step: what the organisation does and how it handles its mail, in its administrator's words. */
function describing(stage: SlotHandle, description: string): void {
  const said = Textarea({ value: description, tall: true, required: true, maxLength: 4000, placeholder: t('assistant.placeholder') });
  const submit = Button(t('assistant.propose'), { variant: 'primary', type: 'submit' });
  stage.show(SubmitForm(submit, t('assistant.proposing'), () => ask(stage, { description: said.value, answers: [] }),
    Card({ form: true },
      Field(t('assistant.description'), said, { hint: t('assistant.descriptionHint') }),
      Block(Text({ muted: true, small: true }, t('assistant.sent')))),
    Actions(submit, ButtonLink(t('common.cancel'), { href: '#/attributes' })),
  ));
}

/** One question, with where its answer is written and the answers offered: a click writes one. */
function questionField({ question, choices }: Question): { answer: HTMLInputElement; parts: Child[] } {
  const answer = Input({ maxLength: 600 });
  const offered = choices.map((choice) => Button(choice, { size: 'small', onClick: () => (answer.value = choice) }));
  return { answer, parts: [Field(question, answer), offered.length > 0 && Block(Actions(offered))] };
}

/** The assistant's questions, asked once: answered or not, a proposal follows. */
function asking(stage: SlotHandle, { description }: ConfigurationWanted, questions: Question[]): void {
  const fields = questions.map(questionField);
  const answers = () => questions.map(({ question }, place) => ({ question, answer: fields[place]?.answer.value ?? '' }));
  const submit = Button(t('assistant.continue'), { variant: 'primary', type: 'submit' });
  stage.show(SubmitForm(submit, t('assistant.proposing'), () => ask(stage, { description, answers: answers() }),
    Card({ form: true, title: t('assistant.questionsTitle') }, Block(Text({ muted: true, small: true }, t('assistant.questionsIntro'))), fields.map(({ parts }) => parts)),
    Actions(submit, Button(t('assistant.startAgain'), { onClick: () => describing(stage, description) })),
  ));
}

/** SortAgainByRule for each attribute applied that a rule decides: so that the emails already kept show on the boards. */
async function sortKeptEmails({ attributes }: Configuration): Promise<void> {
  const now = await refreshAttributes();
  for (const { name, decidedBy } of attributes) {
    const attribute = now.find((one) => sameName(attributeConfiguredAs(one), name));
    if (attribute && decidedBy === 'elo') await sortAgainByRule(attribute.key);
  }
}

/** ApplyConfiguration with what is ticked, then back to the attributes. */
async function apply(kept: Configuration, sortKept: boolean): Promise<void> {
  await applyConfiguration(kept);
  if (sortKept) await sortKeptEmails(kept);
  await Promise.all([refreshAttributes(), refreshBoards()]);
  toast(t('assistant.applied'));
  location.hash = '#/attributes';
}

/** What is proposed, to read; then what is ticked of it is applied, or one starts again. */
function proposing(stage: SlotHandle, { description }: ConfigurationWanted, { summary, configuration }: ConfigurationProposed): void {
  const proposed = proposedConfiguration(configuration);
  const again = Button(t('assistant.startAgain'), { onClick: () => describing(stage, description) });
  if (proposed.cards.length === 0) return stage.show(Callout('info', summary || t('assistant.nothing')), Actions(again, ButtonLink(t('assistant.back'), { href: '#/attributes' })));
  const sortKept = Checkbox({ checked: true });
  const byRule = configuration.attributes.some(({ decidedBy }) => decidedBy === 'elo');
  stage.show(
    summary && Callout('info', summary),
    proposed.cards,
    byRule && CheckField(t('assistant.sortKept'), sortKept, { hint: t('assistant.sortKeptHint') }),
    Actions(ActionButton(t('assistant.apply'), t('assistant.applying'), () => apply(proposed.kept(), byRule && sortKept.checked), { variant: 'primary' }), again),
  );
}

export const configurationAssistantPage = guard(async () => {
  const stage = Slot();
  shell(Page(PageHeader({ title: t('assistant.title'), intro: t('assistant.intro'), crumbs: [{ label: t('attributes.title'), href: '#/attributes' }] }), stage.element));
  describing(stage, '');
});
