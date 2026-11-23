// The conditions of a board, as a list one adds to: on the attributes of the organisation, and on
// the facts of an email. Only those the board has are there; the others are offered.

import type { Attribute } from '../../shared/attribute.ts';
import type { BoardFilter } from '../../shared/board.ts';
import type { Mailbox } from '../../shared/mailbox.ts';
import { t } from '../i18n.ts';
import { attributeName, valueLabel } from './attribute-names.ts';
import { Input, Select } from '../ui/atoms/input.ts';
import { ConditionList, ValuePicker } from '../ui/molecules/condition-list.ts';
import type { Condition, PickOption } from '../ui/molecules/condition-list.ts';

/** A condition the board can have: how it is shown, whether the filter has it, and what it adds to a filter. */
interface BoardCondition extends Condition {
  has: boolean;
  write(filter: BoardFilter): void;
}

/** How recent, in days. */
const RECENT = [1, 7, 30, 90];

/** A condition made of values picked among a few: an attribute, or the mailboxes. */
function picked(key: string, name: string, group: string, options: PickOption[], has: string[], write: (filter: BoardFilter, values: string[]) => void, changed: () => void): BoardCondition {
  const picker = ValuePicker({ options, picked: has, addLabel: t('boards.orValue'), removeLabel: (label) => t('boards.removeValue', { label }), onChange: changed });
  return { key, name, group, verb: t('boards.is'), control: picker.element, has: has.length > 0, write: (filter) => write(filter, picker.values()) };
}

const onAttribute = (attribute: Attribute, filter: BoardFilter, changed: () => void): BoardCondition =>
  picked(`attribute:${attribute.key}`, attributeName(attribute), t('boards.groupAttributes'),
    attribute.values.map((value) => ({ key: value.key, label: attribute.kind === 'member' ? value.label : valueLabel(attribute, value), color: value.color })),
    filter.attributes?.[attribute.key] ?? [],
    (written, values) => void (values.length && (written.attributes = { ...written.attributes, [attribute.key]: values })), changed);

const onMailbox = (mailboxes: Mailbox[], filter: BoardFilter, changed: () => void): BoardCondition =>
  picked('mailbox', t('boards.mailbox'), t('boards.groupEmail'), mailboxes.map((m) => ({ key: String(m.id), label: m.email })), (filter.mailbox ?? []).map(String),
    (written, values) => void (values.length && (written.mailbox = values.map(Number))), changed);

function onReceived(filter: BoardFilter, changed: () => void): BoardCondition {
  const days = Select(RECENT.map((n) => ({ value: n, label: t('boards.receivedWithin', { days: n }), selected: (filter.received ?? 7) === n })), { onchange: changed });
  return { key: 'received', name: t('boards.received'), group: t('boards.groupEmail'), verb: t('boards.receivedIn'), control: days, has: Boolean(filter.received), write: (written) => void (written.received = Number(days.value)) };
}

function onAttachment(filter: BoardFilter, changed: () => void): BoardCondition {
  const which = Select([{ value: 'with', label: t('boards.attachmentWith'), selected: filter.attachment !== false }, { value: 'without', label: t('boards.attachmentWithout'), selected: filter.attachment === false }], { onchange: changed });
  return { key: 'attachment', name: t('boards.attachment'), group: t('boards.groupEmail'), verb: t('boards.is'), control: which, has: filter.attachment !== undefined, write: (written) => void (written.attachment = which.value === 'with') };
}

/** A condition on a text the email holds: its sender, or words of its subject and text. */
function onText(key: 'from' | 'keywords', name: string, placeholder: string, filter: BoardFilter, changed: () => void): BoardCondition {
  const text = Input({ value: filter[key] ?? '', placeholder, oninput: changed });
  return { key, name, group: t('boards.groupEmail'), verb: t('boards.contains'), control: text, has: Boolean(filter[key]), write: (written) => void (text.value.trim() && (written[key] = text.value)) };
}

export interface BoardConditions {
  element: HTMLElement;
  /** The filter the conditions that are there make. */
  filter(): BoardFilter;
}

/** The conditions of a board: those `filter` has are there, the others can be added. `changed` is told whenever what they say changes. */
export function boardConditions(filter: BoardFilter, attributes: Attribute[], mailboxes: Mailbox[], changed: () => void): BoardConditions {
  const all: BoardCondition[] = [
    ...attributes.map((attribute) => onAttribute(attribute, filter, changed)),
    onMailbox(mailboxes, filter, changed),
    onReceived(filter, changed),
    onText('from', t('boards.from'), t('boards.fromPlaceholder'), filter, changed),
    onText('keywords', t('boards.keywords'), t('boards.keywordsPlaceholder'), filter, changed),
    onAttachment(filter, changed),
  ];
  const list = ConditionList({
    conditions: all, present: all.filter((c) => c.has).map((c) => c.key), onChange: changed,
    and: t('boards.and'), addLabel: t('boards.addCondition'), removeLabel: (name) => t('boards.removeCondition', { name }), emptyText: t('boards.noCondition'),
  });
  const written = (): BoardFilter => {
    const made: BoardFilter = {};
    for (const condition of all) if (list.present().includes(condition.key)) condition.write(made);
    return made;
  };
  return { element: list.element, filter: written };
}
