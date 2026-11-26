// How a value of an attribute is shown, and the signs of who decides: a rule, a member by hand.

import type { Attribute, AttributeValue, Decider, ValueOfEmail } from '../../shared/attribute.ts';
import { t } from '../i18n.ts';
import { valueLabel } from './attribute-names.ts';
import type { IconName } from '../ui/atoms/icon.ts';
import { ValueChip } from '../ui/atoms/value-chip.ts';

const SOURCES: Record<Exclude<ValueOfEmail['source'], 'nobody'>, string> = { rule: 'attributes.sourceRule', user: 'attributes.sourceUser' };

/** Who decided a value, in words; nothing when nobody did. */
export const whoDecided = (source: ValueOfEmail['source']): string => (source === 'nobody' ? '' : t(SOURCES[source]));

/** The signs of who decides an attribute. */
export const DECIDER_ICONS: Record<Decider, IconName[]> = { nobody: ['pencil'], elo: ['code'] };

/** A value as a chip, in its colour. A member is named by the part of their address before the @, the whole of it as a tooltip. */
export const chipOf = (attribute: Attribute, value: AttributeValue, small = false): HTMLSpanElement =>
  attribute.kind === 'member'
    ? ValueChip(value.label.split('@')[0] ?? value.label, { small, plain: true, title: value.label })
    : ValueChip(valueLabel(attribute, value), { color: value.color, small });

/** The chip of the value with this key; nothing when the attribute no longer has it. */
export function chipFor(attribute: Attribute, key: string | undefined, small = false): HTMLSpanElement | null {
  const value = attribute.values.find((v) => v.key === key);
  return value ? chipOf(attribute, value, small) : null;
}

/** What stands for no value. */
export const noValueChip = (small = false): HTMLSpanElement => ValueChip(t('attributes.noValue'), { empty: true, small });
