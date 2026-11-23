// Making an attribute, or changing one: what it is, and how it is decided when an email is
// sorted — by nobody, by a rule written in Elo, by the AI. A rule can be tried before it is kept.

import { ATTRIBUTE_KINDS, DECIDERS } from '../../shared/attribute.ts';
import type { Attribute, AttributeGiven, AttributeKind, Decider, RuleTried } from '../../shared/attribute.ts';
import { createAttribute, deleteAttribute, editAttribute, readAttributes, tryRule } from '../api/attributes.ts';
import { t, tRich } from '../i18n.ts';
import { ActionButton, confirmAction, guard, SubmitForm, toast } from './actions.ts';
import { attributeName, valueLabel } from './attribute-names.ts';
import { DECIDER_LABEL } from './attributes.ts';
import { shell } from './shell.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import { Input, Select, Textarea } from '../ui/atoms/input.ts';
import { Code, Link, Muted, Text } from '../ui/atoms/text.ts';
import { Card, CardSection } from '../ui/molecules/card.ts';
import { Block, Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Table } from '../ui/molecules/table.ts';
import { Page } from '../ui/organisms/page.ts';

const KIND_LABEL: Record<AttributeKind, string> = { choice: 'attributes.kindChoice', member: 'attributes.kindMember' };

interface AttributeFields {
  name: HTMLInputElement;
  kind: HTMLSelectElement;
  values: HTMLTextAreaElement;
  decidedBy: HTMLSelectElement;
  elo: HTMLTextAreaElement;
}

/** The AI decides the two pre-configured attributes only, for now. */
const decidersFor = (attribute: Attribute | null): readonly Decider[] => (attribute?.system ? DECIDERS : ['nobody', 'elo']);

/** The fields. Of a pre-configured attribute only how it is decided can be changed. */
const attributeFields = (attribute: Attribute | null): AttributeFields => ({
  name: Input({ required: true, maxLength: 60, value: attribute ? attributeName(attribute) : '', disabled: attribute?.system }),
  kind: Select(ATTRIBUTE_KINDS.map((kind) => ({ value: kind, label: t(KIND_LABEL[kind]), selected: attribute?.kind === kind })), { disabled: attribute?.system }),
  values: Textarea({ rows: 5, value: attribute?.kind === 'choice' ? attribute.values.map((value) => valueLabel(attribute, value)).join('\n') : '', disabled: attribute?.system }),
  decidedBy: Select(decidersFor(attribute).map((decider) => ({ value: decider, label: t(DECIDER_LABEL[decider]), selected: attribute?.decidedBy === decider }))),
  elo: Textarea({ tall: true, value: attribute?.elo ?? '', spellcheck: false, placeholder: t('attributes.ruleExample') }),
});

const valuesTyped = (f: AttributeFields): string[] => f.values.value.split('\n').map((line) => line.trim()).filter(Boolean);

const written = (f: AttributeFields): AttributeGiven => ({ name: f.name.value, kind: f.kind.value as AttributeKind, values: valuesTyped(f), decidedBy: f.decidedBy.value as Decider, elo: f.elo.value });

/** What the rule says of recent emails, shown under it. */
const triedTable = (tried: RuleTried[]): HTMLDivElement =>
  Table({ title: t('attributes.triedTitle'), columns: [t('attributes.triedEmail'), t('attributes.triedValue')] }, tried.map((one) => [[one.subject || t('mailbox.noSubject'), ' ', Muted(one.from)], one.value ?? Muted(t('attributes.triedNothing'))]));

/** The rule: what it is given, where Elo is explained, and a way to see it at work on recent emails before it is kept. */
function ruleSection(attribute: Attribute | null, f: AttributeFields): HTMLDivElement {
  const section = CardSection(t('attributes.ruleTitle'),
    Block(Text({ muted: true, small: true }, tRich('attributes.ruleIntro', {}, { link: (label) => Link(label, 'https://elo-lang.org'), code: Code }))),
    Field(null, f.elo, { hint: t('attributes.ruleGiven') }),
    Actions(ActionButton(t('attributes.try'), '…', async () => {
      const tried = triedTable(await tryRule(f.elo.value, attribute?.key ?? null, valuesTyped(f)));
      section.lastElementChild?.replaceWith(tried);
    }, { icon: 'search' })),
    Block(Text({ muted: true, small: true }, t('attributes.tryHint'))),
  );
  return section;
}

/** DeleteAttribute, once confirmed. */
const deleteButton = (attribute: Attribute): HTMLButtonElement => ActionButton(t('attributes.delete'), '…', async () => {
  if (!(await confirmAction(t('attributes.confirmDelete', { name: attribute.name }), t('attributes.delete')))) return;
  await deleteAttribute(attribute.key);
  location.hash = '#/attributes';
}, { variant: 'danger' });

/** CreateAttribute or EditAttribute, then back to the list. */
function attributeForm(attribute: Attribute | null, f: AttributeFields): HTMLFormElement {
  const save = Button(attribute ? t('common.save') : t('attributes.create'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    await (attribute ? editAttribute(attribute.key, written(f)) : createAttribute(written(f)));
    toast(t('attributes.saved'));
    location.hash = '#/attributes';
  },
    Field(t('attributes.name'), f.name, { hint: attribute?.system && t('attributes.fixed') }),
    Field(t('attributes.kind'), f.kind),
    Field(t('attributes.values'), f.values, { hint: t('attributes.valuesHint') }),
    Field(t('attributes.decidedBy'), f.decidedBy, { hint: t('attributes.decidedByHint') }),
    ruleSection(attribute, f),
    Actions(save, ButtonLink(t('common.cancel'), { href: '#/attributes' }), attribute && !attribute.system && deleteButton(attribute)),
  );
}

/** The form for a new attribute, or with `key` for one of the organisation's. */
export const editAttributePage = guard(async (key: string | null) => {
  const attribute = (await readAttributes()).find((a) => a.key === key) ?? null;
  const fields = attributeFields(attribute);
  shell(Page(
    PageHeader({ title: attribute ? t('attributes.editTitle', { name: attributeName(attribute) }) : t('attributes.newTitle'), intro: t('attributes.formIntro'), crumbs: [{ label: t('attributes.title'), href: '#/attributes' }] }),
    Card({ form: true }, attributeForm(attribute, fields)),
  ));
});
