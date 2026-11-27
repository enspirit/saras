// The conditions of a board, as a list one adds to: on the attributes of the organisation, and on
// the facts of an email. Only those the board has are there; the others are offered.

import type { Attribute } from '../../shared/attribute.ts';
import { someOf } from '../../shared/board.ts';
import type { BoardFilter, ReversibleConditions, SomeOf } from '../../shared/board.ts';
import type { Mailbox } from '../../shared/mailbox.ts';
import { t } from '../i18n.ts';
import { attributeCondition, pickedCondition } from './attribute-conditions.ts';
import { Input, Select } from '../ui/atoms/input.ts';
import { ConditionList } from '../ui/molecules/condition-list.ts';
import type { Condition } from '../ui/molecules/condition-list.ts';

/** A condition the board can have: how it is shown, whether the filter has it, and what it adds to a filter. */
interface BoardCondition extends Condition {
  has: boolean;
  write(filter: BoardFilter): void;
}

/** How recent, in days. */
const RECENT = [1, 7, 30, 90];

/** A condition that can be said both ways: an email is this, or is not. */
interface TwoWay<T> {
  /** What the filter has for it, whichever way it says it. */
  given: T | undefined;
  /** Its linking word, to choose: "is" or "is not". */
  verb: HTMLSelectElement;
  /** Where it is written: among the conditions an email must meet, or among those it must not. */
  side(written: BoardFilter): ReversibleConditions;
}

/** What `filter` says of one thing, read from either side by `read`, and the choice between the two `words` that say which side. */
function twoWay<T>(filter: BoardFilter, read: (side: ReversibleConditions) => T | undefined, words: [string, string], changed: () => void): TwoWay<T> {
  const except = filter.except && read(filter.except);
  const verb = Select([{ value: '', label: words[0], selected: except === undefined }, { value: 'not', label: words[1], selected: except !== undefined }], { onchange: changed });
  return { given: except ?? read(filter), verb, side: (written) => (verb.value ? (written.except ??= {}) : written) };
}

function onAttribute(attribute: Attribute, filter: BoardFilter, changed: () => void): BoardCondition {
  const way = twoWay(filter, (side) => side.attributes?.[attribute.key], [t('boards.is'), t('boards.isNot')], changed);
  const picked = attributeCondition(attribute, way.given ?? [], changed);
  const write = (side: ReversibleConditions, values: SomeOf<string>): void => void (side.attributes = { ...side.attributes, [attribute.key]: values });
  return { ...picked, verb: way.verb, write: (written) => void ((values) => values && write(way.side(written), values))(someOf(picked.values())) };
}

function onMailbox(mailboxes: Mailbox[], filter: BoardFilter, changed: () => void): BoardCondition {
  const way = twoWay(filter, (side) => side.mailbox, [t('boards.is'), t('boards.isNot')], changed);
  const picked = pickedCondition('mailbox', t('boards.mailbox'), t('boards.groupEmail'), mailboxes.map((m) => ({ key: String(m.id), label: m.email })), (way.given ?? []).map(String), changed);
  return { ...picked, verb: way.verb, write: (written) => void ((ids) => ids && (way.side(written).mailbox = ids))(someOf(picked.values().map(Number))) };
}

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
  const way = twoWay(filter, (side) => side[key], [t('boards.contains'), t('boards.containsNot')], changed);
  const text = Input({ value: way.given ?? '', placeholder, maxLength: 200, oninput: changed });
  return { key, name, group: t('boards.groupEmail'), verb: way.verb, control: text, has: Boolean(way.given), write: (written) => void (text.value.trim() && (way.side(written)[key] = text.value.trim())) };
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
