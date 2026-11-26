// The attributes of an email being read: the value each has, who decided it and why, and a way to set it by hand.

import { STATUS, VALUE_COLORS } from '../../shared/attribute.ts';
import type { Attribute, ValueColor, ValueOfEmail } from '../../shared/attribute.ts';
import type { EmailWithItsReply } from '../../shared/email.ts';
import { editAttribute, setEmailAttribute } from '../api/attributes.ts';
import { t } from '../i18n.ts';
import { isAdmin } from '../session.ts';
import { messageOf, toast } from './actions.ts';
import { attributeName } from './attribute-names.ts';
import { chipFor, chipOf, whoDecided } from './attribute-values.ts';
import type { Child } from '../ui/dom.ts';
import { AttributeBar } from '../ui/molecules/attribute-bar.ts';
import type { AttributeEntry } from '../ui/molecules/attribute-bar.ts';

/** The value an email has for an attribute, if any. */
const valueOf = (email: EmailWithItsReply, attribute: Attribute): ValueOfEmail | undefined => email.attributes[attribute.key];

/** Why a value is what it is, in the words of the rule that decided it, when it said. */
const reasonOf = (has: ValueOfEmail): string => (has.source === 'rule' && has.reason && !has.reason.startsWith('code:') ? has.reason : '');

/** Who decided the value it has, and why when the rule said: the tooltip of the attribute. */
function whyOf(has: ValueOfEmail | undefined): string {
  if (!has) return '';
  const reason = reasonOf(has);
  return reason ? t('attributes.decidedBecause', { who: whoDecided(has.source), reason }) : whoDecided(has.source);
}

/** SetEmailAttribute: the value chosen is the member's from then on; the email on screen is brought up to date. */
async function setByHand(email: EmailWithItsReply, attribute: Attribute, value: string, shown: () => void): Promise<void> {
  try {
    await setEmailAttribute(email.id, attribute.key, value || null);
    if (value) email.attributes[attribute.key] = { value, source: 'user' };
    else delete email.attributes[attribute.key];
    shown();
    toast(t('attributes.valueSet', { name: attributeName(attribute) }));
  } catch (e) {
    toast(messageOf(e), true);
  }
}

/** The colour a new value takes: the first no value has yet, grey once all are taken. */
const nextColor = ({ values }: Attribute): ValueColor => VALUE_COLORS.find((c) => c !== 'grey' && !values.some((v) => v.color === c)) ?? 'grey';

/** EditAttribute, then SetEmailAttribute: a value typed in the menu joins the end of the attribute's values, and this email has it. One it has already is just chosen. */
async function addValue(email: EmailWithItsReply, attribute: Attribute, label: string, shown: () => void): Promise<void> {
  const known = attribute.values.find((v) => v.label.toLowerCase() === label.toLowerCase());
  if (known) return setByHand(email, attribute, known.key, shown);
  try {
    const values = [...attribute.values.map((v) => ({ label: v.label, color: v.color ?? 'grey' })), { label, color: nextColor(attribute) }];
    Object.assign(attribute, await editAttribute(attribute.key, { name: attribute.name, kind: attribute.kind, values, decidedBy: attribute.decidedBy, elo: attribute.elo }));
    await setByHand(email, attribute, attribute.values[attribute.values.length - 1]!.key, shown);
  } catch (e) {
    toast(messageOf(e), true);
  }
}

/** Only an administrator adds a value, and only to a choice of the organisation's own. */
const canAddTo = (attribute: Attribute): boolean => isAdmin() && attribute.kind === 'choice' && !attribute.system;

/** One attribute: its value, why it has it, and its values to choose from. Clearing it is a cross in the menu, which then opens again. */
function entryOf(email: EmailWithItsReply, attribute: Attribute, shown: (open?: string) => void, open?: string): AttributeEntry {
  const has = valueOf(email, attribute);
  const name = attributeName(attribute);
  return {
    name,
    value: has ? chipFor(attribute, has.value) : null,
    why: whyOf(has),
    clearLabel: t('attributes.clearValue', { name }),
    choices: attribute.values.map((v) => ({ key: v.key, label: chipOf(attribute, v), chosen: has?.value === v.key, tone: attribute.kind === 'member' ? undefined : v.color })),
    onPick: (key) => void setByHand(email, attribute, key, shown),
    onClear: () => void setByHand(email, attribute, '', () => shown(attribute.key)),
    open: open === attribute.key,
    onAdd: canAddTo(attribute) ? (label) => void addValue(email, attribute, label, shown) : undefined,
    addLabel: t('attributes.addValue'),
  };
}

/** Every attribute but where the email stands, which is changed by acting on it; `open` names the one whose menu is open. */
export function attributesOfEmail(email: EmailWithItsReply, attributes: Attribute[], open?: string): Child {
  const others = attributes.filter((a) => a.key !== STATUS);
  if (!others.length) return null;
  const shown = (reopen?: string): void => bar.replaceWith(attributesOfEmail(email, attributes, reopen) as Node);
  const bar: HTMLElement = AttributeBar(others.map((attribute) => entryOf(email, attribute, shown, open)), t('attributes.ofEmail'));
  return bar;
}
