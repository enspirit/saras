// What the assistant proposes, to read before anything is applied: each attribute with its
// values and its rule, each board with its conditions, and for each whether it is kept.

import { STATUS } from '../../shared/attribute.ts';
import type { Attribute, ValueColor } from '../../shared/attribute.ts';
import { attributeConfiguredAs, sameName, valueConfiguredAs } from '../../shared/configuration.ts';
import type { AttributeConfigured, BoardConfigured, ConditionsConfigured, Configuration } from '../../shared/configuration.ts';
import { t } from '../i18n.ts';
import { session } from '../session.ts';
import { attributeName, valueLabel } from './attribute-names.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Checkbox } from '../ui/atoms/input.ts';
import { Muted, Text } from '../ui/atoms/text.ts';
import { ValueChip } from '../ui/atoms/value-chip.ts';
import type { Child } from '../ui/dom.ts';
import { ValueList } from '../ui/molecules/attribute-bar.ts';
import { Card } from '../ui/molecules/card.ts';
import { Facts } from '../ui/molecules/facts.ts';
import { Block, CheckField } from '../ui/molecules/field.ts';
import { Snippet } from '../ui/molecules/rule-help.ts';

/** The attribute the organisation has under this name, if it has one. */
const kept = (name: string): Attribute | undefined => session.attributes.find((attribute) => sameName(attributeConfiguredAs(attribute), name));

const shownName = (name: string): string => {
  const attribute = kept(name);
  return attribute ? attributeName(attribute) : name;
};

/** A value as the organisation shows it, with its colour: the one proposed for it, else the one it has. */
function chip(proposed: Configuration, name: string, said: string): HTMLSpanElement {
  const attribute = kept(name);
  const value = attribute?.values.find((one) => sameName(valueConfiguredAs(attribute, one), said));
  const given = proposed.attributes.find((one) => sameName(one.name, name))?.values.find((one) => sameName(one.label, said));
  const color: ValueColor | undefined = given?.color ?? value?.color;
  return ValueChip(attribute && value ? valueLabel(attribute, value) : said, { color, plain: attribute?.kind === 'member' });
}

/** Whether what is proposed is new, or changes what the organisation has. */
const state = (isNew: boolean): HTMLSpanElement => (isNew ? Badge(t('assistant.new'), 'ok') : Badge(t('assistant.changes'), 'neutral'));

const tick = (): HTMLInputElement => Checkbox({ checked: true });

/** How an attribute is decided: its rule to read, or that members set it by hand. */
const decided = ({ decidedBy, elo }: AttributeConfigured): Child => Block(decidedBy === 'elo' ? Snippet(elo, t('attributes.byRule')) : Text({ muted: true, small: true }, t('attributes.deciderNobody')));

/** The values proposed. Of "Stands in" none is shown: they are fixed. */
const values = (proposed: Configuration, { name, kind, values }: AttributeConfigured): Child =>
  name === STATUS ? null : Block(kind === 'member' ? Muted(t('attributes.kindMember')) : ValueList(values.map(({ label }) => chip(proposed, name, label))));

function attributeCard(proposed: Configuration, attribute: AttributeConfigured, keep: HTMLInputElement): HTMLDivElement {
  return Card({ form: true, title: shownName(attribute.name), badges: [state(!kept(attribute.name))] }, values(proposed, attribute), decided(attribute), CheckField(t('assistant.keep'), keep));
}

/** The conditions said one way: what an email is, or with `not`, what it is not. */
function rows(proposed: Configuration, conditions: ConditionsConfigured, not: boolean): [string, Child][] {
  const is = t(not ? 'boards.isNot' : 'boards.is');
  const contains = t(not ? 'boards.containsNot' : 'boards.contains');
  return [
    ...Object.entries(conditions.attributes ?? {}).map(([name, said]): [string, Child] => [shownName(name), [is, ' ', ValueList(said.map((one) => chip(proposed, name, one)))]]),
    ...(conditions.mailbox ? [[t('boards.mailbox'), `${is} ${conditions.mailbox.join(', ')}`] as [string, Child]] : []),
    ...(conditions.from ? [[t('boards.from'), `${contains} ${conditions.from}`] as [string, Child]] : []),
    ...(conditions.keywords ? [[t('boards.keywords'), `${contains} ${conditions.keywords}`] as [string, Child]] : []),
  ];
}

/** Every condition of a board, in words. */
function conditions(proposed: Configuration, { filter }: BoardConfigured): Child {
  const facts: [string, Child][] = [...rows(proposed, filter, false), ...rows(proposed, filter.except ?? {}, true)];
  if (filter.received) facts.push([t('boards.received'), `${t('boards.receivedIn')} ${t('boards.receivedWithin', { days: filter.received })}`]);
  if (filter.attachment !== undefined) facts.push([t('boards.attachment'), t(filter.attachment ? 'boards.attachmentWith' : 'boards.attachmentWithout')]);
  return Block(facts.length ? Facts(facts) : Text({ muted: true, small: true }, t('boards.noCondition')));
}

const isNewBoard = ({ name }: BoardConfigured): boolean => !session.boards.some((board) => board.shared && sameName(board.name, name));

function boardCard(proposed: Configuration, board: BoardConfigured, keep: HTMLInputElement): HTMLDivElement {
  return Card({ form: true, title: board.name, badges: [state(isNewBoard(board))] }, conditions(proposed, board), CheckField(t('assistant.keep'), keep));
}

export interface ProposedConfiguration {
  cards: HTMLDivElement[];
  /** What is ticked of what was proposed. */
  kept(): Configuration;
}

/** What is proposed, card by card: attributes, then boards. Each is kept unless unticked. */
export function proposedConfiguration(proposed: Configuration): ProposedConfiguration {
  const attributes = proposed.attributes.map((attribute) => ({ attribute, keep: tick() }));
  const boards = proposed.boards.map((board) => ({ board, keep: tick() }));
  return {
    cards: [...attributes.map(({ attribute, keep }) => attributeCard(proposed, attribute, keep)), ...boards.map(({ board, keep }) => boardCard(proposed, board, keep))],
    kept: () => ({ attributes: attributes.filter(({ keep }) => keep.checked).map(({ attribute }) => attribute), boards: boards.filter(({ keep }) => keep.checked).map(({ board }) => board) }),
  };
}
