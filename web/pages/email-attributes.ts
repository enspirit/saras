// The attributes of an email being read: what each is, who decided it, and a way to set it by hand.

import { STATUS } from '../../shared/attribute.ts';
import type { Attribute, ValueOfEmail } from '../../shared/attribute.ts';
import type { EmailWithItsReply } from '../../shared/email.ts';
import { setEmailAttribute } from '../api/attributes.ts';
import { t } from '../i18n.ts';
import { messageOf, toast } from './actions.ts';
import { attributeName, valueLabel } from './attribute-names.ts';
import { Select } from '../ui/atoms/input.ts';
import type { Child } from '../ui/dom.ts';
import { Field } from '../ui/molecules/field.ts';
import { FormRow } from '../ui/molecules/form.ts';

const SOURCE = { rule: 'attributes.sourceRule', ai: 'attributes.sourceAi', user: 'attributes.sourceUser' };

/** The value an email has for an attribute. Its priority is kept apart: the AI or nobody may have set it. */
const valueOf = (email: EmailWithItsReply, attribute: Attribute): ValueOfEmail | undefined =>
  email.attributes[attribute.key] ?? (attribute.key === 'priority' ? { value: email.priority, source: 'ai' } : undefined);

/** SetEmailAttribute: the value chosen is the member's from then on. */
async function setByHand(email: EmailWithItsReply, attribute: Attribute, value: string): Promise<void> {
  try {
    await setEmailAttribute(email.id, attribute.key, value || null);
    toast(t('attributes.valueSet', { name: attributeName(attribute) }));
  } catch (e) {
    toast(messageOf(e), true);
  }
}

/** One attribute: its values to choose from, and who decided the one it has. */
function attributeField(email: EmailWithItsReply, attribute: Attribute): HTMLDivElement {
  const has = valueOf(email, attribute);
  const none = { value: '', label: t('attributes.noValue'), selected: !has };
  const select = Select([none, ...attribute.values.map((v) => ({ value: v.key, label: valueLabel(attribute, v), selected: has?.value === v.key }))], { onchange: () => void setByHand(email, attribute, select.value) });
  return Field(attributeName(attribute), select, { hint: has && email.attributes[attribute.key] ? t(SOURCE[has.source]) : undefined, size: 'narrow' });
}

/** Every attribute but where the email stands, which is changed by acting on it. */
export const attributesOfEmail = (email: EmailWithItsReply, attributes: Attribute[]): Child =>
  attributes.some((a) => a.key !== STATUS) && FormRow(attributes.filter((a) => a.key !== STATUS).map((attribute) => attributeField(email, attribute)));
