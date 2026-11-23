// How attributes and their values are named on screen. The two pre-configured ones are named in
// the reader's language; those an organisation made keep the names it gave them.

import { PRIORITY, STATUS } from '../../shared/attribute.ts';
import type { Attribute, AttributeValue } from '../../shared/attribute.ts';
import { t } from '../i18n.ts';

const NAMES: Record<string, string> = { [STATUS]: 'attributes.status', [PRIORITY]: 'attributes.priority' };
const VALUES: Record<string, Record<string, string>> = {
  [STATUS]: { todo: 'box.todo.label', none: 'box.none.label', sent: 'box.sent.label', ignored: 'box.ignored.label' },
  [PRIORITY]: { high: 'attributes.priorityHigh', normal: 'attributes.priorityNormal', low: 'attributes.priorityLow' },
};

export const attributeName = (attribute: Attribute): string => (NAMES[attribute.key] ? t(NAMES[attribute.key] as string) : attribute.name);

export function valueLabel(attribute: Attribute, value: AttributeValue): string {
  const named = VALUES[attribute.key]?.[value.key];
  return named ? t(named) : value.label;
}
