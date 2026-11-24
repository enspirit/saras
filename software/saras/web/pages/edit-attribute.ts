// Making an attribute, or changing one: what it is, its values and their colours, and who decides
// it when an email is sorted — a rule written in Elo, or without one, members by hand.

import { ATTRIBUTE_KINDS, VALUE_COLORS } from '../../shared/attribute.ts';
import type { Attribute, AttributeGiven, AttributeKind, ValueColor } from '../../shared/attribute.ts';
import { createAttribute, deleteAttribute, editAttribute, readAttributes, sortAgainByRule } from '../api/attributes.ts';
import { t } from '../i18n.ts';
import { ActionButton, confirmAction, guard, SubmitForm, toast } from './actions.ts';
import { attributeName, valueLabel } from './attribute-names.ts';
import { ruleSection } from './attribute-rule.ts';
import type { EloEditorMaker } from './attribute-rule.ts';
import { briefCard, fieldsCard } from './rule-aside.ts';
import { shell } from './shell.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import type { Child } from '../ui/dom.ts';
import { Checkbox, Input, Select } from '../ui/atoms/input.ts';
import { Card } from '../ui/molecules/card.ts';
import type { EloEditorHandle } from '../ui/molecules/elo-editor.ts';
import { CheckField, Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { ValueEditor } from '../ui/molecules/value-editor.ts';
import type { ValueEditorHandle } from '../ui/molecules/value-editor.ts';
import { Columns, Page } from '../ui/organisms/page.ts';

const KIND_LABEL: Record<AttributeKind, string> = { choice: 'attributes.kindChoice', member: 'attributes.kindMember' };

const COLOR_NAME: Record<ValueColor, string> = { grey: 'attributes.color.grey', red: 'attributes.color.red', orange: 'attributes.color.orange', yellow: 'attributes.color.yellow', green: 'attributes.color.green', blue: 'attributes.color.blue', purple: 'attributes.color.purple' };

interface AttributeFields {
  name: HTMLInputElement;
  kind: HTMLSelectElement;
  values: ValueEditorHandle;
  /** Ticked when a rule decides it; otherwise members do, by hand. */
  byRule: HTMLInputElement;
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

/** Shows `parts` only while `when` holds, looked at again each time `control` changes. */
function shownWhile(control: HTMLElement, when: () => boolean, parts: HTMLElement[]): void {
  const show = (): void => parts.forEach((part) => (part.hidden = !when()));
  control.addEventListener('change', show);
  show();
}

/** The fields. Of a pre-configured attribute only how it is decided can be changed. */
const attributeFields = (attribute: Attribute | null): AttributeFields => ({
  name: Input({ required: true, maxLength: 60, value: attribute ? attributeName(attribute) : '', disabled: attribute?.system }),
  kind: Select(ATTRIBUTE_KINDS.map((kind) => ({ value: kind, label: t(KIND_LABEL[kind]), selected: attribute?.kind === kind })), { disabled: attribute?.system }),
  values: valuesField(attribute),
  byRule: Checkbox({ checked: attribute?.decidedBy === 'elo' }),
});

const written = (f: AttributeFields, elo: EloEditorHandle): AttributeGiven =>
  ({ name: f.name.value, kind: f.kind.value as AttributeKind, values: f.values.values(), decidedBy: f.byRule.checked ? 'elo' : 'nobody', elo: elo.value() });

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

/** What is asked of an attribute, in the order of the form. The values of a "member" attribute are the members: nothing to type. */
function askedOf(attribute: Attribute | null, f: AttributeFields): Child[] {
  const values = Field(t('attributes.values'), f.values.element, { hint: !attribute?.system && t('attributes.valuesHint') });
  shownWhile(f.kind, () => f.kind.value !== 'member', [values]);
  return [
    Field(t('attributes.name'), f.name, { hint: attribute?.system && t('attributes.fixed') }),
    Field(t('attributes.kind'), f.kind),
    values,
    CheckField(t('attributes.byRule'), f.byRule),
  ];
}

interface AttributeForm {
  form: HTMLFormElement;
  aside: HTMLElement[];
  byRule: HTMLInputElement;
  /** What is only about the rule, in the form. */
  ruleParts: HTMLElement[];
}

/** CreateAttribute or EditAttribute, then back to the list. */
function attributeForm(attribute: Attribute | null, EloEditor: EloEditorMaker): AttributeForm {
  const f = attributeFields(attribute);
  const { section, editor } = ruleSection(attribute, EloEditor, () => f.values.values());
  const rule = Card({}, section);
  const given = (): AttributeGiven => written(f, editor);
  const save = Button(attribute ? t('common.save') : t('attributes.create'), { variant: 'primary', type: 'submit' });
  const sortAgain = attribute && sortAgainButton(attribute, given);
  const form = SubmitForm(save, '…', async () => {
    await (attribute ? editAttribute(attribute.key, given()) : createAttribute(given()));
    toast(t('attributes.saved'));
    location.hash = '#/attributes';
  },
    Card({ form: true }, askedOf(attribute, f)),
    rule,
    Actions(save, sortAgain, ButtonLink(t('common.cancel'), { href: '#/attributes' }), attribute && !attribute.system && deleteButton(attribute)),
  );
  // Beside the form, while a rule is asked for: what a rule can read, and Elo in brief.
  const aside = [fieldsCard((path) => editor.insert(path)), briefCard({ label: t('rules.guideMore'), href: '#/attributes/guide' })];
  return { form, aside, byRule: f.byRule, ruleParts: [rule, ...aside, ...(sortAgain ? [sortAgain] : [])] };
}

/** The form for a new attribute, or with `key` for one of the organisation's; while a rule is asked for, its rule and what helps write it. */
export const editAttributePage = guard(async (key: string | null) => {
  const attribute = (await readAttributes()).find((a) => a.key === key) ?? null;
  // The editor is loaded with this page only: it is by far the heaviest thing the interface has.
  const { EloEditor } = await import('../ui/molecules/elo-editor.ts');
  const { form, aside, byRule, ruleParts } = attributeForm(attribute, EloEditor);
  shownWhile(byRule, () => byRule.checked, ruleParts);
  shell(Page(
    PageHeader({ title: attribute ? t('attributes.editTitle', { name: attributeName(attribute) }) : t('attributes.newTitle'), crumbs: [{ label: t('attributes.title'), href: '#/attributes' }] }),
    // The form, its buttons under the rule; what helps write the rule beside it, staying in view as the page scrolls.
    Columns(form, aside),
  ));
});
