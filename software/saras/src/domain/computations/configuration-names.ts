// Pure: what the names of a configuration stand for in an organisation — the attribute of a
// name, the filter a board is kept with, the attributes there would be once it is applied,
// and the names that stand for nothing.
import { STATUS, VALUE_COLORS } from '../../../shared/attribute.ts';
import type { Attribute, AttributeGiven, AttributeValue, ValueColor, ValueGiven } from '../../../shared/attribute.ts';
import type { BoardFilter } from '../../../shared/board.ts';
import { attributeConfiguredAs, sameName, valueConfiguredAs } from '../../../shared/configuration.ts';
import type { AttributeConfigured, ConditionsConfigured, FilterConfigured } from '../../../shared/configuration.ts';
import type { MessageParams } from '../../tooling/messages.ts';
import { accept } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import { attributeGiven, deciderGiven } from './attributes.ts';
import { filterGiven } from './boards.ts';
import type { Known } from './configuration.ts';
import { clipped } from './given.ts';

/** The attribute a configuration names so, when the organisation has it. */
export const attributeNamed = (attributes: Attribute[], name: string): Attribute | undefined => attributes.find((one) => sameName(attributeConfiguredAs(one), name));

/** The value of an attribute a configuration names so. One of the pre-configured attribute is also known by its label. */
const valueNamed = (attribute: Attribute, said: string): AttributeValue | undefined =>
  attribute.values.find((value) => sameName(valueConfiguredAs(attribute, value), said) || (attribute.system && sameName(value.label, said)));

/** The values of the pre-configured attribute a configuration gives a colour we know: the others keep theirs. */
const colored = (values: unknown): ValueGiven[] =>
  (Array.isArray(values) ? values : []).flatMap((value: { label?: unknown; color?: unknown } | null) => {
    const color = VALUE_COLORS.find((known) => known === value?.color);
    return color && clipped(value?.label, 60) ? [{ label: clipped(value?.label, 60), color }] : [];
  });

/** ReqPre of ApplyConfiguration, for the pre-configured attribute: a way of deciding we know. Nothing else of it is read. */
function systemRead(given: Record<string, unknown>): Verdict<AttributeConfigured> {
  const decidedBy = deciderGiven(given.decidedBy);
  return decidedBy.ok ? accept({ name: STATUS, kind: 'choice', values: colored(given.values), decidedBy: decidedBy.value, elo: clipped(given.elo, 4000) }) : decidedBy;
}

/** ReqPre of ApplyConfiguration: each attribute is one CreateAttribute or EditAttribute accepts. */
export const attributeRead = (given: Record<string, unknown>): Verdict<AttributeConfigured> => (sameName(clipped(given.name, 60), STATUS) ? systemRead(given) : attributeGiven(given));

/** What EditAttribute is given for the pre-configured attribute: how it is decided, and at the place of each value the colour a configuration gives it, if any. */
export const systemEdited = ({ values }: Attribute, given: AttributeConfigured): { decidedBy: string; elo: string; values: { color?: ValueColor }[] } => ({
  decidedBy: given.decidedBy,
  elo: given.elo,
  values: values.map((value) => ({ color: given.values.find((one) => sameName(one.label, value.key) || sameName(one.label, value.label))?.color })),
});

const valuesOf = (given: AttributeGiven, members: AttributeValue[]): AttributeValue[] =>
  given.kind === 'member' ? members : given.values.map(({ label, color }, place) => ({ key: String(place + 1), label, color }));

/** The attributes the organisation would have once these are applied: so that what boards name is checked before anything is written. */
export function attributesAfter({ attributes, members }: Pick<Known, 'attributes' | 'members'>, configured: AttributeConfigured[]): Attribute[] {
  const givenFor = (kept: Attribute): AttributeConfigured | undefined => configured.find((one) => sameName(one.name, attributeConfiguredAs(kept)));
  const changed = attributes.map((kept) => {
    const given = givenFor(kept);
    return given && !kept.system ? { ...kept, ...given, values: valuesOf(given, members) } : kept;
  });
  const made = configured.filter((one) => !attributeNamed(attributes, one.name)).map((one, place) => ({ ...one, key: `new-${place}`, values: valuesOf(one, members), system: false }));
  return [...changed, ...made];
}

/** The places of the names said before, case aside: what is named twice in one configuration. */
export const saidTwice = (names: string[]): number[] => names.flatMap((name, place) => (name && names.slice(0, place).some((before) => sameName(before, name)) ? [place] : []));

/** A name that stands for nothing in the organisation, as the message that says so. */
export interface Unknown {
  code: 'configuration.attributeUnknown' | 'configuration.valueUnknown' | 'configuration.mailboxUnknown';
  params: MessageParams;
}

function unknownValues(attribute: Attribute | undefined, name: string, values: string[]): Unknown[] {
  if (!attribute) return [{ code: 'configuration.attributeUnknown', params: { name } }];
  return values.filter((said) => !valueNamed(attribute, said)).map((value) => ({ code: 'configuration.valueUnknown', params: { attribute: name, value } }));
}

function unknownAmong(conditions: ConditionsConfigured, { attributes, mailboxes }: Known): Unknown[] {
  const values = Object.entries(conditions.attributes ?? {}).flatMap(([name, said]) => unknownValues(attributeNamed(attributes, name), name, said));
  const addresses = (conditions.mailbox ?? []).filter((address) => !mailboxes.some(({ email }) => sameName(email, address)));
  return [...values, ...addresses.map((address): Unknown => ({ code: 'configuration.mailboxUnknown', params: { address } }))];
}

/** ReqPre of ApplyConfiguration: a board names attributes there are, values they have, and mailboxes of who asks. What it names otherwise is told here. */
export const unknownIn = (filter: FilterConfigured, known: Known): Unknown[] => [...unknownAmong(filter, known), ...unknownAmong(filter.except ?? {}, known)];

function conditionsResolved(conditions: ConditionsConfigured, { attributes, mailboxes }: Known): Record<string, unknown> {
  const values = Object.entries(conditions.attributes ?? {}).flatMap(([name, said]): [string, string[]][] => {
    const attribute = attributeNamed(attributes, name);
    return attribute ? [[attribute.key, said.flatMap((one) => valueNamed(attribute, one)?.key ?? [])]] : [];
  });
  const mailbox = mailboxes.filter(({ email }) => conditions.mailbox?.some((address) => sameName(address, email))).map(({ id }) => id);
  return { attributes: Object.fromEntries(values), mailbox, from: conditions.from, keywords: conditions.keywords };
}

/** The filter a board is kept with: what a configuration names, as this organisation numbers it. An address names every mailbox that has it. */
export const filterResolved = (filter: FilterConfigured, known: Known): BoardFilter =>
  filterGiven({ ...conditionsResolved(filter, known), received: filter.received, attachment: filter.attachment, except: conditionsResolved(filter.except ?? {}, known) });
