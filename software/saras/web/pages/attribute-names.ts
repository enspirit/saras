// How attributes and their values are named on screen. The pre-configured one is named in the
// reader's language; an organisation's own keep the names it gave them.

import { STATUS } from '../../shared/attribute.ts';
import type { Attribute, AttributeValue } from '../../shared/attribute.ts';
import { t } from '../i18n.ts';

const NAMES: Record<string, string> = { [STATUS]: 'attributes.status' };
const VALUES: Record<string, Record<string, string>> = {
  [STATUS]: { todo: 'box.todo.label', none: 'box.none.label', sent: 'box.sent.label', ignored: 'box.ignored.label' },
};

export const attributeName = (attribute: Attribute): string => (NAMES[attribute.key] ? t(NAMES[attribute.key] as string) : attribute.name);

export function valueLabel(attribute: Attribute, value: AttributeValue): string {
  const named = VALUES[attribute.key]?.[value.key];
  return named ? t(named) : value.label;
}
