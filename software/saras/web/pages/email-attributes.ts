// The attributes of an email being read: the value each has, who decided it and why, and a way to set it by hand.

import { PRIORITY, STATUS } from '../../shared/attribute.ts';
import type { Attribute, ValueOfEmail } from '../../shared/attribute.ts';
import type { EmailWithItsReply, Priority } from '../../shared/email.ts';
import { setEmailAttribute } from '../api/attributes.ts';
import { t } from '../i18n.ts';
import { messageOf, toast } from './actions.ts';
import { attributeName } from './attribute-names.ts';
import { chipFor, chipOf, noValueChip, signOf } from './attribute-values.ts';
import type { Child } from '../ui/dom.ts';
import { AttributeBar } from '../ui/molecules/attribute-bar.ts';
import type { AttributeEntry } from '../ui/molecules/attribute-bar.ts';

/** The value an email has for an attribute. Its priority is kept apart: the AI or nobody may have set it. */
const valueOf = (email: EmailWithItsReply, attribute: Attribute): ValueOfEmail | undefined =>
  email.attributes[attribute.key] ?? (attribute.key === PRIORITY ? { value: email.priority, source: 'ai' } : undefined);

/** Who sorted an email, when it was the AI: then what it said of it also explains its priority. */
const sortedByAi = ({ triageSource, triageReasonCode }: EmailWithItsReply): boolean => Boolean(triageSource) && !['rule', 'user', 'none'].includes(triageSource ?? '') && !triageReasonCode;

/** Why a value is what it is, in the words of who decided: a rule that said, or the AI when it sorted. Nothing when it is not known. */
function reasonOf(email: EmailWithItsReply, attribute: Attribute, has: ValueOfEmail): string {
  if (has.source === 'rule') return has.reason && !has.reason.startsWith('code:') ? has.reason : '';
  return has.source === 'ai' && attribute.key === PRIORITY && sortedByAi(email) ? email.triageReason : '';
}

const NOTES = { rule: 'attributes.noteRule', ai: 'attributes.noteAi', user: 'attributes.noteUser' };

/** Under the values: who decided the one it has, why when that is known, and what setting it by hand does. */
function noteOf(email: EmailWithItsReply, attribute: Attribute, has: ValueOfEmail | undefined): Child[] {
  if (!has) return [t('attributes.noteNone'), t('attributes.noteByHand')];
  const reason = reasonOf(email, attribute, has);
  return [t(NOTES[has.source]), reason && t('attributes.noteReason', { reason }), has.source !== 'user' && t('attributes.noteByHand')].filter(Boolean);
}

/** SetEmailAttribute: the value chosen is the member's from then on; the email on screen is brought up to date. */
async function setByHand(email: EmailWithItsReply, attribute: Attribute, value: string, shown: () => void): Promise<void> {
  try {
    await setEmailAttribute(email.id, attribute.key, value || null);
    if (value) email.attributes[attribute.key] = { value, source: 'user' };
    else delete email.attributes[attribute.key];
    if (attribute.key === PRIORITY) email.priority = (value || 'normal') as Priority;
    shown();
    toast(t('attributes.valueSet', { name: attributeName(attribute) }));
  } catch (e) {
    toast(messageOf(e), true);
  }
}

/** One attribute: its value, the sign of who decided it, and its values to choose from, "none" last. */
function entryOf(email: EmailWithItsReply, attribute: Attribute, shown: () => void): AttributeEntry {
  const has = valueOf(email, attribute);
  const choices = attribute.values.map((v) => ({ key: v.key, label: chipOf(attribute, v), chosen: has?.value === v.key }));
  return {
    name: attributeName(attribute),
    value: has ? chipFor(attribute, has.value) : null,
    decider: has && signOf(has.source),
    choices: [...choices, { key: '', label: noValueChip(), chosen: !has }],
    note: noteOf(email, attribute, has),
    onPick: (key) => void setByHand(email, attribute, key, shown),
  };
}

/** Every attribute but where the email stands, which is changed by acting on it. */
export function attributesOfEmail(email: EmailWithItsReply, attributes: Attribute[]): Child {
  const others = attributes.filter((a) => a.key !== STATUS);
  if (!others.length) return null;
  const bar: HTMLElement = AttributeBar(others.map((attribute) => entryOf(email, attribute, () => bar.replaceWith(attributesOfEmail(email, attributes) as Node))), t('attributes.ofEmail'));
  return bar;
}
