// Making an attribute, or changing one: what it is, its values and their colours, and how it is
// decided when an email is sorted — by hand, by a rule written in Elo, by the AI.

import { ATTRIBUTE_KINDS, DECIDERS, STATUS, VALUE_COLORS } from '../../shared/attribute.ts';
import type { Attribute, AttributeGiven, AttributeKind, Decider, ValueColor } from '../../shared/attribute.ts';
import { createAttribute, deleteAttribute, editAttribute, readAttributes, sortAgainByRule } from '../api/attributes.ts';
import { t } from '../i18n.ts';
import { ActionButton, confirmAction, guard, SubmitForm, toast } from './actions.ts';
import { attributeName, valueLabel } from './attribute-names.ts';
import { ruleSection } from './attribute-rule.ts';
import type { EloEditorMaker } from './attribute-rule.ts';
import { DECIDER_LABEL } from './attributes.ts';
import { briefCard, fieldsCard, skillCard } from './rule-aside.ts';
import { shell } from './shell.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import { Input, Select } from '../ui/atoms/input.ts';
import { Text } from '../ui/atoms/text.ts';
import { Card } from '../ui/molecules/card.ts';
import { Choices } from '../ui/molecules/choices.ts';
import type { ChoicesHandle } from '../ui/molecules/choices.ts';
import type { EloEditorHandle } from '../ui/molecules/elo-editor.ts';
import { Block, Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { ValueEditor } from '../ui/molecules/value-editor.ts';
import type { ValueEditorHandle } from '../ui/molecules/value-editor.ts';
import { Columns, Page } from '../ui/organisms/page.ts';

const KIND_LABEL: Record<AttributeKind, string> = { choice: 'attributes.kindChoice', member: 'attributes.kindMember' };
const DECIDER_HINT: Record<Decider, string> = { nobody: 'attributes.hintNobody', elo: 'attributes.hintElo', ai: 'attributes.hintAi', eloAi: 'attributes.hintEloAi' };

const COLOR_NAME: Record<ValueColor, string> = { grey: 'attributes.color.grey', red: 'attributes.color.red', orange: 'attributes.color.orange', yellow: 'attributes.color.yellow', green: 'attributes.color.green', blue: 'attributes.color.blue', purple: 'attributes.color.purple' };

interface AttributeFields {
  name: HTMLInputElement;
  kind: HTMLSelectElement;
  values: ValueEditorHandle;
  decidedBy: ChoicesHandle;
}

/** The values of a choice, to type and colour; those of a pre-configured attribute are shown as they are. */
const valuesField = (attribute: Attribute | null): ValueEditorHandle => ValueEditor({
  values: attribute?.kind === 'choice' ? attribute.values.map((value) => ({ label: valueLabel(attribute, value), color: value.color ?? 'grey' })) : [],
  colors: VALUE_COLORS,
  fixed: attribute?.system,
  placeholder: t('attributes.addValue'),
  colorLabel: (label) => t('attributes.colorOf', { label }),
  colorName: (color) => t(COLOR_NAME[color]),
  removeLabel: (label) => t('attributes.removeValue', { label }),
});

/** Who decides: the four ways, each explained. The AI decides the two pre-configured attributes only, for now. */
const decidedByField = (attribute: Attribute | null): ChoicesHandle => Choices({
  legend: t('attributes.decidedBy'),
  name: 'decidedBy',
  value: attribute?.decidedBy ?? 'nobody',
  options: DECIDERS.map((decider) => {
    const notYet = !attribute?.system && (decider === 'ai' || decider === 'eloAi');
    // Where an email stands is the one thing the AI is asked at sorting: what that costs and sends is said there.
    const hint = notYet ? 'attributes.hintNotYet' : decider === 'ai' && attribute?.key === STATUS ? 'attributes.hintAiSorting' : DECIDER_HINT[decider];
    return { value: decider, title: t(DECIDER_LABEL[decider]), hint: t(hint), disabled: notYet };
  }),
});

/** The fields. Of a pre-configured attribute only how it is decided can be changed. */
const attributeFields = (attribute: Attribute | null): AttributeFields => ({
  name: Input({ required: true, maxLength: 60, value: attribute ? attributeName(attribute) : '', disabled: attribute?.system }),
  kind: Select(ATTRIBUTE_KINDS.map((kind) => ({ value: kind, label: t(KIND_LABEL[kind]), selected: attribute?.kind === kind })), { disabled: attribute?.system }),
  values: valuesField(attribute),
  decidedBy: decidedByField(attribute),
});

const written = (f: AttributeFields, elo: EloEditorHandle): AttributeGiven =>
  ({ name: f.name.value, kind: f.kind.value as AttributeKind, values: f.values.values(), decidedBy: f.decidedBy.value() as Decider, elo: elo.value() });

/** EditAttribute then SortAgainByRule, once confirmed: the rule as written here is kept, then applied to the emails already kept. */
const sortAgainButton = (attribute: Attribute, given: () => AttributeGiven): HTMLButtonElement => ActionButton(t('attributes.sortAgain'), t('attributes.sortingAgain'), async () => {
  if (!(await confirmAction(t('attributes.confirmSortAgain', { name: attributeName(attribute) }), t('attributes.sortAgain'), false))) return;
  await editAttribute(attribute.key, given());
  const { examined, changed } = await sortAgainByRule(attribute.key);
  toast(t('attributes.sortedAgain', { examined, changed }));
}, { icon: 'refresh-cw' });

/** DeleteAttribute, once confirmed. */
const deleteButton = (attribute: Attribute): HTMLButtonElement => ActionButton(t('attributes.delete'), '…', async () => {
  if (!(await confirmAction(t('attributes.confirmDelete', { name: attribute.name }), t('attributes.delete')))) return;
  await deleteAttribute(attribute.key);
  location.hash = '#/attributes';
}, { variant: 'danger' });

/** CreateAttribute or EditAttribute, then back to the list. */
function attributeForm(attribute: Attribute | null, EloEditor: EloEditorMaker): { form: HTMLFormElement; editor: EloEditorHandle } {
  const f = attributeFields(attribute);
  const { section, editor } = ruleSection(attribute, EloEditor, () => f.values.values());
  const given = (): AttributeGiven => written(f, editor);
  const save = Button(attribute ? t('common.save') : t('attributes.create'), { variant: 'primary', type: 'submit' });
  const form = SubmitForm(save, '…', async () => {
    await (attribute ? editAttribute(attribute.key, given()) : createAttribute(given()));
    toast(t('attributes.saved'));
    location.hash = '#/attributes';
  },
    Field(t('attributes.name'), f.name, { hint: attribute?.system && t('attributes.fixed') }),
    Field(t('attributes.kind'), f.kind),
    Field(t('attributes.values'), f.values.element, { hint: !attribute?.system && t('attributes.valuesHint') }),
    f.decidedBy.element,
    section,
    attribute && Block(Text({ muted: true, small: true }, t('attributes.sortAgainHint'))),
    Actions(save, attribute && sortAgainButton(attribute, given), ButtonLink(t('common.cancel'), { href: '#/attributes' }), attribute && !attribute.system && deleteButton(attribute)),
  );
  return { form, editor };
}

/** The form for a new attribute, or with `key` for one of the organisation's; beside it, what helps write its rule. */
export const editAttributePage = guard(async (key: string | null) => {
  const attribute = (await readAttributes()).find((a) => a.key === key) ?? null;
  // The editor is loaded with this page only: it is by far the heaviest thing the interface has.
  const { EloEditor } = await import('../ui/molecules/elo-editor.ts');
  const { form, editor } = attributeForm(attribute, EloEditor);
  shell(Page(
    PageHeader({ title: attribute ? t('attributes.editTitle', { name: attributeName(attribute) }) : t('attributes.newTitle'), intro: t('attributes.formIntro'), crumbs: [{ label: t('attributes.title'), href: '#/attributes' }] }),
    Columns(Card({}, form), [fieldsCard((path) => editor.insert(path)), briefCard({ label: t('rules.guideMore'), href: '#/attributes/guide' }), skillCard(attribute)]),
  ));
});
