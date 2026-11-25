// Pure: the configuration of an organisation as data — how what is kept is told by names, and
// what a configuration given is reduced to.
import { attributeConfiguredAs, valueConfiguredAs } from '../../../shared/configuration.ts';
import type { AttributeConfigured, BoardConfigured, ConditionsConfigured, Configuration, FilterConfigured } from '../../../shared/configuration.ts';
import type { Attribute, AttributeValue } from '../../../shared/attribute.ts';
import type { BoardFilter, ReversibleConditions } from '../../../shared/board.ts';
import { filterGiven } from './boards.ts';
import { clipped } from './given.ts';

/** A mailbox as a configuration names it: by its address. */
export interface MailboxNamed {
  id: number;
  email: string;
}

/** What the names of a configuration stand for in an organisation: its attributes, its members, and the mailboxes of who asks. */
export interface Known {
  attributes: Attribute[];
  /** The members, as the values an attribute of kind "member" has. */
  members: AttributeValue[];
  mailboxes: MailboxNamed[];
}

/** A board as it is kept, for what a configuration tells of it. */
export interface BoardKept {
  name: string;
  filter: BoardFilter;
}

/** An attribute as a configuration tells it: named as an administrator names it, its values by their label. */
export const attributeConfigured = (attribute: Attribute): AttributeConfigured => ({
  name: attributeConfiguredAs(attribute),
  kind: attribute.kind,
  values: attribute.kind === 'choice' ? attribute.values.map((value) => ({ label: valueConfiguredAs(attribute, value), color: value.color ?? 'grey' })) : [],
  decidedBy: attribute.decidedBy,
  elo: attribute.elo,
});

/** The values of one attribute a filter keeps, as a configuration names them; none for an attribute or a value that is gone. */
function valuesTold([key, values]: [string, string[]], attributes: Attribute[]): [string, string[]][] {
  const attribute = attributes.find((one) => one.key === key);
  const named = attribute ? attribute.values.filter((value) => values.includes(value.key)).map((value) => valueConfiguredAs(attribute, value)) : [];
  return attribute && named.length ? [[attributeConfiguredAs(attribute), named]] : [];
}

function conditionsTold(conditions: ReversibleConditions, { attributes, mailboxes }: Known): ConditionsConfigured {
  const told: ConditionsConfigured = {};
  const values = Object.entries(conditions.attributes ?? {}).flatMap((entry) => valuesTold(entry, attributes));
  const addresses = [...new Set(mailboxes.filter(({ id }) => conditions.mailbox?.includes(id)).map(({ email }) => email))];
  if (values.length) told.attributes = Object.fromEntries(values);
  if (addresses.length) told.mailbox = addresses;
  if (conditions.from) told.from = conditions.from;
  if (conditions.keywords) told.keywords = conditions.keywords;
  return told;
}

/** A filter as a configuration tells it. What it names that is gone, or that who asks may not use, is left out. */
export function filterConfigured(filter: BoardFilter, known: Known): FilterConfigured {
  const told: FilterConfigured = conditionsTold(filter, known);
  const except = conditionsTold(filter.except ?? {}, known);
  if (filter.received) told.received = filter.received;
  if (filter.attachment !== undefined) told.attachment = filter.attachment;
  if (Object.keys(except).length) told.except = except;
  return told;
}

/** The configuration of an organisation: its attributes, then the boards its members share. */
export const configurationTold = (known: Known, boards: BoardKept[]): Configuration => ({
  attributes: known.attributes.map(attributeConfigured),
  boards: boards.map(({ name, filter }) => ({ name, filter: filterConfigured(filter, known) })),
});

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
const records = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.map(record) : []);
const texts = (value: unknown): string[] => (Array.isArray(value) ? [...new Set(value.map((one) => clipped(one, 320)).filter(Boolean))] : []);

function conditionsGiven(given: Record<string, unknown>): ConditionsConfigured {
  const kept: ConditionsConfigured = {};
  const values = Object.entries(record(given.attributes)).map(([name, said]): [string, string[]] => [clipped(name, 60), texts(said)]).filter(([name, said]) => name && said.length);
  if (values.length) kept.attributes = Object.fromEntries(values);
  if (texts(given.mailbox).length) kept.mailbox = texts(given.mailbox).map((address) => address.toLowerCase());
  if (clipped(given.from, 200)) kept.from = clipped(given.from, 200);
  if (clipped(given.keywords, 200)) kept.keywords = clipped(given.keywords, 200);
  return kept;
}

/** A filter of a configuration as it is given: only what a filter may say, only the conditions that say something. */
export function filterConfiguredGiven(value: unknown): FilterConfigured {
  const given = record(value);
  const filter: FilterConfigured = conditionsGiven(given);
  const { received, attachment } = filterGiven({ received: given.received, attachment: given.attachment });
  const except = conditionsGiven(record(given.except));
  if (received) filter.received = received;
  if (attachment !== undefined) filter.attachment = attachment;
  if (Object.keys(except).length) filter.except = except;
  return filter;
}

/** A configuration as it was given: its attributes as they came, each still to be checked; its boards reduced to a name and what a filter may say. */
export interface ConfigurationGiven {
  attributes: Record<string, unknown>[];
  boards: BoardConfigured[];
}

/** What is given as a configuration, whatever it is: what is not a list of attributes or of boards is an empty one. */
export const configurationGiven = (value: unknown): ConfigurationGiven => ({
  attributes: records(record(value).attributes),
  boards: records(record(value).boards).map((board) => ({ name: clipped(board.name, 80), filter: filterConfiguredGiven(board.filter) })),
});
