// Conditions on the attributes of an email, as a list one adds to: for a board, which emails it
// shows; for a prompt, which emails it suits. Each condition holds values picked one by one.

import type { Attribute } from '../../shared/attribute.ts';
import { t } from '../i18n.ts';
import { attributeName, valueLabel } from './attribute-names.ts';
import { ConditionList, ValuePicker } from '../ui/molecules/condition-list.ts';
import type { Condition, PickOption } from '../ui/molecules/condition-list.ts';

/** A condition made of values picked among a few, and what is picked now. */
export interface PickedCondition extends Condition {
  has: boolean;
  values(): string[];
}

/** A condition whose values are picked among `options`: `has` are those it starts with. */
export function pickedCondition(key: string, name: string, group: string, options: PickOption[], has: string[], changed: () => void): PickedCondition {
  const picker = ValuePicker({ options, picked: has, addLabel: t('boards.orValue'), removeLabel: (label) => t('boards.removeValue', { label }), onChange: changed });
  return { key, name, group, verb: t('boards.is'), control: picker.element, has: has.length > 0, values: picker.values };
}

/** The condition on one attribute: its values to pick, in their colours; a member by their address. */
export const attributeCondition = (attribute: Attribute, has: string[], changed: () => void): PickedCondition =>
  pickedCondition(`attribute:${attribute.key}`, attributeName(attribute), t('boards.groupAttributes'),
    attribute.values.map((value) => ({ key: value.key, label: attribute.kind === 'member' ? value.label : valueLabel(attribute, value), color: value.color })), has, changed);

export interface AttributeConditions {
  element: HTMLElement;
  /** The values picked, by the key of each attribute that has a condition with at least one. */
  values(): Record<string, string[]>;
}

/** Conditions on attributes alone: those `given` names are there, the others can be added. */
export function attributeConditions(given: Record<string, string[]>, attributes: Attribute[], emptyText: string, changed: () => void = () => {}): AttributeConditions {
  const all = attributes.map((attribute) => ({ attribute, condition: attributeCondition(attribute, given[attribute.key] ?? [], changed) }));
  const list = ConditionList({
    conditions: all.map((one) => one.condition), present: all.filter((one) => one.condition.has).map((one) => one.condition.key), onChange: changed,
    and: t('boards.and'), addLabel: t('boards.addCondition'), removeLabel: (name) => t('boards.removeCondition', { name }), emptyText,
  });
  const values = (): Record<string, string[]> => Object.fromEntries(all
    .filter(({ condition }) => list.present().includes(condition.key) && condition.values().length)
    .map(({ attribute, condition }) => [attribute.key, condition.values()]));
  return { element: list.element, values };
}
