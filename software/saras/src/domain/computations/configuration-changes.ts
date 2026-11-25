// Pure: what of a configuration is not already so — the attributes and the boards that
// applying it would make or change.
import { STATUS } from '../../../shared/attribute.ts';
import type { ValueGiven } from '../../../shared/attribute.ts';
import { sameName } from '../../../shared/configuration.ts';
import type { AttributeConfigured, ConditionsConfigured, Configuration, FilterConfigured } from '../../../shared/configuration.ts';

const sameValues = (kept: ValueGiven[], given: ValueGiven[]): boolean =>
  kept.length === given.length && kept.every((value, place) => value.label === given[place]?.label && value.color === given[place]?.color);

/** The rule of an attribute nobody decides is not looked at: it decides nothing. */
const decidedAlike = (kept: AttributeConfigured, given: AttributeConfigured): boolean =>
  kept.decidedBy === given.decidedBy && (given.decidedBy === 'nobody' || kept.elo.trim() === given.elo.trim());

/** Of the pre-configured attribute, a configuration says only the colours it changes: a value it does not name stays as it is. */
const coloredAlike = (kept: ValueGiven[], given: ValueGiven[]): boolean => given.every((one) => kept.some((value) => sameName(value.label, one.label) && value.color === one.color));

function sameAttribute(kept: AttributeConfigured, given: AttributeConfigured): boolean {
  if (!decidedAlike(kept, given)) return false;
  if (kept.name === STATUS) return coloredAlike(kept.values, given.values);
  return kept.name === given.name && kept.kind === given.kind && sameValues(kept.values, given.values);
}

const lower = (texts: string[]): string[] => texts.map((text) => text.toLowerCase()).sort();

/** Conditions in one order, case aside: two filters that say the same are written the same. */
const ordered = (conditions: ConditionsConfigured): unknown[] => [
  Object.entries(conditions.attributes ?? {}).map(([name, values]) => [name.toLowerCase(), lower(values)]).sort(),
  lower(conditions.mailbox ?? []),
  conditions.from ?? '',
  conditions.keywords ?? '',
];

const written = (filter: FilterConfigured): string => JSON.stringify([ordered(filter), filter.received ?? 0, filter.attachment ?? null, ordered(filter.except ?? {})]);

/** What of `proposed` is not already so in `current`: what would be made, and what would change. */
export const whatChanges = (current: Configuration, proposed: Configuration): Configuration => ({
  attributes: proposed.attributes.filter((given) => {
    const kept = current.attributes.find((one) => sameName(one.name, given.name));
    return !kept || !sameAttribute(kept, given);
  }),
  boards: proposed.boards.filter((given) => {
    const kept = current.boards.find((one) => sameName(one.name, given.name));
    return !kept || written(kept.filter) !== written(given.filter);
  }),
});
